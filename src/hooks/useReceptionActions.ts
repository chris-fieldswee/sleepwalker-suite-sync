// src/hooks/useReceptionActions.ts
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";
import type { Room, Staff } from './useReceptionData'; // Import Staff type
import { taskInputSchema, workLogSchema } from '@/lib/validation';
import { useAuth } from '@/contexts/AuthContext';
// Import IssueTask type if defined separately, or use inline definition
import type { IssueTask } from '@/components/reception/IssueDetailDialog';


type CleaningType = Database["public"]["Enums"]["cleaning_type"];
type TaskStatus = Database["public"]["Enums"]["task_status"]; // Define TaskStatus

// ... (NewTaskState, getTodayDateString, initialNewTaskState remain the same) ...
export interface NewTaskState {
    roomId: string;
    cleaningType: CleaningType;
    guestCount: number;
    staffId: string | 'unassigned';
    notes: string;
    date: string;
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
    // *** Add callback for issue updates ***
    onIssueUpdated?: () => void
) {
  const { toast } = useToast();
  const { userId } = useAuth();
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [isSubmittingNewIssue, setIsSubmittingNewIssue] = useState(false);
  // *** Add loading state for updating issues ***
  const [isUpdatingIssue, setIsUpdatingIssue] = useState(false);

  // ... (handleAddTask, handleSaveWorkLog, handleReportNewIssue remain the same) ...
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

          if (limitError) {
               console.warn(`Could not fetch time limit: ${limitError.message}. Proceeding without limit.`);
          }
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
          success = false;
      } finally {
          setIsSubmittingTask(false);
      }
      return success;
    };

    const handleSaveWorkLog = async (logData: any): Promise<boolean> => {
         const validation = workLogSchema.safeParse({
           user_id: logData.user_id,
           date: logData.date,
           time_in: logData.time_in,
           time_out: logData.time_out,
           break_minutes: logData.break_minutes || 0,
           laundry_minutes: logData.laundry_minutes || 0,
           breakfast_minutes: logData.breakfast_minutes || 0,
           total_minutes: logData.total_minutes,
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
             const { error } = await supabase.from("work_logs").upsert({
                 user_id: validation.data.user_id,
                 date: validation.data.date,
                 time_in: validation.data.time_in,
                 time_out: validation.data.time_out,
                 break_minutes: validation.data.break_minutes,
                 laundry_minutes: validation.data.laundry_minutes,
                 breakfast_minutes: validation.data.breakfast_minutes,
                 total_minutes: validation.data.total_minutes,
                 notes: validation.data.notes
             });

             if (error) throw error;

             toast({ title: "Work Log Saved", description: "Work log has been saved successfully." });
             onWorkLogSaved?.();
             success = true;
         } catch (error: any) {
             console.error("Error saving work log:", error);
             toast({ title: "Error", description: error.message, variant: "destructive" });
             success = false;
         } finally {
             setIsSavingLog(false);
         }
         return success;
    };

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
          let filePath: string | undefined = undefined; // Define filePath here

          try {
              if (photo && userId) {
                  const fileExt = photo.name.split('.').pop();
                  const fileName = `${userId}_issue_${Date.now()}.${fileExt}`;
                  filePath = `issue_photos/${fileName}`; // Assign value here
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
                  cleaning_type: 'O' as CleaningType,
                  guest_count: 1,
                  status: 'repair_needed' as const,
                  issue_flag: true,
                  issue_description: description,
                  issue_photo: photoUrl,
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


    // *** NEW FUNCTION: handleUpdateIssue ***
    const handleUpdateIssue = async (
        taskId: string,
        updates: Partial<Pick<IssueTask, 'status' | 'reception_notes'> & { user_id: string | null }>
    ): Promise<boolean> => {
        setIsUpdatingIssue(true);
        let success = false;
        try {
             // Optional: Add validation for notes length if needed
             if (updates.reception_notes && updates.reception_notes.length > 2000) {
                 throw new Error("Reception notes cannot exceed 2000 characters.");
             }

             // Determine if we are resolving the issue
             const isResolving = updates.status && updates.status !== 'repair_needed';

             const finalUpdates: Partial<Database["public"]["Tables"]["tasks"]["Update"]> = {
                 status: updates.status as TaskStatus, // Already validated as TaskStatus
                 user_id: updates.user_id,
                 reception_notes: updates.reception_notes,
                 issue_flag: !isResolving // Set issue_flag to false if status is changing away from 'repair_needed'
             };

             // If resolving, also set stop_time and potentially calculate times
             if (isResolving && updates.status === 'done') {
                  // Fetch the task's start_time and other details if needed for calculation
                  // For simplicity, just marking as done. Time calculation is complex here.
                  finalUpdates.stop_time = new Date().toISOString();
                  // Note: actual_time and difference won't be calculated here unless you
                  // fetch start_time, total_pause etc. and replicate the stop logic.
                  // It might be simpler to just mark as 'done'.
             }


            const { error } = await supabase
                .from('tasks')
                .update(finalUpdates)
                .eq('id', taskId);

            if (error) throw error;

            toast({ title: "Issue Updated", description: "Issue details have been saved." });
            onIssueUpdated?.(); // Trigger callback (e.g., refresh data)
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

  return {
      handleAddTask,
      isSubmittingTask,
      handleSaveWorkLog,
      isSavingLog,
      initialNewTaskState,
      handleReportNewIssue,
      isSubmittingNewIssue,
      // *** Export new handler and loading state ***
      handleUpdateIssue,
      isUpdatingIssue,
  };
}
