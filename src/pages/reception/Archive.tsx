import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TaskTableRow } from "@/components/reception/TaskTableRow";
import type { Database } from "@/integrations/supabase/types";

type Task = {
  id: string;
  date: string;
  status: string;
  room: { id: string; name: string; group_type: string; color: string | null };
  user: { id: string; name: string } | null;
  cleaning_type: Database["public"]["Enums"]["cleaning_type"];
  guest_count: number;
  time_limit: number | null;
  actual_time: number | null;
  difference: number | null;
  issue_flag: boolean;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  start_time: string | null;
  stop_time: string | null;
  issue_description: string | null;
  issue_photo: string | null;
  pause_start: string | null;
  pause_stop: string | null;
  total_pause: number | null;
};

export default function Archive() {
  const { toast } = useToast();
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchArchivedTasks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const fetchArchivedTasks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("tasks")
        .select(`
          id, date, status, cleaning_type, guest_count, time_limit, actual_time,
          difference, issue_flag, housekeeping_notes, reception_notes, start_time,
          stop_time, issue_description, issue_photo, pause_start, pause_stop, total_pause,
          room:rooms!inner(id, name, color, group_type),
          user:users(id, name, first_name, last_name)
        `)
        .eq("status", "done")
        .order("date", { ascending: false })
        .order("stop_time", { ascending: false })
        .limit(500);

      if (startDate) {
        query = query.gte("date", startDate);
      }
      if (endDate) {
        query = query.lte("date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Construct display name for user if first_name and last_name exist
      const tasksWithDisplayNames = (data || []).map((task: any) => ({
        ...task,
        user: task.user ? {
          ...task.user,
          name: task.user.first_name && task.user.last_name
            ? `${task.user.first_name} ${task.user.last_name}`
            : task.user.name
        } : null
      }));

      setArchivedTasks(tasksWithDisplayNames);
    } catch (error: any) {
      console.error("Error fetching archived tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load archived tasks.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString + 'T00:00:00'); // Parse as local date
        if (isNaN(date.getTime())) return dateString;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}.${month}`;
    } catch (error) {
        console.error("Date formatting error:", error, dateString);
        return dateString;
    }
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
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead className="text-center w-[80px]">Type</TableHead>
              <TableHead className="text-center w-[100px]">Guests</TableHead>
              <TableHead className="text-center w-[60px]">Limit</TableHead>
              <TableHead className="text-center w-[60px]">Actual</TableHead>
              <TableHead className="text-center w-[60px]">Issue</TableHead>
              <TableHead className="text-center w-[60px]">Notes</TableHead>
              <TableHead className="text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskList.map((task) => (
              <TaskTableRow
                key={task.id}
                task={task}
                staff={[]}
                onViewDetails={() => {}}
                onDeleteTask={async () => {}}
                isDeleting={false}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  const getDisplayDateRange = () => {
    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    } else if (startDate) {
      return `From ${formatDate(startDate)}`;
    } else if (endDate) {
      return `Until ${formatDate(endDate)}`;
    }
    return "All Time";
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Range Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Archived Tasks - {getDisplayDateRange()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="max-w-[200px]"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="max-w-[200px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Hotel Rooms and Other Locations */}
      <Tabs defaultValue="hotel" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="hotel">
            Hotel Rooms ({regularTasks.length})
          </TabsTrigger>
          <TabsTrigger value="other">
            Other Locations ({otherTasks.length})
          </TabsTrigger>
        </TabsList>

        {/* Hotel Rooms Tab */}
        <TabsContent value="hotel" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {renderTaskTable(
                regularTasks,
                startDate || endDate
                  ? `No completed hotel room tasks found for selected date range`
                  : "No completed hotel room tasks found"
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other Locations Tab */}
        <TabsContent value="other" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {renderTaskTable(
                otherTasks,
                startDate || endDate
                  ? `No completed other location tasks found for selected date range`
                  : "No completed other location tasks found"
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
