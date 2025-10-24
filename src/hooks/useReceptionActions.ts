// src/hooks/useReceptionActions.ts
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";
import type { Room } from './useReceptionData';
import { taskInputSchema, workLogSchema } from '@/lib/validation';
// *** Import useAuth to get userId for photo naming ***
import { useAuth } from '@/contexts/AuthContext';

type CleaningType = Database["public"]["Enums"]["cleaning_type"];

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
    // *** Add callback for when a new issue is reported ***
    onIssueReported?: () => void
) {
  const { toast } = useToast();
  const { userId } = useAuth(); // Get user ID
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);
  // *** Add new loading state for reporting issues ***
  const [isSubmittingNewIssue, setIsSubmittingNewIssue] = useState(false);

  const handleAddTask = async (newTask: NewTaskState): Promise<boolean> => {
    // ... (handleAddTask function remains the same) ...
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
       // ... (handleSaveWorkLog function remains the same) ...
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

  // *** NEW FUNCTION: handleReportNewIssue ***
  const handleReportNewIssue = async (roomId: string, description: string, photo: File | null): Promise<boolean> => {
        // Basic validation (already done in dialog, but good practice)
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

        try {
            // 1. Upload photo if provided
            if (photo && userId) {
                const fileExt = photo.name.split('.').pop();
                // Use a generic name format since there's no task ID yet
                const fileName = `${userId}_issue_${Date.now()}.${fileExt}`;
                const filePath = `issue_photos/${fileName}`;
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

            // 2. Insert new task marked as an issue
            const taskToInsert = {
                room_id: roomId,
                date: getTodayDateString(), // Use today's date
                cleaning_type: 'O' as CleaningType, // Default to 'Other'
                guest_count: 1, // Default guest count
                status: 'repair_needed' as const,
                issue_flag: true,
                issue_description: description,
                issue_photo: photoUrl,
                // Add user_id if you want to track who reported it via reception
                // user_id: loggedInReceptionUserId, // Requires getting reception user ID
            };

            const { error: insertError } = await supabase.from('tasks').insert(taskToInsert);

            if (insertError) {
                 // Attempt to delete uploaded photo if DB insert fails
                if (photoUrl && filePath) {
                    console.warn("Database insert failed, attempting to delete uploaded photo:", filePath);
                    await supabase.storage.from('task_issues').remove([filePath]);
                }
                throw insertError;
            }

            const roomName = availableRooms.find(r => r.id === roomId)?.name || 'Unknown Room';
            toast({ title: "Issue Reported Successfully", description: `New issue task created for ${roomName}.` });
            onIssueReported?.(); // Trigger callback (e.g., refresh data)
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


  return {
      handleAddTask,
      isSubmittingTask,
      handleSaveWorkLog,
      isSavingLog,
      initialNewTaskState,
      // *** Export new handler and loading state ***
      handleReportNewIssue,
      isSubmittingNewIssue,
  };
}
