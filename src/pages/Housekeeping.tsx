// src/pages/Housekeeping.tsx
import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"; // Keep Card for Empty State
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut } from "lucide-react";
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


// --- TaskTimerDisplay Component (Keep exported or move to its own file) ---
// (Ensure this component is exported if it stays here, or import if moved)
export interface TaskTimerDisplayProps { // Export if kept here
    task: Task;
}
export const TaskTimerDisplay: React.FC<TaskTimerDisplayProps> = ({ task }) => { // Export if kept here
    const elapsedSeconds = useTaskTimer(task); // Pass the whole task

    const formatTime = (totalSeconds: number | null): string => { /* ... implementation ... */ };
    // ... rest of TaskTimerDisplay implementation from previous version ...

     const elapsedMinutes = elapsedSeconds !== null ? Math.floor(elapsedSeconds / 60) : 0;
     const timeLimit = task.time_limit ?? 0;
     const remainingMinutes = timeLimit > 0 && elapsedSeconds !== null
                              ? Math.max(0, timeLimit - Math.ceil(elapsedSeconds / 60))
                              : null;
     const isOverTime = timeLimit > 0 && elapsedMinutes > timeLimit;

      if (task.status === 'done' && task.actual_time !== null) {
          return ( /* ... JSX for 'done' state ... */ );
      }

     return ( /* ... JSX for 'in_progress'/'paused' state ... */ );
};
