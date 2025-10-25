import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Task = {
  id: string;
  date: string;
  status: string;
  room: { name: string; color: string | null; group_type: string };
  user: { name: string } | null;
  cleaning_type: string;
  guest_count: number;
  time_limit: number | null;
  actual_time: number | null;
  difference: number | null;
  reception_notes: string | null;
  housekeeping_notes: string | null;
  stop_time: string | null;
};

export default function Archive() {
  const { toast } = useToast();
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchArchivedTasks();
  }, [startDate, endDate]);

  const fetchArchivedTasks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("tasks")
        .select(`
          id, date, status, cleaning_type, guest_count, time_limit, actual_time, 
          difference, reception_notes, housekeeping_notes, stop_time,
          room:rooms!inner(name, color, group_type),
          user:users(name)
        `)
        .eq("status", "done")
        .order("date", { ascending: false })
        .order("stop_time", { ascending: false });

      if (startDate) query = query.gte("date", startDate);
      if (endDate) query = query.lte("date", endDate);

      const { data, error } = await query;
      if (error) throw error;
      setArchivedTasks(data as Task[]);
    } catch (error: any) {
      console.error("Error fetching archived tasks:", error);
      toast({ title: "Error", description: "Failed to load archived tasks", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
    });
  };

  // Split tasks into two groups
  const regularTasks = archivedTasks.filter(task => task.room.group_type !== 'OTHER');
  const otherTasks = archivedTasks.filter(task => task.room.group_type === 'OTHER');

  const renderTaskTable = (taskList: Task[], emptyMessage: string) => (
    loading ? (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="ml-2">Loading archived tasks...</span>
      </div>
    ) : taskList.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
        <p className="text-sm text-muted-foreground">Adjust the date range to see more results</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Date</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Guests</TableHead>
              <TableHead className="text-center">Limit</TableHead>
              <TableHead className="text-center">Actual</TableHead>
              <TableHead className="text-center">Diff</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskList.map((task) => (
              <TableRow key={task.id}>
                <TableCell>{formatDate(task.date)}</TableCell>
                <TableCell>
                  <span
                    className="inline-block w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: task.room.color || '#ccc' }}
                  />
                  {task.room.name}
                </TableCell>
                <TableCell>{task.user?.name || "Unassigned"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{task.cleaning_type}</Badge>
                </TableCell>
                <TableCell className="text-center">{task.guest_count}</TableCell>
                <TableCell className="text-center">{task.time_limit ?? "-"}</TableCell>
                <TableCell className="text-center">{task.actual_time ?? "-"}</TableCell>
                <TableCell className="text-center">
                  {task.difference !== null && (
                    <span className={task.difference > 0 ? "text-red-600" : "text-green-600"}>
                      {task.difference > 0 ? "+" : ""}{task.difference}
                    </span>
                  )}
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {task.housekeeping_notes || task.reception_notes || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Archive</h1>
        <p className="text-muted-foreground mt-1">Review completed tasks and performance history</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date Range Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <div className="relative">
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <div className="relative">
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="regular" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="regular">Hotel Rooms ({regularTasks.length})</TabsTrigger>
          <TabsTrigger value="other">Other Locations ({otherTasks.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="regular">
          <Card>
            <CardHeader>
              <CardTitle>Completed Hotel Room Tasks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(regularTasks, "No completed hotel room tasks found")}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other">
          <Card>
            <CardHeader>
              <CardTitle>Completed Other Location Tasks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(otherTasks, "No completed other location tasks found")}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
