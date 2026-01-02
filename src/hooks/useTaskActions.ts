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
    // Validation
    if (!issueDescription.trim()) {
      toast({ 
        title: "Brak Opisu", 
        description: "Proszę opisać problem.", 
        variant: "destructive" 
      });
      return false;
    }
    if (issueDescription.length > 5000) {
      toast({ 
        title: "Opis Zbyt Długi", 
        description: "Opis musi mieć mniej niż 5000 znaków.", 
        variant: "destructive" 
      });
      return false;
    }

    // Get the task to find room_id
    const task = tasks.find(t => t.id === issueTaskId);
    if (!task) {
      toast({ 
        title: "Błąd", 
        description: "Nie znaleziono zadania.", 
        variant: "destructive" 
      });
      return false;
    }

    // Get current user's id from users table (not just auth_id)
    let currentUserId: string | null = null;
    if (userId) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', userId)
        .maybeSingle();
      
      if (userError) {
        console.error("Error fetching user:", userError);
        toast({ 
          title: "Błąd", 
          description: "Nie udało się pobrać danych użytkownika.", 
          variant: "destructive" 
        });
        return false;
      }
      
      if (!userData || !userData.id) {
        console.error("User not found in users table for auth_id:", userId);
        toast({ 
          title: "Błąd", 
          description: "Nie znaleziono użytkownika w bazie danych.", 
          variant: "destructive" 
        });
        return false;
      }
      
      currentUserId = userData.id;
      console.log("Found user ID for issue reporting:", currentUserId, "for auth_id:", userId);
    } else {
      console.error("No userId available from auth context");
      toast({ 
        title: "Błąd", 
        description: "Brak identyfikatora użytkownika.", 
        variant: "destructive" 
      });
      return false;
    }

    // Upload photo if provided
    let photoUrl: string | null = null;
    if (issuePhoto && userId) {
      const fileExt = issuePhoto.name.split('.').pop();
      const fileName = `${userId}_${issueTaskId}_${Date.now()}.${fileExt}`;
      const filePath = `issue_photos/${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('issue-photos')
        .upload(filePath, issuePhoto);

      if (uploadError) {
        console.error("Error uploading photo:", uploadError);
        toast({ 
          title: "Błąd", 
          description: `Nie udało się przesłać zdjęcia: ${uploadError.message}`, 
          variant: "destructive" 
        });
        return false;
      }
      
      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from('issue-photos')
          .getPublicUrl(filePath);
        photoUrl = urlData?.publicUrl || null;
      }
    }

    // Update task with issue flag (keep existing behavior)
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        issue_flag: true, 
        issue_description: issueDescription, 
        issue_photo: photoUrl,
      })
      .eq("id", issueTaskId);

    if (updateError) {
      console.error("Error updating task:", updateError);
      toast({ 
        title: "Błąd", 
        description: `Nie udało się zaktualizować zadania: ${updateError.message}`, 
        variant: "destructive" 
      });
      return false;
    }

    // Create issue in issues table
    const issueToInsert = {
      room_id: task.room.id,
      task_id: issueTaskId,
      reported_by_user_id: currentUserId,
      title: issueDescription.substring(0, 100),
      description: issueDescription,
      photo_url: photoUrl,
      status: 'reported' as const,
      priority: 'medium' as const,
    };

    const { data: insertedIssue, error: insertError } = await supabase
      .from('issues')
      .insert(issueToInsert)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating issue:", insertError);
      console.error("Issue data attempted:", issueToInsert);
      console.error("Error details:", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint
      });
      // Don't fail completely - task was already updated
      // Just show a warning that issue wasn't created in issues table
      toast({ 
        title: "Ostrzeżenie", 
        description: `Problem został zgłoszony, ale nie udało się utworzyć rekordu w tabeli problemów: ${insertError.message}`, 
        variant: "destructive" 
      });
      // Still return true since task was updated
      await fetchTasks();
      return true;
    }

    console.log("Issue created successfully:", insertedIssue);

    toast({ 
      title: "Sukces", 
      description: "Problem został zgłoszony pomyślnie" 
    });
    await fetchTasks(); // Refresh data after reporting issue
    return true;
  }, [toast, userId, tasks, fetchTasks]);

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
