// src/components/reception/IssueTableRow.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Eye, Trash2 } from "lucide-react";
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
import type { Database } from "@/integrations/supabase/types";

type Issue = Database["public"]["Tables"]["issues"]["Row"];

interface ExpandedIssue extends Issue {
  room: { id: string; name: string; color: string | null };
  assigned_to?: { id: string; name: string; first_name: string | null; last_name: string | null } | null;
  reported_by?: { id: string; name: string; first_name: string | null; last_name: string | null } | null;
  resolved_by?: { id: string; name: string; first_name: string | null; last_name: string | null } | null;
}

interface IssueTableRowProps {
  issue: ExpandedIssue;
  onViewDetails: (issue: ExpandedIssue) => void;
  onDelete: (issueId: string) => Promise<void>;
  isDeleting: boolean;
}

export const IssueTableRow = ({ issue, onViewDetails, onDelete, isDeleting }: IssueTableRowProps) => {

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      reported: { label: 'Zgłoszone', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200' },
      open: { label: 'Otwarte', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
      in_progress: { label: 'W trakcie', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
      resolved: { label: 'Rozwiązane', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
      closed: { label: 'Zamknięte', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200' },
    };
    const { label, className } = config[status] || { label: status, className: '' };
    return <Badge className={className}>{label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const config: Record<string, { label: string; className: string }> = {
      low: { label: 'Niski', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' },
      medium: { label: 'Średni', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' },
      high: { label: 'Wysoki', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' },
      urgent: { label: 'Pilny', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
    };
    const { label, className } = config[priority] || { label: priority, className: '' };
    return <Badge className={className}>{label}</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getDisplayName = (user: { id: string; name: string; first_name: string | null; last_name: string | null } | null) => {
    if (!user) return "Nieprzypisane";
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.name;
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <TableRow className="border-b hover:bg-muted/50 transition-colors text-sm">
      {/* Room */}
      <TableCell className="p-2 align-middle font-medium">{issue.room.name}</TableCell>

      {/* Title */}
      <TableCell className="p-2 align-middle">{truncateText(issue.title, 50)}</TableCell>

      {/* Priority */}
      <TableCell className="p-2 align-middle text-center">
        {getPriorityBadge(issue.priority)}
      </TableCell>

      {/* Status */}
      <TableCell className="p-2 align-middle text-center">
        {getStatusBadge(issue.status)}
      </TableCell>

      {/* Assigned To */}
      <TableCell className="p-2 align-middle">
        {issue.assigned_to ? getDisplayName(issue.assigned_to) : 'Nieprzypisane'}
      </TableCell>

      {/* Reported At */}
      <TableCell className="p-2 align-middle text-center text-muted-foreground">
        {formatDate(issue.reported_at)}
      </TableCell>

      {/* Photo */}
      <TableCell className="p-2 align-middle text-center">
        {issue.photo_url ? 'Tak' : '-'}
      </TableCell>

      {/* Actions */}
      <TableCell className="p-2 align-middle text-right">
        <div className="flex gap-1 justify-end">
          {/* View Details Button */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewDetails(issue)}>
                  <Eye className="h-4 w-4" />
                  <span className="sr-only">Szczegóły</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>Zobacz/Edytuj Szczegóły</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Delete Confirmation Dialog */}
          <AlertDialog>
            <TooltipProvider delayDuration={100}>
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
                      <span className="sr-only">Usuń Problem</span>
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Usuń Problem</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Czy na pewno?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tej akcji nie można cofnąć. Spowoduje to trwałe usunięcie problemu dla pokoju{" "}
                  <span className="font-medium">{issue.room.name}</span>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(issue.id)}
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

