// src/pages/reception/Tasks.tsx
import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Download, GripVertical, List, Users } from "lucide-react";
import { CAPACITY_ID_TO_LABEL } from "@/lib/capacity-utils";
import { TaskFilters, type RoomGroupOption } from "@/components/reception/TaskFilters";
import { TaskTableRow } from "@/components/reception/TaskTableRow";
import { AddTaskDialog } from "@/components/reception/AddTaskDialog";
import { BatchTaskWizard } from "@/components/reception/BatchTaskWizard";
import { TaskDetailDialog } from "@/components/reception/TaskDetailDialog";
import { TaskSummaryFooter } from "@/components/reception/TaskSummaryFooter";
import { useTaskOrder } from "@/hooks/useTaskOrder";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  display_order?: number | null;
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

const getDateRangeLabel = (from: string | null, to: string | null) => {
  if (from && to) return `${getDisplayDate(from)} - ${getDisplayDate(to)}`;
  if (from) return `od ${getDisplayDate(from)}`;
  if (to) return `do ${getDisplayDate(to)}`;
  return "";
};

const allRoomGroups: RoomGroupOption[] = [
  { value: 'all', label: 'Wszystkie grupy' },
  { value: 'P1', label: 'Pokoje P1' },
  { value: 'P2', label: 'Pokoje P2' },
  { value: 'A1S', label: 'Apartamenty A1S' },
  { value: 'A2S', label: 'Apartamenty A2S' },
  { value: 'OTHER', label: 'Inne Przestrzenie' },
];

const OPEN_TASK_STATUSES = new Set(["todo", "in_progress", "paused"]);

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
  cachedUpcomingTasks?: Task[];
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
  onDeleteTask: (taskId: string) => Promise<boolean>;
  isUpdatingTask: boolean;
  isDeletingTask: boolean;
  onSetTaskFetchScope: (scope: 'upcoming' | 'archive') => void;
  allTasksTotalCount: number;
}

type TaskTableRowProps = Parameters<typeof TaskTableRow>[0];

function SortableTaskRow(props: TaskTableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  return (
    <TaskTableRow
      {...props}
      innerRef={setNodeRef}
      dragStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
        zIndex: isDragging ? 1 : undefined,
        position: isDragging ? 'relative' : undefined,
      }}
      dragListeners={listeners as Record<string, unknown>}
      dragAttributes={attributes}
      showDragHandle
    />
  );
}

export default function Tasks({
  tasks,
  cachedUpcomingTasks = [],
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
  onSetTaskFetchScope,
  allTasksTotalCount,
}: TasksProps) {
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"today" | "open" | "archive">("today");
  const [dateRangeFrom, setDateRangeFrom] = useState<string | null>(null);
  const [dateRangeTo, setDateRangeTo] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>(() =>
    (localStorage.getItem('taskListViewMode') as 'flat' | 'grouped') ?? 'flat'
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [optimisticTaskIds, setOptimisticTaskIds] = useState<string[] | null>(null);
  const taskOrder = useTaskOrder();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    onSetTaskFetchScope(activeTab === 'archive' ? 'archive' : 'upcoming');
    return () => {
      onSetTaskFetchScope('upcoming');
    };
  }, [activeTab, onSetTaskFetchScope]);

  useEffect(() => {
    localStorage.setItem('taskListViewMode', viewMode);
  }, [viewMode]);

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

  const housekeepingStaff = useMemo(() => allStaff.filter(s => s.role === 'housekeeping'), [allStaff]);

  const filteredTasks = useMemo(() => {
    let result = tasks;

    if (activeTab === 'today') {
      result = result.filter(task => task.date === todayDate);
      return [...result].sort((a, b) => {
        const ao = a.display_order ?? Infinity;
        const bo = b.display_order ?? Infinity;
        if (ao !== bo) return ao - bo;
        return (a.created_at ?? '').localeCompare(b.created_at ?? '');
      });
    } else if (activeTab === 'open') {
      result = result.filter(task => task.date > todayDate && OPEN_TASK_STATUSES.has(task.status));
      if (filters.date) {
        result = result.filter(task => task.date === filters.date);
      }
    } else {
      // archive: date < today is already ensured by backend scope
      if (dateRangeFrom != null || dateRangeTo != null) {
        const from = dateRangeFrom ?? '0000-01-01';
        const to = dateRangeTo ?? '9999-12-31';
        result = result.filter(task => task.date >= from && task.date <= to);
      }
    }

    return result;
  }, [activeTab, tasks, todayDate, filters.date, dateRangeFrom, dateRangeTo]);

  const todayCount = useMemo(() => {
    const source = cachedUpcomingTasks.length > 0 ? cachedUpcomingTasks : tasks;
    return source.filter(t => t.date === todayDate).length;
  }, [cachedUpcomingTasks, tasks, todayDate]);
  const openCount = useMemo(() => {
    const source = cachedUpcomingTasks.length > 0 ? cachedUpcomingTasks : tasks;
    return source.filter(t => t.date > todayDate && OPEN_TASK_STATUSES.has(t.status)).length;
  }, [cachedUpcomingTasks, tasks, todayDate]);

  const isFilterActive = filters.status !== 'all' || filters.staffId !== 'all' || filters.roomGroup !== 'all' || filters.roomId !== 'all';
  const canDragToday = activeTab === 'today' && !isFilterActive;

  const displayTasks = useMemo(() => {
    if (!optimisticTaskIds || activeTab !== 'today') return filteredTasks;
    const map = new Map(filteredTasks.map(t => [t.id, t]));
    return optimisticTaskIds.map(id => map.get(id)).filter((t): t is Task => t !== undefined);
  }, [filteredTasks, optimisticTaskIds, activeTab]);

  type GroupEntry = { staffName: string; staffId: string | null; tasks: Task[] };

  const groupedTasks = useMemo((): [string, GroupEntry][] | null => {
    if (viewMode !== 'grouped') return null;
    const byKey = new Map<string, GroupEntry>();
    for (const task of displayTasks) {
      const key = task.user?.id ?? '__unassigned__';
      if (!byKey.has(key)) {
        byKey.set(key, { staffName: task.user?.name ?? 'Nieprzypisane', staffId: task.user?.id ?? null, tasks: [] });
      }
      byKey.get(key)!.tasks.push(task);
    }
    return [...byKey.entries()].sort(([kA], [kB]) => {
      if (kA === '__unassigned__') return 1;
      if (kB === '__unassigned__') return -1;
      return byKey.get(kA)!.staffName.localeCompare(byKey.get(kB)!.staffName);
    });
  }, [viewMode, displayTasks]);

  const toggleGroupCollapsed = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleFlatDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = displayTasks.map(t => t.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newIds = arrayMove(ids, oldIndex, newIndex);
    setOptimisticTaskIds(newIds);
    await taskOrder.reorder(newIds);
    setOptimisticTaskIds(null);
    onRefresh();
  }, [displayTasks, taskOrder, onRefresh]);

  const handleGroupedDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !groupedTasks) return;
    const activeGroupEntry = groupedTasks.find(([, g]) => g.tasks.some(t => t.id === active.id));
    const overGroupEntry = groupedTasks.find(([, g]) => g.tasks.some(t => t.id === over.id));
    if (!activeGroupEntry || !overGroupEntry || activeGroupEntry[0] !== overGroupEntry[0]) return;
    const groupTasks = activeGroupEntry[1].tasks;
    const groupIds = groupTasks.map(t => t.id);
    const oldIndex = groupIds.indexOf(active.id as string);
    const newIndex = groupIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    const newGroupIds = arrayMove(groupIds, oldIndex, newIndex);
    const groupIdSet = new Set(groupIds);
    const allIds = displayTasks.map(t => t.id);
    const newAllIds: string[] = [];
    let inserted = false;
    for (const id of allIds) {
      if (groupIdSet.has(id)) {
        if (!inserted) { newAllIds.push(...newGroupIds); inserted = true; }
      } else {
        newAllIds.push(id);
      }
    }
    setOptimisticTaskIds(newAllIds);
    await taskOrder.reorder(newAllIds);
    setOptimisticTaskIds(null);
    onRefresh();
  }, [groupedTasks, displayTasks, taskOrder, onRefresh]);

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

  const tableHeaders = (withDragCol: boolean) => (
    <TableHeader>
      <TableRow className="bg-muted/50 sticky top-0 z-10">
        {withDragCol && <TableHead className="w-8" />}
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
  );

  const commonRowProps = { staff: allStaff, onViewDetails: handleViewDetails, onDeleteTask: handleDelete, isDeleting: isDeletingTask };

  const renderFlatTable = (taskList: Task[], draggable: boolean) => (
    <div className="overflow-x-auto max-h-[calc(8*3.5rem)] overflow-y-auto">
      <Table>
        {tableHeaders(draggable)}
        <TableBody>
          {draggable ? (
            <SortableContext items={taskList.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {taskList.map(task => <SortableTaskRow key={task.id} task={task} {...commonRowProps} />)}
            </SortableContext>
          ) : (
            taskList.map(task => <TaskTableRow key={task.id} task={task} {...commonRowProps} />)
          )}
        </TableBody>
      </Table>
    </div>
  );

  const renderGroupedView = (taskList: Task[], groups: [string, { staffName: string; staffId: string | null; tasks: Task[] }][], draggable: boolean) => (
    <div className="space-y-2 p-4">
      {groups.map(([key, group]) => {
        const isCollapsed = collapsedGroups.has(key);
        return (
          <div key={key} className="border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-2 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-medium"
              onClick={() => toggleGroupCollapsed(key)}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{group.staffName}</span>
                <span className="text-xs text-muted-foreground font-normal">({group.tasks.length})</span>
              </div>
              <span className="text-muted-foreground text-xs">{isCollapsed ? '▶' : '▼'}</span>
            </button>
            {!isCollapsed && (
              draggable ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroupedDragEnd}>
                  <div className="overflow-x-auto">
                    <Table>
                      {tableHeaders(true)}
                      <TableBody>
                        <SortableContext items={group.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                          {group.tasks.map(task => <SortableTaskRow key={task.id} task={task} {...commonRowProps} />)}
                        </SortableContext>
                      </TableBody>
                    </Table>
                  </div>
                </DndContext>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    {tableHeaders(false)}
                    <TableBody>
                      {group.tasks.map(task => <TaskTableRow key={task.id} task={task} {...commonRowProps} />)}
                    </TableBody>
                  </Table>
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );

  const renderEmpty = (emptyMessage: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-lg font-medium text-muted-foreground">{emptyMessage}</p>
      <p className="text-sm text-muted-foreground">Spróbuj zmienić filtry lub dodaj nowe zadanie.</p>
    </div>
  );

  const renderTaskTable = (taskList: Task[], emptyMessage: string) => (
    loading && !refreshing ? (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="ml-2">Ładowanie zadań...</span>
      </div>
    ) : taskList.length === 0 ? renderEmpty(emptyMessage) : renderFlatTable(taskList, false)
  );

  const viewToggle = (
    <div className="flex items-center gap-2 ml-auto">
      <span className="text-sm text-muted-foreground">Widok:</span>
      <div className="flex rounded-md border overflow-hidden">
        <Button variant={viewMode === 'flat' ? 'default' : 'ghost'} size="sm" className="rounded-none h-8 px-2" onClick={() => setViewMode('flat')}>
          <List className="h-4 w-4" />
        </Button>
        <Button variant={viewMode === 'grouped' ? 'default' : 'ghost'} size="sm" className="rounded-none h-8 px-2 border-l" onClick={() => setViewMode('grouped')}>
          <Users className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
          <BatchTaskWizard
            availableRooms={availableRooms}
            allStaff={allStaff}
            onSubmit={onAddTask}
            isSubmitting={isSubmittingTask}
          />
        </div>
      </div>

      <Tabs defaultValue="today" value={activeTab} onValueChange={(value) => setActiveTab(value as "today" | "open" | "archive")} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">Dzisiaj ({todayCount})</TabsTrigger>
          <TabsTrigger value="open">Zaplanowane ({openCount})</TabsTrigger>
          <TabsTrigger value="archive">Archiwum</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg">Filtry</CardTitle>
                {viewToggle}
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <TaskFilters
                date={filters.date}
                status={filters.status}
                staffId={filters.staffId}
                roomGroup={filters.roomGroup}
                roomId={filters.roomId}
                staff={housekeepingStaff}
                availableRooms={availableRooms}
                roomGroups={allRoomGroups}
                onDateChange={onDateChange}
                onStatusChange={onStatusChange}
                onStaffChange={onStaffChange}
                onRoomGroupChange={onRoomGroupChange}
                onRoomChange={onRoomChange}
                onClearFilters={onClearFilters}
                showRoomGroupFilter={true}
                showDoneStatus={true}
                lockedDate={todayDate}
              />
              {isFilterActive && (
                <p className="mt-2 text-xs text-muted-foreground">Wyczyść filtry, aby zmienić kolejność zadań.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Zadania dzisiaj ({displayTasks.length} zadań)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading && !refreshing ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <span className="ml-2">Ładowanie zadań...</span>
                </div>
              ) : displayTasks.length === 0 ? renderEmpty("Brak zadań na dzisiaj.") : viewMode === 'grouped' && groupedTasks ? (
                renderGroupedView(displayTasks, groupedTasks, canDragToday)
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={canDragToday ? handleFlatDragEnd : () => {}}>
                  {renderFlatTable(displayTasks, canDragToday)}
                </DndContext>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="open" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <div className="flex items-center gap-4">
                <CardTitle className="text-lg">Filtry</CardTitle>
                {viewToggle}
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <TaskFilters
                date={filters.date}
                status={filters.status}
                staffId={filters.staffId}
                roomGroup={filters.roomGroup}
                roomId={filters.roomId}
                staff={housekeepingStaff}
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
              <CardTitle>
                {filters.date
                  ? `Zadania otwarte dla ${getDisplayDate(filters.date)} (${filteredTasks.length} zadań)`
                  : `Zadania otwarte — przyszłe daty (${filteredTasks.length} zadań)`}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading && !refreshing ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <span className="ml-2">Ładowanie zadań...</span>
                </div>
              ) : filteredTasks.length === 0 ? renderEmpty(
                filters.date
                  ? `Nie znaleziono otwartych zadań dla ${getDisplayDate(filters.date)}`
                  : "Brak otwartych zadań na przyszłe daty."
              ) : viewMode === 'grouped' && groupedTasks ? (
                renderGroupedView(filteredTasks, groupedTasks, false)
              ) : renderFlatTable(filteredTasks, false)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archive" className="space-y-4">
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
                staff={housekeepingStaff}
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
                  ? `Archiwum ${getDateRangeLabel(dateRangeFrom, dateRangeTo)} (${filteredTasks.length} zadań)`
                  : `Archiwum (${filteredTasks.length} zadań)`}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const filename = dateRangeFrom && dateRangeTo
                    ? `zadania-${dateRangeFrom}-${dateRangeTo}.csv`
                    : `zadania-archiwum-${getTodayDateString()}.csv`;
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
                  ? "Nie znaleziono zadań w wybranym okresie."
                  : "Brak zadań archiwalnych."
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
