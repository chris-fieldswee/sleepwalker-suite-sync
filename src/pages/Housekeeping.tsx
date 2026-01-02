// src/pages/Housekeeping.tsx
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Play, Pause, Square, AlertTriangle, MessageSquare, Camera, Check, Info, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

// Import the new hooks and components
import { useHousekeepingTasks } from '@/hooks/useHousekeepingTasks';
import { useTaskActions } from '@/hooks/useTaskActions';
import { TaskCard } from '@/components/housekeeping/TaskCard';


// --- Interfaces (Should ideally be moved to a types file, e.g., src/types/tasks.ts) ---
export interface Room { // Export if used by other components/hooks
  id: string;
  name: string;
  group_type: Database["public"]["Enums"]["room_group"];
  color: string | null;
}
export interface Task { // Export if used by other components/hooks
  id: string;
  date: string;
  status: Database["public"]["Enums"]["task_status"];
  room: Room;
  cleaning_type: Database["public"]["Enums"]["cleaning_type"];
  guest_count: string; // Now stores capacity_id (a, b, c, d, etc.) instead of numeric value
  time_limit: number | null;
  start_time: string | null;
  pause_start: string | null;
  pause_stop: string | null; // Keep track of last pause end time
  total_pause: number | null; // Total accumulated pause time in minutes
  stop_time: string | null;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  reception_note_acknowledged?: boolean; // Schema-dependent
  issue_flag: boolean;
  issue_description: string | null;
  issue_photo: string | null;
  priority?: boolean; // Schema-dependent
  created_at: string;
  // Add actual_time and difference if they are part of the Task type after calculations
  actual_time?: number | null;
  difference?: number | null;
}
// --- END Interfaces ---


// --- Utility Functions (Keep here or move to utils.ts) ---
// (getStatusColor and getStatusLabel are now within TaskCard, but keep one copy here for filter/empty state)
const getStatusLabel = (status: Task['status'] | null | undefined): string => {
  if (!status) return "Nieznany";
  const labels: Record<string, string> = {
    todo: "Do sprzątania", in_progress: "W trakcie", paused: "Wstrzymane",
    done: "Zrobione", repair_needed: "Naprawa",
  };
  return labels[status] || (status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '));
};
// --- END Utility Functions ---


// Possible filter values
type TaskStatusFilter = Database["public"]["Enums"]["task_status"] | 'all';
const statusFilters: TaskStatusFilter[] = ['all', 'todo', 'in_progress', 'paused', 'repair_needed', 'done'];


// --- Timer Hook ---
export function useTaskTimer(task: Task | null): number | null {
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Destructure relevant properties from the task object
  const { start_time, total_pause, status, stop_time, pause_start } = task || {};

  useEffect(() => {
    // Clear any existing interval when dependencies change or component unmounts
    if (intervalRef.current) clearInterval(intervalRef.current);

    const calculateElapsed = () => {
      if (!start_time) {
        setElapsedSeconds(null);
        return;
      }
      try {
        const start = new Date(start_time).getTime();
        if (isNaN(start)) { throw new Error("Invalid start_time"); }

        let currentPauseMs = 0;
        // If currently paused, calculate time since pause_start
        if (status === 'paused' && pause_start) {
          const pauseStartTime = new Date(pause_start).getTime();
          if (!isNaN(pauseStartTime)) {
            currentPauseMs = Math.max(0, Date.now() - pauseStartTime);
          } else {
            console.warn("Invalid pause_start time for paused task:", task?.id);
          }
        }

        // Total pause time already accumulated (in minutes), convert to ms
        const accumulatedPauseMs = (total_pause || 0) * 60 * 1000;

        // Determine the 'end' time for calculation
        const end = (status === 'done' && stop_time)
          ? new Date(stop_time).getTime()
          : Date.now(); // Use current time for active/paused tasks

        if (isNaN(end)) { throw new Error("Invalid stop_time or current time issue"); }

        // Calculate elapsed milliseconds: (End Time - Start Time) - Accumulated Pause - Current Pause (if any)
        const elapsedMs = Math.max(0, end - start - accumulatedPauseMs - currentPauseMs);
        setElapsedSeconds(Math.floor(elapsedMs / 1000));

      } catch (error: any) {
        console.error("Error calculating elapsed time:", error.message, "Task:", task);
        setElapsedSeconds(null); // Set to null on error
      }
    };

    // If task is 'in_progress', calculate immediately and set interval
    if (status === 'in_progress' && start_time) {
      calculateElapsed(); // Initial calculation
      intervalRef.current = setInterval(calculateElapsed, 1000); // Update every second
    }
    // If task is 'paused' or 'done', calculate elapsed time once based on stop/current time
    else if ((status === 'paused' || status === 'done') && start_time) {
      calculateElapsed(); // Calculate final or current paused elapsed time
    }
    // If task has no start time or status doesn't warrant a timer
    else {
      setElapsedSeconds(null);
    }

    // Cleanup interval on unmount or dependency change
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [start_time, total_pause, status, stop_time, pause_start, task?.id]); // Added task.id for logging

  return elapsedSeconds;
}


// --- Main Component ---
export default function Housekeeping() {
  const { signOut, userId, user } = useAuth();

  // Destructure fetchTasks from the hook
  const { tasks, loading, activeTaskId, setActiveTaskId, fetchTasks } = useHousekeepingTasks();
  // Pass fetchTasks to useTaskActions
  const taskActions = useTaskActions(tasks, setActiveTaskId, activeTaskId, fetchTasks);

  // Local state for filter and active tab
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [activeTab, setActiveTab] = useState<'open' | 'all'>('open');
  const [dateFilter, setDateFilter] = useState<string>(''); // For date filtering
  const [userName, setUserName] = useState<string>('');

  // Fetch user name
  useEffect(() => {
    const fetchUserName = async () => {
      if (!userId) return;
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('name, first_name, last_name')
          .eq('id', userId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching user name:', error);
          return;
        }
        
        if (data) {
          // Prefer first_name + last_name, fallback to name
          const displayName = data.first_name && data.last_name
            ? `${data.first_name} ${data.last_name}`
            : data.name || user?.email || '';
          setUserName(displayName);
        }
      } catch (error) {
        console.error('Error fetching user name:', error);
      }
    };

    fetchUserName();
  }, [userId, user]);

  // Get today's date for comparison (used for progress calculation)
  const todayDate = useMemo(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, []);

  // Open tasks: tasks with status todo, in_progress, paused, or repair_needed (all dates)
  const openTasks = useMemo(() => {
    return tasks.filter(task => 
      task.status === 'todo' || 
      task.status === 'in_progress' || 
      task.status === 'paused' || 
      task.status === 'repair_needed'
    );
  }, [tasks]);

  // Filtered Tasks Memo - applies to whichever tab is active
  const filteredTasks = useMemo(() => {
    let baseTasks = activeTab === 'open' ? openTasks : tasks;

    // Apply date filter if selected
    if (dateFilter) {
      baseTasks = baseTasks.filter(task => task.date === dateFilter);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      return baseTasks.filter(task => task.status === statusFilter);
    }

    // For open tab, 'all' means all open statuses (already filtered in openTasks)
    // For all tab, show all tasks regardless of status
    return baseTasks;
  }, [activeTab, openTasks, tasks, statusFilter, dateFilter]);

  // Progress Calculation Memo - based on today's tasks only
  const progress = useMemo(() => {
    const todayTasks = tasks.filter(task => task.date === todayDate);
    const validTasks = Array.isArray(todayTasks) ? todayTasks : [];
    const totalTasks = validTasks.length;
    if (totalTasks === 0) return { count: 0, total: 0, percentage: 0 };
    const completedTasks = validTasks.filter(task => task.status === 'done').length;
    return {
      count: completedTasks,
      total: totalTasks,
      percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
  }, [tasks, todayDate]);

  // Timer for active task (must be at component level, not in callback)
  const activeTask = tasks.find(t => t.id === activeTaskId);
  const activeTaskElapsedSeconds = useTaskTimer(activeTask || null);


  return (
    <div className="min-h-screen bg-background pb-24">

      {/* Main Content with Tabs */}
      <main className="container mx-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="ml-2">Ładowanie zadań...</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'open' | 'all')} className="space-y-4">
            {/* Header: Greeting & Actions */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-muted-foreground pl-1">
                {userName ? (
                  <>Hej, <strong>{userName}</strong>!</>
                ) : (
                  user?.email || ''
                )}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={fetchTasks}
                  title="Odśwież zadania"
                >
                  <RefreshCw className="h-5 w-5" />
                  <span className="sr-only">Odśwież</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={signOut}
                >
                  <LogOut className="h-5 w-5" />
                  <span className="sr-only">Wyloguj</span>
                </Button>
              </div>
            </div>

            {/* Centered Tabs List */}
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="open" className="relative">
                Zadania otwarte
                {openTasks.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1 text-xs">
                    {openTasks.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all" className="relative">
                Wszystkie zadania
                {tasks.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1 text-xs">
                    {tasks.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Open Tasks Tab */}
            <TabsContent value="open" className="space-y-4 mt-4">
              {/* Filters for Open Tasks */}
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Date Filter */}
                  <div className="w-full">
                    <Label htmlFor="open-date-filter" className="text-sm mb-2 block">
                      Data
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="open-date-filter"
                          variant="outline"
                          className={`w-full justify-start text-left font-normal h-9 ${!dateFilter && "text-muted-foreground"
                            } `}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFilter ? (
                            format(new Date(dateFilter), "PPP", { locale: pl })
                          ) : (
                            <span>Wszystkie daty</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateFilter ? new Date(dateFilter) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              setDateFilter(format(date, 'yyyy-MM-dd'));
                            } else {
                              setDateFilter('');
                            }
                          }}
                          initialFocus
                          locale={pl}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Status Filter */}
                  <div className="w-full">
                    <Label htmlFor="open-status-filter" className="text-sm mb-2 block">
                      Status
                    </Label>
                    <Select value={statusFilter} onValueChange={(value: string) => setStatusFilter(value as TaskStatusFilter)}>
                      <SelectTrigger id="open-status-filter" className="h-9">
                        <SelectValue placeholder="Wybierz status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusFilters.map(status => (
                          <SelectItem key={status} value={status}>
                            {status === 'all' ? 'Wszystkie otwarte' : getStatusLabel(status as Task['status'])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters Button */}
                  {(dateFilter || statusFilter !== 'all') && (
                    <div className="col-span-2 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDateFilter('');
                          setStatusFilter('all');
                        }}
                        className="h-9"
                      >
                        Wyczyść Filtry
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Task List */}
              {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Card className="p-6 border-dashed">
                    <CardTitle className="text-lg mb-2">
                      {statusFilter === 'all' ? '🎉 Brak otwartych zadań' : `Brak zadań pasujących do filtra: ${getStatusLabel(statusFilter as Task['status'])
                        }`}
                    </CardTitle>
                    <CardDescription>
                      {statusFilter === 'all' ? 'Brak zadań ze statusem: do sprzątania, w trakcie, wstrzymane lub naprawa.' : 'Spróbuj zmienić filtr statusu lub daty.'}
                    </CardDescription>
                  </Card>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isActive={activeTaskId === task.id}
                    activeTaskId={activeTaskId}
                    onStart={taskActions.handleStart}
                    onPause={taskActions.handlePause}
                    onResume={taskActions.handleResume}
                    onStop={taskActions.handleStop}
                    onSaveNote={taskActions.handleSaveNote}
                    onReportIssue={taskActions.handleReportIssue}
                    onAcknowledgeNote={taskActions.handleAcknowledgeNote}
                  />
                ))
              )}
            </TabsContent>

            {/* All Tasks Tab */}
            <TabsContent value="all" className="space-y-4 mt-4">
              {/* Filters for All Tasks */}
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Date Filter */}
                  <div className="w-full">
                    <Label htmlFor="all-date-filter" className="text-sm mb-2 block">
                      Data
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="all-date-filter"
                          variant="outline"
                          className={`w-full justify-start text-left font-normal h-9 ${!dateFilter && "text-muted-foreground"
                            } `}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFilter ? (
                            format(new Date(dateFilter), "PPP", { locale: pl })
                          ) : (
                            <span>Wszystkie daty</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={dateFilter ? new Date(dateFilter) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              setDateFilter(format(date, 'yyyy-MM-dd'));
                            } else {
                              setDateFilter('');
                            }
                          }}
                          initialFocus
                          locale={pl}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Status Filter */}
                  <div className="w-full">
                    <Label htmlFor="all-status-filter" className="text-sm mb-2 block">
                      Status
                    </Label>
                    <Select value={statusFilter} onValueChange={(value: string) => setStatusFilter(value as TaskStatusFilter)}>
                      <SelectTrigger id="all-status-filter" className="h-9">
                        <SelectValue placeholder="Wybierz status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusFilters.map(status => (
                          <SelectItem key={status} value={status}>
                            {status === 'all' ? 'Wszystkie' : getStatusLabel(status as Task['status'])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters Button */}
                  {(dateFilter || statusFilter !== 'all') && (
                    <div className="col-span-2 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDateFilter('');
                          setStatusFilter('all');
                        }}
                        className="h-9"
                      >
                        Wyczyść Filtry
                      </Button>
                    </div>
                  )}
                </div>
              </Card>

              {/* Task List */}
              {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Card className="p-6 border-dashed">
                    <CardTitle className="text-lg mb-2">
                      📦 Brak zadań
                    </CardTitle>
                    <CardDescription>
                      {statusFilter === 'all' ? 'Brak zadań w systemie.' : `Brak zadań pasujących do filtra: ${getStatusLabel(statusFilter as Task['status'])}`}
                    </CardDescription>
                  </Card>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isActive={activeTaskId === task.id}
                    activeTaskId={activeTaskId}
                    onStart={taskActions.handleStart}
                    onPause={taskActions.handlePause}
                    onResume={taskActions.handleResume}
                    onStop={taskActions.handleStop}
                    onSaveNote={taskActions.handleSaveNote}
                    onReportIssue={taskActions.handleReportIssue}
                    onAcknowledgeNote={taskActions.handleAcknowledgeNote}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg z-40">
        <div className="container mx-auto px-4 pt-3 pb-8">
          {/* Progress Bar */}
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Postęp</span>
              <span className="font-medium">{progress.count}/{progress.total} ({progress.percentage}%)</span>
            </div>
            <Progress value={progress.percentage} className="h-2" aria-label={`Postęp zadań ${progress.percentage}% `} />
          </div>

          {/* Time Information */}
          <div className="flex items-center justify-between text-xs">
              {(() => {
              const todayTasks = tasks.filter(task => task.date === todayDate);
              const totalTimeLimit = todayTasks.reduce((sum, task) => sum + (task.time_limit || 0), 0);

              if (activeTask) {
                // Use pre-calculated elapsed time
                const elapsedMinutes = activeTaskElapsedSeconds ? Math.floor(activeTaskElapsedSeconds / 60) : 0;
                const remainingMinutes = activeTask.time_limit ? activeTask.time_limit - elapsedMinutes : null;
                const isOverTime = remainingMinutes !== null && remainingMinutes < 0;

                return (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant={activeTask.status === 'in_progress' ? 'default' : 'secondary'} className="text-xs">
                        {activeTask.status === 'in_progress' ? 'W trakcie' : 'Wstrzymane'}
                      </Badge>
                      <span className="text-muted-foreground truncate">{activeTask.room.name}</span>
                    </div>
                    <div className={cn("font-medium tabular-nums", isOverTime && "text-red-600 dark:text-red-400")}>
                      {elapsedMinutes}m / {activeTask.time_limit || '?'}m
                      {remainingMinutes !== null && (
                        <span className="ml-1 text-xs">({remainingMinutes >= 0 ? `${remainingMinutes}m` : `+${Math.abs(remainingMinutes)}m`})</span>
                      )}
                    </div>
                  </>
                );
              } else {
                // No active task - show total time limits
                return (
                  <>
                    <span className="text-muted-foreground">
                      Zadania na dziś
                    </span>
                    <span className="font-medium">
                      {totalTimeLimit > 0 ? `Łącznie: ${totalTimeLimit}m` : 'Brak limitów'}
                    </span>
                  </>
                );
              }
            })()}
          </div>
        </div>
      </div>

      <footer className="h-4"></footer>
    </div>
  );
}


// --- TaskTimerDisplay Component ---
export interface TaskTimerDisplayProps {
  task: Task;
}
export const TaskTimerDisplay: React.FC<TaskTimerDisplayProps> = ({ task }) => {
  const elapsedSeconds = useTaskTimer(task);

  const formatTime = (totalSeconds: number | null): string => {
    if (totalSeconds === null || totalSeconds < 0) return "--:--";
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} `;
  };

  const elapsedMinutes = elapsedSeconds !== null ? Math.floor(elapsedSeconds / 60) : null;
  const timeLimit = task.time_limit ?? null; // Use null if no limit
  const remainingMinutes = (timeLimit !== null && elapsedSeconds !== null)
    ? Math.max(0, timeLimit - Math.ceil(elapsedSeconds / 60))
    : null;
  const isOverTime = (timeLimit !== null && elapsedMinutes !== null) && elapsedMinutes > timeLimit;

  // Display for 'done' tasks
  if (task.status === 'done') {
    // Use actual_time if available and valid, otherwise display placeholder
    const displayTime = (task.actual_time !== null && task.actual_time >= 0) ? `${task.actual_time} m` : '-';
    // Use difference if available and valid
    const displayDiff = (task.difference !== null) ? `(${task.difference > 0 ? '+' : ''}${task.difference}m)` : '';
    const diffColor = (task.difference ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";

    return (
      <div className="text-xs text-muted-foreground flex flex-wrap justify-between items-center gap-x-4 mt-1">
        <span>Rzeczywisty: <span className={cn("font-medium", (task.difference ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>{displayTime}</span></span>
        {timeLimit !== null && ( // Only show limit info if it exists
          <span>Limit: {timeLimit}m <span className={cn("font-medium", diffColor)}>{displayDiff}</span></span>
        )}
      </div>
    );
  }

  // Display for 'in_progress' or 'paused' tasks
  return (
    <div className="text-xs text-muted-foreground flex flex-wrap justify-between items-center gap-x-4 mt-1">
      <span>Upłynęło: <span className={cn("font-medium tabular-nums", isOverTime ? "text-red-600 dark:text-red-400" : "text-foreground")}>{formatTime(elapsedSeconds)}</span></span>
      {timeLimit !== null && ( // Only show limit info if it exists
        <span className={cn(isOverTime ? "text-red-600 dark:text-red-400" : "")}>
          Limit: {timeLimit}m
          {/* Show remaining only if in progress and remaining is calculable */}
          {task.status === 'in_progress' && remainingMinutes !== null && ` (${remainingMinutes}m pozostało)`}
          {/* Indicate if paused */}
          {task.status === 'paused' && ` (Wstrzymane)`}
        </span>
      )}
      {/* If no time limit, but task is paused */}
      {timeLimit === null && task.status === 'paused' && (
        <span>(Wstrzymane)</span>
      )}
    </div>
  );
};
