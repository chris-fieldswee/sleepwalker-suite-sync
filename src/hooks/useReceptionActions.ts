// src/hooks/useReceptionActions.ts
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";
import type { Room, Staff } from './useReceptionData';
import { taskInputSchema, workLogSchema } from '@/lib/validation';
// *** MODIFICATION: Import useAuth ***
import { useAuth } from '@/contexts/AuthContext';
// Import IssueTask type if defined separately, or use inline definition
import type { IssueTask } from '@/components/reception/IssueDetailDialog'; // Assuming IssueTask includes issue_flag

type CleaningType = Database["public"]["Enums"]["cleaning_type"];
// Remove TaskStatus if only using issue_flag
// type TaskStatus = Database["public"]["Enums"]["task_status"];

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
    // *** Add callbacks for task updates/deletes ***
    onTaskUpdated?: () => void,
    onTaskDeleted?: () => void,
) {
  const { toast } = useToast();
  // *** MODIFICATION: Call useAuth hook ***
  const { userId } = useAuth();
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [isSubmittingNewIssue, setIsSubmittingNewIssue] = useState(false);
  const [isUpdatingIssue, setIsUpdatingIssue] = useState(false);
  // *** Add states for task update/delete ***
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  // --- handleAddTask remains the same ---
    const handleAddTask = async (newTask: NewTaskState): Promise<boolean> => {
        // ... (implementation unchanged) ...
        const validation = taskInputSchema.safeParse({ /* ... */ });
        if (!validation.success) { /* ... toast ... */ return false; }
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


  // --- handleSaveWorkLog remains the same ---
    const handleSaveWorkLog = async (logData: any): Promise<boolean> => {
       // ... (implementation unchanged) ...
        const validation = workLogSchema.safeParse({ /* ... */ });
        if (!validation.success) { /* ... toast ... */ return false; }
        setIsSavingLog(true);
        let success = false;
        try {
            // Convert time strings to ISO format if they exist
            const formatTime = (timeStr: string | null | undefined): string | null => {
                if (!timeStr) return null;
                // Assuming timeStr is "HH:mm"
                const today = new Date(logData.date + 'T00:00:00Z'); // Use provided date in UTC
                const [hours, minutes] = timeStr.split(':').map(Number);
                 if (isNaN(hours) || isNaN(minutes)) return null; // Invalid time format
                today.setUTCHours(hours, minutes, 0, 0); // Set UTC hours/minutes
                return today.toISOString();
            };

             // Calculate total minutes if possible
             let calculatedTotalMinutes: number | null = null;
             if (validation.data.time_in && validation.data.time_out) {
                 try {
                     const timeInDate = new Date(formatTime(validation.data.time_in) || 0);
                     const timeOutDate = new Date(formatTime(validation.data.time_out) || 0);
                     if (!isNaN(timeInDate.getTime()) && !isNaN(timeOutDate.getTime())) {
                         const diffMs = timeOutDate.getTime() - timeInDate.getTime();
                         calculatedTotalMinutes = Math.max(0, Math.round(diffMs / 60000)); // Total duration in minutes
                     }
                 } catch (e) {
                     console.error("Error calculating total minutes from times:", e);
                 }
             }


            const { error } = await supabase.from("work_logs").upsert({
                id: logData.id, // Include ID for upsert
                user_id: validation.data.user_id,
                date: validation.data.date,
                time_in: formatTime(validation.data.time_in), // Format for TIMESTAMPTZ
                time_out: formatTime(validation.data.time_out), // Format for TIMESTAMPTZ
                break_minutes: validation.data.break_minutes,
                // Add laundry and breakfast if needed from validation.data
                // laundry_minutes: validation.data.laundry_minutes,
                // breakfast_minutes: validation.data.breakfast_minutes,
                total_minutes: calculatedTotalMinutes, // Use calculated value
                notes: validation.data.notes
            }, { onConflict: 'user_id, date' }); // Specify conflict columns

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

  // --- handleReportNewIssue remains the same ---
   const handleReportNewIssue = async (roomId: string, description: string, photo: File | null): Promise<boolean> => {
       // ... (implementation unchanged) ...
        if (!roomId || !description.trim()) { /* ... toast ... */ return false; }
        if (description.length > 5000) { /* ... toast ... */ return false; }
        setIsSubmittingNewIssue(true);
        let success = false;
        let photoUrl: string | null = null;
        let filePath: string | undefined = undefined;
        try {
            // Photo upload logic...
            if (photo && userId) {
                const fileExt = photo.name.split('.').pop();
                const fileName = `${userId}_issue_${Date.now()}.${fileExt}`;
                filePath = `issue_photos/${fileName}`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('task_issues')
                    .upload(filePath, photo);

                if (uploadError) {
                    throw new Error(`Photo upload failed: ${uploadError.message}`);
                }
                if (uploadData) {
                    const { data: urlData } = supabase.storage.from('task_issues').getPublicUrl(filePath);
                    photoUrl = urlData?.publicUrl || null;
                } else {
                     throw new Error('Photo upload failed unexpectedly.');
                }
            }


            const taskToInsert = {
                room_id: roomId,
                date: getTodayDateString(),
                cleaning_type: 'O' as CleaningType, // Consider making this dynamic if needed
                guest_count: 1, // Default guest count for issue tasks
                status: 'repair_needed' as const,
                issue_flag: true,
                issue_description: description,
                issue_photo: photoUrl,
            };

            const { error: insertError } = await supabase.from('tasks').insert(taskToInsert);
             if (insertError) {
                 if (photoUrl && filePath) { /* ... delete photo on failure ... */
                    console.warn("Database insert failed, attempting to delete uploaded photo:", filePath);
                    await supabase.storage.from('task_issues').remove([filePath]);
                 }
                 throw insertError;
             }
            const roomName = availableRooms.find(r => r.id === roomId)?.name || 'Unknown Room';
            toast({ title: "Issue Reported", description: `New issue task created for ${roomName}.` });
            onIssueReported?.(); // Trigger refresh
            success = true;
        } catch (error: any) {
            console.error("Error reporting new issue:", error);
            toast({ title: "Error Reporting Issue", description: error.message, variant: "destructive" });
        }
        finally { setIsSubmittingNewIssue(false); }
        return success;
    };


  // --- handleUpdateIssue remains the same ---
    const handleUpdateIssue = async (
        taskId: string,
        updates: Partial<{
            issue_flag: boolean | null;
            reception_notes: string | null;
            user_id: string | null
        }>
    ): Promise<boolean> => {
        // ... (implementation unchanged) ...
        setIsUpdatingIssue(true);
        let success = false;
        try {
             // ... validation ...
              if (updates.reception_notes && updates.reception_notes.length > 2000) {
                  throw new Error("Reception notes cannot exceed 2000 characters.");
              }
             const finalUpdates: Partial<Database["public"]["Tables"]["tasks"]["Update"]> = {
                user_id: updates.user_id,
                reception_notes: updates.reception_notes,
                issue_flag: updates.issue_flag
             };
             // Optionally add logic to change status when issue_flag changes
             if (updates.issue_flag === false) {
                 // Example: Set status to 'todo' or 'done' when issue is fixed
                 // This depends on the desired workflow
                 // finalUpdates.status = 'todo';
             }

             const { error } = await supabase.from('tasks').update(finalUpdates).eq('id', taskId);
             if (error) throw error;
             toast({ title: "Issue Updated"});
             onIssueUpdated?.(); // Trigger refresh
             success = true;
        } catch (error: any) {
            console.error("Error updating issue:", error);
            toast({ title: "Error Updating Issue", description: error.message, variant: "destructive" });
        }
        finally { setIsUpdatingIssue(false); }
        return success;
    };

  // --- handleUpdateTask remains the same ---
  const handleUpdateTask = async (taskId: string, updates: Partial<EditableTaskState>): Promise<boolean> => {
      setIsUpdatingTask(true);
      let success = false;
      try {
          // 1. Prepare data for Supabase (map state names to DB column names)
          const dbUpdates: Partial<Database["public"]["Tables"]["tasks"]["Update"]> = {};
          let needsLimitCheck = false;

          if (updates.roomId !== undefined) { dbUpdates.room_id = updates.roomId; needsLimitCheck = true; }
          if (updates.cleaningType !== undefined) { dbUpdates.cleaning_type = updates.cleaningType; needsLimitCheck = true; }
          if (updates.guestCount !== undefined) { dbUpdates.guest_count = updates.guestCount; needsLimitCheck = true; }
          if (updates.staffId !== undefined) { dbUpdates.user_id = updates.staffId === 'unassigned' ? null : updates.staffId; }
          if (updates.notes !== undefined) { dbUpdates.reception_notes = updates.notes || null; }
          if (updates.date !== undefined) { dbUpdates.date = updates.date; }
          if (updates.timeLimit !== undefined) { dbUpdates.time_limit = updates.timeLimit; } // Allow direct update if provided
          else if (needsLimitCheck) {
             // 2. Fetch new time limit if relevant fields changed and timeLimit wasn't explicitly set
             // Get current cleaning_type and guest_count first
              const { data: currentTaskInfo, error: currentInfoError } = await supabase
                 .from('tasks')
                 .select('cleaning_type, guest_count, room:rooms!inner(group_type)')
                 .eq('id', taskId)
                 .single();

             if (currentInfoError || !currentTaskInfo) {
                  throw new Error("Could not fetch current task info for limit check.");
             }

             // Determine the values to use for the limit query
             const groupType = updates.roomId
                 ? availableRooms.find(r => r.id === updates.roomId)?.group_type
                 : currentTaskInfo.room.group_type; // Use fetched group_type
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
                  dbUpdates.time_limit = limitData?.time_limit ?? null; // Update time_limit based on changes
             } else {
                 console.warn("Could not determine all required fields for time limit check.");
                 dbUpdates.time_limit = null; // Set to null if unable to determine
             }
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


  // --- handleDeleteTask remains the same ---
  const handleDeleteTask = async (taskId: string): Promise<boolean> => {
      // ... (implementation unchanged) ...
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
      // *** Export new handlers and states ***
      handleUpdateTask,
      isUpdatingTask,
      handleDeleteTask,
      isDeletingTask,
  };
}
