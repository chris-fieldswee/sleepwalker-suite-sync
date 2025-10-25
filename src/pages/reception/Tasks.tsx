// src/pages/reception/Tasks.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskFilters } from "@/components/reception/TaskFilters";
import { AddTaskDialog } from "@/components/reception/AddTaskDialog";
import { WorkLogDialog } from "@/components/reception/WorkLogDialog";
import { TaskTableRow } from "@/components/reception/TaskTableRow";
import type { Task, Staff, Room, WorkLog } from "@/hooks/useReceptionData";
import type { NewTaskState } from "@/hooks/useReceptionActions";
import type { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["task_status"];
type RoomGroup = Database["public"]["Enums"]["room_group"];

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
  onAddTask: (task: NewTaskState) => Promise<boolean>;
  onSaveWorkLog: (logData: any) => Promise<boolean>;
  initialNewTaskState: NewTaskState;
  isSubmittingTask: boolean;
  isSavingLog: boolean;
}

const getTodayDateString = () => new Date().toISOString().split("T")[0];

const getDisplayDate = (dateString: string | null) => {
  if (!dateString) return "Upcoming";
  try {
    return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });
  } catch (e) {
    console.error("Error formatting date string:", dateString, e);
    return dateString;
  }
};

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
  isSavingLog
}: TasksProps) {
  // Split tasks and rooms into two groups based on room group type
  const regularTasks = tasks.filter(task => task.room.group_type !== 'OTHER');
  const otherTasks = tasks.filter(task => task.room.group_type === 'OTHER');
  
  const regularRooms = availableRooms.filter(room => room.group_type !== 'OTHER');
  const otherRooms = availableRooms.filter(room => room.group_type === 'OTHER');

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
              <TableHead className="font-semibold min-w-[200px]">Notes</TableHead>
              <TableHead className="font-semibold text-center">Working Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {taskList.map((task) => (
              <TaskTableRow key={task.id} task={task} staff={allStaff} />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  return (
    <div className="space-y-4">
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

      <Tabs defaultValue="regular" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="regular">Hotel Rooms ({regularTasks.length})</TabsTrigger>
          <TabsTrigger value="other">Other Locations ({otherTasks.length})</TabsTrigger>
        </TabsList>
        
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
            <CardContent className="p-0">
              {renderTaskTable(regularTasks, filters.date ? `No hotel room tasks found for ${getDisplayDate(filters.date)}` : "No upcoming hotel room tasks found")}
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
                roomGroup="OTHER"
                roomId={filters.roomId}
                staff={allStaff}
                availableRooms={otherRooms}
                onDateChange={onDateChange}
                onStatusChange={onStatusChange}
                onStaffChange={onStaffChange}
                onRoomGroupChange={onRoomGroupChange}
                onRoomChange={onRoomChange}
                onClearFilters={onClearFilters}
                showRoomGroupFilter={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Other Location Tasks for {getDisplayDate(filters.date)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(otherTasks, filters.date ? `No other location tasks found for ${getDisplayDate(filters.date)}` : "No upcoming other location tasks found")}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
