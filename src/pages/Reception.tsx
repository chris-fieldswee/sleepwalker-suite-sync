import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskTableRow } from "@/components/reception/TaskTableRow";
import { TaskFilters } from "@/components/reception/TaskFilters";
import { LogOut, Plus, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  date: string;
  status: string;
  room: { name: string; group_type: string };
  user: { id: string; name: string } | null;
  cleaning_type: string;
  guest_count: number;
  time_limit: number;
  actual_time: number | null;
  difference: number | null;
  issue_flag: boolean;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  start_time: string | null;
  stop_time: string | null;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

export default function Reception() {
  const { signOut, userRole } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split("T")[0]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStaffId, setFilterStaffId] = useState("all");
  const [filterRoomGroup, setFilterRoomGroup] = useState("all");
  
  const { toast } = useToast();

  useEffect(() => {
    if (userRole !== "reception" && userRole !== "admin") {
      return;
    }

    fetchStaff();
    fetchTasks();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("reception-tasks-channel")
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
  }, [userRole, filterDate, filterStatus, filterStaffId, filterRoomGroup]);

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, role")
      .eq("role", "housekeeping")
      .eq("active", true)
      .order("name");

    if (!error && data) {
      setAllStaff(data);
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    
    let query = supabase
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
        issue_flag,
        housekeeping_notes,
        reception_notes,
        start_time,
        stop_time,
        room:rooms(name, group_type),
        user:users(id, name)
      `)
      .eq("date", filterDate)
      .order("created_at", { ascending: true });

    // Apply filters
    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus as any);
    }

    if (filterStaffId !== "all") {
      if (filterStaffId === "unassigned") {
        query = query.is("user_id", null);
      } else {
        query = query.eq("user_id", filterStaffId);
      }
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      });
      setTasks([]);
    } else {
      let filteredData = data as any;
      
      // Filter by room group
      if (filterRoomGroup !== "all") {
        filteredData = filteredData.filter(
          (task: any) => task.room.group_type === filterRoomGroup
        );
      }
      
      setTasks(filteredData);
    }
    
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTasks();
    setTimeout(() => setRefreshing(false), 500);
    toast({ title: "Data refreshed" });
  };

  const handleClearFilters = () => {
    setFilterDate(new Date().toISOString().split("T")[0]);
    setFilterStatus("all");
    setFilterStaffId("all");
    setFilterRoomGroup("all");
  };

  const getFilteredTasksCount = () => {
    return {
      total: tasks.length,
      todo: tasks.filter((t) => t.status === "todo").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
      repair: tasks.filter((t) => t.issue_flag).length,
    };
  };

  const stats = getFilteredTasksCount();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-20 shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Reception Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Housekeeping Operations Management
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
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
        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                To Clean
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-status-todo">
                {stats.todo}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-status-in-progress">
                {stats.inProgress}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-status-done">
                {stats.done}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-status-repair">
                {stats.repair}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskFilters
              date={filterDate}
              status={filterStatus}
              staffId={filterStaffId}
              roomGroup={filterRoomGroup}
              staff={allStaff}
              onDateChange={setFilterDate}
              onStatusChange={setFilterStatus}
              onStaffChange={setFilterStaffId}
              onRoomGroupChange={setFilterRoomGroup}
              onClearFilters={handleClearFilters}
            />
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card>
          <CardHeader>
            <CardTitle>Tasks for {new Date(filterDate).toLocaleDateString()}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-lg font-medium text-muted-foreground">
                  No tasks found
                </p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your filters or create a new task
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Room</TableHead>
                      <TableHead className="font-semibold">Staff</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold text-center">Guests</TableHead>
                      <TableHead className="font-semibold text-center">Limit (min)</TableHead>
                      <TableHead className="font-semibold text-center">Actual (min)</TableHead>
                      <TableHead className="font-semibold text-center">Diff (min)</TableHead>
                      <TableHead className="font-semibold text-center">Issue</TableHead>
                      <TableHead className="font-semibold">Notes</TableHead>
                      <TableHead className="font-semibold text-center">Working Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TaskTableRow
                        key={task.id}
                        task={task}
                        staff={allStaff}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
