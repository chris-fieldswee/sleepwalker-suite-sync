import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
// *** MODIFICATION START: Import User icon ***
import { Check, X, Edit2, User } from "lucide-react";
// *** MODIFICATION END ***
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils"; // Import cn utility

interface Task {
  id: string;
  status: string;
  room: { name: string; group_type: string };
  user: { id: string; name: string } | null;
  cleaning_type: string;
  guest_count: number;
  time_limit: number;
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
  staff: Staff[];
}

export const TaskTableRow = ({ task, staff }: TaskTableRowProps) => {
  const [editingNotes, setEditingNotes] = useState(false);
  const [receptionNotes, setReceptionNotes] = useState(task.reception_notes || "");
  const { toast } = useToast();

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

  const handleStaffChange = async (userId: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ user_id: userId === 'unassigned' ? null : userId }) // Handle unassigned case
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update staff assignment",
        variant: "destructive",
      });
    } else {
      toast({ title: "Staff updated" });
      // Note: Realtime should update the UI, manual refresh might not be needed
    }
  };

  const handleIssueToggle = async () => {
    const newIssueFlag = !task.issue_flag;
    const updates: any = { issue_flag: newIssueFlag };

    if (newIssueFlag) {
      updates.status = "repair_needed";
    } else if (task.status === 'repair_needed') {
      // Optionally reset status if unflagging, e.g., to 'todo' or based on time
      updates.status = 'todo'; // Example: reset to 'todo'
    }

    const { error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update issue status",
        variant: "destructive",
      });
    }
    // Note: Realtime should update the UI
  };


  const handleNotesUpdate = async () => {
    // Validate notes length (max 2000 chars)
    if (receptionNotes && receptionNotes.length > 2000) {
      toast({
        title: "Validation Error",
        description: "Reception notes must be less than 2000 characters.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({ reception_notes: receptionNotes || null }) // Send null if empty
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update notes",
        variant: "destructive",
      });
    } else {
      toast({ title: "Notes updated" });
      setEditingNotes(false);
      // Note: Realtime should update the UI
    }
  };

  // Calculate working time or show status if not started/stopped
  const calculateWorkingTime = () => {
      if (task.status === 'done' && task.actual_time !== null) {
          return `${task.actual_time} min`;
      }
      if (task.start_time && task.status !== 'todo') {
          const start = new Date(task.start_time).getTime();
          let end = Date.now();
          if (task.stop_time) {
              end = new Date(task.stop_time).getTime();
          } else if (task.status === 'paused' && task.pause_start) {
              end = new Date(task.pause_start).getTime(); // Calculate up to pause start
          }

          let currentPauseMs = 0;
          if (task.status === 'paused' && task.pause_start) {
            const pauseStartTime = new Date(task.pause_start).getTime();
            if (!isNaN(pauseStartTime)) {
                currentPauseMs = Date.now() - pauseStartTime; // Time since pause started
            }
          }

          const accumulatedPauseMs = (task.total_pause || 0) * 60 * 1000;
          const elapsedMs = Math.max(0, end - start - accumulatedPauseMs); // Adjusted calculation
          const elapsedMinutes = Math.floor(elapsedMs / 60000);

          if (task.status === 'in_progress' || task.status === 'paused') {
              return `${elapsedMinutes} min ${task.status === 'paused' ? '(paused)' : ''}`;
          }
      }
      return "-";
  };

  // *** MODIFICATION START: Render guest icons ***
  const renderGuestIcons = (count: number) => {
    const icons = [];
    // Ensure count is a positive integer, default to 1 if invalid
    const validCount = Math.max(1, Math.floor(count) || 1);
    const displayCount = Math.min(validCount, 10); // Limit icons to a max of 10 for UI sanity

    for (let i = 0; i < displayCount; i++) {
      icons.push(<User key={i} className="h-4 w-4 text-muted-foreground" />);
    }
    // Optionally show "+X" if count exceeds the limit
    if (validCount > displayCount) {
       icons.push(<span key="plus" className="text-xs text-muted-foreground ml-1">+{validCount - displayCount}</span>);
    }
    return <div className="flex items-center justify-center gap-0.5">{icons}</div>;
  };
  // *** MODIFICATION END ***

  return (
    <tr className="border-b hover:bg-muted/50 transition-colors">
      <td className="p-3">
        <Badge className={cn(getStatusColor(task.status), "whitespace-nowrap")}>
          {getStatusLabel(task.status)}
        </Badge>
      </td>
      <td className="p-3 font-medium">{task.room.name}</td>
      <td className="p-3">
        <Select
          value={task.user?.id || "unassigned"}
          onValueChange={handleStaffChange}
        >
          <SelectTrigger className="w-[160px] bg-card h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            <SelectItem value="unassigned" className="text-sm">Unassigned</SelectItem>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-sm">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-3 text-center">{task.cleaning_type}</td>
      {/* *** MODIFICATION START: Use guest icon renderer *** */}
      <td className="p-3 text-center">
        {renderGuestIcons(task.guest_count)}
      </td>
       {/* *** MODIFICATION END *** */}
      <td className="p-3 text-center">{task.time_limit ?? '-'}</td>
      <td className="p-3 text-center">
        {task.actual_time !== null ? task.actual_time : "-"}
      </td>
      <td className="p-3 text-center">
        {task.difference !== null ? (
          <span
            className={cn(
                "font-semibold",
                task.difference > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
            )}
          >
            {task.difference > 0 ? "+" : ""}
            {task.difference}
          </span>
        ) : (
          "-"
        )}
      </td>
      <td className="p-3 text-center">
        {/* Simplified Issue Display */}
         {task.issue_flag ? (
             <span title="Issue Reported" className="text-red-500 font-bold text-lg">!</span>
         ) : (
             <span title="No Issue" className="text-muted-foreground">-</span>
         )}
      </td>
      <td className="p-3 min-w-[200px] max-w-xs"> {/* Added max-width */}
        {editingNotes ? (
          <div className="space-y-1">
            <Textarea
              value={receptionNotes}
              onChange={(e) => setReceptionNotes(e.target.value)}
              className="min-h-[60px] bg-card text-xs"
              placeholder="Reception notes..."
              maxLength={2000} // Add validation limit
            />
            <div className="flex gap-1 justify-end">
              <Button size="icon" className="h-7 w-7" onClick={handleNotesUpdate}>
                <Check className="h-4 w-4" /> <span className="sr-only">Save</span>
              </Button>
              <Button
                size="icon"
                className="h-7 w-7"
                variant="outline"
                onClick={() => {
                  setEditingNotes(false);
                  setReceptionNotes(task.reception_notes || "");
                }}
              >
                <X className="h-4 w-4" /> <span className="sr-only">Cancel</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5 group relative">
            {task.housekeeping_notes && (
              <p className="text-xs text-muted-foreground truncate" title={task.housekeeping_notes}>
                <strong>HK:</strong> {task.housekeeping_notes}
              </p>
            )}
            <div className="flex items-start gap-1">
              <p className="text-xs flex-1 truncate" title={task.reception_notes ?? "No reception notes"}>
                {task.reception_notes || (
                  <span className="italic text-muted-foreground/70">No notes</span>
                )}
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-0 right-0"
                onClick={() => setEditingNotes(true)}
              >
                <Edit2 className="h-3 w-3" /> <span className="sr-only">Edit Notes</span>
              </Button>
            </div>
          </div>
        )}
      </td>
      <td className="p-3 text-center text-xs whitespace-nowrap">{calculateWorkingTime()}</td>
    </tr>
  );
};
