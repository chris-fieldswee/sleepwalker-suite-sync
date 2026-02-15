// src/pages/reception/Tasks.tsx
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Download } from "lucide-react";
import { CAPACITY_ID_TO_LABEL } from "@/lib/capacity-utils";
import { TaskFilters, type RoomGroupOption } from "@/components/reception/TaskFilters";
import { TaskTableRow } from "@/components/reception/TaskTableRow";
import { AddTaskDialog } from "@/components/reception/AddTaskDialog";
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
  guest_count: string; // Now stores capacity_id (a, b, c, d, etc.) instead of numeric value
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
  capacity_label?: string | null;
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
  if (!dateStr) return "Nadchodzące zadania";
  try {
    return new Date(dateStr + 'T00:00:00Z').toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });
  } catch (e) {
    return dateStr;
  }
};

const allRoomGroups: RoomGroupOption[] = [
  { value: 'all', label: 'Wszystkie grupy' },
  { value: 'P1', label: 'Pokoje P1' },
  { value: 'P2', label: 'Pokoje P2' },
  { value: 'A1S', label: 'Apartamenty A1S' },
  { value: 'A2S', label: 'Apartamenty A2S' },
  { value: 'OTHER', label: 'Inne Przestrzenie' },
];

// Labels for CSV export (aligned with TaskTableRow)
const statusLabels: Record<string, string> = {
  todo: "Do sprzątania",
  in_progress: "W trakcie",
  paused: "Wstrzymane",
  done: "Gotowe",
  repair_needed: "Naprawa",
};
const cleaningTypeLabels: Record<string, string> = {
  W: "Wyjazd",
  P: "Przyjazd",
  T: "Trakt",
  O: "Odświeżenie",
  G: "Generalne",
  S: "Standard",
};

const escapeCsvCell = (value: string): string => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

function tasksToCsv(tasks: Task[]): string {
  const headers = ["Status", "Pokój", "Personel", "Data", "Typ", "Goście", "Limit", "Rzeczywisty", "Różnica", "Problem", "Notatki"];
  const rows = tasks.map((task) => {
    const status = statusLabels[task.status] ?? task.status;
    const room = task.room?.name ?? "";
    const staff = task.user?.name ?? "";
    const date = task.date ?? "";
    const type = cleaningTypeLabels[task.cleaning_type] ?? task.cleaning_type;
    const guests = CAPACITY_ID_TO_LABEL[task.guest_count] ?? task.guest_count;
    const limit = task.time_limit != null ? String(task.time_limit) : "";
    const actual = task.actual_time != null ? String(task.actual_time) : "";
    const diff = task.difference != null ? (task.difference > 0 ? "+" : "") + String(task.difference) : "";
    const issue = task.issue_flag ? (task.issue_description ? `Tak: ${task.issue_description}` : "Tak") : "Nie";
    const notes = [task.housekeeping_notes, task.reception_notes].filter(Boolean).join("; ") || "";
    return [status, room, staff, date, type, guests, limit, actual, diff, issue, notes].map(escapeCsvCell).join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  onSetFetchAllTasks: (fetchAll: boolean) => void; // New prop to control fetching all tasks
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
  onSetFetchAllTasks,
}: TasksProps) {
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"open" | "all">("open");
  const [dateRangeFrom, setDateRangeFrom] = useState<string | null>(null);
  const [dateRangeTo, setDateRangeTo] = useState<string | null>(null);

  // Always fetch all tasks when on tasks page, filter client-side
  useEffect(() => {
    onSetFetchAllTasks(true);
    // Cleanup: reset to false when component unmounts (optional, but good practice)
    return () => {
      onSetFetchAllTasks(false);
    };
  }, [onSetFetchAllTasks]);

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

  // Get today's date for filtering
  const todayDate = useMemo(() => getTodayDateString(), []);

  // Filter tasks based on active tab and date filter
  // Note: tasks prop is already filtered by status, staff, room group, and room ID from useReceptionData
  // We need to apply the tab-specific date filter here
  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (activeTab === 'open') {
      // Apply date filter if a specific date is selected
      if (filters.date) {
        result = result.filter(task => task.date === filters.date);
      } else {
        // For "open" tab, show all tasks from current and future dates
        result = result.filter(task => task.date >= todayDate);
      }
    } else {
      // "all" tab: apply date range filter when at least one bound is set
      if (dateRangeFrom != null || dateRangeTo != null) {
        const from = dateRangeFrom ?? '0000-01-01';
        const to = dateRangeTo ?? '9999-12-31';
        result = result.filter(task => task.date >= from && task.date <= to);
      }
      // When both null on "all" tab, show all tasks (no additional filtering)
    }

    return result;
  }, [activeTab, tasks, todayDate, filters.date, dateRangeFrom, dateRangeTo]);

  // Calculate counts for tab labels - use all tasks regardless of current filter
  const openTasksCount = useMemo(() => {
    return tasks.filter(task => task.date >= todayDate).length;
  }, [tasks, todayDate]);

  // Calculate all tasks count - this should always show the total
  const allTasksCount = useMemo(() => {
    return tasks.length;
  }, [tasks]);

  // Calculate totals based on the filtered tasks
  const taskTotals = useMemo(() => {
    const tasksToSum = filteredTasks;
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

    const totalDifference =
      totalLimit !== null && totalActual !== null ? totalActual - totalLimit : null;

    return {
      totalLimit: limitIsNull ? null : totalLimit,
      totalActual: actualIsNull ? null : totalActual,
      totalDifference,
      visibleTaskCount: tasksToSum.length
    };
  }, [filteredTasks]);

  const renderTaskTable = (taskList: Task[], emptyMessage: string) => (
    loading && !refreshing ? (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="ml-2">Ładowanie zadań...</span>
      </div>
    ) : taskList.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
        <p className="text-sm text-muted-foreground">Spróbuj zmienić filtry lub dodaj nowe zadanie.</p>
      </div>
    ) : (
      // Added max-height and overflow classes here
      <div className="overflow-x-auto max-h-[calc(8*3.5rem)] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 sticky top-0 z-10">
              <TableHead className="font-semibold w-[100px]">Status</TableHead>
              <TableHead className="font-semibold w-[100px]">Pokój</TableHead>
              <TableHead className="font-semibold w-[150px]">Personel</TableHead>
              <TableHead className="font-semibold text-center w-[80px]">Data</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Typ</TableHead>
              <TableHead className="font-semibold text-center w-[80px]">Goście</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Limit</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Rzeczywisty</TableHead>
              <TableHead className="font-semibold text-center w-[70px]">Różnica</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Problem</TableHead>
              <TableHead className="font-semibold text-center w-[60px]">Notatki</TableHead>
              <TableHead className="font-semibold text-right w-[100px]">Akcje</TableHead>
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
          <h1 className="text-3xl font-bold">Zadania</h1>
          <p className="text-muted-foreground mt-1">Zarządzaj aktywnymi zadaniami sprzątania</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing || loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${(refreshing || loading) ? "animate-spin" : ""}`} />
            Odśwież
          </Button>
          <AddTaskDialog
            availableRooms={availableRooms}
            allStaff={allStaff}
            initialState={initialNewTaskState}
            onSubmit={onAddTask}
            isSubmitting={isSubmittingTask}
          />
        </div>
      </div>

      <Tabs defaultValue="open" value={activeTab} onValueChange={(value) => setActiveTab(value as "open" | "all")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="open">Zadania otwarte ({openTasksCount})</TabsTrigger>
          <TabsTrigger value="all">Wszystkie zadania ({allTasksCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-lg">Filtry</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <TaskFilters
                date={filters.date}
                status={filters.status}
                staffId={filters.staffId}
                roomGroup={filters.roomGroup}
                roomId={filters.roomId}
                staff={allStaff}
                availableRooms={availableRooms}
                roomGroups={allRoomGroups}
                onDateChange={onDateChange}
                onStatusChange={onStatusChange}
                onStaffChange={onStaffChange}
                onRoomGroupChange={onRoomGroupChange}
                onRoomChange={onRoomChange}
                onClearFilters={onClearFilters}
                showRoomGroupFilter={true}
                allowPastDates={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zadania otwarte dla {getDisplayDate(filters.date)} ({filteredTasks.length} zadań)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(
                filteredTasks,
                filters.date
                  ? `Nie znaleziono otwartych zadań dla ${getDisplayDate(filters.date)} z obecnymi filtrami`
                  : "Nie znaleziono otwartych zadań z obecnymi filtrami"
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-lg">Filtry</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <TaskFilters
                date={filters.date}
                status={filters.status}
                staffId={filters.staffId}
                roomGroup={filters.roomGroup}
                roomId={filters.roomId}
                staff={allStaff}
                availableRooms={availableRooms}
                roomGroups={allRoomGroups}
                onDateChange={onDateChange}
                onStatusChange={onStatusChange}
                onStaffChange={onStaffChange}
                onRoomGroupChange={onRoomGroupChange}
                onRoomChange={onRoomChange}
                onClearFilters={onClearFilters}
                showRoomGroupFilter={true}
                allowPastDates={true}
                showDoneStatus={true}
                showDateRange={true}
                dateRangeFrom={dateRangeFrom}
                dateRangeTo={dateRangeTo}
                onDateRangeChange={(from, to) => {
                  setDateRangeFrom(from);
                  setDateRangeTo(to);
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>
                {dateRangeFrom != null || dateRangeTo != null
                  ? `Wszystkie zadania w okresie ${getDisplayDate(dateRangeFrom)} – ${getDisplayDate(dateRangeTo)} (${filteredTasks.length} zadań)`
                  : `Wszystkie zadania dla ${getDisplayDate(filters.date)} (${filteredTasks.length} zadań)`}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const filename = dateRangeFrom && dateRangeTo
                    ? `zadania-${dateRangeFrom}-${dateRangeTo}.csv`
                    : `zadania-export-${getTodayDateString()}.csv`;
                  downloadCsv(tasksToCsv(filteredTasks), filename);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Eksportuj CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {renderTaskTable(
                filteredTasks,
                dateRangeFrom != null || dateRangeTo != null
                  ? `Nie znaleziono zadań w wybranym okresie z obecnymi filtrami`
                  : filters.date
                    ? `Nie znaleziono zadań dla ${getDisplayDate(filters.date)} z obecnymi filtrami`
                    : "Nie znaleziono zadań z obecnymi filtrami"
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
        totalDifference={taskTotals.totalDifference}
        visibleTaskCount={taskTotals.visibleTaskCount}
        showActual={true}
        showDifference={true}
      />
    </div>
  );
}
