// src/components/reception/TaskTableRow.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { User, Eye, Trash2, AlertTriangle, MessageSquare, CalendarDays } from "lucide-react"; // Added CalendarDays
import { cn } from "@/lib/utils";
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


interface Task {
  id: string;
  date: string; // Ensure date is always present
  status: string;
  room: { name: string; group_type: string }; // Assuming group_type might be needed later, keep it
  user: { id: string; name: string } | null;
  cleaning_type: string;
  guest_count: number;
  time_limit: number | null;
  actual_time: number | null;
  difference: number | null;
  issue_flag: boolean;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  start_time: string | null; // Keep if needed elsewhere (e.g., detail view)
  stop_time: string | null; // Keep if needed elsewhere (e.g., detail view)
  // Include fields potentially used by tooltips or detail view even if not directly in the row
  issue_description?: string | null;
  issue_photo?: string | null;
}

interface Staff {
  id: string;
  name: string;
}

interface TaskTableRowProps {
  task: Task;
  staff: Staff[]; // Keep staff prop if it might be used for something else later, even if name comes from task.user
  onViewDetails: (task: Task) => void;
  onDeleteTask: (taskId: string) => Promise<void>; // Consistent return type
  isDeleting: boolean;
  showActualAndDifference?: boolean; // New prop to show actual and difference columns
}

export const TaskTableRow = ({ task, staff, onViewDetails, onDeleteTask, isDeleting, showActualAndDifference = false }: TaskTableRowProps) => {

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      todo: "bg-status-todo text-white",
      in_progress: "bg-status-in-progress text-white",
      paused: "bg-status-paused text-white",
      done: "bg-status-done text-white",
      repair_needed: "bg-status-repair text-white",
    };
    return colors[status] || "bg-muted text-muted-foreground"; // Added fallback text color
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      todo: "Do sprzątania",
      in_progress: "W trakcie",
      paused: "Wstrzymane",
      done: "Gotowe",
      repair_needed: "Naprawa",
    };
    return labels[status] || (status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '));
  };

  const cleaningTypeLabels: Record<string, string> = {
    W: "Wyjazd",
    P: "Przyjazd",
    T: "Trakt",
    O: "Odświeżenie",
    G: "Generalne",
    S: "Standard"
  };

  const renderGuestIcons = (count: number) => {
    const icons = [];
    // Ensure count is a positive integer, default to 1 if invalid/zero
    const validCount = Math.max(1, Math.floor(count) || 1);
    // Limit icons to prevent excessive width in table cell
    const displayCount = Math.min(validCount, 5);

    for (let i = 0; i < displayCount; i++) {
      icons.push(<User key={i} className="h-4 w-4 text-muted-foreground" />);
    }
    // Show "+N" if count exceeds display limit
    if (validCount > displayCount) {
      icons.push(<span key="plus" className="text-xs text-muted-foreground ml-0.5">+{validCount - displayCount}</span>);
    }
    return <div className="flex items-center justify-center gap-0.5">{icons}</div>;
  };

  // Format difference with color coding
  const formatDifference = (difference: number | null) => {
    if (difference === null) return "-";
    const sign = difference > 0 ? "+" : "";
    return `${sign}${difference} min`;
  };

  const getDifferenceColor = (difference: number | null) => {
    if (difference === null) return "";
    if (difference > 0) return "text-red-600 dark:text-red-400";
    if (difference < 0) return "text-green-600 dark:text-green-400";
    return "";
  };

  // Simple date formatter (DD.MM)
  const formatShortDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      // Assuming dateString is YYYY-MM-DD
      const parts = dateString.split('-');
      if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}`; // DD.MM
      }
      // Fallback parsing for safety, using UTC to avoid timezone issues
      const date = new Date(dateString + 'T00:00:00Z');
      if (isNaN(date.getTime())) return dateString; // Return original if invalid
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      return `${day}.${month}`;
    } catch (error) {
      console.error("Date formatting error:", error, dateString);
      return dateString; // Return original on error
    }
  };


  const hasNotes = !!task.housekeeping_notes || !!task.reception_notes;
  // Construct tooltip content, handling null notes
  const notesTooltip = `Housekeeping: ${task.housekeeping_notes || '-'}\nReception: ${task.reception_notes || '-'}`;

  return (
    <TableRow className="border-b hover:bg-muted/50 transition-colors text-sm">
      {/* Status */}
      <TableCell className="p-2 align-middle">
        <Badge className={cn(getStatusColor(task.status), "whitespace-nowrap text-xs px-2 py-0.5")}>
          {getStatusLabel(task.status)}
        </Badge>
      </TableCell>
      {/* Room */}
      <TableCell className="p-2 align-middle font-medium">{task.room.name}</TableCell>
      {/* Staff */}
      <TableCell className="p-2 align-middle text-muted-foreground">
        {task.user?.name || <span className="italic text-muted-foreground/70">Nieprzypisane</span>}
      </TableCell>
      {/* Date Column */}
      <TableCell className="p-2 align-middle text-center text-muted-foreground tabular-nums">
        {formatShortDate(task.date)}
      </TableCell>
      {/* Type Column */}
      <TableCell className="p-2 align-middle text-center">
        {cleaningTypeLabels[task.cleaning_type] || task.cleaning_type}
      </TableCell>
      {/* Guests */}
      <TableCell className="p-2 align-middle">
        {renderGuestIcons(task.guest_count)}
      </TableCell>
      {/* Limit */}
      <TableCell className="p-2 align-middle text-center">{task.time_limit ?? '-'}</TableCell>
      {/* Actual - Only show if showActualAndDifference is true */}
      {showActualAndDifference && (
        <TableCell className="p-2 align-middle text-center">
          {task.actual_time !== null ? task.actual_time : "-"}
        </TableCell>
      )}
      {/* Difference - Only show if showActualAndDifference is true */}
      {showActualAndDifference && (
        <TableCell className={cn("p-2 align-middle text-center", getDifferenceColor(task.difference))}>
          {formatDifference(task.difference)}
        </TableCell>
      )}
      {/* Issue */}
      <TableCell className="p-2 align-middle text-center">
        {task.issue_flag ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Make the icon slightly easier to click if needed */}
              <span className="inline-flex items-center justify-center h-full w-full">
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{task.issue_description ? `Problem: ${task.issue_description.substring(0, 50)}...` : 'Zgłoszono Problem'}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      {/* Notes Indicator */}
      <TableCell className="p-2 align-middle text-center">
        {hasNotes ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Make the icon slightly easier to click if needed */}
              <span className="inline-flex items-center justify-center h-full w-full">
                <MessageSquare className="h-4 w-4 text-blue-500" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <pre className="text-xs whitespace-pre-wrap max-w-xs">{notesTooltip}</pre>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      {/* Actions */}
      <TableCell className="p-2 align-middle text-right">
        <div className="flex gap-1 justify-end">
          {/* View Details Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewDetails(task)}>
                <Eye className="h-4 w-4" />
                <span className="sr-only">Szczegóły</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Zobacz/Edytuj Szczegóły</p>
            </TooltipContent>
          </Tooltip>
          {/* Delete Confirmation Dialog */}
          <AlertDialog>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Usuń Zadanie</span>
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Usuń Zadanie</p>
              </TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Jesteś pewien?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tej operacji nie można cofnąć. To trwale usunie zadanie dla pokoju{" "}
                  <span className="font-medium">{task.room.name}</span> zaplanowane na{" "}
                  <span className="font-medium">{formatShortDate(task.date)}</span>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDeleteTask(task.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Usuwanie..." : "Usuń"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
};
