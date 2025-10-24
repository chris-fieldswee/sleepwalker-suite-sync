// src/components/housekeeping/TaskActions.tsx
import { Button } from "@/components/ui/button";
import { Play, Pause, Square } from "lucide-react";
import type { Task } from '@/pages/Housekeeping'; // Assuming Task type is exported or moved

interface TaskActionsProps {
  task: Task;
  activeTaskId: string | null;
  onStart: (taskId: string) => void;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onStop: (taskId: string) => void;
}

export function TaskActions({ task, activeTaskId, onStart, onPause, onResume, onStop }: TaskActionsProps) {
  const isThisTaskActive = activeTaskId === task.id;
  // Can start/resume if NO task is active OR if THIS task was the one paused (implied by status='paused' check below)
  // Can pause/stop ONLY if THIS task is the currently active one
  const canStartOrResume = !activeTaskId || task.status === 'paused';
  const canPauseOrStop = isThisTaskActive;

  return (
    <div className="flex gap-2 flex-wrap">
      {/* Show Start button for 'todo' or 'repair_needed' tasks, only if no other task is active */}
      {(task.status === "todo" || task.status === "repair_needed") && (
        <Button size="sm" onClick={() => onStart(task.id)} disabled={!!activeTaskId} className="bg-green-600 hover:bg-green-700 text-white">
          <Play className="mr-1 h-4 w-4" /> Start
        </Button>
      )}

      {/* Show Pause and Stop buttons when 'in_progress', only if this is the active task */}
      {task.status === "in_progress" && (
        <>
          <Button size="sm" variant="outline" onClick={() => onPause(task.id)} disabled={!canPauseOrStop} className="text-orange-600 border-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-600 dark:hover:bg-orange-900/30">
            <Pause className="mr-1 h-4 w-4" /> Pause
          </Button>
          <Button size="sm" onClick={() => onStop(task.id)} disabled={!canPauseOrStop} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Square className="mr-1 h-4 w-4" /> Stop
          </Button>
        </>
      )}

      {/* Show Resume and Stop buttons when 'paused', only if no other task is currently active */}
      {task.status === "paused" && (
        <>
          {/* Resume is enabled if no other task is active */}
          <Button size="sm" onClick={() => onResume(task.id)} disabled={!!activeTaskId} className="bg-green-600 hover:bg-green-700 text-white">
            <Play className="mr-1 h-4 w-4" /> Resume
          </Button>
          {/* Stop can also be pressed when paused, no active task check needed here as pausing implies it was active */}
          <Button size="sm" variant="outline" onClick={() => onStop(task.id)} className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900/30">
            <Square className="mr-1 h-4 w-4" /> Stop
          </Button>
        </>
      )}

       {/* Show Completed text when done */}
       {task.status === "done" && <span className="text-sm text-muted-foreground self-center">Completed</span>}
    </div>
  );
}
