// src/pages/reception/Tasks.tsx
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { TaskFilters, type RoomGroupOption } from "@/components/reception/TaskFilters";
import { TaskTableRow } from "@/components/reception/TaskTableRow";
import { AddTaskDialog } from "@/components/reception/AddTaskDialog";
import { WorkLogDialog } from "@/components/reception/WorkLogDialog";
import { TaskDetailDialog } from "@/components/reception/TaskDetailDialog";
import { TaskSummaryFooter } from "@/components/reception/TaskSummaryFooter"; // Import the footer
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["task_status"];
type RoomGroup = Database["public"]["Enums"]["room_group"];

export interface Task {
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
  issue_description: string | null; // Added based on TaskTableRow usage
  issue_photo: string | null; // Added based on TaskTableRow usage
  housekeeping_notes: string | null;
  reception_notes: string | null;
  start_time: string | null;
  stop_time: string | null;
  pause_start: string | null; // Keep if needed by TaskDetailDialog or logic
  pause_stop: string | null; // Keep if needed by TaskDetailDialog or logic
  total_pause: number | null; // Keep if needed by TaskDetailDialog or logic
  created_at?: string;
}

export interface Staff {
  id: string;
  name: string;
  role: string;
}

export interface Room {
  id: string;
  name: string;
  group_type: RoomGroup;
  capacity: number;
  color?: string | null;
}

export interface WorkLog {
  id: string;
  user_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  total_minutes: number | null;
  break_minutes: number | null;
  notes: string | null;
  user: { name: string };
}

const getTodayDateString = () => new Date().toISOString().split("T")[0];

const getDisplayDate = (dateStr: string | null) => {
  if (!dateStr) return "Upcoming Tasks";
  try {
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });
  } catch (e) {
    return dateStr;
  }
};

const allRoomGroups: RoomGroupOption[] = [
  { value: 'all', label: 'All Groups' },
  { value: 'P1', label: 'P1' },
  { value: 'P2', label: 'P2' },
  { value: 'A1S', label: 'A1S' },
  { value: 'A2S', label: 'A2S' },
  { value: 'OTHER', label: 'Other' },
];

interface TasksProps {
  tasks: Task[];
  allStaff: Staff[];
  availableRooms: Room[];
  workLogs: WorkLog[];
  loading: boolean;
  refreshing: boolean;
  filters: {
    date: string | null;
    status: TaskStatus | 'all';
    staffId: string;
    roomGroup: RoomGroup | 'all';
    roomId: string;
  };
  onDateChange: (date: string | null) => void;
  onStatusChange: (status: TaskStatus | 'all') => void;
  onStaffChange: (staffId: string) => void;
  onRoomGroupChange: (group: RoomGroup | 'all') => void;
  onRoomChange: (roomId: string) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  onAddTask: (task: any) => Promise<boolean>;
  onSaveWorkLog: (log: any) => Promise<boolean>;
  initialNewTaskState: any;
  isSubmittingTask: boolean;
  isSavingLog: boolean;
  onUpdateTask: (taskId: string, updates: any) => Promise<boolean>;
  onDeleteTask: (taskId: string) => Promise<boolean>; // Changed return type to Promise<boolean> based on useReceptionActions
  isUpdatingTask: boolean;
  isDeletingTask: boolean;
}

export default function Tasks({
  tasks,
  allStaff,
  availableRooms,
  workLogs,
  loading,
  refreshing,
  filters,
  onDateChange,
  onStatusChange,
  onStaffChange,
  onRoomGroupChange,
  onRoomChange,
  onClearFilters,
  onRefresh,
  onAddTask,
  onSaveWorkLog,
  initialNewTaskState,
  isSubmittingTask,
  isSavingLog,
  onUpdateTask,
  onDeleteTask,
  isUpdatingTask,
  isDeletingTask,
}: TasksProps) {
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"regular" | "other" | "all">("all");

  const handleViewDetails = (task: Task) => {
    setSelectedTaskForDetail(task);
    setIsDetailDialogOpen(true);
  };

  const handleDelete = async (taskId: string) => {
    const success = await onDeleteTask(taskId); // Await the promise
    // Close dialog only if deletion was successful AND it was the selected task
    if (success && selectedTaskForDetail?.id === taskId) {
      setIsDetailDialogOpen(false);
      setSelectedTaskForDetail(null);
      // Data should refresh via the callback passed to useReceptionActions, no need to call onRefresh here explicitly
    }
  };

  // Split tasks and rooms
  const regularTasks = useMemo(() => tasks.filter(task => task.room.group_type !== 'OTHER'), [tasks]);
  const otherTasks = useMemo(() => tasks.filter(task => task.room.group_type === 'OTHER'), [tasks]);
  const allTasks = useMemo(() => tasks, [tasks]); // All tasks combined
  const regularRooms = useMemo(() => availableRooms.filter(room => room.group_type !== 'OTHER'), [availableRooms]);
  const otherRooms = useMemo(() => availableRooms.filter(room => room.group_type === 'OTHER'), [availableRooms]);
  const regularRoomGroups: RoomGroupOption[] = allRoomGroups.filter(rg => rg.value !== 'OTHER');
  const otherRoomGroups: RoomGroupOption[] = allRoomGroups.filter(rg => rg.value === 'all' || rg.value === 'OTHER');

  // Calculate totals based on the active tab
  const taskTotals = useMemo(() => {
    const tasksToSum = activeTab === "regular" ? regularTasks : activeTab === "other" ? otherTasks : allTasks;
    let totalLimit: number | null = 0;
    let totalActual: number | null = 0;
    let limitIsNull = true;
    let actualIsNull = true;

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
    });

    return {
        totalLimit: limitIsNull ? null : totalLimit,
        totalActual: actualIsNull ? null : totalActual,
        visibleTaskCount: tasksToSum.length
    };
  }, [activeTab, regularTasks, otherTasks, allTasks]);

  const renderTaskTable = (taskList: Task[], emptyMessage: string) => (
    loading && !refreshing ? (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="ml-2">Loading tasks...</span>
      </div>
    ) : taskList.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
        <p className="text-sm text-muted-foreground">Try adjusting filters or add a new task.</p>
      </div>
    ) : (
      // Added max-height and overflow classes here
      <div className="overflow-x-auto max-h-[calc(8*3.5rem)] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 sticky top-0 z-10">
              <TableHead className="font-semibold w-[100px]">Status</TableHead>
              <TableHead className="font-semibold w-[100px]">Room</TableHead>
              <TableHead className="font-semibold w-[150px]">Staff</TableHead>
              <TableHead className="font-semibold text-center w-[80px]">Date</TableHead> {/* Date Header Added */}
              <TableHead className="font-semibold text-center w-[60px]">Type</TableHead>
              <TableHead className="font-semibold text-center w-[80px]">Guests</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Limit</TableHead>
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
                staff={allStaff} // Pass allStaff down for potential display needs in TaskTableRow
                onViewDetails={handleViewDetails}
                onDeleteTask={handleDelete} // Corrected prop name
                isDeleting={isDeletingTask}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  return (
    <div className="space-y-4 pb-20"> {/* Keep pb-20 for footer spacing */}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage active housekeeping tasks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing || loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${(refreshing || loading) ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <WorkLogDialog
            filterDate={filters.date || getTodayDateString()}
            workLogs={workLogs}
            allStaff={allStaff}
            onSave={onSaveWorkLog}
            isSaving={isSavingLog}
          />
          <AddTaskDialog
            availableRooms={availableRooms}
            allStaff={allStaff}
            initialState={initialNewTaskState}
            onSubmit={onAddTask}
            isSubmitting={isSubmittingTask}
          />
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
              <TaskFilters
                date={filters.date}
                status={filters.status}
                staffId={filters.staffId}
                roomGroup={filters.roomGroup}
                roomId={filters.roomId}
                staff={allStaff}
                availableRooms={availableRooms} // All rooms for all locations
                roomGroups={allRoomGroups} // All room groups
                onDateChange={onDateChange}
                onStatusChange={onStatusChange}
                onStaffChange={onStaffChange}
                onRoomGroupChange={onRoomGroupChange}
                onRoomChange={onRoomChange}
                onClearFilters={onClearFilters}
                showRoomGroupFilter={true}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Location Tasks for {getDisplayDate(filters.date)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0"> {/* Removed padding */}
              {renderTaskTable(
                allTasks,
                filters.date
                  ? `No tasks found for ${getDisplayDate(filters.date)} with current filters`
                  : "No upcoming tasks found with current filters"
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
              <TaskFilters
                date={filters.date}
                status={filters.status}
                staffId={filters.staffId}
                roomGroup={filters.roomGroup}
                roomId={filters.roomId}
                staff={allStaff}
                availableRooms={regularRooms}
                roomGroups={regularRoomGroups}
                onDateChange={onDateChange}
                onStatusChange={onStatusChange}
                onStaffChange={onStaffChange}
                onRoomGroupChange={onRoomGroupChange}
                onRoomChange={onRoomChange}
                onClearFilters={onClearFilters}
                showRoomGroupFilter={true}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hotel Room Tasks for {getDisplayDate(filters.date)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0"> {/* Removed padding */}
              {renderTaskTable(
                regularTasks,
                filters.date
                  ? `No hotel room tasks found for ${getDisplayDate(filters.date)} with current filters`
                  : "No upcoming hotel room tasks found with current filters"
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
              <TaskFilters
                date={filters.date}
                status={filters.status}
                staffId={filters.staffId}
                roomGroup="OTHER" // Keep specific group filter if needed
                roomId={filters.roomId}
                staff={allStaff}
                availableRooms={otherRooms}
                roomGroups={otherRoomGroups} // Pass appropriate groups
                onDateChange={onDateChange}
                onStatusChange={onStatusChange}
                onStaffChange={onStaffChange}
                onRoomGroupChange={onRoomGroupChange} // This might be unused if showRoomGroupFilter=false
                onRoomChange={onRoomChange}
                onClearFilters={onClearFilters}
                showRoomGroupFilter={false} // Hide group filter here
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Other Location Tasks for {getDisplayDate(filters.date)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0"> {/* Removed padding */}
              {renderTaskTable(
                otherTasks,
                filters.date
                  ? `No other location tasks found for ${getDisplayDate(filters.date)} with current filters`
                  : "No upcoming other location tasks found with current filters"
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTaskForDetail}
        allStaff={allStaff}
        availableRooms={availableRooms}
        isOpen={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        onUpdate={onUpdateTask}
        isUpdating={isUpdatingTask}
      />

      {/* Render the TaskSummaryFooter */}
      <TaskSummaryFooter
        totalLimit={taskTotals.totalLimit}
        totalActual={taskTotals.totalActual}
        totalDifference={null}
        visibleTaskCount={taskTotals.visibleTaskCount}
        showActual={false}
        showDifference={false}
      />
    </div>
  );
}
