// src/hooks/useTaskActions.ts
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Task } from '@/pages/Housekeeping'; // Assuming Task type is exported from Housekeeping.tsx or moved

export function useTaskActions(
    tasks: Task[], // Pass current tasks to find details if needed
    setActiveTaskId: (id: string | null) => void, // To update active task state
    activeTaskId: string | null
) {
  const { toast } = useToast();
  const { userId } = useAuth(); // Needed for photo upload path

  const handleStart = useCallback(async (taskId: string) => {
    if (activeTaskId && activeTaskId !== taskId) {
      toast({ title: "Action Denied", description: "Another task is already in progress.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("tasks").update({
        status: "in_progress", start_time: new Date().toISOString(),
        pause_start: null, pause_stop: null, stop_time: null,
        actual_time: null, difference: null // Reset time calculation fields on start
     }).eq("id", taskId);

    if (error) { toast({ title: "Error", description: `Failed to start task: ${error.message}`, variant: "destructive" }); }
    else { setActiveTaskId(taskId); toast({ title: "Task started" }); }
  }, [activeTaskId, setActiveTaskId, toast]);

  const handlePause = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    // Ensure the task is actually 'in_progress' before pausing
    if (task?.status !== 'in_progress') {
         toast({ title: "Action Denied", description: "Task must be 'In Progress' to pause.", variant: "destructive" });
         return;
    }
    const { error } = await supabase.from("tasks").update({
        status: "paused", pause_start: new Date().toISOString(), // Record when pause started
     }).eq("id", taskId);

    if (error) { toast({ title: "Error", description: `Failed to pause task: ${error.message}`, variant: "destructive" }); }
    else { setActiveTaskId(null); toast({ title: "Task paused" }); }
  }, [tasks, setActiveTaskId, toast]); // Added tasks dependency

  const handleResume = useCallback(async (taskId: string) => {
    // Check if another task is active before resuming
    if (activeTaskId && activeTaskId !== taskId) {
        toast({ title: "Action Denied", description: "Another task is already in progress.", variant: "destructive" });
        return;
    }
    const task = tasks.find((t) => t.id === taskId);
    // Ensure task exists, is paused, and has a pause_start time
    if (!task || task.status !== 'paused' || !task.pause_start) {
        toast({ title: "Error", description: "Cannot resume task. Ensure it was paused correctly.", variant: "destructive" });
        return;
    }

    const pauseEndTime = new Date();
    const pauseStartTime = new Date(task.pause_start);
    // Calculate duration of this specific pause in minutes
    const pauseDuration = Math.max(0, Math.floor((pauseEndTime.getTime() - pauseStartTime.getTime()) / 60000)); // Ensure non-negative
    const currentTotalPause = task.total_pause || 0;

    const { error } = await supabase.from("tasks").update({
        status: "in_progress",
        total_pause: currentTotalPause + pauseDuration, // Add current pause duration to total
        pause_start: null, // Clear pause start time
        pause_stop: pauseEndTime.toISOString(), // Record when pause ended (for record keeping)
     }).eq("id", taskId);

    if (error) { toast({ title: "Error", description: `Failed to resume task: ${error.message}`, variant: "destructive" }); }
    else { setActiveTaskId(taskId); toast({ title: "Task resumed" }); }
  }, [tasks, activeTaskId, setActiveTaskId, toast]); // Added tasks dependency

  const handleStop = useCallback(async (taskId: string) => {
     // Fetch the *latest* task state right before stopping to avoid race conditions
     const { data: currentTaskData, error: fetchError } = await supabase
        .from("tasks")
        .select("start_time, total_pause, pause_start, time_limit, status, pause_stop")
        .eq("id", taskId)
        .single();

     if (fetchError || !currentTaskData) {
         console.error("Error fetching task before stop:", fetchError);
         toast({ title: "Error", description: `Cannot fetch task details: ${fetchError?.message}`, variant: "destructive" });
         return;
     }

     const { start_time, total_pause, pause_start, time_limit, status, pause_stop } = currentTaskData;

     // Prevent stopping if not started, or already done
     if (!start_time || status === 'done' || status === 'todo') {
         toast({ title: "Action Denied", description: "Task cannot be stopped in its current state.", variant: "destructive" });
         return;
     }

     let finalTotalPause = total_pause || 0;
     const stopTime = new Date();
     let finalPauseStop = pause_stop; // Keep the last pause_stop time if resuming wasn't the last action

     // If stopping directly from paused state, calculate the final pause duration
     if (status === 'paused' && pause_start) {
        const lastPauseStartTime = new Date(pause_start);
        if (!isNaN(lastPauseStartTime.getTime())) { // Check for valid date
            finalTotalPause += Math.max(0, Math.floor((stopTime.getTime() - lastPauseStartTime.getTime()) / 60000));
            finalPauseStop = stopTime.toISOString(); // Record stop time as the end of the last pause
        } else {
            console.warn("Invalid pause_start date encountered for task:", taskId);
        }
     }

     let actual_time = null;
     let difference = null;

     const startTime = new Date(start_time);
      if (!isNaN(startTime.getTime())) { // Check for valid start date
        // Calculate total elapsed time in minutes, subtract total pause time
        actual_time = Math.max(0, Math.floor((stopTime.getTime() - startTime.getTime()) / 60000) - finalTotalPause);

        // Calculate difference if time_limit exists
        if (time_limit != null) {
            difference = actual_time - time_limit;
        }
      } else {
         console.warn("Invalid start_time date encountered for task:", taskId);
      }


    const { error } = await supabase.from("tasks").update({
        status: "done",
        stop_time: stopTime.toISOString(),
        pause_start: null, // Ensure pause_start is cleared
        pause_stop: finalPauseStop, // Record the end time of the last pause (might be stopTime)
        total_pause: finalTotalPause,
        actual_time: actual_time,
        difference: difference,
     }).eq("id", taskId);

    if (error) {
        console.error("Error stopping task:", error);
        toast({ title: "Error", description: `Failed to stop task: ${error.message}`, variant: "destructive" });
    } else {
        setActiveTaskId(null); // Clear active task ID
        toast({ title: "Task completed!" });
    }
  }, [setActiveTaskId, toast]); // Removed 'tasks' dependency as we fetch latest state

  const handleSaveNote = useCallback(async (noteTaskId: string, currentNote: string) => {
    // Validate note length (max 2000 chars)
    if (currentNote && currentNote.length > 2000) {
      toast({ title: "Validation Error", description: "Housekeeping notes must be less than 2000 characters.", variant: "destructive" });
      return false;
    }

    const { error } = await supabase.from("tasks").update({ housekeeping_notes: currentNote }).eq("id", noteTaskId);
    if (error) { toast({ title: "Error", description: `Failed to save note: ${error.message}`, variant: "destructive" }); return false; }
    else { toast({ title: "Note saved" }); return true; }
  }, [toast]);

  const handleReportIssue = useCallback(async (
      issueTaskId: string,
      issueDescription: string,
      issuePhoto: File | null
    ) => {
    // Validate issue description
    if (!issueDescription.trim()) {
        toast({ title: "Missing Description", description: "Please describe the issue.", variant: "destructive" });
        return false;
    }
    if (issueDescription.length > 5000) {
        toast({ title: "Validation Error", description: "Issue description must be less than 5000 characters.", variant: "destructive" });
        return false;
    }

    let photoUrl: string | null = null;
    if (issuePhoto && userId) { // Check userId exists
        const fileExt = issuePhoto.name.split('.').pop();
        const fileName = `${userId}_${issueTaskId}_${Date.now()}.${fileExt}`;
        const filePath = `issue_photos/${fileName}`; // Define storage path

        // Upload photo to Supabase storage bucket 'task_issues'
        const { data: uploadData, error: uploadError } = await supabase.storage.from('task_issues').upload(filePath, issuePhoto);

        if (uploadError) {
             console.error("Error uploading issue photo:", uploadError);
             toast({ title: "Upload Error", description: `Failed to upload photo: ${uploadError.message}`, variant: "destructive" });
             return false;
        }

        // Get the public URL of the uploaded file
        if (uploadData) {
            const { data: urlData } = supabase.storage.from('task_issues').getPublicUrl(filePath);
            photoUrl = urlData?.publicUrl || null;
             if (!photoUrl) {
                console.warn("Could not get public URL for uploaded photo:", filePath);
             }
        } else {
            // Handle case where upload might succeed but return no data (shouldn't happen often)
            toast({ title: "Upload Error", description: "Photo uploaded but could not retrieve URL.", variant: "destructive" });
            return false;
        }
    }

    // Update the task record with issue details and set status to 'repair_needed'
    const { error: updateError } = await supabase.from("tasks").update({
        issue_flag: true,
        issue_description: issueDescription,
        issue_photo: photoUrl,
        status: "repair_needed", // Set status to repair_needed
    }).eq("id", issueTaskId);

    if (updateError) {
         console.error("Error updating task with issue:", updateError);
         toast({ title: "Error Reporting Issue", description: `Failed to update task: ${updateError.message}`, variant: "destructive" });
         return false;
    }
    else { toast({ title: "Maintenance issue reported" }); return true; }
  }, [toast, userId]);

  const handleAcknowledgeNote = useCallback(async (taskId: string) => {
     // --- SCHEMA CHANGE REQUIRED ---
     /*
     const { error } = await supabase.from('tasks').update({ reception_note_acknowledged: true }).eq('id', taskId);
     if (error) { toast({ title: "Error", description: `Failed to acknowledge note: ${error.message}`, variant: "destructive" }); return false;}
     else { toast({ title: "Note acknowledged" }); return true;}
     */
     console.warn("handleAcknowledgeNote requires 'reception_note_acknowledged' column in schema.");
     toast({ title: "Feature Incomplete", description: "Acknowledging notes requires a database update." });
     return false; // Indicate failure until implemented
  }, [toast]);


  return {
    handleStart,
    handlePause,
    handleResume,
    handleStop,
    handleSaveNote,
    handleReportIssue,
    handleAcknowledgeNote,
  };
}
