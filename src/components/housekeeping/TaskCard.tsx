// src/components/housekeeping/TaskCard.tsx
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskActions } from './TaskActions';
import { SecondaryTaskActions } from './SecondaryTaskActions';
import { TaskTimerDisplay } from '@/pages/Housekeeping'; // Assuming TaskTimerDisplay is exported or moved
import type { Task } from '@/pages/Housekeeping'; // Assuming Task type is exported or moved

// --- Utility Functions (Keep consistent with Housekeeping.tsx or move to utils) ---
const getStatusColor = (status: Task['status'] | null | undefined): string => {
  if (!status) return "bg-muted text-muted-foreground";
  const colors: Record<string, string> = {
    todo: "bg-status-todo text-status-todo-foreground", // Use defined variables
    in_progress: "bg-status-in-progress text-status-in-progress-foreground",
    paused: "bg-status-paused text-status-paused-foreground",
    done: "bg-status-done text-status-done-foreground",
    repair_needed: "bg-status-repair text-status-repair-foreground",
   };
  return colors[status] || "bg-muted text-muted-foreground";
};

const getStatusLabel = (status: Task['status'] | null | undefined): string => {
   if (!status) return "Unknown";
   const labels: Record<string, string> = {
    todo: "To Clean", in_progress: "In Progress", paused: "Paused",
    done: "Done", repair_needed: "Repair",
  };
   return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
};
// --- END Utility Functions ---


interface TaskCardProps {
  task: Task;
  isActive: boolean;
  activeTaskId: string | null; // Needed for disabling buttons in TaskActions
  // Action handlers from useTaskActions
  onStart: (taskId: string) => void;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onStop: (taskId: string) => void;
  onSaveNote: (taskId: string, note: string) => Promise<boolean>;
  onReportIssue: (taskId: string, description: string, photo: File | null) => Promise<boolean>;
  onAcknowledgeNote: (taskId: string) => Promise<boolean>;
}

export function TaskCard({
  task,
  isActive,
  activeTaskId,
  onStart,
  onPause,
  onResume,
  onStop,
  onSaveNote,
  onReportIssue,
  onAcknowledgeNote
}: TaskCardProps) {

   // Determine if the acknowledge button should be shown (requires schema change)
   // const showAcknowledge = task.reception_notes && !task.reception_note_acknowledged;
   const showAcknowledge = task.reception_notes; // Temporarily show if notes exist

  return (
    <Card
        key={task.id} // Key is still important when mapping in parent
        className={cn(
            "overflow-hidden border-l-4 transition-shadow duration-300",
            // Use status color for active ring instead of hardcoding 'in-progress'
            isActive ? `ring-2 ring-offset-2 ring-[hsl(var(--status-${task.status}))] shadow-lg` : 'shadow-sm hover:shadow-md',
            // --- SCHEMA CHANGE REQUIRED for priority: ---
            // task.priority && 'border-yellow-500' // Example priority styling
        )}
        style={{ borderLeftColor: task.room?.color || 'hsl(var(--border))' }}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 pt-3 px-4">
           <div>
             <CardTitle className="text-lg font-semibold">{task.room?.name || 'Unknown Room'}</CardTitle>
              <p className="text-xs text-muted-foreground pt-1">
                Type: {task.cleaning_type} / Guests: {task.guest_count} / Limit: {task.time_limit ? `${task.time_limit}m` : 'N/A'}
              </p>
            </div>
           {/* Apply status color utility */}
           <Badge className={cn(getStatusColor(task.status), "text-xs ml-2 flex-shrink-0")}>
            {getStatusLabel(task.status)}
          </Badge>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-1 space-y-2">
            {/* Conditionally render timer only if task has started */}
            { (task.start_time) && (
               <TaskTimerDisplay task={task} />
            )}

            {/* Reception Note Display */}
            {task.reception_notes && (
              <div className={cn(
                  "mt-1 p-2 rounded-md border text-xs",
                   // Style based on acknowledgment status (requires schema change)
                   // showAcknowledge ?
                    "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-200"
                   // : "bg-muted/50 border-border text-muted-foreground" // Example style for acknowledged
               )}>
                  <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold flex items-center"><Info className="h-3 w-3 mr-1 inline"/> Reception Note:</span>
                       {/* Show Acknowledge button conditionally */}
                       { showAcknowledge && (
                           <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-800" onClick={() => onAcknowledgeNote(task.id)}>
                               <Check className="h-3 w-3 mr-1"/> Acknowledge
                           </Button>
                       )}
                  </div>
                  <p>{task.reception_notes}</p>
              </div>
            )}

            {/* Housekeeping Note Display */}
            {task.housekeeping_notes && ( <p className="text-xs text-muted-foreground mt-1 italic"><strong>Your Note:</strong> {task.housekeeping_notes}</p> )}

            {/* Issue Display */}
            {task.issue_flag && (
                <div className="mt-1 p-2 rounded-md border border-red-200 bg-red-50 text-xs text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-200">
                   <p className="font-semibold flex items-center mb-1"><AlertTriangle className="h-3 w-3 mr-1 inline"/> Maintenance Issue</p>
                  {task.issue_description && <p className="mb-1">"{task.issue_description}"</p>}
                   {task.issue_photo && (
                      <a href={task.issue_photo} target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80">
                        <img src={task.issue_photo} alt="Issue photo" className="h-10 w-10 object-cover rounded border"/> <span className="sr-only">View issue photo</span>
                      </a>
                   )}
                </div>
              )}
        </CardContent>

         {/* Footer with Actions */}
         <CardFooter className="flex flex-wrap gap-2 pt-2 pb-3 px-4 justify-between items-center bg-muted/30 border-t dark:bg-muted/10">
            {/* Primary actions (Start/Pause/Resume/Stop) */}
            <TaskActions
                task={task}
                activeTaskId={activeTaskId}
                onStart={onStart}
                onPause={onPause}
                onResume={onResume}
                onStop={onStop}
            />
            {/* Secondary actions (Note/Report Issue), hide if task is done */}
           { task.status !== 'done' && (
               <SecondaryTaskActions
                    task={task}
                    onSaveNote={onSaveNote}
                    onReportIssue={onReportIssue}
                />
            )}
        </CardFooter>
    </Card>
  );
}
