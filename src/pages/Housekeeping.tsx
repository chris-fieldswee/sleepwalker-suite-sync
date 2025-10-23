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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Added Select
import { LogOut, Play, Pause, Square, AlertTriangle, MessageSquare, Camera, Check, Info } from "lucide-react"; // Added Check, Info
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types"; // Import Database types
import { cn } from "@/lib/utils"; // Import cn utility

// --- Interfaces (Task, Room defined similarly to Reception.tsx) ---
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
  time_limit: number | null; // Allow null
  start_time: string | null;
  pause_start: string | null;
  pause_stop: string | null;
  total_pause: number | null;
  stop_time: string | null;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  reception_note_acknowledged?: boolean; // Optional: Add to schema
  issue_flag: boolean;
  issue_description: string | null;
  issue_photo: string | null;
  priority?: boolean; // Optional: Add to schema
  created_at?: string; // Optional: For sorting
}

// Possible filter values
type TaskStatusFilter = Database["public"]["Enums"]["task_status"] | 'all';
const statusFilters: TaskStatusFilter[] = ['all', 'todo', 'in_progress', 'paused', 'repair_needed']; // Exclude 'done' from filter options initially? Or include based on preference

// Timer Hook
function useTaskTimer(startTime: string | null, totalPause: number | null, status: Task['status']): number | null {
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (status === 'in_progress' && startTime) {
      const calculateElapsed = () => {
        const start = new Date(startTime).getTime();
        const now = Date.now();
        const pauseMs = (totalPause || 0) * 60 * 1000;
        const elapsed = Math.max(0, Math.floor((now - start - pauseMs) / 1000));
        setElapsedSeconds(elapsed);
      };

      calculateElapsed(); // Initial calculation
      intervalRef.current = setInterval(calculateElapsed, 1000); // Update every second
    } else {
      setElapsedSeconds(null); // Clear timer if not in progress or no start time
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTime, totalPause, status]); // Rerun effect if these change

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
  const [issuePhotoPreview, setIssuePhotoPreview] = useState<string | null>(null); // For preview URL
  const [issueTaskId, setIssueTaskId] = useState<string | null>(null);
  const { toast } = useToast();

  // --- Filtering State ---
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');

  // --- Fetch Tasks (modified for sorting and potential schema changes) ---
   const fetchTasks = useCallback(async () => {
    if (!userId) return;

    const currentISODate = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        id, date, status, cleaning_type, guest_count, time_limit, start_time,
        pause_start, pause_stop, total_pause, stop_time, housekeeping_notes,
        reception_notes, reception_note_acknowledged, issue_flag, issue_description, issue_photo,
        priority, created_at,
        room:rooms!inner(id, name, group_type, color)
      `)
      .eq("user_id", userId)
      .eq("date", currentISODate)
      // Exclude 'done' tasks unless specifically filtered for (can be adjusted)
      // .neq('status', 'done') // Example: uncomment to hide done tasks by default
      .order("priority", { ascending: false, nullsFirst: false }) // Sort by priority first (needs 'priority' column)
      .order("created_at", { ascending: true }); // Then by creation time

    if (error) {
      console.error("Error fetching tasks:", error);
      toast({ title: "Error", description: `Failed to fetch tasks: ${error.message}`, variant: "destructive" });
    } else {
      const fetchedTasks = (data as unknown as Task[]) || [];
      setTasks(fetchedTasks);
      const active = fetchedTasks.find((t) => t.status === "in_progress");
      setActiveTaskId(active?.id || null);
    }
    setLoading(false);
  }, [userId, toast]);

  // --- useEffect for Initial Fetch and Realtime ---
  useEffect(() => {
    if (userRole !== "housekeeping" || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchTasks();

    const currentISODate = new Date().toISOString().split("T")[0];
    const channel = supabase
      .channel(`my-tasks-channel-${userId}`)
      .on<Task>( // Add type hint
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}&date=eq.${currentISODate}`, // Filter server-side
        },
        (payload) => {
          console.log("Housekeeping Realtime update received:", payload);
           // Smart update or refetch needed here - reusing fetchTasks is simplest for now
           fetchTasks();

           // Basic Notification Logic (can be expanded)
           if (payload.eventType === 'INSERT') {
               toast({ title: "New Task Assigned", description: `Room ${payload.new.room?.name || 'Unknown'}`});
           } else if (payload.eventType === 'UPDATE') {
               const oldNotes = (payload.old as Task | null)?.reception_notes;
               const newNotes = payload.new.reception_notes;
               if (newNotes && newNotes !== oldNotes) {
                   toast({ title: `Note Update for Room ${payload.new.room?.name || 'Unknown'}`, description: `Reception: "${newNotes}"` });
               }
           }
        }
      )
      .subscribe(/* ... */);

    return () => {
      console.log("Removing housekeeping realtime channel");
      supabase.removeChannel(channel);
    };
  }, [userId, userRole, fetchTasks, toast]); // Added fetchTasks, toast

  // --- Action Handlers (handleStart, handlePause, handleResume, handleStop, handleSaveNote) - Keep existing logic ---
    const handleStart = async (taskId: string) => {
        if (activeTaskId && activeTaskId !== taskId) {
            toast({ title: "Action Denied", description: "Another task is already in progress.", variant: "destructive" });
            return;
        }
        const { error } = await supabase.from("tasks").update({ status: "in_progress", start_time: new Date().toISOString(), pause_start: null, pause_stop: null, }).eq("id", taskId);
        if (error) { toast({ title: "Error", description: "Failed to start task: " + error.message, variant: "destructive" }); }
        else { setActiveTaskId(taskId); toast({ title: "Task started" }); }
    };
    const handlePause = async (taskId: string) => {
        const { error } = await supabase.from("tasks").update({ status: "paused", pause_start: new Date().toISOString(), pause_stop: null, }).eq("id", taskId);
        if (error) { toast({ title: "Error", description: "Failed to pause task: " + error.message, variant: "destructive" }); }
        else { setActiveTaskId(null); toast({ title: "Task paused" }); }
    };
    const handleResume = async (taskId: string) => {
        if (activeTaskId && activeTaskId !== taskId) {
            toast({ title: "Action Denied", description: "Another task is already in progress.", variant: "destructive" });
            return;
        }
        const task = tasks.find((t) => t.id === taskId);
        if (!task || !task.pause_start) { toast({ title: "Error", description: "Cannot resume task.", variant: "destructive" }); return; }
        const pauseEndTime = new Date();
        const pauseStartTime = new Date(task.pause_start);
        const pauseDuration = Math.max(0, Math.floor((pauseEndTime.getTime() - pauseStartTime.getTime()) / 60000));
        const currentTotalPause = task.total_pause || 0;
        const { error } = await supabase.from("tasks").update({ status: "in_progress", total_pause: currentTotalPause + pauseDuration, pause_start: null, pause_stop: pauseEndTime.toISOString(), }).eq("id", taskId);
        if (error) { toast({ title: "Error", description: "Failed to resume task: " + error.message, variant: "destructive" }); }
        else { setActiveTaskId(taskId); toast({ title: "Task resumed" }); }
    };
    const handleStop = async (taskId: string) => {
         const { data: currentTaskData, error: fetchError } = await supabase.from("tasks").select("start_time, total_pause, pause_start, time_limit").eq("id", taskId).single();
         if (fetchError || !currentTaskData) { toast({ title: "Error", description: "Could not fetch task details to stop.", variant: "destructive" }); return; }
         const { start_time, total_pause, pause_start, time_limit } = currentTaskData;
         let finalTotalPause = total_pause || 0;
         const stopTime = new Date();
         if (pause_start) {
            const lastPauseStartTime = new Date(pause_start);
            finalTotalPause += Math.max(0, Math.floor((stopTime.getTime() - lastPauseStartTime.getTime()) / 60000));
         }
         let actual_time = null; let difference = null;
         if (start_time) {
            const startTime = new Date(start_time);
            actual_time = Math.max(0, Math.floor((stopTime.getTime() - startTime.getTime()) / 60000) - finalTotalPause);
            if (time_limit != null) { difference = actual_time - time_limit; }
         }
        const { error } = await supabase.from("tasks").update({ status: "done", stop_time: stopTime.toISOString(), pause_start: null, pause_stop: pause_start ? stopTime.toISOString() : null, total_pause: finalTotalPause, actual_time: actual_time, difference: difference, }).eq("id", taskId);
        if (error) { toast({ title: "Error", description: "Failed to stop task: " + error.message, variant: "destructive" }); }
        else { setActiveTaskId(null); toast({ title: "Task completed!" }); }
    };
     const handleSaveNote = async () => {
        if (!noteTaskId) return;
        const { error } = await supabase.from("tasks").update({ housekeeping_notes: currentNote }).eq("id", noteTaskId);
        if (error) { toast({ title: "Error", description: "Failed to save note: " + error.message, variant: "destructive" }); }
        else { toast({ title: "Note saved" }); setNoteTaskId(null); } // Rely on DialogClose
    };

    // --- Handle Issue Report (with photo preview) ---
    const handleReportIssue = async () => {
        if (!issueTaskId || !issueDescription.trim()) {
            toast({ title: "Missing Description", description: "Please describe the issue.", variant: "destructive" });
            return;
        }

        let photoUrl = null;
        if (issuePhoto) {
            const fileExt = issuePhoto.name.split('.').pop();
            const fileName = `${userId}_${issueTaskId}_${Date.now()}.${fileExt}`;
            const filePath = `issue_photos/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('task_issues').upload(filePath, issuePhoto);
            if (uploadError) {
                toast({ title: "Error", description: `Photo upload failed: ${uploadError.message}`, variant: "destructive" });
                return;
            }
            const { data: urlData } = supabase.storage.from('task_issues').getPublicUrl(filePath);
            photoUrl = urlData?.publicUrl;
        }

        const { error } = await supabase.from("tasks").update({
            issue_flag: true, issue_description: issueDescription, issue_photo: photoUrl, status: "repair_needed",
        }).eq("id", issueTaskId);

        if (error) {
            toast({ title: "Error", description: `Failed to report issue: ${error.message}`, variant: "destructive" });
        } else {
            toast({ title: "Maintenance issue reported" });
            setIssueTaskId(null); // Close dialog
            setIssueDescription("");
            setIssuePhoto(null);
            setIssuePhotoPreview(null);
        }
    };

    // Handle photo selection for preview
    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        setIssuePhoto(file);
        if (issuePhotoPreview) { URL.revokeObjectURL(issuePhotoPreview); } // Clean up previous preview
        if (file) {
            setIssuePhotoPreview(URL.createObjectURL(file));
        } else {
            setIssuePhotoPreview(null);
        }
    };

    // --- Handle Acknowledge Note ---
    const handleAcknowledgeNote = async (taskId: string) => {
        // !!! REQUIRES 'reception_note_acknowledged' BOOLEAN COLUMN IN 'tasks' TABLE !!!
        const { error } = await supabase
            .from('tasks')
            .update({ reception_note_acknowledged: true })
            .eq('id', taskId);

        if (error) {
            toast({ title: "Error", description: `Failed to acknowledge note: ${error.message}`, variant: "destructive" });
        } else {
            toast({ title: "Note acknowledged" });
            // Optimistic UI update or wait for realtime
             setTasks(currentTasks => currentTasks.map(t =>
                t.id === taskId ? { ...t, reception_note_acknowledged: true } : t
            ));
        }
    };

  // --- Status Color/Label Helpers (keep existing) ---
    const getStatusColor = (status: Task['status']) => { /* ... */ };
    const getStatusLabel = (status: Task['status']) => { /* ... */ };


  // --- Filtered and Sorted Tasks ---
  const filteredTasks = useMemo(() => {
      let displayTasks = tasks;
      if (statusFilter !== 'all') {
          displayTasks = displayTasks.filter(task => task.status === statusFilter);
      }
      // Sorting is now handled by the initial Supabase query order (priority then created_at)
      return displayTasks;
  }, [tasks, statusFilter]);

  // --- Progress Calculation ---
   const progress = useMemo(() => {
    const totalTasks = tasks.length; // Calculate based on ALL tasks for the day fetched
    if (totalTasks === 0) return { count: 0, total: 0, percentage: 0 };
    const completedTasks = tasks.filter(task => task.status === 'done').length;
    return {
        count: completedTasks,
        total: totalTasks,
        percentage: Math.round((completedTasks / totalTasks) * 100)
    };
  }, [tasks]);


  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 gap-4"> {/* Added gap */}
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold">My Tasks</h1>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </p>
          </div>

          {/* Progress Bar & Filter */}
          <div className="flex-grow flex items-center justify-center gap-4">
              <div className="w-full max-w-xs"> {/* Constrained width */}
                <Label className="text-xs text-muted-foreground mb-1 block text-center">
                    Progress: {progress.count}/{progress.total} ({progress.percentage}%)
                </Label>
                <Progress value={progress.percentage} className="h-2" />
              </div>
              <div>
                  <Label htmlFor="statusFilter" className="sr-only">Filter by Status</Label>
                  <Select value={statusFilter} onValueChange={(value: TaskStatusFilter) => setStatusFilter(value)}>
                    <SelectTrigger id="statusFilter" className="h-9 text-xs w-[120px]">
                        <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                        {statusFilters.map(status => (
                            <SelectItem key={status} value={status} className="text-xs">
                                {status === 'all' ? 'All Active' : getStatusLabel(status as Task['status'])}
                            </SelectItem>
                        ))}
                         <SelectItem value="done" className="text-xs">Done</SelectItem> {/* Add Done explicitly if needed */}
                    </SelectContent>
                  </Select>
              </div>
          </div>

          <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={signOut}>
            <LogOut className="h-4 w-4" />
             <span className="sr-only">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto space-y-4 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : (
          <>
            {filteredTasks.map((task) => {
              const isActive = activeTaskId === task.id;
              const isPaused = task.status === 'paused';
              const showAcknowledge = task.reception_notes && !task.reception_note_acknowledged;
              return (
              <Card
                key={task.id}
                className={cn(
                    "overflow-hidden border-l-4 transition-shadow duration-300",
                    isActive ? 'ring-2 ring-offset-2 ring-status-in-progress shadow-md' : 'shadow-sm', // Clearer active indication
                    task.priority && 'border-yellow-500 ring-yellow-500' // Highlight priority
                )}
                style={{ borderLeftColor: task.room.color || 'hsl(var(--border))' }}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-3 px-4">
                   <div>
                     <CardTitle className="text-lg font-semibold">{task.room.name}</CardTitle>
                      <p className="text-xs text-muted-foreground pt-1">
                        {task.cleaning_type} / {task.guest_count} Guest(s) / Limit: {task.time_limit || 'N/A'} min
                      </p>
                    </div>
                   <Badge className={`${getStatusColor(task.status)} text-xs ml-2 flex-shrink-0`}>
                    {getStatusLabel(task.status)}
                  </Badge>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-1 space-y-2">
                    {/* Timer Display */}
                    { (isActive || isPaused) && task.start_time && (
                       <TaskTimerDisplay task={task} />
                    )}

                    {/* Reception Note */}
                    {task.reception_notes && (
                      <div className={cn(
                          "mt-1 p-2 rounded-md border text-xs",
                          showAcknowledge ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-muted/50 border-border text-muted-foreground italic"
                       )}>
                          <p className="flex justify-between items-center">
                              <span className="font-semibold flex items-center"><Info className="h-3 w-3 mr-1 inline"/> Reception:</span>
                               {showAcknowledge && (
                                   <Button size="xs" variant="ghost" className="h-6 px-1 text-blue-700 hover:bg-blue-100" onClick={() => handleAcknowledgeNote(task.id)}>
                                       <Check className="h-3 w-3 mr-1"/> Acknowledge
                                   </Button>
                               )}
                          </p>
                          <p className="mt-1">{task.reception_notes}</p>
                      </div>
                    )}
                     {/* Housekeeping Note */}
                    {task.housekeeping_notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                          <strong>Your Note:</strong> {task.housekeeping_notes}
                      </p>
                    )}
                    {/* Issue Indicator */}
                     {task.issue_flag && (
                        <p className="text-xs text-red-600 mt-1 font-semibold flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1 inline"/> Maintenance Issue Reported
                          {task.issue_description && `: ${task.issue_description}`}
                           {/* Issue Photo Thumbnail */}
                           {task.issue_photo && (
                              <a href={task.issue_photo} target="_blank" rel="noopener noreferrer" className="ml-2 inline-block">
                                <img src={task.issue_photo} alt="Issue photo" className="h-8 w-8 object-cover rounded border"/>
                              </a>
                           )}
                        </p>
                      )}
                </CardContent>
                 <CardFooter className="flex flex-wrap gap-2 pt-2 pb-3 px-4 justify-between items-center bg-muted/30 border-t">
                    {/* Primary Action Buttons */}
                     <div className="flex gap-2 flex-wrap order-1">
                      {task.status === "todo" && (
                        <Button size="sm" onClick={() => handleStart(task.id)} disabled={!!activeTaskId} className="bg-green-600 hover:bg-green-700 text-white"> <Play className="mr-1 h-4 w-4" /> Start </Button>
                      )}
                      {task.status === "in_progress" && ( <>
                           <Button size="sm" variant="outline" onClick={() => handlePause(task.id)} className="text-orange-600 border-orange-600 hover:bg-orange-50"> <Pause className="mr-1 h-4 w-4" /> Pause </Button>
                           <Button size="sm" onClick={() => handleStop(task.id)} className="bg-blue-600 hover:bg-blue-700 text-white"> <Square className="mr-1 h-4 w-4" /> Stop </Button>
                      </>)}
                      {task.status === "paused" && ( <>
                           <Button size="sm" onClick={() => handleResume(task.id)} disabled={!!activeTaskId} className="bg-green-600 hover:bg-green-700 text-white"> <Play className="mr-1 h-4 w-4" /> Resume </Button>
                           <Button size="sm" variant="outline" onClick={() => handleStop(task.id)} className="text-blue-600 border-blue-600 hover:bg-blue-50"> <Square className="mr-1 h-4 w-4" /> Stop </Button>
                      </>)}
                    </div>

                   {/* Secondary Action Buttons */}
                   {(task.status !== 'done' || task.status === 'repair_needed') && ( // Show even if done or repair needed
                     <div className="flex gap-2 flex-wrap order-2">
                        <Dialog onOpenChange={(open) => { if (open) { setNoteTaskId(task.id); setCurrentNote(task.housekeeping_notes || ""); } else { setNoteTaskId(null); setCurrentNote(""); }}}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-200 px-2"> <MessageSquare className="mr-1 h-4 w-4" /> Note </Button>
                          </DialogTrigger>
                          <DialogContent>
                             {/* ... Note Modal Content ... */}
                               <DialogHeader> <DialogTitle>Note for Room {task.room.name}</DialogTitle> <DialogDescription> Add housekeeping notes. </DialogDescription> </DialogHeader>
                               <div className="py-4"><Textarea id="note" value={currentNote} onChange={(e) => setCurrentNote(e.target.value)} className="min-h-[100px]" placeholder="E.g., Extra towels requested..." /></div>
                               <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><DialogClose asChild><Button type="button" onClick={handleSaveNote}>Save Note</Button></DialogClose></DialogFooter>
                          </DialogContent>
                        </Dialog>

                      {!task.issue_flag && task.status !== 'done' && ( // Don't allow reporting issue if already done (unless also repair_needed?)
                         <Dialog onOpenChange={(open) => { if (open) { setIssueTaskId(task.id); } else { setIssueTaskId(null); setIssueDescription(""); setIssuePhoto(null); setIssuePhotoPreview(null); }}}>
                          <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 px-2"> <AlertTriangle className="mr-1 h-4 w-4" /> Report Issue </Button>
                          </DialogTrigger>
                           <DialogContent>
                             {/* ... Issue Modal Content with Preview ... */}
                                <DialogHeader> <DialogTitle>Report Issue for Room {task.room.name}</DialogTitle> <DialogDescription> Describe the issue and optionally add a photo. </DialogDescription> </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <Label htmlFor="issueDescription-modal" className="sr-only">Description*</Label>
                                    <Textarea id="issueDescription-modal" value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)} className="min-h-[100px]" placeholder="E.g., Leaking faucet..." required />
                                    <Label htmlFor="issuePhoto-modal" className="sr-only">Photo (Optional)</Label>
                                    <Input id="issuePhoto-modal" type="file" accept="image/*" onChange={handlePhotoSelect} />
                                    {issuePhotoPreview && <img src={issuePhotoPreview} alt="Issue preview" className="mt-2 max-h-32 w-auto object-contain rounded border mx-auto"/>}
                                </div>
                                <DialogFooter><DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose><DialogClose asChild><Button type="button" onClick={handleReportIssue} disabled={!issueDescription.trim()}>Report</Button></DialogClose></DialogFooter>
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

        {!loading && filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
             <Card className="p-6">
                <p className="text-lg font-medium text-muted-foreground">
                    {statusFilter === 'all' ? '🎉 No active tasks assigned for today!' : `No tasks found with status: ${getStatusLabel(statusFilter as Task['status'])}`}
                </p>
                <p className="text-sm text-muted-foreground">
                    {statusFilter === 'all' ? 'Enjoy your day or check back later.' : 'Try changing the filter.'}
                </p>
             </Card>
          </div>
        )}
      </main>

       {/* Ensure consistent footer/padding */}
       <footer className="h-10"></footer>
    </div>
  );
}

// -- Helper Component for Timer Display --
const TaskTimerDisplay: React.FC<{ task: Task }> = ({ task }) => {
    const elapsedSeconds = useTaskTimer(task.start_time, task.total_pause, task.status);

    const formatTime = (totalSeconds: number | null): string => {
        if (totalSeconds === null) return "00:00";
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const elapsedMinutes = elapsedSeconds !== null ? Math.floor(elapsedSeconds / 60) : 0;
    const timeLimit = task.time_limit ?? 0; // Treat null limit as 0 for calculation
    const remainingMinutes = timeLimit > 0 ? Math.max(0, timeLimit - elapsedMinutes) : null; // Calculate remaining or null if no limit
    const isOverTime = timeLimit > 0 && elapsedMinutes > timeLimit;

    return (
        <div className="text-xs text-muted-foreground flex justify-between items-center mt-1">
            <span>Elapsed: <span className={cn("font-medium", isOverTime ? "text-red-600" : "text-foreground")}>{formatTime(elapsedSeconds)}</span></span>
            {timeLimit > 0 && (
                <span>Limit: {timeLimit}m {remainingMinutes !== null ? `(${remainingMinutes}m left)` : ''}</span>
            )}
        </div>
    );
};
