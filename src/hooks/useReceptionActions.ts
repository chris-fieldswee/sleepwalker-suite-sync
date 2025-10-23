// src/hooks/useReceptionActions.ts
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";
import type { Room } from './useReceptionData'; // Import types from the data hook

type CleaningType = Database["public"]["Enums"]["cleaning_type"];

export interface NewTaskState {
    roomId: string;
    cleaningType: CleaningType;
    guestCount: number;
    staffId: string | 'unassigned';
    notes: string;
    // *** NEW: Add date field ***
    date: string; // YYYY-MM-DD format
}

// Get today's date in YYYY-MM-DD format for the initial state
const getTodayDateString = () => new Date().toISOString().split("T")[0];

const initialNewTaskState: NewTaskState = {
    roomId: "",
    cleaningType: "W",
    guestCount: 2,
    staffId: "unassigned",
    notes: "",
    date: getTodayDateString(), // Default to today
};

export function useReceptionActions(
    availableRooms: Room[],
    // filterDate is no longer directly needed for adding tasks
    onTaskAdded?: () => void,
    onWorkLogSaved?: () => void
) {
  const { toast } = useToast();
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isSavingLog, setIsSavingLog] = useState(false); // Keep work log logic

  // *** MODIFIED: handleAddTask uses date from newTask object ***
  const handleAddTask = async (newTask: NewTaskState): Promise<boolean> => {
    // Validate required fields including the new date field
    if (!newTask.roomId || !newTask.cleaningType || !newTask.date) {
        toast({ title: "Missing Information", description: "Please select a room, cleaning type, and date.", variant: "destructive" });
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
            // *** Use date from the newTask object ***
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

  // handleSaveWorkLog remains unchanged, assuming it uses filterDate passed separately if needed
  const handleSaveWorkLog = async (logData: any): Promise<boolean> => {
       // ... existing implementation ...
       setIsSavingLog(true);
       let success = false;
       // ... existing implementation ...
        const { error } = await supabase.from("work_logs").upsert(/*... data using logData.date or filterDate ...*/);
       // ... existing implementation ...
       setIsSavingLog(false);
       return success;
  };


  return {
      handleAddTask,
      isSubmittingTask,
      handleSaveWorkLog,
      isSavingLog,
      initialNewTaskState // Export updated initial state
  };
}
