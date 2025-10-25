// src/components/reception/TaskTableRow.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Eye, Trash2, AlertTriangle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils"; // Import cn utility
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


// Keep Task interface consistent
interface Task {
  id: string;
  status: string;
  room: { name: string; group_type: string };
  user: { id: string; name: string } | null;
  cleaning_type: string;
  guest_count: number;
  time_limit: number | null; // Allow null
  actual_time: number | null;
  difference: number | null;
  issue_flag: boolean;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  start_time: string | null;
  stop_time: string | null;
}

interface Staff {
  id: string;
  name: string;
}

interface TaskTableRowProps {
  task: Task;
  staff: Staff[]; // Keep staff for display even if not editable here
  onViewDetails: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  isDeleting: boolean; // Add state for delete button
}

export const TaskTableRow = ({ task, staff, onViewDetails, onDeleteTask, isDeleting }: TaskTableRowProps) => {

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      todo: "bg-status-todo text-white",
      in_progress: "bg-status-in-progress text-white",
      paused: "bg-status-paused text-white",
      done: "bg-status-done text-white",
      repair_needed: "bg-status-repair text-white",
    };
    return colors[status] || "bg-muted";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      todo: "To Clean",
      in_progress: "In Progress",
      paused: "Paused",
      done: "Done",
      repair_needed: "Repair",
    };
    return labels[status] || status;
  };

  // Render guest icons (remains the same)
  const renderGuestIcons = (count: number) => {
    const icons = [];
    const validCount = Math.max(1, Math.floor(count) || 1);
    const displayCount = Math.min(validCount, 5); // Limit icons slightly more aggressively in table

    for (let i = 0; i < displayCount; i++) {
      icons.push(<User key={i} className="h-4 w-4 text-muted-foreground" />);
    }
    if (validCount > displayCount) {
       icons.push(<span key="plus" className="text-xs text-muted-foreground ml-0.5">+{validCount - displayCount}</span>);
    }
    return <div className="flex items-center justify-center gap-0.5">{icons}</div>;
  };

  const hasNotes = !!task.housekeeping_notes || !!task.reception_notes;
  const notesTooltip = `HK: ${task.housekeeping_notes || '-'}\nREC: ${task.reception_notes || '-'}`;

  return (
    <TooltipProvider delayDuration={100}>
      <tr className="border-b hover:bg-muted/50 transition-colors text-sm">
        {/* Status */}
        <td className="p-2 align-middle">
          <Badge className={cn(getStatusColor(task.status), "whitespace-nowrap text-xs px-2 py-0.5")}>
            {getStatusLabel(task.status)}
          </Badge>
        </td>
        {/* Room */}
        <td className="p-2 align-middle font-medium">{task.room.name}</td>
        {/* Staff */}
        <td className="p-2 align-middle text-muted-foreground">{task.user?.name || <span className="italic text-muted-foreground/70">Unassigned</span>}</td>
        {/* Type */}
        <td className="p-2 align-middle text-center">{task.cleaning_type}</td>
        {/* Guests */}
        <td className="p-2 align-middle">
          {renderGuestIcons(task.guest_count)}
        </td>
        {/* Limit */}
        <td className="p-2 align-middle text-center">{task.time_limit ?? '-'}</td>
        {/* Actual */}
        <td className="p-2 align-middle text-center">
          {task.actual_time !== null ? task.actual_time : "-"}
        </td>
        {/* Issue */}
        <td className="p-2 align-middle text-center">
          {task.issue_flag ? (
            <Tooltip>
                <TooltipTrigger asChild>
                    <AlertTriangle className="h-4 w-4 text-red-500 mx-auto" />
                </TooltipTrigger>
                <TooltipContent>
                    <p>Issue Reported</p>
                </TooltipContent>
            </Tooltip>
           ) : (
            <span className="text-muted-foreground">-</span>
           )}
        </td>
        {/* Notes Indicator */}
        <td className="p-2 align-middle text-center">
          {hasNotes ? (
              <Tooltip>
                  <TooltipTrigger asChild>
                      <MessageSquare className="h-4 w-4 text-blue-500 mx-auto" />
                  </TooltipTrigger>
                  <TooltipContent>
                      <pre className="text-xs whitespace-pre-wrap max-w-xs">{notesTooltip}</pre>
                  </TooltipContent>
              </Tooltip>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </td>
        {/* Actions */}
        <td className="p-2 align-middle text-right">
          <div className="flex gap-1 justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewDetails(task)}>
                  <Eye className="h-4 w-4" />
                  <span className="sr-only">View Details</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>View/Edit Details</p></TooltipContent>
            </Tooltip>
            {/* Delete Confirmation */}
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" disabled={isDeleting}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete Task</span>
                        </Button>
                    </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent><p>Delete Task</p></TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the task for room <span className="font-medium">{task.room.name}</span>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDeleteTask(task.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </td>
      </tr>
    </TooltipProvider>
  );
};
