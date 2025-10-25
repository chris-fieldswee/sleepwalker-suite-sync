// src/components/reception/TaskTableRow.tsx
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, X, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Task {
  id: string;
  status: string;
  room: { name: string; group_type: string };
  user: { id: string; name: string } | null; // User object contains name
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

  const handleStaffChange = async (userIdValue: string) => {
    // Handle 'unassigned' case
    const userId = userIdValue === "unassigned" ? null : userIdValue;
    const { error } = await supabase
      .from("tasks")
      .update({ user_id: userId })
      .eq("id", task.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update staff assignment",
        variant: "destructive",
      });
    } else {
      toast({ title: "Staff updated" });
      // No need to manually update state here, rely on realtime/refresh
    }
  };


  const handleIssueToggle = async () => {
    const newIssueFlag = !task.issue_flag;
    const updates: any = { issue_flag: newIssueFlag };

    if (newIssueFlag) {
      updates.status = "repair_needed";
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
      .update({ reception_notes: receptionNotes })
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
      // No need to manually update state here, rely on realtime/refresh
    }
  };

  const calculateWorkingTime = () => {
    if (!task.start_time) return "-";
    if (!task.stop_time) {
      const elapsed = Math.floor((Date.now() - new Date(task.start_time).getTime()) / 60000);
      // Consider pause time if needed for 'in_progress' display
      return `${elapsed} min`;
    }
    // Use actual_time which accounts for pauses
    return `${task.actual_time ?? 0} min`;
  };

  return (
    <tr className="border-b hover:bg-muted/50 transition-colors">
      <td className="p-3">
        <Badge className={getStatusColor(task.status)}>
          {getStatusLabel(task.status)}
        </Badge>
      </td>
      <td className="p-3 font-medium">{task.room.name}</td>
      <td className="p-3">
        {/* Staff Select Dropdown */}
        <Select
          value={task.user?.id || "unassigned"}
          onValueChange={handleStaffChange}
        >
          <SelectTrigger className="w-[180px] bg-card text-sm">
            {/* Display name in the trigger */}
            <SelectValue placeholder="Assign Staff">
                {task.user?.name || "Unassigned"}
            </SelectValue>
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
      <td className="p-3">{task.cleaning_type}</td>
      <td className="p-3 text-center">{task.guest_count}</td>
      <td className="p-3 text-center">{task.time_limit ?? '-'}</td> {/* Handle null time_limit */}
      <td className="p-3 text-center">
        {task.actual_time !== null ? task.actual_time : "-"}
      </td>
      <td className="p-3 text-center">
        {task.difference !== null ? (
          <span
            className={`font-semibold ${
              task.difference > 0 ? "text-status-todo" : "text-status-done"
            }`}
          >
            {task.difference > 0 ? "+" : ""}
            {task.difference}
          </span>
        ) : (
          "-"
        )}
      </td>
      <td className="p-3 text-center">
        <button
          onClick={handleIssueToggle}
          className={`text-xl font-bold cursor-pointer transition-colors ${
            task.issue_flag ? "text-red-500 hover:text-red-700" : "text-green-500 hover:text-green-700"
          }`}
          title={task.issue_flag ? "Mark as not an issue" : "Mark as issue"}
        >
          {task.issue_flag ? "✗" : "✓"}
        </button>
      </td>
       <td className="p-3 min-w-[200px] max-w-xs"> {/* Added max-width */}
        {editingNotes ? (
          <div className="space-y-1">
            <Textarea
              value={receptionNotes}
              onChange={(e) => setReceptionNotes(e.target.value)}
              className="min-h-[60px] bg-card text-xs" /* smaller text */
              placeholder="Reception notes..."
              maxLength={2000} /* Added maxLength */
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{receptionNotes.length}/2000</span>
              <div className="flex gap-1">
                <Button size="icon" className="h-6 w-6" onClick={handleNotesUpdate}>
                  <Check className="h-3 w-3" />
                  <span className="sr-only">Save Notes</span>
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => {
                    setEditingNotes(false);
                    setReceptionNotes(task.reception_notes || ""); // Reset on cancel
                  }}
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Cancel Edit Notes</span>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5 group"> {/* Reduced space */}
            {task.housekeeping_notes && (
              <p className="text-xs text-muted-foreground italic truncate" title={task.housekeeping_notes}>
                <strong>HK:</strong> {task.housekeeping_notes}
              </p>
            )}
            <div className="flex items-start gap-1"> {/* Align start */}
              <p className="text-xs flex-1 break-words py-1"> {/* Allow word break */}
                {task.reception_notes || (
                  <span className="text-muted-foreground/70 italic">No notes</span>
                )}
              </p>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" /* Show on hover */
                onClick={() => setEditingNotes(true)}
              >
                <Edit2 className="h-3 w-3" />
                <span className="sr-only">Edit Notes</span>
              </Button>
            </div>
          </div>
        )}
      </td>
      <td className="p-3 text-center text-xs">{calculateWorkingTime()}</td>
    </tr>
  );
};
