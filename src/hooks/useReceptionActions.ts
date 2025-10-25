// src/hooks/useReceptionActions.ts
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";
import type { Room, Staff } from './useReceptionData';
import { taskInputSchema, workLogSchema } from '@/lib/validation';
import { useAuth } from '@/contexts/AuthContext'; // ✅ FIXED: Import added
import type { IssueTask } from '@/components/reception/IssueDetailDialog';

type CleaningType = Database["public"]["Enums"]["cleaning_type"];

export interface NewTaskState {
    roomId: string;
    cleaningType: CleaningType;
    guestCount: number;
    staffId: string | 'unassigned';
    notes: string;
    date: string;
}

export interface EditableTaskState {
    roomId: string;
    cleaningType: CleaningType;
    guestCount: number;
    staffId: string | 'unassigned';
    notes: string;
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
  const { userId } = useAuth(); // ✅ FIXED: Hook call added
  
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
            onTaskAdded?.();
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
         time_in: logData.time_in || null,
         time_out: logData.time_out || null,
         break_minutes: logData.break_minutes || 0,
         laundry_minutes: logData.laundry_minutes || 0,
         breakfast_minutes: logData.breakfast_minutes || 0,
         total_minutes: logData.total_minutes || null,
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
            const formatTime = (timeStr: string | null | undefined): string | null => {
                if (!timeStr) return null;
                const baseDate = new Date(validation.data.date + 'T00:00:00Z');
                 if (isNaN(baseDate.getTime())) {
                     console.error("Invalid base date for time formatting:", validation.data.date);
                     return null;
                 }
                const [hours, minutes] = timeStr.split(':').map(Number);
                 if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                    console.error("Invalid time format detected:", timeStr);
                    return null;
                 }
                baseDate.setUTCHours(hours, minutes, 0, 0);
                return baseDate.toISOString();
            };

             let calculatedTotalMinutes: number | null = null;
             const isoTimeIn = formatTime(validation.data.time_in);
             const isoTimeOut = formatTime(validation.data.time_out);

             if (isoTimeIn && isoTimeOut) {
                 try {
                     const timeInDate = new Date(isoTimeIn);
                     const timeOutDate = new Date(isoTimeOut);
                     if (!isNaN(timeInDate.getTime()) && !isNaN(timeOutDate.getTime())) {
                         const diffMs = timeOutDate.getTime() - timeInDate.getTime();
                         const netMinutes = Math.round(diffMs / 60000) - (validation.data.break_minutes ?? 0);
                         calculatedTotalMinutes = Math.max(0, netMinutes);
                     }
                 } catch (e) {
                     console.error("Error calculating total minutes from times:", e);
                 }
             }

            const upsertData: Database["public"]["Tables"]["work_logs"]["Insert"] = {
                user_id: validation.data.user_id,
                date: validation.data.date,
                time_in: isoTimeIn,
                time_out: isoTimeOut,
                break_minutes: validation.data.break_minutes,
                laundry_minutes: validation.data.laundry_minutes,
                breakfast_minutes: validation.data.breakfast_minutes,
                total_minutes: calculatedTotalMinutes,
                notes: validation.data.notes || null,
             };

             if (!logData.id) {
                 delete (upsertData as any).id;
             } else {
                 (upsertData as any).id = logData.id;
             }

            const { error } = await supabase.from("work_logs").upsert(
                upsertData as any,
                { onConflict: 'user_id, date' }
             );

            if (error) throw error;

            toast({ title: "Work Log Saved", description: "Work log updated successfully." });
            onWorkLogSaved?.();
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
                     if (!photoUrl) {
                        console.warn("Could not get public URL for uploaded photo:", filePath);
                     }
                } else {
                     throw new Error('Photo upload failed unexpectedly (no data returned).');
                }
            } else if (photo && !userId) {
                console.error("Cannot upload photo: User ID is not available.");
                toast({ title: "Upload Error", description: "Could not upload photo, user not identified.", variant: "destructive" });
                setIsSubmittingNewIssue(false);
                return false;
            }

            const taskToInsert = {
                room_id: roomId,
                date: getTodayDateString(),
                cleaning_type: 'O' as CleaningType,
                guest_count: 1,
                status: 'repair_needed' as const,
                issue_flag: true,
                issue_description: description,
                issue_photo: photoUrl,
                user_id: null,
                time_limit: null,
            };

            const { error: insertError } = await supabase.from('tasks').insert(taskToInsert);

            if (insertError) {
                if (photoUrl && filePath) {
                    console.warn("Database insert failed, attempting to delete uploaded photo:", filePath);
                    await supabase.storage.from('task_issues').remove([filePath]);
                }
                throw insertError;
            }

            const roomName = availableRooms.find(r => r.id === roomId)?.name || 'Unknown Room';
            toast({ title: "Issue Reported Successfully", description: `New issue task created for ${roomName}.` });
            onIssueReported?.();
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
            user_id: string | null | 'unassigned';
        }>
    ): Promise<boolean> => {
        setIsUpdatingIssue(true);
        let success = false;
        try {
             if (updates.reception_notes && updates.reception_notes.length > 2000) {
                 throw new Error("Reception notes cannot exceed 2000 characters.");
             }

             const finalUpdates: Partial<Database["public"]["Tables"]["tasks"]["Update"]> = {
                 user_id: updates.user_id === 'unassigned' ? null : updates.user_id,
                 reception_notes: updates.reception_notes,
                 issue_flag: updates.issue_flag
             };

             if (updates.issue_flag === false) {
                 finalUpdates.status = 'todo';
             } else if (updates.issue_flag === true) {
                 finalUpdates.status = 'repair_needed';
             }

            const { error } = await supabase
                .from('tasks')
                .update(finalUpdates)
                .eq('id', taskId);

            if (error) throw error;

            toast({ title: "Issue Updated", description: "Issue status and details have been saved." });
            onIssueUpdated?.();
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
          const dbUpdates: Partial<Database["public"]["Tables"]["tasks"]["Update"]> = {};
          let needsLimitCheck = false;

          if (updates.roomId !== undefined) { dbUpdates.room_id = updates.roomId; needsLimitCheck = true; }
          if (updates.cleaningType !== undefined) { dbUpdates.cleaning_type = updates.cleaningType; needsLimitCheck = true; }
          if (updates.guestCount !== undefined) { dbUpdates.guest_count = updates.guestCount; needsLimitCheck = true; }
          if (updates.staffId !== undefined) { dbUpdates.user_id = updates.staffId === 'unassigned' ? null : updates.staffId; }
          if (updates.notes !== undefined) { dbUpdates.reception_notes = updates.notes || null; }
          if (updates.date !== undefined) { dbUpdates.date = updates.date; }
          
          if (updates.timeLimit !== undefined) {
             dbUpdates.time_limit = updates.timeLimit;
          } else if (needsLimitCheck) {
              const { data: currentTaskInfo, error: currentInfoError } = await supabase
                 .from('tasks')
                 .select('cleaning_type, guest_count, room_id, room:rooms!inner(group_type)')
                 .eq('id', taskId)
                 .single();

              if (currentInfoError || !currentTaskInfo) {
                   console.error("Error fetching current task info:", currentInfoError);
                   throw new Error("Could not fetch current task info for limit check.");
              }

              const finalRoomId = updates.roomId ?? currentTaskInfo.room_id;
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
                  dbUpdates.time_limit = limitData?.time_limit ?? null;
             } else {
                 console.warn("Could not determine all required fields for time limit check. Setting limit to null.");
                 dbUpdates.time_limit = null;
             }
          }

          if (Object.keys(dbUpdates).length === 0) {
              toast({ title: "No Changes Detected", description: "Task details were not modified." });
              setIsUpdatingTask(false);
              return true;
          }

          const { error } = await supabase
              .from('tasks')
              .update(dbUpdates)
              .eq('id', taskId);

          if (error) throw error;

          toast({ title: "Task Updated", description: "Task details saved successfully." });
          onTaskUpdated?.();
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
      setIsDeletingTask(true);
      let success = false;
      try {
          const { error } = await supabase
              .from('tasks')
              .delete()
              .eq('id', taskId);

          if (error) throw error;

          toast({ title: "Task Deleted", description: "The task has been successfully removed." });
          onTaskDeleted?.();
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
