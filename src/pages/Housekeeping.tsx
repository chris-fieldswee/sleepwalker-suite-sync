import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, Play, Pause, Square, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  date: string;
  status: string;
  room: { name: string; group_type: string; color: string };
  cleaning_type: string;
  guest_count: number;
  time_limit: number;
  start_time: string | null;
  pause_start: string | null;
  housekeeping_notes: string | null;
  issue_flag: boolean;
}

export default function Housekeeping() {
  const { signOut, userId, userRole } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
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
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userRole]);

  const fetchTasks = async () => {
    if (!userId) return;
    
    setLoading(true);
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
        housekeeping_notes,
        issue_flag,
        room:rooms(name, group_type, color)
      `)
      .eq("user_id", userId)
      .eq("date", new Date().toISOString().split("T")[0])
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      });
    } else {
      setTasks(data as any);
      const active = data?.find((t) => t.status === "in_progress");
      if (active) setActiveTaskId(active.id);
    }
    setLoading(false);
  };

  const handleStart = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "in_progress",
        start_time: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to start task",
        variant: "destructive",
      });
    } else {
      setActiveTaskId(taskId);
      toast({ title: "Task started" });
    }
  };

  const handlePause = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "paused",
        pause_start: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to pause task",
        variant: "destructive",
      });
    } else {
      setActiveTaskId(null);
      toast({ title: "Task paused" });
    }
  };

  const handleResume = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.pause_start) return;

    const pauseDuration = Math.floor(
      (new Date().getTime() - new Date(task.pause_start).getTime()) / 60000
    );

    // Get current total_pause
    const { data: currentTask } = await supabase
      .from("tasks")
      .select("total_pause")
      .eq("id", taskId)
      .single();

    const { error } = await supabase
      .from("tasks")
      .update({
        status: "in_progress",
        total_pause: (currentTask?.total_pause || 0) + pauseDuration,
        pause_start: null,
      })
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to resume task",
        variant: "destructive",
      });
    } else {
      setActiveTaskId(taskId);
      toast({ title: "Task resumed" });
    }
  };

  const handleStop = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "done",
        stop_time: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to stop task",
        variant: "destructive",
      });
    } else {
      setActiveTaskId(null);
      toast({ title: "Task completed!" });
    }
  };

  const handleReportIssue = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        issue_flag: true,
        status: "repair_needed",
      })
      .eq("id", taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to report issue",
        variant: "destructive",
      });
    } else {
      toast({ title: "Maintenance issue reported" });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      todo: "bg-status-todo",
      in_progress: "bg-status-in-progress",
      paused: "bg-status-paused",
      done: "bg-status-done",
      repair_needed: "bg-status-repair",
    };
    return colors[status] || "bg-muted";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      todo: "To Clean",
      in_progress: "In Progress",
      paused: "Paused",
      done: "Done",
      repair_needed: "Repair Needed",
    };
    return labels[status] || status;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
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
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

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
                className="overflow-hidden"
                style={{
                  borderLeft: `4px solid ${task.room.color}`,
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{task.room.name}</CardTitle>
                    <Badge className={getStatusColor(task.status)}>
                      {getStatusLabel(task.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Type: {task.cleaning_type} | Guests: {task.guest_count} |
                    Time: {task.time_limit} min
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {task.status === "todo" && (
                    <Button
                      className="w-full"
                      onClick={() => handleStart(task.id)}
                      disabled={activeTaskId !== null}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Start
                    </Button>
                  )}

                  {task.status === "in_progress" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handlePause(task.id)}
                      >
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </Button>
                      <Button onClick={() => handleStop(task.id)}>
                        <Square className="mr-2 h-4 w-4" />
                        Stop
                      </Button>
                    </div>
                  )}

                  {task.status === "paused" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleResume(task.id)}
                        disabled={activeTaskId !== null}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Resume
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleStop(task.id)}
                      >
                        <Square className="mr-2 h-4 w-4" />
                        Stop
                      </Button>
                    </div>
                  )}

                  {!task.issue_flag &&
                    task.status !== "done" &&
                    task.status !== "repair_needed" && (
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => handleReportIssue(task.id)}
                      >
                        <AlertTriangle className="mr-2 h-4 w-4" />
                        Report Maintenance Issue
                      </Button>
                    )}

                  {task.issue_flag && (
                    <Badge variant="destructive" className="w-full py-2">
                      ⚠️ Maintenance Issue Reported
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No tasks assigned
            </p>
            <p className="text-sm text-muted-foreground">
              Check back later or contact reception
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
