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
import { LogOut, Play, Pause, Square, AlertTriangle, MessageSquare, Camera, Check, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

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
  guest_count: number;
  time_limit: number | null;
  start_time: string | null;
  pause_start: string | null;
  pause_stop: string | null;
  total_pause: number | null;
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
   if (!status) return "Unknown";
   const labels: Record<string, string> = {
    todo: "To Clean", in_progress: "In Progress", paused: "Paused",
    done: "Done", repair_needed: "Repair",
  };
  return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
};
// --- END Utility Functions ---


// Possible filter values
type TaskStatusFilter = Database["public"]["Enums"]["task_status"] | 'all';
const statusFilters: TaskStatusFilter[] = ['all', 'todo', 'in_progress', 'paused', 'repair_needed', 'done'];


// --- Timer Hook ---
// (Keep the hook definition from the previous step)
function useTaskTimer(task: Task | null): number | null {
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { start_time, total_pause, status, stop_time } = task || {};

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (status === 'in_progress' && start_time) {
      const calculateElapsed = () => { /* ... calculation ... */ };
      calculateElapsed();
      intervalRef.current = setInterval(calculateElapsed, 1000);
    } else if (start_time) { // Paused or Done
        try {
            const start = new Date(start_time).getTime();
            if (isNaN(start)) { setElapsedSeconds(null); return; }
            const end = status === 'done' && stop_time ? new Date(stop_time).getTime() : Date.now();
            if (isNaN(end)) { setElapsedSeconds(null); return; } // Handle invalid end time
            const pauseMs = (total_pause || 0) * 60 * 1000;
            const elapsedMs = Math.max(0, end - start - pauseMs);
            setElapsedSeconds(Math.floor(elapsedMs / 1000));
        } catch(error) { /* ... error handling ... */ setElapsedSeconds(null); }
    } else {
        setElapsedSeconds(null);
    }

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [start_time, total_pause, status, stop_time]);

  return elapsedSeconds;
}


// --- Main Component ---
export default function Housekeeping() {
  const { signOut } = useAuth(); // Only need signOut from AuthContext directly now

  // Use the custom hooks
  const { tasks, loading, activeTaskId, setActiveTaskId } = useHousekeepingTasks();
  const taskActions = useTaskActions(tasks, setActiveTaskId, activeTaskId);

  // Local state for filter
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');

  // Filtered Tasks Memo
  const filteredTasks = useMemo(() => {
      let displayTasks = tasks;
      if (statusFilter !== 'all') {
          displayTasks = displayTasks.filter(task => task.status === statusFilter);
      } else {
          // 'all' currently means 'all active' in the filter dropdown
          displayTasks = displayTasks.filter(task => task.status !== 'done');
      }
      return displayTasks;
  }, [tasks, statusFilter]);

  // Progress Calculation Memo
   const progress = useMemo(() => {
    const totalTasks = tasks.length;
    if (totalTasks === 0) return { count: 0, total: 0, percentage: 0 };
    const completedTasks = tasks.filter(task => task.status === 'done').length;
    return {
        count: completedTasks,
        total: totalTasks,
        percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
  }, [tasks]);


  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 gap-4">
          <div className="flex-shrink-0">
            <h1 className="text-xl font-bold">My Tasks</h1>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>

          <div className="flex-grow flex items-center justify-center gap-4 md:gap-6">
              <div className="w-full max-w-xs hidden sm:block">
                <Label className="text-xs text-muted-foreground mb-1 block text-center">
                    Progress: {progress.count}/{progress.total} ({progress.percentage}%)
                </Label>
                <Progress value={progress.percentage} className="h-2" aria-label={`Task progress ${progress.percentage}%`} />
              </div>
              <div>
                  <Label htmlFor="statusFilter" className="sr-only">Filter by Status</Label>
                  <Select value={statusFilter} onValueChange={(value: string) => setStatusFilter(value as TaskStatusFilter)}>
                    <SelectTrigger id="statusFilter" className="h-9 text-xs w-[120px] bg-background">
                        <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                        {statusFilters.map(status => (
                            <SelectItem key={status} value={status} className="text-xs">
                                {status === 'all' ? 'All Active' : getStatusLabel(status as Task['status'])}
                            </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
              </div>
          </div>

          <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={signOut}>
            <LogOut className="h-4 w-4" /> <span className="sr-only">Sign Out</span>
          </Button>
        </div>
        <div className="sm:hidden px-4 pb-2">
             <Label className="text-xs text-muted-foreground mb-1 block text-center"> Progress: {progress.count}/{progress.total} ({progress.percentage}%) </Label>
             <Progress value={progress.percentage} className="h-2" aria-label={`Task progress ${progress.percentage}%`} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto space-y-4 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="ml-2">Loading tasks...</span>
          </div>
        ) : (
          <>
            {/* Render Task Cards using the new component */}
            {filteredTasks.map((task) => (
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
            ))}

            {/* Empty State Message */}
            {!loading && filteredTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                 <Card className="p-6 border-dashed">
                     <CardTitle className="text-lg mb-2">
                        {statusFilter === 'all' ? '🎉 No Active Tasks' : `No tasks match filter: ${getStatusLabel(statusFilter as Task['status'])}`}
                    </CardTitle>
                    <CardDescription>
                        {statusFilter === 'all' ? 'All assigned tasks for today are complete or none were assigned.' : 'Try changing the status filter.'}
                    </CardDescription>
                 </Card>
              </div>
            )}
          </>
        )}
      </main>

       <footer className="h-10"></footer>
    </div>
  );
}


// --- TaskTimerDisplay Component ---
// (Moved outside the main component, ensure it's exported or in its own file)
export interface TaskTimerDisplayProps {
    task: Task;
}
export const TaskTimerDisplay: React.FC<TaskTimerDisplayProps> = ({ task }) => {
    const elapsedSeconds = useTaskTimer(task);

    const formatTime = (totalSeconds: number | null): string => {
        if (totalSeconds === null || totalSeconds < 0) return "--:--";
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const elapsedMinutes = elapsedSeconds !== null ? Math.floor(elapsedSeconds / 60) : 0;
    const timeLimit = task.time_limit ?? 0;
    const remainingMinutes = timeLimit > 0 && elapsedSeconds !== null
                             ? Math.max(0, timeLimit - Math.ceil(elapsedSeconds / 60))
                             : null;
    const isOverTime = timeLimit > 0 && elapsedMinutes > timeLimit;

     // *** FIX: Added JSX for 'done' state ***
     if (task.status === 'done') {
         // Use actual_time if available and valid, otherwise display placeholder
         const displayTime = (task.actual_time !== null && task.actual_time >= 0) ? `${task.actual_time}m` : '-';
         // Use difference if available and valid
         const displayDiff = (task.difference !== null) ? `(${task.difference > 0 ? '+' : ''}${task.difference}m)` : '';

         return (
             <div className="text-xs text-muted-foreground flex flex-wrap justify-between items-center gap-x-4 mt-1">
                 <span>Actual Time: <span className={cn("font-medium", (task.difference ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>{displayTime}</span></span>
                 {timeLimit > 0 && (
                     <span>Limit: {timeLimit}m {displayDiff}</span>
                 )}
             </div>
         );
     }

     // *** FIX: Added JSX for 'in_progress'/'paused' state ***
     return (
        <div className="text-xs text-muted-foreground flex flex-wrap justify-between items-center gap-x-4 mt-1">
            <span>Elapsed: <span className={cn("font-medium tabular-nums", isOverTime ? "text-red-600 dark:text-red-400" : "text-foreground")}>{formatTime(elapsedSeconds)}</span></span>
            {timeLimit > 0 && (
                <span className={cn(isOverTime ? "text-red-600 dark:text-red-400" : "")}>
                    Limit: {timeLimit}m
                    {remainingMinutes !== null && task.status === 'in_progress' && ` (${remainingMinutes}m left)`}
                    {task.status === 'paused' && ` (Paused)`}
                </span>
            )}
        </div>
     );
};
