import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  date: string;
  status: string;
  room: { name: string; group_type: string; color: string };
  user: { name: string } | null;
  cleaning_type: string;
  guest_count: number;
  time_limit: number;
  actual_time: number | null;
  difference: number | null;
  start_time: string | null;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  issue_flag: boolean;
}

export default function Reception() {
  const { signOut, userRole } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (userRole !== "reception" && userRole !== "admin") {
      return;
    }

    fetchTasks();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel("tasks-channel")
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
  }, [userRole]);

  const fetchTasks = async () => {
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
        actual_time,
        difference,
        start_time,
        housekeeping_notes,
        reception_notes,
        issue_flag,
        room:rooms(name, group_type, color),
        user:users(name)
      `)
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
    }
    setLoading(false);
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Reception Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tasks.map((task) => (
              <Card key={task.id} className="overflow-hidden">
                <CardHeader
                  className="pb-3"
                  style={{ backgroundColor: task.room.color }}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold">
                      {task.room.name}
                    </CardTitle>
                    <Badge className={getStatusColor(task.status)}>
                      {getStatusLabel(task.status)}
                    </Badge>
                  </div>
                  <p className="text-sm opacity-80">
                    Type: {task.cleaning_type} | Guests: {task.guest_count}
                  </p>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Staff:</span>
                      <span className="font-medium">
                        {task.user?.name || "Unassigned"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time Limit:</span>
                      <span className="font-medium">{task.time_limit} min</span>
                    </div>
                    {task.actual_time && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Actual Time:
                          </span>
                          <span className="font-medium">
                            {task.actual_time} min
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Difference:
                          </span>
                          <span
                            className={`font-medium ${
                              (task.difference || 0) > 0
                                ? "text-destructive"
                                : "text-status-done"
                            }`}
                          >
                            {task.difference > 0 ? "+" : ""}
                            {task.difference} min
                          </span>
                        </div>
                      </>
                    )}
                    {task.issue_flag && (
                      <Badge variant="destructive" className="w-full">
                        ⚠️ Maintenance Issue Reported
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No tasks for today
            </p>
            <p className="text-sm text-muted-foreground">
              Create a new task to get started
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
