// src/pages/reception/Archive.tsx
import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TaskTableRow } from "@/components/reception/TaskTableRow";
import { TaskDetailDialog } from "@/components/reception/TaskDetailDialog";
import type { Database } from "@/integrations/supabase/types";
import type { Staff, Room } from "@/hooks/useReceptionData";

// Keep Task type consistent (you might want to centralize this type)
type Task = {
  id: string;
  date: string;
  status: string; // Keep as string if TaskTableRow uses string status
  room: { id: string; name: string; group_type: string; color: string | null };
  user: { id: string; name: string } | null;
  cleaning_type: Database["public"]["Enums"]["cleaning_type"];
  guest_count: number;
  time_limit: number | null;
  actual_time: number | null;
  difference: number | null;
  issue_flag: boolean;
  issue_description: string | null; // Needed for TaskDetailDialog
  issue_photo: string | null; // Needed for TaskDetailDialog
  housekeeping_notes: string | null;
  reception_notes: string | null;
  start_time: string | null; // Needed for TaskDetailDialog
  stop_time: string | null; // Needed for TaskDetailDialog
  pause_start: string | null; // Keep if needed by TaskDetailDialog or logic
  pause_stop: string | null; // Keep if needed by TaskDetailDialog or logic
  total_pause: number | null; // Keep if needed by TaskDetailDialog or logic
  created_at?: string;
};

// Interface for props received from Reception.tsx
interface ArchiveProps {
  allStaff: Staff[];
  availableRooms: Room[];
  onUpdateTask: (taskId: string, updates: any) => Promise<boolean>;
  onDeleteTask: (taskId: string) => Promise<boolean>; // Changed return type
  isUpdatingTask: boolean;
  isDeletingTask: boolean;
}

export default function Archive({
  allStaff,
  availableRooms,
  onUpdateTask,
  onDeleteTask,
  isUpdatingTask,
  isDeletingTask
}: ArchiveProps) {
  const { toast } = useToast();
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // State for Task Detail Dialog
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Fetch tasks when date range changes
  const fetchArchivedTasks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("tasks")
        .select(`
          id, date, status, cleaning_type, guest_count, time_limit, actual_time,
          difference, issue_flag, housekeeping_notes, reception_notes, start_time,
          stop_time, issue_description, issue_photo, pause_start, pause_stop, total_pause, created_at,
          room:rooms!inner(id, name, color, group_type),
          user:users(id, name, first_name, last_name)
        `)
        .eq("status", "done") // Primarily fetch 'done' tasks for archive
        .order("date", { ascending: false })
        .order("stop_time", { ascending: false }) // Order by completion time
        .limit(500); // Limit results for performance

      if (startDate) {
        query = query.gte("date", startDate);
      }
      if (endDate) {
        query = query.lte("date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Construct display name for user
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
        title: "Error Loading Archive",
        description: `Failed to load archived tasks: ${error.message}`,
        variant: "destructive",
      });
      setArchivedTasks([]); // Clear tasks on error
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, toast]); // Include toast dependency

  useEffect(() => {
    fetchArchivedTasks();
  }, [fetchArchivedTasks]);

  // Handler to open the detail dialog
  const handleViewDetails = (task: Task) => {
    setSelectedTask(task);
    setIsDetailDialogOpen(true);
  };

  // Handler for deleting task
  const handleDelete = async (taskId: string) => {
    const success = await onDeleteTask(taskId);
    if (success) {
      fetchArchivedTasks(); // Refetch after successful delete
      if (selectedTask?.id === taskId) {
        setIsDetailDialogOpen(false);
        setSelectedTask(null);
      }
    }
  };

  // Format date as DD.MM for display range
  const formatDateForRange = (dateString: string) => {
    if (!dateString) return '';
    try {
      // Assuming dateString is YYYY-MM-DD
      const parts = dateString.split('-');
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`; // DD.MM.YYYY
      }
      // Fallback for unexpected formats
      const date = new Date(dateString + 'T00:00:00Z'); // Use UTC to avoid timezone shifts
      if (isNaN(date.getTime())) return dateString;
       return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }); // Format as DD/MM/YYYY
    } catch (error) {
      console.error("Date formatting error:", error, dateString);
      return dateString;
    }
  };


  // Reusable function to render the table for a task list
  const renderTaskTable = (taskList: Task[], emptyMessage: string) => (
    loading ? (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="ml-2">Loading archived tasks...</span>
      </div>
    ) : taskList.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
        <p className="text-sm text-muted-foreground">Adjust the date range or wait for tasks to be completed.</p>
      </div>
    ) : (
      <div className="overflow-x-auto"> {/* No max-height/scroll needed usually for archive */}
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead className="text-center w-[80px]">Date</TableHead> {/* Date Header */}
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
                staff={allStaff} // Pass staff for potential display consistency
                onViewDetails={handleViewDetails}
                onDeleteTask={handleDelete} // Pass delete handler
                isDeleting={isDeletingTask} // Pass deleting state
              />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  const getDisplayDateRange = () => {
    if (startDate && endDate) {
      return `${formatDateForRange(startDate)} - ${formatDateForRange(endDate)}`;
    } else if (startDate) {
      return `From ${formatDateForRange(startDate)}`;
    } else if (endDate) {
      return `Until ${formatDateForRange(endDate)}`;
    }
    return "All Completed Tasks"; // More descriptive default
  };


  return (
    <div className="space-y-6"> {/* No pb-20 needed for archive */}
      {/* Header with Date Range Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Archive - {getDisplayDateRange()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full sm:w-auto">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:max-w-[200px]" // Responsive width
              />
            </div>
            <div className="flex-1 w-full sm:w-auto">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined} // Prevent end date before start date
                className="w-full sm:max-w-[200px]" // Responsive width
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
            <CardContent className="pt-6"> {/* Keep padding for Archive table */}
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
            <CardContent className="pt-6"> {/* Keep padding for Archive table */}
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

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        allStaff={allStaff}
        availableRooms={availableRooms} // Pass available rooms
        isOpen={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onUpdate={async (taskId, updates) => { // Handle update and refetch
            const success = await onUpdateTask(taskId, updates);
            if (success) fetchArchivedTasks(); // Refetch on successful update
            return success;
         }}
        isUpdating={isUpdatingTask}
      />
    </div>
  );
}
