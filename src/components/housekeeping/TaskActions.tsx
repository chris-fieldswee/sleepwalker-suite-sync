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
  const canPerformActions = !activeTaskId || isThisTaskActive; // Can interact if no task is active, or if this *is* the active task

  return (
    <div className="flex gap-2 flex-wrap">
      {task.status === "todo" && (
        <Button size="sm" onClick={() => onStart(task.id)} disabled={!canPerformActions} className="bg-green-600 hover:bg-green-700 text-white">
          <Play className="mr-1 h-4 w-4" /> Start
        </Button>
      )}
      {task.status === "in_progress" && (
        <>
          <Button size="sm" variant="outline" onClick={() => onPause(task.id)} disabled={!isThisTaskActive} className="text-orange-600 border-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-600 dark:hover:bg-orange-900/30">
            <Pause className="mr-1 h-4 w-4" /> Pause
          </Button>
          <Button size="sm" onClick={() => onStop(task.id)} disabled={!isThisTaskActive} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Square className="mr-1 h-4 w-4" /> Stop
          </Button>
        </>
      )}
      {task.status === "paused" && (
        <>
          <Button size="sm" onClick={() => onResume(task.id)} disabled={!!activeTaskId && !isThisTaskActive} className="bg-green-600 hover:bg-green-700 text-white">
            <Play className="mr-1 h-4 w-4" /> Resume
          </Button>
          <Button size="sm" variant="outline" onClick={() => onStop(task.id)} className="text-blue-600 border-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900/30">
            <Square className="mr-1 h-4 w-4" /> Stop
          </Button>
        </>
      )}
      {task.status === "repair_needed" && !isThisTaskActive && (
           <Button size="sm" onClick={() => onStart(task.id)} disabled={!!activeTaskId} className="bg-green-600 hover:bg-green-700 text-white">
               <Play className="mr-1 h-4 w-4" /> Start
           </Button>
       )}
       {task.status === "done" && <span className="text-sm text-muted-foreground self-center">Completed</span>}
    </div>
  );
}
