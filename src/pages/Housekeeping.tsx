// src/pages/Housekeeping.tsx
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Play, Pause, Square, AlertTriangle, MessageSquare, Camera, Check, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

// --- Interfaces ---
interface Room {
    id: string;
    name: string;
    group_type: Database["public"]["Enums"]["room_group"];
    color: string | null;
}
interface Task {
  id: string;
  date: string;
  status: Database["public"]["Enums"]["task_status"];
  room: Room;
  cleaning_type: Database["public"]["Enums"]["cleaning_type"];
  guest_count: number;
  time_limit: number | null;
  start_time: string | null;
  pause_start: string | null;
  pause_stop: string | null;
  total_pause: number | null;
  stop_time: string | null;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  // --- SCHEMA CHANGE REQUIRED ---
  // Add 'reception_note_acknowledged BOOLEAN DEFAULT false' to tasks table
  reception_note_acknowledged?: boolean;
  issue_flag: boolean;
  issue_description: string | null;
  issue_photo: string | null;
  // --- SCHEMA CHANGE REQUIRED ---
  // Add 'priority BOOLEAN DEFAULT false' to tasks table
  priority?: boolean;
  created_at: string; // Ensure this is selected for sorting
}

// Possible filter values
type TaskStatusFilter = Database["public"]["Enums"]["task_status"] | 'all';
// Define filters - include 'done' if users should be able to filter for completed tasks
const statusFilters: TaskStatusFilter[] = ['all', 'todo', 'in_progress', 'paused', 'repair_needed', 'done'];

// --- Timer Hook ---
function useTaskTimer(startTime: string | null, totalPause: number | null, status: Task['status']): number | null {
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only run timer if task is 'in_progress' and has a start time
    if (status === 'in_progress' && startTime) {
      const calculateElapsed = () => {
        try {
          const start = new Date(startTime).getTime();
          // If startTime is invalid, getTime() returns NaN
          if (isNaN(start)) {
              console.error("Invalid start_time for timer:", startTime);
              setElapsedSeconds(null);
              if (intervalRef.current) clearInterval(intervalRef.current);
              return;
          }
          const now = Date.now();
          const pauseMs = (totalPause || 0) * 60 * 1000;
          // Calculate elapsed time in milliseconds, ensure it's not negative
          const elapsedMs = Math.max(0, now - start - pauseMs);
          setElapsedSeconds(Math.floor(elapsedMs / 1000));
        } catch (error) {
            console.error("Error calculating elapsed time:", error);
            setElapsedSeconds(null);
             if (intervalRef.current) clearInterval(intervalRef.current);
        }
      };

      calculateElapsed(); // Initial calculation
      intervalRef.current = setInterval(calculateElapsed, 1000); // Update every second
    } else {
      // If task is paused or stopped, calculate final elapsed time based on known values
       if (startTime) {
           try {
               const start = new Date(startTime).getTime();
               if (isNaN(start)) {
                   setElapsedSeconds(null);
               } else {
                   // Use stop_time if available, otherwise calculate up to now (for paused state display)
                   const end = status === 'done' && task.stop_time ? new Date(task.stop_time).getTime() : Date.now();
                   const pauseMs = (totalPause || 0) * 60 * 1000;
                   const elapsedMs = Math.max(0, end - start - pauseMs);
                   setElapsedSeconds(Math.floor(elapsedMs / 1000));
               }
           } catch(error) {
               console.error("Error calculating final elapsed time:", error);
               setElapsedSeconds(null);
           }
       } else {
            setElapsedSeconds(null); // Clear timer if no start time
       }
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
     // Add task.stop_time dependency if you want the timer to display final time for 'done' tasks accurately
  }, [startTime, totalPause, status, task.stop_time]); // task added for stop_time access

  return elapsedSeconds;
}


export default function Housekeeping() {
  const { signOut, userId, userRole } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null); // Task currently 'in_progress'
  const [currentNote, setCurrentNote] = useState("");
  const [noteTaskId, setNoteTaskId] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [issuePhoto, setIssuePhoto] = useState<File | null>(null);
  const [issuePhotoPreview, setIssuePhotoPreview] = useState<string | null>(null);
  const [issueTaskId, setIssueTaskId] = useState<string | null>(null);
  const { toast } = useToast();

  // Filtering State
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all'); // Default to 'all' active tasks

  // --- Fetch Tasks ---
   const fetchTasks = useCallback(async () => {
    if (!userId) return;

    const currentISODate = new Date().toISOString().split("T")[0];
    // Select all fields needed, including created_at and potentially schema-dependent ones
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        id, date, status, cleaning_type, guest_count, time_limit, start_time,
        pause_start, pause_stop, total_pause, stop_time, housekeeping_notes,
        reception_notes,
        issue_flag, issue_description, issue_photo,
        created_at,
        room:rooms!inner(id, name, group_type, color),
        user:users!inner(id, name)
         // --- SCHEMA CHANGE REQUIRED to select these: ---
        // reception_note_acknowledged,
        // priority
      `)
      .eq("user_id", userId)
      .eq("date", currentISODate)
      // Example: Exclude 'done' tasks by default if 'all' means 'all active'
      // .neq('status', 'done') // Uncomment if 'all' filter should exclude 'done' initially
      // --- SCHEMA CHANGE REQUIRED for priority sorting: ---
      // .order("priority", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true }); // Then by creation time

    if (error) {
      console.error("Error fetching tasks:", error);
      toast({ title: "Error", description: `Failed to fetch tasks: ${error.message}`, variant: "destructive" });
    } else {
      const fetchedTasks = (data as unknown as Task[]) || [];
      // Ensure created_at exists for sorting stability if not sorted by DB
      fetchedTasks.forEach(t => t.created_at = t.created_at || new Date(0).toISOString());

      setTasks(fetchedTasks);
      const active = fetchedTasks.find((t) => t.status === "in_progress");
      setActiveTaskId(active?.id || null);
    }
    setLoading(false);
  }, [userId, toast]);

  // --- useEffect for Initial Fetch and Realtime ---
  useEffect(() => {
    if (userRole !== "housekeeping" || !userId) {
      setLoading(false); // Stop loading if wrong role or no user ID
      return;
    }
    setLoading(true);
    fetchTasks(); // Initial fetch

    const currentISODate = new Date().toISOString().split("T")[0];
    const channel = supabase
      .channel(`my-tasks-channel-${userId}`)
      .on<Task>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}&date=eq.${currentISODate}`, // Filter server-side
        },
        (payload) => {
          console.log("Housekeeping Realtime update received:", payload);
          // Refetch for simplicity, ensure UI updates correctly based on new data
           fetchTasks();

           // Basic Notification Logic
           if (payload.eventType === 'INSERT') {
               // Use optional chaining for safety
               const roomName = (payload.new as Task)?.room?.name || 'Unknown Room';
               toast({ title: "New Task Assigned", description: `Task for Room ${roomName} added.`});
           } else if (payload.eventType === 'UPDATE') {
               const oldNotes = (payload.old as Task | null)?.reception_notes;
               const newNotes = (payload.new as Task | null)?.reception_notes;
               const roomName = (payload.new as Task)?.room?.name || 'Unknown Room';
               // Check if notes changed and are not empty
               if (newNotes && newNotes !== oldNotes) {
                   toast({ title: `Note Update for Room ${roomName}`, description: `Reception: "${newNotes}"` });
               }
               // Optionally notify about other changes like status or priority if needed
           }
        }
      )
      .subscribe((status, err) => {
           if (err) {
               console.error("Realtime subscription error:", err);
               toast({ title: "Realtime Error", description: "Connection issue, updates might be delayed.", variant: "destructive" });
           }
           console.log("Realtime subscription status:", status);
      });

    // Cleanup function
    return () => {
      console.log("Removing housekeeping realtime channel");
      supabase.removeChannel(channel).catch(err => console.error("Error removing channel:", err));
    };
  }, [userId, userRole, fetchTasks, toast]); // Dependencies


  // --- Action Handlers ---
    const handleStart = async (taskId: string) => {
        if (activeTaskId && activeTaskId !== taskId) {
            toast({ title: "Action Denied", description: "Another task is already in progress.", variant: "destructive" });
            return;
        }
        // Ensure pause times are reset when starting
        const { error } = await supabase.from("tasks").update({
            status: "in_progress",
            start_time: new Date().toISOString(),
            pause_start: null, // Reset pause start
            pause_stop: null,  // Reset pause stop
            stop_time: null, // Ensure stop time is null
            actual_time: null, // Reset calculated times
            difference: null
         }).eq("id", taskId);

        if (error) { toast({ title: "Error", description: "Failed to start task: " + error.message, variant: "destructive" }); }
        else { setActiveTaskId(taskId); toast({ title: "Task started" }); /* Realtime should update UI */ }
    };

    const handlePause = async (taskId: string) => {
        // Only allow pausing if the task is currently 'in_progress'
        const task = tasks.find(t => t.id === taskId);
        if (task?.status !== 'in_progress') {
             toast({ title: "Action Denied", description: "Task must be 'In Progress' to pause.", variant: "destructive" });
             return;
        }
        const { error } = await supabase.from("tasks").update({
            status: "paused",
            pause_start: new Date().toISOString(), // Record when pause began
            // Do not clear pause_stop here, it marks the end of the *last* pause interval
         }).eq("id", taskId);

        if (error) { toast({ title: "Error", description: "Failed to pause task: " + error.message, variant: "destructive" }); }
        else { setActiveTaskId(null); toast({ title: "Task paused" }); /* Realtime should update UI */ }
    };

    const handleResume = async (taskId: string) => {
        if (activeTaskId && activeTaskId !== taskId) {
            toast({ title: "Action Denied", description: "Another task is already in progress.", variant: "destructive" });
            return;
        }
        const task = tasks.find((t) => t.id === taskId);
        // Ensure task exists, is currently paused, and has a pause_start time
        if (!task || task.status !== 'paused' || !task.pause_start) {
            toast({ title: "Error", description: "Cannot resume task. Ensure it was paused correctly.", variant: "destructive" });
            return;
        }

        const pauseEndTime = new Date();
        const pauseStartTime = new Date(task.pause_start);
        // Calculate duration of the current pause in minutes
        const pauseDuration = Math.max(0, Math.floor((pauseEndTime.getTime() - pauseStartTime.getTime()) / 60000));
        const currentTotalPause = task.total_pause || 0;

        const { error } = await supabase.from("tasks").update({
            status: "in_progress",
            total_pause: currentTotalPause + pauseDuration, // Add current pause duration to total
            pause_start: null, // Clear pause_start as we are resuming
            pause_stop: pauseEndTime.toISOString(), // Record when the pause ended
         }).eq("id", taskId);

        if (error) { toast({ title: "Error", description: "Failed to resume task: " + error.message, variant: "destructive" }); }
        else { setActiveTaskId(taskId); toast({ title: "Task resumed" }); /* Realtime should update UI */ }
    };

    const handleStop = async (taskId: string) => {
         // Fetch the latest task state, especially start_time, total_pause, pause_start, time_limit, status
         const { data: currentTaskData, error: fetchError } = await supabase
            .from("tasks")
            .select("start_time, total_pause, pause_start, time_limit, status")
            .eq("id", taskId)
            .single();

         if (fetchError || !currentTaskData) {
            console.error("Stop Task - Fetch Error:", fetchError);
            toast({ title: "Error", description: "Could not fetch task details to stop. Please try again.", variant: "destructive" });
            return;
         }

         const { start_time, total_pause, pause_start, time_limit, status } = currentTaskData;

         // Cannot stop if not started, or already done
         if (!start_time || status === 'done' || status === 'todo') {
             toast({ title: "Action Denied", description: `Cannot stop a task that is '${status || 'not started'}'.`, variant: "destructive" });
             return;
         }

         let finalTotalPause = total_pause || 0;
         const stopTime = new Date();
         let finalPauseStop = null;

         // If stopping directly from 'paused' state, calculate the final pause duration
         if (status === 'paused' && pause_start) {
            const lastPauseStartTime = new Date(pause_start);
            finalTotalPause += Math.max(0, Math.floor((stopTime.getTime() - lastPauseStartTime.getTime()) / 60000));
            finalPauseStop = stopTime.toISOString(); // Record pause ending at stop time
         } else if (task.pause_stop) {
             finalPauseStop = task.pause_stop; // Keep the last recorded pause stop if stopping from 'in_progress'
         }

         let actual_time = null;
         let difference = null;

         // Calculate actual_time and difference
         const startTime = new Date(start_time);
         actual_time = Math.max(0, Math.floor((stopTime.getTime() - startTime.getTime()) / 60000) - finalTotalPause);
         if (time_limit != null) {
            difference = actual_time - time_limit;
         }

        // Update task to 'done' status with calculated times
        const { error } = await supabase.from("tasks").update({
            status: "done",
            stop_time: stopTime.toISOString(),
            pause_start: null, // Clear pause_start when stopping
            pause_stop: finalPauseStop, // Set based on calculation above
            total_pause: finalTotalPause,
            actual_time: actual_time,
            difference: difference,
         }).eq("id", taskId);

        if (error) {
            console.error("Stop Task - Update Error:", error);
            toast({ title: "Error", description: "Failed to stop task: " + error.message, variant: "destructive" }); }
        else {
            setActiveTaskId(null); // Clear active task ID
            toast({ title: "Task completed!" });
            // Realtime should handle the UI update (removing/changing task display based on filter)
         }
    };

     const handleSaveNote = async () => {
        if (!noteTaskId) return;
        const { error } = await supabase.from("tasks").update({ housekeeping_notes: currentNote }).eq("id", noteTaskId);
        if (error) { toast({ title: "Error", description: "Failed to save note: " + error.message, variant: "destructive" }); }
        else { toast({ title: "Note saved" }); setNoteTaskId(null); /* Let DialogClose handle closing */ }
    };

    // --- Handle Issue Report ---
    const handleReportIssue = async () => {
        if (!issueTaskId || !issueDescription.trim()) {
            toast({ title: "Missing Description", description: "Please describe the issue.", variant: "destructive" });
            return;
        }

        let photoUrl: string | null = null;
        // Upload photo if selected
        if (issuePhoto) {
            const fileExt = issuePhoto.name.split('.').pop();
            const fileName = `${userId}_${issueTaskId}_${Date.now()}.${fileExt}`;
            const filePath = `issue_photos/${fileName}`; // Define storage path

            // Upload to Supabase Storage bucket named 'task_issues'
            // Ensure this bucket exists and has appropriate RLS policies
            const { error: uploadError } = await supabase.storage
                .from('task_issues') // Bucket name
                .upload(filePath, issuePhoto);

            if (uploadError) {
                console.error("Photo Upload Error:", uploadError);
                toast({ title: "Error", description: `Photo upload failed: ${uploadError.message}`, variant: "destructive" });
                return; // Stop if upload fails
            }

            // Get the public URL of the uploaded file
            const { data: urlData } = supabase.storage
                .from('task_issues')
                .getPublicUrl(filePath);

             if (!urlData?.publicUrl) {
                console.warn("Could not get public URL for uploaded photo.");
                // Decide if you want to proceed without the URL or show an error
            }
            photoUrl = urlData?.publicUrl; // Store the public URL
        }

        // Update the task in the database
        const { error: updateError } = await supabase.from("tasks").update({
            issue_flag: true,
            issue_description: issueDescription,
            issue_photo: photoUrl, // Save the public URL or null
            status: "repair_needed", // Change status to indicate repair is needed
        }).eq("id", issueTaskId);

        if (updateError) {
             console.error("Report Issue - Update Error:", updateError);
            toast({ title: "Error", description: `Failed to report issue: ${updateError.message}`, variant: "destructive" });
        } else {
            toast({ title: "Maintenance issue reported" });
            setIssueTaskId(null); // Close dialog via state change driving Dialog open prop
            setIssueDescription("");
            setIssuePhoto(null);
            setIssuePhotoPreview(null);
            // Realtime update should refresh the task list/card
        }
    };

    // Handle photo selection and create preview URL
    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        setIssuePhoto(file); // Store the File object

        // Clean up previous preview URL to prevent memory leaks
        if (issuePhotoPreview) {
             URL.revokeObjectURL(issuePhotoPreview);
        }

        // Create and set new preview URL
        if (file) {
            setIssuePhotoPreview(URL.createObjectURL(file));
        } else {
            setIssuePhotoPreview(null);
        }
    };

    // --- Handle Acknowledge Note ---
    const handleAcknowledgeNote = async (taskId: string) => {
        // --- SCHEMA CHANGE REQUIRED ---
        // This function requires a 'reception_note_acknowledged' BOOLEAN column
        // in the 'tasks' table to work correctly.
        /*
        const { error } = await supabase
            .from('tasks')
            .update({ reception_note_acknowledged: true })
            .eq('id', taskId);

        if (error) {
            console.error("Acknowledge Note Error:", error);
            toast({ title: "Error", description: `Failed to acknowledge note: ${error.message}`, variant: "destructive" });
        } else {
            toast({ title: "Note acknowledged" });
            // Optimistic UI update or rely on realtime fetch
             setTasks(currentTasks => currentTasks.map(t =>
                t.id === taskId ? { ...t, reception_note_acknowledged: true } : t
            ));
        }
        */
       // Placeholder until schema is updated:
       console.warn("handleAcknowledgeNote requires 'reception_note_acknowledged' column in schema.");
       toast({ title: "Feature Incomplete", description: "Acknowledging notes requires a database update." });
    };

  // --- Status Color/Label Helpers ---
    const getStatusColor = (status: Task['status']): string => {
      const colors: Record<string, string> = {
        todo: "bg-status-todo text-white",
        in_progress: "bg-status-in-progress text-white",
        paused: "bg-status-paused text-white",
        done: "bg-status-done text-white",
        repair_needed: "bg-status-repair text-white",
      };
      return colors[status] || "bg-muted text-muted-foreground"; // Fallback color
    };

    const getStatusLabel = (status: Task['status']): string => {
       const labels: Record<string, string> = {
        todo: "To Clean",
        in_progress: "In Progress",
        paused: "Paused",
        done: "Done",
        repair_needed: "Repair",
      };
      return labels[status] || status; // Fallback to raw status
    };

  // --- Filtered Tasks ---
  const filteredTasks = useMemo(() => {
      let displayTasks = tasks;
      if (statusFilter !== 'all') {
          displayTasks = displayTasks.filter(task => task.status === statusFilter);
      }
      // Apply default filtering if 'all' means 'all active'
      else {
          // Example: If 'all' should exclude 'done' unless explicitly selected
          // displayTasks = displayTasks.filter(task => task.status !== 'done');
      }
      // Sorting is handled by the initial Supabase query order (created_at, potentially priority)
      return displayTasks;
  }, [tasks, statusFilter]);

  // --- Progress Calculation ---
   const progress = useMemo(() => {
    // Calculate based on ALL tasks fetched for the day, regardless of filter
    const totalTasks = tasks.length;
    if (totalTasks === 0) return { count: 0, total: 0, percentage: 0 };
    const completedTasks = tasks.filter(task => task.status === 'done').length;
    return {
        count: completedTasks,
        total: totalTasks,
        percentage: Math.round((completedTasks / totalTasks) * 100)
    };
  }, [tasks]); // Depends only on the full tasks list

  // --- FEATURE NOT IMPLEMENTED: Special Activities ---
  // Placeholder for where Break/Laundry logic would go
  // const handleStartBreak = () => { /* ... */ };
  // const handleStopBreak = () => { /* ... */ };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 gap-4">
          {/* Title */}
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold">My Tasks</h1>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>

          {/* Progress Bar & Filter */}
          <div className="flex-grow flex items-center justify-center gap-4 md:gap-6">
              {/* Progress */}
              <div className="w-full max-w-xs hidden sm:block"> {/* Hide on extra small screens */}
                <Label className="text-xs text-muted-foreground mb-1 block text-center">
                    Progress: {progress.count}/{progress.total} ({progress.percentage}%)
                </Label>
                <Progress value={progress.percentage} className="h-2" aria-label={`Task progress ${progress.percentage}%`} />
              </div>
              {/* Status Filter */}
              <div>
                  <Label htmlFor="statusFilter" className="sr-only">Filter by Status</Label>
                  <Select
                     value={statusFilter}
                     onValueChange={(value: string) => setStatusFilter(value as TaskStatusFilter)}
                  >
                    <SelectTrigger id="statusFilter" className="h-9 text-xs w-[120px] bg-background">
                        <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                        {statusFilters.map(status => (
                            <SelectItem key={status} value={status} className="text-xs">
                                {status === 'all' ? 'All Active' : getStatusLabel(status as Task['status'])}
                            </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
              </div>
          </div>

          {/* Sign Out Button */}
          <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={signOut}>
            <LogOut className="h-4 w-4" />
             <span className="sr-only">Sign Out</span>
          </Button>
        </div>
        {/* Progress bar for small screens below header */}
        <div className="sm:hidden px-4 pb-2">
             <Label className="text-xs text-muted-foreground mb-1 block text-center">
                Progress: {progress.count}/{progress.total} ({progress.percentage}%)
             </Label>
             <Progress value={progress.percentage} className="h-2" aria-label={`Task progress ${progress.percentage}%`} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto space-y-4 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /> <span className="ml-2">Loading tasks...</span></div>
        ) : (
          <>
            {/* --- FEATURE NOT IMPLEMENTED: Break/Laundry Buttons --- */}
            {/*
            <div className="flex justify-center gap-4 mb-4">
                <Button variant="outline" onClick={handleStartBreak}>Start Break</Button>
                <Button variant="outline">Start Laundry</Button>
            </div>
            */}

            {filteredTasks.map((task) => {
              const isActive = activeTaskId === task.id;
              const isPaused = task.status === 'paused';
              // --- SCHEMA CHANGE REQUIRED ---
              // Update this condition when 'reception_note_acknowledged' exists
              const showAcknowledge = task.reception_notes && !task.reception_note_acknowledged; // Assumes false if undefined for now

              return (
              <Card
                key={task.id}
                className={cn(
                    "overflow-hidden border-l-4 transition-shadow duration-300",
                    isActive ? 'ring-2 ring-offset-2 ring-status-in-progress shadow-lg' : 'shadow-sm hover:shadow-md',
                    // --- SCHEMA CHANGE REQUIRED for priority highlight ---
                    // task.priority && 'border-yellow-500 ring-1 ring-yellow-500'
                    task.priority && 'border-yellow-500' // Simple border highlight for now
                )}
                style={{ borderLeftColor: task.room.color || 'hsl(var(--border))' }}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-3 px-4">
                   {/* Room Info */}
                   <div>
                     <CardTitle className="text-lg font-semibold">{task.room.name}</CardTitle>
                      <p className="text-xs text-muted-foreground pt-1">
                        Type: {task.cleaning_type} / Guests: {task.guest_count} / Limit: {task.time_limit ? `${task.time_limit}m` : 'N/A'}
                      </p>
                    </div>
                    {/* Status Badge */}
                   <Badge className={`${getStatusColor(task.status)} text-xs ml-2 flex-shrink-0`}>
                    {getStatusLabel(task.status)}
                  </Badge>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-1 space-y-2">
                    {/* Timer Display */}
                    { (task.status === 'in_progress' || task.status === 'paused' || task.status === 'done') && task.start_time && (
                       <TaskTimerDisplay task={task} />
                    )}

                    {/* Reception Note */}
                    {task.reception_notes && (
                      <div className={cn(
                          "mt-1 p-2 rounded-md border text-xs",
                           // --- SCHEMA CHANGE REQUIRED ---
                           // Use showAcknowledge variable when schema updated
                           // showAcknowledge ? "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-200" : "bg-muted/50 border-border text-muted-foreground italic"
                           "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-200" // Style as unacknowledged for now
                       )}>
                          <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold flex items-center"><Info className="h-3 w-3 mr-1 inline"/> Reception Note:</span>
                               {/* --- SCHEMA CHANGE REQUIRED --- */}
                               {/* Enable button when schema updated */}
                               {/* showAcknowledge && ( */}
                                   <Button
                                       size="xs" // Custom size potentially needed via tailwind.config
                                       variant="ghost"
                                       className="h-6 px-1 text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-800"
                                       onClick={() => handleAcknowledgeNote(task.id)}
                                       // Remove disabled prop when schema is updated
                                       disabled={true} // Disabled for now
                                    >
                                       <Check className="h-3 w-3 mr-1"/> Acknowledge
                                   </Button>
                               {/* )} */}
                          </div>
                          <p>{task.reception_notes}</p>
                      </div>
                    )}

                     {/* Housekeeping Note */}
                    {task.housekeeping_notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                          <strong>Your Note:</strong> {task.housekeeping_notes}
                      </p>
                    )}

                    {/* Issue Indicator */}
                     {task.issue_flag && (
                        <div className="mt-1 p-2 rounded-md border border-red-200 bg-red-50 text-xs text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200">
                           <p className="font-semibold flex items-center mb-1">
                              <AlertTriangle className="h-3 w-3 mr-1 inline"/> Maintenance Issue Reported
                           </p>
                          {task.issue_description && <p className="mb-1">"{task.issue_description}"</p>}
                           {/* Issue Photo Thumbnail */}
                           {task.issue_photo && (
                              <a href={task.issue_photo} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80">
                                <img src={task.issue_photo} alt="Issue photo" className="h-10 w-10 object-cover rounded border"/>
                                <span className="sr-only">View issue photo</span>
                              </a>
                           )}
                        </div>
                      )}
                </CardContent>

                 <CardFooter className="flex flex-wrap gap-2 pt-2 pb-3 px-4 justify-between items-center bg-muted/30 border-t dark:bg-muted/10">
                    {/* Primary Action Buttons */}
                     <div className="flex gap-2 flex-wrap order-1">
                      {task.status === "todo" && (
                        <Button size="sm" onClick={() => handleStart(task.id)} disabled={!!activeTaskId && activeTaskId !== task.id} className="bg-green-600 hover:bg-green-700 text-white"> <Play className="mr-1 h-4 w-4" /> Start </Button>
                      )}
                      {task.status === "in_progress" && ( <>
                           <Button size="sm" variant="outline" onClick={() => handlePause(task.id)} className="text-orange-600 border-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-600 dark:hover:bg-orange-900/30"> <Pause className="mr-1 h-4 w-4" /> Pause </Button>
                           <Button size="sm" onClick={() => handleStop(task.id)} className="bg-blue-600 hover:bg-blue-700 text-white"> <Square className="mr-1 h-4 w-4" /> Stop </Button>
                      </>)}
                      {task.status === "paused" && ( <>
                           <Button size="sm" onClick={() => handleResume(task.id)} disabled={!!activeTaskId && activeTaskId !== task.id} className="bg-green-600 hover:bg-green-700 text-white"> <Play className="mr-1 h-4 w-4" /> Resume </Button>
                           <Button size="sm" variant="outline" onClick={() => handleStop(task.id)} className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900/30"> <Square className="mr-1 h-4 w-4" /> Stop </Button>
                      </>)}
                      {/* Optionally show something for 'done' or 'repair_needed' if actions are possible */}
                      {task.status === "done" && <span className="text-sm text-muted-foreground">Completed</span>}
                      {task.status === "repair_needed" && !isActive && !isPaused && (
                           // Allow starting even if repair needed? Or only resume/stop if paused?
                           // Example: Allow re-starting if needed
                           <Button size="sm" onClick={() => handleStart(task.id)} disabled={!!activeTaskId} className="bg-green-600 hover:bg-green-700 text-white"> <Play className="mr-1 h-4 w-4" /> Start </Button>
                      )}
                    </div>

                   {/* Secondary Action Buttons */}
                   {/* Show Note/Issue buttons unless task is 'done' */}
                   { task.status !== 'done' && (
                     <div className="flex gap-2 flex-wrap order-2">
                        {/* Note Dialog */}
                        <Dialog onOpenChange={(open) => { if (open) { setNoteTaskId(task.id); setCurrentNote(task.housekeeping_notes || ""); } else { setNoteTaskId(null); setCurrentNote(""); }}}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-accent px-2"> <MessageSquare className="mr-1 h-4 w-4" /> Note </Button>
                          </DialogTrigger>
                          <DialogContent>
                               <DialogHeader>
                                  <DialogTitle>Note for Room {task.room.name}</DialogTitle>
                                  <DialogDescription> Add or update housekeeping notes (e.g., lost & found, specific observations). </DialogDescription>
                               </DialogHeader>
                               <div className="py-4">
                                   <Label htmlFor={`note-${task.id}`} className="sr-only">Note Content</Label>
                                   <Textarea id={`note-${task.id}`} value={currentNote} onChange={(e) => setCurrentNote(e.target.value)} className="min-h-[100px]" placeholder="E.g., Extra towels requested, guest left wallet..." />
                               </div>
                               <DialogFooter>
                                   <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                                   {/* Close dialog on save */}
                                   <DialogClose asChild><Button type="button" onClick={handleSaveNote}>Save Note</Button></DialogClose>
                               </DialogFooter>
                          </DialogContent>
                        </Dialog>

                      {/* Report Issue Dialog - Hide if already flagged */}
                      {!task.issue_flag && (
                         <Dialog onOpenChange={(open) => {
                             if (open) {
                                 setIssueTaskId(task.id);
                                 setIssueDescription(task.issue_description || ""); // Pre-fill if editing was possible
                                 setIssuePhotoPreview(task.issue_photo || null); // Show existing photo if available
                             } else {
                                 // Reset fully on close
                                 setIssueTaskId(null);
                                 setIssueDescription("");
                                 setIssuePhoto(null);
                                 if (issuePhotoPreview) URL.revokeObjectURL(issuePhotoPreview);
                                 setIssuePhotoPreview(null);
                             }
                          }}>
                          <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 px-2"> <AlertTriangle className="mr-1 h-4 w-4" /> Report Issue </Button>
                          </DialogTrigger>
                           <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Report Issue for Room {task.room.name}</DialogTitle>
                                    <DialogDescription> Describe the maintenance issue and optionally add a photo. This will mark the task as needing repair. </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-1">
                                      <Label htmlFor={`issueDescription-${task.id}`}>Description*</Label>
                                      <Textarea id={`issueDescription-${task.id}`} value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} className="min-h-[80px]" placeholder="E.g., Leaking faucet in bathroom sink..." required />
                                    </div>
                                    <div className="space-y-1">
                                      <Label htmlFor={`issuePhoto-${task.id}`}>Photo (Optional)</Label>
                                      <Input id={`issuePhoto-${task.id}`} type="file" accept="image/*" onChange={handlePhotoSelect} />
                                    </div>
                                    {/* Photo Preview */}
                                    {issuePhotoPreview && (
                                       <div className="mt-2 text-center">
                                         <img src={issuePhotoPreview} alt="Issue preview" className="max-h-40 w-auto object-contain rounded border inline-block"/>
                                         <p className="text-xs text-muted-foreground mt-1">{issuePhoto ? `New photo: ${issuePhoto.name}` : "Existing photo"}</p>
                                       </div>
                                     )}
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                                    {/* Submit Button - Also closes dialog via onOpenChange */}
                                    <Button type="button" variant="destructive" onClick={handleReportIssue} disabled={!issueDescription.trim()}>Report Issue</Button>
                                </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                     </div>
                   )}
                </CardFooter>
              </Card>
              );
            })}
          </>
        )}

        {/* Empty State Message */}
        {!loading && filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
             <Card className="p-6 border-dashed">
                 <CardTitle className="text-lg mb-2">
                    {statusFilter === 'all' ? '🎉 No Active Tasks' : `No tasks match filter: ${getStatusLabel(statusFilter as Task['status'])}`}
                </CardTitle>
                <CardDescription>
                    {statusFilter === 'all' ? 'All assigned tasks for today are complete or none were assigned.' : 'Try changing the status filter.'}
                </CardDescription>
             </Card>
          </div>
        )}
      </main>

       {/* Footer Padding */}
       <footer className="h-10"></footer>
    </div>
  );
}

// -- Helper Component for Timer Display --
interface TaskTimerDisplayProps {
    task: Task;
}
const TaskTimerDisplay: React.FC<TaskTimerDisplayProps> = ({ task }) => {
    // Pass the entire task to the hook if needed (e.g., for stop_time)
    const elapsedSeconds = useTaskTimer(task.start_time, task.total_pause, task.status, task);

    const formatTime = (totalSeconds: number | null): string => {
        if (totalSeconds === null || totalSeconds < 0) return "--:--";
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const elapsedMinutes = elapsedSeconds !== null ? Math.floor(elapsedSeconds / 60) : 0;
    // Provide a default of 0 if time_limit is null
    const timeLimit = task.time_limit ?? 0;
    // Calculate remaining minutes only if there is a time limit > 0
    const remainingMinutes = timeLimit > 0 && elapsedSeconds !== null
                             ? Math.max(0, timeLimit - Math.ceil(elapsedSeconds / 60)) // Use ceil to show 0 when approaching limit
                             : null;
    // Determine if over time only if there is a limit > 0
    const isOverTime = timeLimit > 0 && elapsedMinutes > timeLimit;

    // Show final time if task is done
     if (task.status === 'done' && task.actual_time !== null) {
         return (
             <div className="text-xs text-muted-foreground flex justify-between items-center mt-1">
                 <span>Actual Time: <span className={cn("font-medium", (task.difference ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>{task.actual_time}m</span></span>
                 {timeLimit > 0 && (
                     <span>Limit: {timeLimit}m {task.difference !== null ? `(${task.difference > 0 ? '+' : ''}${task.difference}m)` : ''}</span>
                 )}
             </div>
         );
     }


    // Display for in_progress or paused tasks
    return (
        <div className="text-xs text-muted-foreground flex flex-wrap justify-between items-center gap-x-4 mt-1">
            <span>Elapsed: <span className={cn("font-medium tabular-nums", isOverTime ? "text-red-600 dark:text-red-400" : "text-foreground")}>{formatTime(elapsedSeconds)}</span></span>
            {timeLimit > 0 && (
                <span className={cn(isOverTime ? "text-red-600 dark:text-red-400" : "")}>
                    Limit: {timeLimit}m
                    {remainingMinutes !== null && task.status !== 'paused' && ` (${remainingMinutes}m left)`}
                    {task.status === 'paused' && ` (Paused)`}
                </span>
            )}
        </div>
    );
};
