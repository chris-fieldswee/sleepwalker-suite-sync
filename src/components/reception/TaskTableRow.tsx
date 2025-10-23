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
    }
  };

  const calculateWorkingTime = () => {
    if (!task.start_time) return "-";
    if (!task.stop_time) {
      const elapsed = Math.floor((Date.now() - new Date(task.start_time).getTime()) / 60000);
      return `${elapsed} min`;
    }
    return `${task.actual_time || 0} min`;
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
        <Select
          value={task.user?.id || "unassigned"}
          onValueChange={handleStaffChange}
        >
          <SelectTrigger className="w-[180px] bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-3">{task.cleaning_type}</td>
      <td className="p-3 text-center">{task.guest_count}</td>
      <td className="p-3 text-center">{task.time_limit}</td>
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
          className={`text-xl font-bold ${
            task.issue_flag ? "text-status-todo" : "text-status-done"
          }`}
        >
          {task.issue_flag ? "✗" : "✓"}
        </button>
      </td>
      <td className="p-3 min-w-[200px]">
        {editingNotes ? (
          <div className="space-y-2">
            <Textarea
              value={receptionNotes}
              onChange={(e) => setReceptionNotes(e.target.value)}
              className="min-h-[60px] bg-card"
              placeholder="Reception notes..."
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleNotesUpdate}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingNotes(false);
                  setReceptionNotes(task.reception_notes || "");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {task.housekeeping_notes && (
              <p className="text-xs text-muted-foreground">
                <strong>HK:</strong> {task.housekeeping_notes}
              </p>
            )}
            <div className="flex items-center gap-2">
              <p className="text-xs flex-1">
                {task.reception_notes || (
                  <span className="text-muted-foreground">No notes</span>
                )}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingNotes(true)}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </td>
      <td className="p-3 text-center">{calculateWorkingTime()}</td>
    </tr>
  );
};
