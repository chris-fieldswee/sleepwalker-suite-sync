// src/hooks/useReceptionActions.ts
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";
import type { Room, Staff } from './useReceptionData';
import { taskInputSchema, workLogSchema } from '@/lib/validation';
// ==========================================
// ===== VERIFY THIS IMPORT LINE EXISTS =====
import { useAuth } from '@/contexts/AuthContext';
// ==========================================
import type { IssueTask } from '@/components/reception/IssueDetailDialog'; // Assuming IssueTask includes issue_flag

type CleaningType = Database["public"]["Enums"]["cleaning_type"];

export interface NewTaskState {
    roomId: string;
    cleaningType: CleaningType;
    guestCount: number;
    staffId: string | 'unassigned';
    notes: string;
    date: string;
}

// Interface for editable fields in Detail Dialog
export interface EditableTaskState {
    roomId: string;
    cleaningType: CleaningType;
    guestCount: number;
    staffId: string | 'unassigned';
    notes: string; // Corresponds to reception_notes
    date: string;
    timeLimit: number | null;
}


const getTodayDateString = () => new Date().toISOString().split("T")[0];

const initialNewTaskState: NewTaskState = {
    roomId: "",
    cleaningType: "W",
    guestCount: 2,
    staffId: "unassigned",
    notes: "",
    date: getTodayDateString(),
};


export function useReceptionActions(
    availableRooms: Room[],
    onTaskAdded?: () => void,
    onWorkLogSaved?: () => void,
    onIssueReported?: () => void,
    onIssueUpdated?: () => void,
    onTaskUpdated?: () => void,
    onTaskDeleted?: () => void,
) {
  const { toast } = useToast();
  // ============================================
  // ===== VERIFY THIS HOOK CALL IS INSIDE =====
  const { userId } = useAuth();
  // ============================================
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [isSubmittingNewIssue, setIsSubmittingNewIssue] = useState(false);
  const [isUpdatingIssue, setIsUpdatingIssue] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  // --- handleAddTask ---
    const handleAddTask = async (newTask: NewTaskState): Promise<boolean> => {
        const validation = taskInputSchema.safeParse({
          cleaning_type: newTask.cleaningType,
          guest_count: newTask.guestCount,
          reception_notes: newTask.notes,
          date: newTask.date,
          room_id: newTask.roomId,
        });

        if (!validation.success) {
          toast({
            title: "Validation Error",
            description: validation.error.errors[0].message,
            variant: "destructive"
          });
          return false;
        }

        setIsSubmittingTask(true);
        let success = false;
        try {
            const selectedRoom = availableRooms.find(r => r.id === newTask.roomId);
            if (!selectedRoom) throw new Error("Selected room not found.");

            // Fetch time limit (consider optimizing if limits rarely change)
            const { data: limitData, error: limitError } = await supabase
                .from('limits')
                .select('time_limit')
                .eq('group_type', selectedRoom.group_type)
                .eq('cleaning_type', newTask.cleaningType)
                .eq('guest_count', newTask.guestCount)
                .maybeSingle();

            if (limitError) console.warn(`Could not fetch time limit: ${limitError.message}. Proceeding without limit.`);
            const timeLimit = limitData?.time_limit ?? null;

            const taskToInsert = {
                date: newTask.date,
                room_id: newTask.roomId,
                cleaning_type: newTask.cleaningType,
                guest_count: newTask.guestCount,
                time_limit: timeLimit,
                reception_notes: newTask.notes || null,
                user_id: newTask.staffId === 'unassigned' ? null : newTask.staffId,
                status: 'todo' as const,
            };

            const { error: insertError } = await supabase.from('tasks').insert(taskToInsert);
            if (insertError) throw insertError;

            toast({ title: "Task Added Successfully", description: `Task for ${selectedRoom.name} on ${newTask.date} created.` });
            onTaskAdded?.(); // Trigger refresh/update in parent
            success = true;

        } catch (error: any) {
            console.error("Error adding task:", error);
            toast({ title: "Error Adding Task", description: error.message, variant: "destructive" });
        } finally {
            setIsSubmittingTask(false);
        }
        return success;
    };


  // --- handleSaveWorkLog ---
    const handleSaveWorkLog = async (logData: any): Promise<boolean> => {
       const validation = workLogSchema.safeParse({
         user_id: logData.user_id,
         date: logData.date,
         time_in: logData.time_in || null, // Allow null
         time_out: logData.time_out || null, // Allow null
         break_minutes: logData.break_minutes || 0,
         laundry_minutes: logData.laundry_minutes || 0, // Assuming these exist if needed
         breakfast_minutes: logData.breakfast_minutes || 0, // Assuming these exist if needed
         total_minutes: logData.total_minutes || null, // Allow null, will recalculate
         notes: logData.notes || '',
       });


       if (!validation.success) {
         toast({
           title: "Validation Error",
           description: validation.error.errors[0].message,
           variant: "destructive"
         });
         return false;
       }

        setIsSavingLog(true);
        let success = false;
        try {
            // Convert time strings to ISO format if they exist
            const formatTime = (timeStr: string | null | undefined): string | null => {
                if (!timeStr) return null;
                // Use the provided log date and ensure UTC interpretation
                const baseDate = new Date(validation.data.date + 'T00:00:00Z');
                 if (isNaN(baseDate.getTime())) {
                     console.error("Invalid base date for time formatting:", validation.data.date);
                     return null; // Invalid date provided
                 }
                const [hours, minutes] = timeStr.split(':').map(Number);
                 if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                    console.error("Invalid time format detected:", timeStr);
                    return null; // Invalid time format
                 }
                baseDate.setUTCHours(hours, minutes, 0, 0); // Set UTC hours/minutes
                return baseDate.toISOString();
            };

             // Calculate total minutes based on formatted times
             let calculatedTotalMinutes: number | null = null;
             const isoTimeIn = formatTime(validation.data.time_in);
             const isoTimeOut = formatTime(validation.data.time_out);

             if (isoTimeIn && isoTimeOut) {
                 try {
                     const timeInDate = new Date(isoTimeIn);
                     const timeOutDate = new Date(isoTimeOut);
                     if (!isNaN(timeInDate.getTime()) && !isNaN(timeOutDate.getTime())) {
                         const diffMs = timeOutDate.getTime() - timeInDate.getTime();
                         // Subtract break minutes from the total difference
                         const netMinutes = Math.round(diffMs / 60000) - (validation.data.break_minutes ?? 0);
                         calculatedTotalMinutes = Math.max(0, netMinutes);
                     }
                 } catch (e) {
                     console.error("Error calculating total minutes from times:", e);
                 }
             }

            const upsertData: Database["public"]["Tables"]["work_logs"]["Insert"] = {
                // id: logData.id, // Supabase handles ID generation or matching for upsert
                user_id: validation.data.user_id,
                date: validation.data.date,
                time_in: isoTimeIn, // Use ISO formatted time
                time_out: isoTimeOut, // Use ISO formatted time
                break_minutes: validation.data.break_minutes,
                laundry_minutes: validation.data.laundry_minutes,
                breakfast_minutes: validation.data.breakfast_minutes,
                total_minutes: calculatedTotalMinutes, // Use calculated net value
                notes: validation.data.notes || null, // Ensure null if empty string
             };

             // Remove id if it's undefined or null before upserting, to let DB handle generation if it's a new record
             if (!logData.id) {
                 delete (upsertData as any).id;
             } else {
                 (upsertData as any).id = logData.id;
             }


            const { error } = await supabase.from("work_logs").upsert(
                upsertData as any, // Cast because Supabase types might be strict about `id` presence
                { onConflict: 'user_id, date' } // Specify conflict columns
             );


            if (error) throw error;

            toast({ title: "Work Log Saved", description: "Work log updated successfully." });
            onWorkLogSaved?.(); // Trigger refresh
            success = true;
        } catch (error: any) {
            console.error("Error saving work log:", error);
            toast({ title: "Error Saving Log", description: error.message, variant: "destructive" });
        } finally {
            setIsSavingLog(false);
        }
        return success;
    };

  // --- handleReportNewIssue ---
   const handleReportNewIssue = async (roomId: string, description: string, photo: File | null): Promise<boolean> => {
        if (!roomId || !description.trim()) {
          toast({ title: "Missing Information", description: "Room and description are required.", variant: "destructive" });
          return false;
        }
         if (description.length > 5000) {
              toast({ title: "Description Too Long", description: "Description must be less than 5000 characters.", variant: "destructive" });
              return false;
         }

        setIsSubmittingNewIssue(true);
        let success = false;
        let photoUrl: string | null = null;
        let filePath: string | undefined = undefined;

        try {
            if (photo && userId) { // Check userId here
                const fileExt = photo.name.split('.').pop();
                // Ensure userId is part of the filename for easier tracking
                const fileName = `${userId}_issue_${Date.now()}.${fileExt}`;
                filePath = `issue_photos/${fileName}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('task_issues') // Ensure this bucket exists and has correct policies
                    .upload(filePath, photo);

                if (uploadError) {
                    throw new Error(`Photo upload failed: ${uploadError.message}`);
                }
                if (uploadData) {
                    // Get public URL *after* successful upload
                    const { data: urlData } = supabase.storage.from('task_issues').getPublicUrl(filePath);
                    photoUrl = urlData?.publicUrl || null;
                     if (!photoUrl) {
                        console.warn("Could not get public URL for uploaded photo:", filePath);
                        // Decide if this is a critical error or not. Maybe proceed without URL?
                     }
                } else {
                     throw new Error('Photo upload failed unexpectedly (no data returned).');
                }
            } else if (photo && !userId) {
                // Handle case where photo is provided but userId isn't available (shouldn't happen if auth is set up)
                console.error("Cannot upload photo: User ID is not available.");
                toast({ title: "Upload Error", description: "Could not upload photo, user not identified.", variant: "destructive" });
                setIsSubmittingNewIssue(false);
                return false;
            }


            // Create a dedicated 'issue' task
            const taskToInsert = {
                room_id: roomId,
                date: getTodayDateString(),
                cleaning_type: 'O' as CleaningType, // 'O' for Other/Issue
                guest_count: 1, // Default guest count for issue tasks
                status: 'repair_needed' as const, // Set status directly
                issue_flag: true, // Explicitly set flag
                issue_description: description,
                issue_photo: photoUrl,
                // Assign to no one initially, can be assigned later
                user_id: null,
                time_limit: null, // No time limit typically
            };

            const { error: insertError } = await supabase.from('tasks').insert(taskToInsert);

            if (insertError) {
                // Attempt to clean up uploaded photo if DB insert fails
                if (photoUrl && filePath) {
                    console.warn("Database insert failed, attempting to delete uploaded photo:", filePath);
                    await supabase.storage.from('task_issues').remove([filePath]);
                }
                throw insertError;
            }

            const roomName = availableRooms.find(r => r.id === roomId)?.name || 'Unknown Room';
            toast({ title: "Issue Reported Successfully", description: `New issue task created for ${roomName}.` });
            onIssueReported?.(); // Trigger refresh
            success = true;

        } catch (error: any) {
            console.error("Error reporting new issue:", error);
            toast({ title: "Error Reporting Issue", description: error.message, variant: "destructive" });
            success = false;
        } finally {
            setIsSubmittingNewIssue(false);
        }
        return success;
    };


  // --- handleUpdateIssue ---
    const handleUpdateIssue = async (
        taskId: string,
        updates: Partial<{
            issue_flag: boolean | null;
            reception_notes: string | null;
            user_id: string | null | 'unassigned'; // Allow 'unassigned'
        }>
    ): Promise<boolean> => {
        setIsUpdatingIssue(true);
        let success = false;
        try {
             if (updates.reception_notes && updates.reception_notes.length > 2000) {
                 throw new Error("Reception notes cannot exceed 2000 characters.");
             }

             const finalUpdates: Partial<Database["public"]["Tables"]["tasks"]["Update"]> = {
                 // Map user_id correctly (null if 'unassigned')
                 user_id: updates.user_id === 'unassigned' ? null : updates.user_id,
                 reception_notes: updates.reception_notes, // Already allows null
                 issue_flag: updates.issue_flag // Directly update issue_flag
             };

            // Optionally, adjust status based on issue_flag change
             if (updates.issue_flag === false) {
                 // When marking as fixed, set status back to 'todo' (or 'done' if stop_time exists?)
                 // Let's assume 'todo' is the desired state after fixing.
                 finalUpdates.status = 'todo';
                 // Consider if you need to clear issue_description/photo here
                 // finalUpdates.issue_description = null;
                 // finalUpdates.issue_photo = null;
             } else if (updates.issue_flag === true) {
                 // If somehow marking as *not* fixed, ensure status is 'repair_needed'
                 finalUpdates.status = 'repair_needed';
             }


            const { error } = await supabase
                .from('tasks')
                .update(finalUpdates)
                .eq('id', taskId);

            if (error) throw error;

            toast({ title: "Issue Updated", description: "Issue status and details have been saved." });
            onIssueUpdated?.(); // Trigger refresh
            success = true;
        } catch (error: any) {
            console.error("Error updating issue:", error);
            toast({ title: "Error Updating Issue", description: error.message, variant: "destructive" });
            success = false;
        } finally {
            setIsUpdatingIssue(false);
        }
        return success;
    };

  // --- handleUpdateTask ---
  const handleUpdateTask = async (taskId: string, updates: Partial<EditableTaskState>): Promise<boolean> => {
      setIsUpdatingTask(true);
      let success = false;
      try {
          // 1. Prepare data for Supabase
          const dbUpdates: Partial<Database["public"]["Tables"]["tasks"]["Update"]> = {};
          let needsLimitCheck = false;

          // Map fields and check if limit needs recalculation
          if (updates.roomId !== undefined) { dbUpdates.room_id = updates.roomId; needsLimitCheck = true; }
          if (updates.cleaningType !== undefined) { dbUpdates.cleaning_type = updates.cleaningType; needsLimitCheck = true; }
          if (updates.guestCount !== undefined) { dbUpdates.guest_count = updates.guestCount; needsLimitCheck = true; }
          if (updates.staffId !== undefined) { dbUpdates.user_id = updates.staffId === 'unassigned' ? null : updates.staffId; }
          if (updates.notes !== undefined) { dbUpdates.reception_notes = updates.notes || null; }
          if (updates.date !== undefined) { dbUpdates.date = updates.date; }
          // Handle timeLimit: Only set if explicitly provided OR if related fields changed
          if (updates.timeLimit !== undefined) {
             dbUpdates.time_limit = updates.timeLimit; // Explicitly set
          } else if (needsLimitCheck) {
             // Fetch current task info if needed for limit check
              const { data: currentTaskInfo, error: currentInfoError } = await supabase
                 .from('tasks')
                 .select('cleaning_type, guest_count, room_id, room:rooms!inner(group_type)') // Select room_id too
                 .eq('id', taskId)
                 .single();

              if (currentInfoError || !currentTaskInfo) {
                   console.error("Error fetching current task info:", currentInfoError);
                   throw new Error("Could not fetch current task info for limit check.");
              }

             // Determine the values to use for the limit query
              const finalRoomId = updates.roomId ?? currentTaskInfo.room_id; // Use updated roomId if available, else current

              const room = availableRooms.find(r => r.id === finalRoomId);
              const groupType = room?.group_type;
              const cleaningType = updates.cleaningType ?? currentTaskInfo.cleaning_type;
              const guestCount = updates.guestCount ?? currentTaskInfo.guest_count;


             if (groupType && cleaningType && guestCount) {
                  const { data: limitData, error: limitError } = await supabase
                     .from('limits')
                     .select('time_limit')
                     .eq('group_type', groupType)
                     .eq('cleaning_type', cleaningType)
                     .eq('guest_count', guestCount)
                     .maybeSingle();

                  if (limitError) console.warn("Could not fetch new time limit during update:", limitError.message);
                  dbUpdates.time_limit = limitData?.time_limit ?? null; // Update time_limit
             } else {
                 console.warn("Could not determine all required fields (groupType, cleaningType, guestCount) for time limit check. Setting limit to null.");
                 dbUpdates.time_limit = null; // Set to null if unable to determine
             }
          }

          // Ensure there are updates to send
          if (Object.keys(dbUpdates).length === 0) {
              toast({ title: "No Changes Detected", description: "Task details were not modified." });
              setIsUpdatingTask(false);
              return true; // Indicate success (no-op)
          }


          // 3. Perform the update
          const { error } = await supabase
              .from('tasks')
              .update(dbUpdates)
              .eq('id', taskId);

          if (error) throw error;

          toast({ title: "Task Updated", description: "Task details saved successfully." });
          onTaskUpdated?.(); // Trigger refresh/update in parent
          success = true;

      } catch (error: any) {
          console.error("Error updating task:", error);
          toast({ title: "Error Updating Task", description: error.message, variant: "destructive" });
          success = false;
      } finally {
          setIsUpdatingTask(false);
      }
      return success;
  };


  // --- handleDeleteTask ---
  const handleDeleteTask = async (taskId: string): Promise<boolean> => {
      // Prevent deleting tasks that are in progress or paused? (Optional business logic)
       // const { data: taskStatus, error: fetchErr } = await supabase.from('tasks').select('status').eq('id', taskId).single();
       // if (taskStatus && (taskStatus.status === 'in_progress' || taskStatus.status === 'paused')) {
       //     toast({ title: "Action Denied", description: "Cannot delete a task that is currently in progress or paused.", variant: "destructive" });
       //     return false;
       // }

      setIsDeletingTask(true);
      let success = false;
      try {
          const { error } = await supabase
              .from('tasks')
              .delete()
              .eq('id', taskId);

          if (error) throw error;

          toast({ title: "Task Deleted", description: "The task has been successfully removed." });
          onTaskDeleted?.(); // Trigger refresh/update in parent
          success = true;

      } catch (error: any) {
          console.error("Error deleting task:", error);
          toast({ title: "Error Deleting Task", description: error.message, variant: "destructive" });
          success = false;
      } finally {
          setIsDeletingTask(false);
      }
      return success;
  };

  return {
      handleAddTask,
      isSubmittingTask,
      handleSaveWorkLog,
      isSavingLog,
      initialNewTaskState,
      handleReportNewIssue,
      isSubmittingNewIssue,
      handleUpdateIssue,
      isUpdatingIssue,
      handleUpdateTask,
      isUpdatingTask,
      handleDeleteTask,
      isDeletingTask,
  };
}
