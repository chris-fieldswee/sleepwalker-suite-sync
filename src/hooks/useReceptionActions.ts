// src/hooks/useReceptionActions.ts
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from "@/integrations/supabase/types";
import type { Room } from './useReceptionData';
import { taskInputSchema, workLogSchema } from '@/lib/validation';

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
    // Validate input using zod schema
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
       // Validate input using zod schema
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


  return {
      handleAddTask,
      isSubmittingTask,
      handleSaveWorkLog,
      isSavingLog,
      initialNewTaskState // Export updated initial state
  };
}
