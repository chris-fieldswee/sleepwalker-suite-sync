import { useEffect, useState, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { LogOut, Play, Pause, Square, AlertTriangle, MessageSquare, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  date: string;
  status: Database["public"]["Enums"]["task_status"];
  room: { id: string; name: string; group_type: string; color: string };
  cleaning_type: Database["public"]["Enums"]["cleaning_type"];
  guest_count: number;
  time_limit: number;
  start_time: string | null;
  pause_start: string | null;
  pause_stop: string | null; // Added based on migration
  total_pause: number | null; // Added based on migration
  stop_time: string | null; // Added based on migration
  housekeeping_notes: string | null;
  reception_notes: string | null; // Added based on migration
  issue_flag: boolean;
  issue_description: string | null; // Added based on migration
  issue_photo: string | null; // Added based on migration
}

// Import Database type if not already globally available
import type { Database } from "@/integrations/supabase/types";

export default function Housekeeping() {
  const { signOut, userId, userRole } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState("");
  const [noteTaskId, setNoteTaskId] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [issuePhoto, setIssuePhoto] = useState<File | null>(null);
  const [issueTaskId, setIssueTaskId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (userRole !== "housekeeping" || !userId) {
      return;
    }

    fetchTasks();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("my-tasks-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`, // Filter updates for the current user
        },
        (payload) => {
          console.log("Realtime update received:", payload);
          fetchTasks(); // Refetch tasks on any change
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error("Realtime subscription error:", err);
          toast({ title: "Realtime Error", description: "Connection issue, try refreshing.", variant: "destructive"});
        } else {
          console.log("Realtime subscription status:", status);
        }
      });

    return () => {
      console.log("Removing realtime channel");
      supabase.removeChannel(channel);
    };
  }, [userId, userRole]); // Dependency array includes userId and userRole

  const fetchTasks = async () => {
    if (!userId) return;

    // Only set loading true on initial load, not refetches triggered by realtime
    // setLoading(true); // Commented out to prevent flicker on realtime updates
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        id,
        date,
        status,
        cleaning_type,
        guest_count,
        time_limit,
        start_time,
        pause_start,
        pause_stop,
        total_pause,
        stop_time,
        housekeeping_notes,
        reception_notes,
        issue_flag,
        issue_description,
        issue_photo,
        room:rooms(id, name, group_type, color)
      `)
      .eq("user_id", userId)
      .eq("date", new Date().toISOString().split("T")[0])
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to fetch tasks: " + error.message,
        variant: "destructive",
      });
    } else {
      setTasks((data as unknown as Task[]) || []);
      const active = data?.find((t) => t.status === "in_progress");
      setActiveTaskId(active?.id || null);
    }
    setLoading(false); // Ensure loading is set to false after fetch completes
  };

  const handleStart = async (taskId: string) => {
    // Prevent starting if another task is active
    if (activeTaskId && activeTaskId !== taskId) {
      toast({ title: "Action Denied", description: "Another task is already in progress.", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "in_progress",
        start_time: new Date().toISOString(),
        pause_start: null, // Ensure pause_start is cleared
        pause_stop: null,  // Ensure pause_stop is cleared
      })
      .eq("id", taskId)
      .select() // Select to get updated data for realtime
      .single(); // Ensure only one row is updated

    if (error) {
       console.error("Error starting task:", error);
      toast({
        title: "Error",
        description: "Failed to start task: " + error.message,
        variant: "destructive",
      });
    } else {
      setActiveTaskId(taskId);
      toast({ title: "Task started" });
      // No need to call fetchTasks here if realtime is working
    }
  };

  const handlePause = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "paused",
        pause_start: new Date().toISOString(),
        pause_stop: null, // Clear pause_stop when pausing
      })
      .eq("id", taskId)
      .select()
      .single();

    if (error) {
       console.error("Error pausing task:", error);
      toast({
        title: "Error",
        description: "Failed to pause task: " + error.message,
        variant: "destructive",
      });
    } else {
      setActiveTaskId(null); // Clear active task ID when paused
      toast({ title: "Task paused" });
      // No need to call fetchTasks here if realtime is working
    }
  };

 const handleResume = async (taskId: string) => {
    // Prevent resuming if another task is active
    if (activeTaskId && activeTaskId !== taskId) {
        toast({ title: "Action Denied", description: "Another task is already in progress.", variant: "destructive" });
        return;
    }

    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.pause_start) {
        console.error("Cannot resume: Task not found or not paused correctly.");
        toast({ title: "Error", description: "Cannot resume task.", variant: "destructive" });
        return;
    }

    const pauseEndTime = new Date();
    const pauseStartTime = new Date(task.pause_start);
    const pauseDuration = Math.max(0, Math.floor((pauseEndTime.getTime() - pauseStartTime.getTime()) / 60000)); // Ensure duration is not negative

    // Get current total_pause - already available in task state
    const currentTotalPause = task.total_pause || 0;

    const { error } = await supabase
      .from("tasks")
      .update({
        status: "in_progress",
        total_pause: currentTotalPause + pauseDuration,
        pause_start: null, // Clear pause_start
        pause_stop: pauseEndTime.toISOString(), // Set pause_stop
      })
      .eq("id", taskId)
      .select()
      .single();

    if (error) {
      console.error("Error resuming task:", error);
      toast({
        title: "Error",
        description: "Failed to resume task: " + error.message,
        variant: "destructive",
      });
    } else {
      setActiveTaskId(taskId); // Set this task as active again
      toast({ title: "Task resumed" });
      // No need to call fetchTasks here if realtime is working
    }
  };

  const handleStop = async (taskId: string) => {
    // Retrieve the task details first to ensure calculations use latest pause info
     const { data: currentTaskData, error: fetchError } = await supabase
      .from("tasks")
      .select("start_time, total_pause, pause_start, time_limit")
      .eq("id", taskId)
      .single();

     if (fetchError || !currentTaskData) {
       console.error("Error fetching task details before stopping:", fetchError);
       toast({ title: "Error", description: "Could not fetch task details to stop.", variant: "destructive" });
       return;
     }

     const { start_time, total_pause, pause_start, time_limit } = currentTaskData;
     let finalTotalPause = total_pause || 0;
     const stopTime = new Date();

     // If the task was paused when stopped, add the last pause duration
     if (pause_start) {
       const lastPauseStartTime = new Date(pause_start);
       const lastPauseDuration = Math.max(0, Math.floor((stopTime.getTime() - lastPauseStartTime.getTime()) / 60000));
       finalTotalPause += lastPauseDuration;
     }

     let actual_time = null;
     let difference = null;

     if (start_time) {
        const startTime = new Date(start_time);
        actual_time = Math.max(0, Math.floor((stopTime.getTime() - startTime.getTime()) / 60000) - finalTotalPause);

        if (time_limit != null) {
            difference = actual_time - time_limit;
        }
     }


    const { error } = await supabase
      .from("tasks")
      .update({
        status: "done",
        stop_time: stopTime.toISOString(),
        pause_start: null, // Clear pause_start if it was set
        pause_stop: pause_start ? stopTime.toISOString() : null, // Set pause_stop if it was paused
        total_pause: finalTotalPause, // Update total_pause if it was paused
        actual_time: actual_time, // Directly set calculated values
        difference: difference,   // Directly set calculated values
      })
      .eq("id", taskId)
      .select()
      .single();

    if (error) {
      console.error("Error stopping task:", error);
      toast({
        title: "Error",
        description: "Failed to stop task: " + error.message,
        variant: "destructive",
      });
    } else {
      setActiveTaskId(null); // Clear active task ID
      toast({ title: "Task completed!" });
      // No need to call fetchTasks here if realtime is working
    }
  };

  const handleSaveNote = async () => {
    if (!noteTaskId) return;
    const { error } = await supabase
      .from("tasks")
      .update({ housekeeping_notes: currentNote })
      .eq("id", noteTaskId)
      .select()
      .single();

    if (error) {
       console.error("Error saving note:", error);
      toast({ title: "Error", description: "Failed to save note: " + error.message, variant: "destructive" });
    } else {
      toast({ title: "Note saved" });
      setNoteTaskId(null); // Close dialog implicitly via DialogClose
      // No need to call fetchTasks here if realtime is working
    }
  };

  const handleReportIssue = async () => {
    if (!issueTaskId) return;

    let photoUrl = null;
    if (issuePhoto) {
      // Upload photo to Supabase Storage
      const fileExt = issuePhoto.name.split('.').pop();
      const fileName = `${userId}_${issueTaskId}_${Date.now()}.${fileExt}`;
      const filePath = `issue_photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task_issues') // Ensure this bucket exists and has correct policies
        .upload(filePath, issuePhoto);

      if (uploadError) {
        console.error("Error uploading photo:", uploadError);
        toast({ title: "Error", description: "Failed to upload issue photo: " + uploadError.message, variant: "destructive" });
        return; // Stop if photo upload fails
      }

       // Get the public URL
       const { data: urlData } = supabase.storage.from('task_issues').getPublicUrl(filePath);
       photoUrl = urlData?.publicUrl;
    }


    const { error } = await supabase
      .from("tasks")
      .update({
        issue_flag: true,
        issue_description: issueDescription,
        issue_photo: photoUrl, // Store the public URL
        status: "repair_needed", // Set status explicitly
      })
      .eq("id", issueTaskId)
      .select()
      .single();


    if (error) {
       console.error("Error reporting issue:", error);
      toast({
        title: "Error",
        description: "Failed to report issue: " + error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Maintenance issue reported" });
      setIssueTaskId(null); // Close dialog
      setIssueDescription("");
      setIssuePhoto(null);
      // No need to call fetchTasks here if realtime is working
    }
  };


  const getStatusColor = (status: Task['status']) => {
    const colors: Record<Task['status'], string> = {
      todo: "bg-status-todo text-white", // More contrast
      in_progress: "bg-status-in-progress text-white", // More contrast
      paused: "bg-status-paused text-white", // More contrast
      done: "bg-status-done text-white", // More contrast
      repair_needed: "bg-status-repair text-white", // More contrast
    };
    return colors[status] || "bg-muted";
  };

  const getStatusLabel = (status: Task['status']) => {
    const labels: Record<Task['status'], string> = {
      todo: "To Clean",
      in_progress: "In Progress",
      paused: "Paused",
      done: "Done",
      repair_needed: "Repair Needed",
    };
    return labels[status] || status;
  };

  // Calculate progress
   const progress = useMemo(() => {
    const totalTasks = tasks.length;
    if (totalTasks === 0) return 0;
    const completedTasks = tasks.filter(task => task.status === 'done').length;
    return Math.round((completedTasks / totalTasks) * 100);
  }, [tasks]);


  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold">My Tasks</h1>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>
           {/* Progress Bar */}
           <div className="w-1/3 mx-4">
            <Label className="text-xs text-muted-foreground mb-1 block text-center">Daily Progress ({progress}%)</Label>
            <Progress value={progress} className="h-2" />
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto space-y-4 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {tasks.map((task) => (
              <Card
                key={task.id}
                className={`overflow-hidden border-l-4 ${activeTaskId === task.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                style={{
                  borderLeftColor: task.room.color || 'hsl(var(--border))',
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-semibold">{task.room.name}</CardTitle>
                   <Badge className={`${getStatusColor(task.status)} text-xs`}>
                    {getStatusLabel(task.status)}
                  </Badge>
                </CardHeader>
                 <CardContent className="pb-3 pt-1">
                   <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Type:</span> {task.cleaning_type} | <span className="font-medium">Guests:</span> {task.guest_count} | <span className="font-medium">Time:</span> {task.time_limit} min
                  </p>
                   {task.reception_notes && (
                      <p className="text-xs text-blue-600 mt-1 italic">
                          <strong>Note from Reception:</strong> {task.reception_notes}
                      </p>
                   )}
                   {task.housekeeping_notes && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                          <strong>Your Note:</strong> {task.housekeeping_notes}
                      </p>
                   )}
                     {task.issue_flag && (
                        <p className="text-xs text-red-600 mt-1 font-semibold flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1 inline"/> Maintenance Issue Reported
                          {task.issue_description && `: ${task.issue_description}`}
                        </p>
                      )}
                </CardContent>
                 <CardFooter className="flex flex-wrap gap-2 pt-0 pb-4 justify-between items-center">
                    {/* Action Buttons */}
                     <div className="flex gap-2 flex-wrap">
                      {task.status === "todo" && (
                        <Button
                          size="sm"
                          onClick={() => handleStart(task.id)}
                          disabled={!!activeTaskId} // Disable if any task is active
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Play className="mr-1 h-4 w-4" />
                          Start
                        </Button>
                      )}

                      {task.status === "in_progress" && (
                         <>
                           <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePause(task.id)}
                            className="text-orange-600 border-orange-600 hover:bg-orange-50"
                           >
                            <Pause className="mr-1 h-4 w-4" />
                            Pause
                           </Button>
                           <Button
                              size="sm"
                              onClick={() => handleStop(task.id)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                            <Square className="mr-1 h-4 w-4" />
                            Stop
                           </Button>
                         </>
                      )}

                      {task.status === "paused" && (
                         <>
                           <Button
                            size="sm"
                            onClick={() => handleResume(task.id)}
                            disabled={!!activeTaskId} // Disable if any task is active
                             className="bg-green-600 hover:bg-green-700 text-white"
                           >
                            <Play className="mr-1 h-4 w-4" />
                            Resume
                           </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStop(task.id)} // Allow stopping from paused state
                            className="text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            <Square className="mr-1 h-4 w-4" />
                            Stop
                          </Button>
                         </>
                      )}
                    </div>

                   {/* Note and Issue Buttons */}
                   {task.status !== 'done' && (
                     <div className="flex gap-2 flex-wrap">
                       {/* Add/Edit Note Dialog Trigger */}
                        <Dialog onOpenChange={(open) => { if (open) { setNoteTaskId(task.id); setCurrentNote(task.housekeeping_notes || ""); } else { setNoteTaskId(null); setCurrentNote(""); }}}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-gray-600 border-gray-400 hover:bg-gray-50">
                              <MessageSquare className="mr-1 h-4 w-4" /> Note
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Add/Edit Note for Room {task.room.name}</DialogTitle>
                              <DialogDescription>
                                Add any relevant notes about this cleaning task.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Textarea
                                  id="note"
                                  value={currentNote}
                                  onChange={(e) => setCurrentNote(e.target.value)}
                                  className="col-span-3 min-h-[100px]"
                                  placeholder="E.g., Extra towels requested, stain on carpet..."
                                />
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancel</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                  <Button type="button" onClick={handleSaveNote}>Save Note</Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                      {/* Report Issue Dialog Trigger */}
                      {!task.issue_flag && ( // Only show if no issue is already flagged
                         <Dialog onOpenChange={(open) => { if (open) { setIssueTaskId(task.id); } else { setIssueTaskId(null); setIssueDescription(""); setIssuePhoto(null); }}}>
                          <DialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <AlertTriangle className="mr-1 h-4 w-4" /> Report Issue
                              </Button>
                          </DialogTrigger>
                           <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Report Issue for Room {task.room.name}</DialogTitle>
                              <DialogDescription>
                                Describe the maintenance issue and optionally upload a photo.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Label htmlFor="issueDescription" className="text-right">
                                  Description*
                                </Label>
                                <Textarea
                                  id="issueDescription"
                                  value={issueDescription}
                                  onChange={(e) => setIssueDescription(e.target.value)}
                                  className="col-span-3 min-h-[100px]"
                                  placeholder="E.g., Leaking faucet, broken lamp, TV not working..."
                                  required
                                />
                                <Label htmlFor="issuePhoto" className="text-right">
                                  Photo (Optional)
                                </Label>
                                <Input
                                  id="issuePhoto"
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => setIssuePhoto(e.target.files ? e.target.files[0] : null)}
                                  className="col-span-3"
                               />
                               {issuePhoto && <p className="text-xs col-span-4 text-center text-muted-foreground">{issuePhoto.name}</p>}
                            </div>
                            <DialogFooter>
                               <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancel</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                  <Button type="button" onClick={handleReportIssue} disabled={!issueDescription.trim()}>Report</Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                     </div>
                   )}
                </CardFooter>
              </Card>
            ))}
          </>
        )}

        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
             <Card className="p-6">
                <p className="text-lg font-medium text-muted-foreground">
                  🎉 No tasks assigned for today!
                </p>
                <p className="text-sm text-muted-foreground">
                  Enjoy your day or check back later.
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
