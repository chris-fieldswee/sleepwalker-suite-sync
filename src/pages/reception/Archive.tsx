// src/pages/reception/Archive.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
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
import { ArchiveTaskFilters, type RoomGroupOption } from "@/components/reception/ArchiveTaskFilters";
import { TaskSummaryFooter } from "@/components/reception/TaskSummaryFooter";
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

type TaskStatus = Database["public"]["Enums"]["task_status"];
type RoomGroup = Database["public"]["Enums"]["room_group"];

const allRoomGroups: RoomGroupOption[] = [
  { value: 'all', label: 'All Groups' },
  { value: 'P1', label: 'P1' },
  { value: 'P2', label: 'P2' },
  { value: 'A1S', label: 'A1S' },
  { value: 'A2S', label: 'A2S' },
  { value: 'OTHER', label: 'Other' },
];

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

  // State for Task Detail Dialog
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Filter state
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>("all");
  const [filterStaffId, setFilterStaffId] = useState<string>("all");
  const [filterRoomGroup, setFilterRoomGroup] = useState<RoomGroup | 'all'>("all");
  const [filterRoomId, setFilterRoomId] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"regular" | "other" | "all">("all");

  // Split tasks by room group type
  const regularTasks = useMemo(() => 
    archivedTasks.filter(task => task.room.group_type !== 'OTHER'), 
    [archivedTasks]
  );
  const otherTasks = useMemo(() => 
    archivedTasks.filter(task => task.room.group_type === 'OTHER'), 
    [archivedTasks]
  );
  const allTasks = useMemo(() => archivedTasks, [archivedTasks]);

  // Filter rooms by group type
  const regularRooms = useMemo(() => availableRooms.filter(room => room.group_type !== 'OTHER'), [availableRooms]);
  const otherRooms = useMemo(() => availableRooms.filter(room => room.group_type === 'OTHER'), [availableRooms]);
  const regularRoomGroups: RoomGroupOption[] = allRoomGroups.filter(rg => rg.value !== 'OTHER');
  const otherRoomGroups: RoomGroupOption[] = allRoomGroups.filter(rg => rg.value === 'all' || rg.value === 'OTHER');

  // Fetch tasks when date range changes
  const fetchArchivedTasks = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      let query = supabase
        .from("tasks")
        .select(`
          id, date, status, cleaning_type, guest_count, time_limit, actual_time,
          difference, issue_flag, housekeeping_notes, reception_notes, start_time,
          stop_time, issue_description, issue_photo, pause_start, pause_stop, total_pause, created_at,
          room:rooms!inner(id, name, color, group_type),
          user:users(id, name, first_name, last_name)
        `)
        .order("date", { ascending: false })
        .order("stop_time", { ascending: false }) // Order by completion time
        .limit(500); // Limit results for performance

      // Archive includes: done tasks + active tasks from yesterday and before
      query = query.or(`status.eq.done,and(status.in.(todo,in_progress,paused,repair_needed),date.lt.${today})`);

      // No date range filters - show all historical tasks

      // Apply status filter
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      // Apply staff filter
      if (filterStaffId !== "all") {
        if (filterStaffId === "unassigned") {
          query = query.is("user_id", null);
        } else {
          query = query.eq("user_id", filterStaffId);
        }
      }

      // Apply room group filter
      if (filterRoomGroup !== "all") {
        query = query.eq("room.group_type", filterRoomGroup);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Apply room ID filter client-side
      let filteredData = data || [];
      if (filterRoomId !== "all") {
        filteredData = filteredData.filter((task: any) => task.room.id === filterRoomId);
      }

      // Construct display name for user
      const tasksWithDisplayNames = filteredData.map((task: any) => ({
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
  }, [filterStatus, filterStaffId, filterRoomGroup, filterRoomId, toast]);

  useEffect(() => {
    fetchArchivedTasks();
  }, [fetchArchivedTasks]);

  // Calculate totals based on the active tab
  const taskTotals = useMemo(() => {
    const tasksToSum = activeTab === "regular" ? regularTasks : activeTab === "other" ? otherTasks : allTasks;
    let totalLimit: number | null = 0;
    let totalActual: number | null = 0;
    let totalDifference: number | null = 0;
    let limitIsNull = true;
    let actualIsNull = true;
    let differenceIsNull = true;

    tasksToSum.forEach(task => {
        // Ensure time_limit is treated as a number
        const limit = typeof task.time_limit === 'number' ? task.time_limit : null;
        if (limit !== null) {
            totalLimit = (totalLimit ?? 0) + limit;
            limitIsNull = false;
        }
        // Ensure actual_time is treated as a number
        const actual = typeof task.actual_time === 'number' ? task.actual_time : null;
        if (actual !== null) {
            totalActual = (totalActual ?? 0) + actual;
            actualIsNull = false;
        }
        // Calculate difference (actual - limit)
        const difference = typeof task.difference === 'number' ? task.difference : null;
        if (difference !== null) {
            totalDifference = (totalDifference ?? 0) + difference;
            differenceIsNull = false;
        }
    });

    return {
        totalLimit: limitIsNull ? null : totalLimit,
        totalActual: actualIsNull ? null : totalActual,
        totalDifference: differenceIsNull ? null : totalDifference,
        visibleTaskCount: tasksToSum.length
    };
  }, [activeTab, regularTasks, otherTasks, allTasks]);

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

  // Clear all filters
  const handleClearFilters = () => {
    setFilterDate(null);
    setFilterStatus("all");
    setFilterStaffId("all");
    setFilterRoomGroup("all");
    setFilterRoomId("all");
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
        <p className="text-sm text-muted-foreground">Try adjusting filters or check the date range.</p>
      </div>
    ) : (
      <div className="overflow-x-auto max-h-[calc(8*3.5rem)] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 sticky top-0 z-10">
              <TableHead className="font-semibold w-[100px]">Status</TableHead>
              <TableHead className="font-semibold w-[100px]">Room</TableHead>
              <TableHead className="font-semibold w-[150px]">Staff</TableHead>
              <TableHead className="font-semibold text-center w-[80px]">Date</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Type</TableHead>
              <TableHead className="font-semibold text-center w-[80px]">Guests</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Limit</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Actual</TableHead>
              <TableHead className="font-semibold text-center w-[80px]">Difference</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Issue</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Notes</TableHead>
              <TableHead className="font-semibold text-right w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskList.map((task) => (
              <TaskTableRow
                key={task.id}
                task={task}
                staff={allStaff}
                onViewDetails={handleViewDetails}
                onDeleteTask={handleDelete}
                isDeleting={isDeletingTask}
                showActualAndDifference={true}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  const getDisplayDateRange = () => {
    return "Historical Tasks"; // More descriptive default
  };


  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Archive</h1>
          <p className="text-muted-foreground mt-1">View completed and historical tasks</p>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={(value) => setActiveTab(value as "regular" | "other" | "all")} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Locations ({allTasks.length})</TabsTrigger>
          <TabsTrigger value="regular">Hotel Rooms ({regularTasks.length})</TabsTrigger>
          <TabsTrigger value="other">Other Locations ({otherTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <ArchiveTaskFilters
                date={filterDate}
                status={filterStatus}
                staffId={filterStaffId}
                roomGroup={filterRoomGroup}
                roomId={filterRoomId}
                staff={allStaff}
                availableRooms={availableRooms}
                roomGroups={allRoomGroups}
                onDateChange={setFilterDate}
                onStatusChange={setFilterStatus}
                onStaffChange={setFilterStaffId}
                onRoomGroupChange={setFilterRoomGroup}
                onRoomChange={setFilterRoomId}
                onClearFilters={handleClearFilters}
                showRoomGroupFilter={true}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Location Tasks for {getDisplayDateRange()}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(
                allTasks,
                "No historical tasks found"
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regular" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <ArchiveTaskFilters
                date={filterDate}
                status={filterStatus}
                staffId={filterStaffId}
                roomGroup={filterRoomGroup}
                roomId={filterRoomId}
                staff={allStaff}
                availableRooms={regularRooms}
                roomGroups={regularRoomGroups}
                onDateChange={setFilterDate}
                onStatusChange={setFilterStatus}
                onStaffChange={setFilterStaffId}
                onRoomGroupChange={setFilterRoomGroup}
                onRoomChange={setFilterRoomId}
                onClearFilters={handleClearFilters}
                showRoomGroupFilter={true}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hotel Room Tasks for {getDisplayDateRange()}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(
                regularTasks,
                "No historical hotel room tasks found"
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <ArchiveTaskFilters
                date={filterDate}
                status={filterStatus}
                staffId={filterStaffId}
                roomGroup="OTHER"
                roomId={filterRoomId}
                staff={allStaff}
                availableRooms={otherRooms}
                roomGroups={otherRoomGroups}
                onDateChange={setFilterDate}
                onStatusChange={setFilterStatus}
                onStaffChange={setFilterStaffId}
                onRoomGroupChange={setFilterRoomGroup}
                onRoomChange={setFilterRoomId}
                onClearFilters={handleClearFilters}
                showRoomGroupFilter={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Other Location Tasks for {getDisplayDateRange()}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(
                otherTasks,
                "No historical other location tasks found"
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        allStaff={allStaff}
        availableRooms={availableRooms}
        isOpen={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onUpdate={async (taskId, updates) => {
            const success = await onUpdateTask(taskId, updates);
            if (success) fetchArchivedTasks();
            return success;
         }}
        isUpdating={isUpdatingTask}
      />

      {/* Task Summary Footer */}
      <TaskSummaryFooter
        totalLimit={taskTotals.totalLimit}
        totalActual={taskTotals.totalActual}
        totalDifference={taskTotals.totalDifference}
        visibleTaskCount={taskTotals.visibleTaskCount}
        showActual={true}
        showDifference={true}
      />
    </div>
  );
}
