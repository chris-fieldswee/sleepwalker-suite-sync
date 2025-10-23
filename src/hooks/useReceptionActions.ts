// src/hooks/useReceptionActions.ts
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";
import type { Room, WorkLog, Staff } from './useReceptionData'; // Import types from the data hook

type CleaningType = Database["public"]["Enums"]["cleaning_type"];

export interface NewTaskState {
    roomId: string;
    cleaningType: CleaningType;
    guestCount: number;
    staffId: string | 'unassigned';
    notes: string;
}

const initialNewTaskState: NewTaskState = {
    roomId: "", cleaningType: "W", guestCount: 2, staffId: "unassigned", notes: "",
};

export function useReceptionActions(
    availableRooms: Room[],
    filterDate: string,
    onTaskAdded?: () => void, // Optional callback after adding task
    onWorkLogSaved?: () => void // Optional callback after saving work log
) {
  const { toast } = useToast();
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false);

  const handleAddTask = async (newTask: NewTaskState): Promise<boolean> => {
    if (!newTask.roomId || !newTask.cleaningType) {
        toast({ title: "Missing Information", description: "Please select a room and cleaning type.", variant: "destructive" });
        return false;
    }
    setIsSubmittingTask(true);
    let success = false;
    try {
        const selectedRoom = availableRooms.find(r => r.id === newTask.roomId);
        if (!selectedRoom) throw new Error("Selected room not found.");

        // Fetch time limit based on room group, cleaning type, guest count
        const { data: limitData, error: limitError } = await supabase
            .from('limits')
            .select('time_limit')
            .eq('group_type', selectedRoom.group_type)
            .eq('cleaning_type', newTask.cleaningType)
            .eq('guest_count', newTask.guestCount)
            .maybeSingle(); // Use maybeSingle to handle cases where no limit is defined

        if (limitError) {
             console.warn(`Could not fetch time limit: ${limitError.message}. Proceeding without limit.`);
             // Allow task creation even if limit fetch fails, but log it
        }
        const timeLimit = limitData?.time_limit ?? null; // Default to null if not found or error

        const taskToInsert = {
            date: filterDate,
            room_id: newTask.roomId,
            cleaning_type: newTask.cleaningType,
            guest_count: newTask.guestCount,
            time_limit: timeLimit,
            reception_notes: newTask.notes || null,
            user_id: newTask.staffId === 'unassigned' ? null : newTask.staffId,
            status: 'todo' as const, // Explicitly type status
            // Ensure all non-nullable fields without defaults are included if any
        };

        const { error: insertError } = await supabase.from('tasks').insert(taskToInsert);
        if (insertError) throw insertError; // Throw to be caught below

        toast({ title: "Task Added Successfully" });
        onTaskAdded?.(); // Call callback if provided (e.g., to refetch)
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

  const handleSaveWorkLog = async (logData: Partial<WorkLog> & { user_id: string }): Promise<boolean> => {
     if (!logData.user_id || !filterDate) return false;
     setIsSavingLog(true);
     let success = false;

     const timeIn = logData.time_in?.trim() ? logData.time_in : null;
     const timeOut = logData.time_out?.trim() ? logData.time_out : null;
     const breakMinutes = Number.isFinite(Number(logData.break_minutes)) ? Number(logData.break_minutes) : 0;

     // Construct the full timestamp for Supabase, handle nulls
     const dataToUpsert = {
       user_id: logData.user_id,
       date: filterDate,
       time_in: timeIn ? `${filterDate}T${timeIn}:00` : null,
       time_out: timeOut ? `${filterDate}T${timeOut}:00` : null,
       break_minutes: breakMinutes,
       notes: logData.notes || null,
     };

     // Use upsert with onConflict to handle existing entries for the user/date
     const { error } = await supabase.from("work_logs").upsert(dataToUpsert, { onConflict: 'user_id, date' });

     if (error) {
       console.error("Error saving work log:", error);
       toast({ title: "Error", description: `Failed to save work log: ${error.message}`, variant: "destructive" });
       success = false;
     } else {
       toast({ title: "Work log saved" });
       onWorkLogSaved?.(); // Callback if provided
       success = true;
     }
     setIsSavingLog(false);
     return success;
  };


  return {
      handleAddTask,
      isSubmittingTask,
      handleSaveWorkLog,
      isSavingLog,
      initialNewTaskState // Export initial state for form reset
  };
}
