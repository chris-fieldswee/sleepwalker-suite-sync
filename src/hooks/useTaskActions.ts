// src/hooks/useTaskActions.ts
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { Task } from '@/pages/Housekeeping'; // Assuming Task type is exported

// Add fetchTasks to the hook's parameters
export function useTaskActions(
    tasks: Task[], // Keep tasks for quick checks like current status
    setActiveTaskId: (id: string | null) => void,
    activeTaskId: string | null,
    fetchTasks: () => Promise<void> // Add the fetch function
) {
  const { toast } = useToast();
  const { userId } = useAuth();

  const handleStart = useCallback(async (taskId: string) => {
    if (activeTaskId && activeTaskId !== taskId) {
      toast({ title: "Action Denied", description: "Another task is already in progress.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("tasks").update({
        status: "in_progress", start_time: new Date().toISOString(),
        pause_start: null, pause_stop: null, stop_time: null,
        actual_time: null, difference: null
     }).eq("id", taskId);

    if (error) { toast({ title: "Error", description: `Failed to start task: ${error.message}`, variant: "destructive" }); }
    else {
        setActiveTaskId(taskId); // Optimistic UI update
        toast({ title: "Task started" });
        await fetchTasks(); // Fetch latest data to confirm state
    }
  }, [activeTaskId, setActiveTaskId, toast, fetchTasks]); // Add fetchTasks dependency

  const handlePause = useCallback(async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task?.status !== 'in_progress') {
         toast({ title: "Action Denied", description: "Task must be 'In Progress' to pause.", variant: "destructive" });
         return;
    }
    const { error } = await supabase.from("tasks").update({
        status: "paused", pause_start: new Date().toISOString(),
     }).eq("id", taskId);

    if (error) { toast({ title: "Error", description: `Failed to pause task: ${error.message}`, variant: "destructive" }); }
    else {
        setActiveTaskId(null); // Optimistic UI update
        toast({ title: "Task paused" });
        await fetchTasks(); // Fetch latest data
    }
  }, [tasks, setActiveTaskId, toast, fetchTasks]); // Add fetchTasks dependency

  const handleResume = useCallback(async (taskId: string) => {
    if (activeTaskId && activeTaskId !== taskId) {
        toast({ title: "Action Denied", description: "Another task is already in progress.", variant: "destructive" });
        return;
    }
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status !== 'paused' || !task.pause_start) {
        toast({ title: "Error", description: "Cannot resume task.", variant: "destructive" });
        return;
    }

    const pauseEndTime = new Date();
    const pauseStartTime = new Date(task.pause_start);
    const pauseDuration = Math.max(0, Math.floor((pauseEndTime.getTime() - pauseStartTime.getTime()) / 60000));
    const currentTotalPause = task.total_pause || 0;

    const { error } = await supabase.from("tasks").update({
        status: "in_progress", total_pause: currentTotalPause + pauseDuration,
        pause_start: null, pause_stop: pauseEndTime.toISOString(),
     }).eq("id", taskId);

    if (error) { toast({ title: "Error", description: `Failed to resume task: ${error.message}`, variant: "destructive" }); }
    else {
        setActiveTaskId(taskId); // Optimistic UI update
        toast({ title: "Task resumed" });
        await fetchTasks(); // Fetch latest data
    }
  }, [tasks, activeTaskId, setActiveTaskId, toast, fetchTasks]); // Add fetchTasks dependency

  const handleStop = useCallback(async (taskId: string) => {
     // Fetch latest state before stopping (keep this logic)
     const { data: currentTaskData, error: fetchError } = await supabase
        .from("tasks").select("start_time, total_pause, pause_start, time_limit, status, pause_stop").eq("id", taskId).single();

     if (fetchError || !currentTaskData) { /* ... error handling ... */ return; }
     const { start_time, total_pause, pause_start, time_limit, status, pause_stop } = currentTaskData;
     if (!start_time || status === 'done' || status === 'todo') { /* ... error handling ... */ return; }

     let finalTotalPause = total_pause || 0;
     const stopTime = new Date();
     let finalPauseStop = pause_stop;
     if (status === 'paused' && pause_start) {
        const lastPauseStartTime = new Date(pause_start);
        if (!isNaN(lastPauseStartTime.getTime())) {
            finalTotalPause += Math.max(0, Math.floor((stopTime.getTime() - lastPauseStartTime.getTime()) / 60000));
            finalPauseStop = stopTime.toISOString();
        }
     }

     let actual_time = null; let difference = null;
     const startTime = new Date(start_time);
      if (!isNaN(startTime.getTime())) {
        actual_time = Math.max(0, Math.floor((stopTime.getTime() - startTime.getTime()) / 60000) - finalTotalPause);
        if (time_limit != null) { difference = actual_time - time_limit; }
      }

    const { error } = await supabase.from("tasks").update({
        status: "done", stop_time: stopTime.toISOString(), pause_start: null, pause_stop: finalPauseStop,
        total_pause: finalTotalPause, actual_time: actual_time, difference: difference,
     }).eq("id", taskId);

    if (error) { /* ... error handling ... */ }
    else {
        setActiveTaskId(null); // Optimistic UI update
        toast({ title: "Task completed!" });
        await fetchTasks(); // Fetch latest data
    }
  }, [setActiveTaskId, toast, fetchTasks]); // Add fetchTasks dependency

  // SaveNote and ReportIssue often trigger a realtime update anyway,
  // but adding fetchTasks ensures immediate consistency if needed.
  const handleSaveNote = useCallback(async (noteTaskId: string, currentNote: string) => {
    if (currentNote && currentNote.length > 2000) {
      toast({ title: "Validation Error", description: "Housekeeping notes must be less than 2000 characters.", variant: "destructive" });
      return false;
    }

    const { error } = await supabase.from("tasks").update({ housekeeping_notes: currentNote }).eq("id", noteTaskId);
    if (error) { toast({ title: "Error", description: `Failed to save note: ${error.message}`, variant: "destructive" }); return false; }
    else {
        toast({ title: "Note saved" });
        await fetchTasks(); // Refresh data after saving note
        return true;
     }
  }, [toast, fetchTasks]); // Add fetchTasks dependency

  const handleReportIssue = useCallback(async (
      issueTaskId: string,
      issueDescription: string,
      issuePhoto: File | null
    ) => {
    // Validation remains the same...
    if (!issueDescription.trim()) { /* ... validation ... */ return false; }
    if (issueDescription.length > 5000) { /* ... validation ... */ return false; }

    let photoUrl: string | null = null;
    if (issuePhoto && userId) {
        // Photo upload logic remains the same...
        const fileExt = issuePhoto.name.split('.').pop();
        const fileName = `${userId}_${issueTaskId}_${Date.now()}.${fileExt}`;
        const filePath = `issue_photos/${fileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('task_issues').upload(filePath, issuePhoto);

        if (uploadError) { /* ... error handling ... */ return false; }
        if (uploadData) {
            const { data: urlData } = supabase.storage.from('task_issues').getPublicUrl(filePath);
            photoUrl = urlData?.publicUrl || null;
        } else { /* ... error handling ... */ return false; }
    }

    const { error: updateError } = await supabase.from("tasks").update({
        issue_flag: true, issue_description: issueDescription, issue_photo: photoUrl,
        status: "repair_needed",
    }).eq("id", issueTaskId);

    if (updateError) { /* ... error handling ... */ return false; }
    else {
        toast({ title: "Maintenance issue reported" });
        await fetchTasks(); // Refresh data after reporting issue
        return true;
    }
  }, [toast, userId, fetchTasks]); // Add fetchTasks dependency

  const handleAcknowledgeNote = useCallback(async (taskId: string) => {
     // --- SCHEMA CHANGE REQUIRED ---
     // Logic remains the same, add fetchTasks on success if implemented
     console.warn("handleAcknowledgeNote requires 'reception_note_acknowledged' column in schema.");
     toast({ title: "Feature Incomplete", description: "Acknowledging notes requires a database update." });
     // If implemented: await fetchTasks();
     return false;
  }, [toast, fetchTasks]); // Add fetchTasks dependency


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
