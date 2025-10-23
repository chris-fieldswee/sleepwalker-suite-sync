import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Staff {
  id: string;
  name: string;
}

interface TaskFiltersProps {
  date: string;
  status: string;
  staffId: string;
  roomGroup: string;
  staff: Staff[];
  onDateChange: (date: string) => void;
  onStatusChange: (status: string) => void;
  onStaffChange: (staffId: string) => void;
  onRoomGroupChange: (group: string) => void;
  onClearFilters: () => void;
}

export const TaskFilters = ({
  date,
  status,
  staffId,
  roomGroup,
  staff,
  onDateChange,
  onStatusChange,
  onStaffChange,
  onRoomGroupChange,
  onClearFilters,
}: TaskFiltersProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-4">
      <div className="space-y-2">
        <Label htmlFor="date-filter">Date</Label>
        <Input
          id="date-filter"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="bg-card"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status-filter">Status</Label>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger id="status-filter" className="bg-card">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="todo">To Clean</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="repair_needed">Repair Needed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="staff-filter">Staff</Label>
        <Select value={staffId} onValueChange={onStaffChange}>
          <SelectTrigger id="staff-filter" className="bg-card">
            <SelectValue placeholder="All staff" />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            <SelectItem value="all">All Staff</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {staff.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="group-filter">Room Group</Label>
        <Select value={roomGroup} onValueChange={onRoomGroupChange}>
          <SelectTrigger id="group-filter" className="bg-card">
            <SelectValue placeholder="All groups" />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            <SelectItem value="all">All Groups</SelectItem>
            <SelectItem value="P1">P1</SelectItem>
            <SelectItem value="P2">P2</SelectItem>
            <SelectItem value="A1S">A1S</SelectItem>
            <SelectItem value="A2S">A2S</SelectItem>
            <SelectItem value="OTHER">OTHER</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end">
        <Button
          variant="outline"
          onClick={onClearFilters}
          className="w-full"
        >
          <X className="mr-2 h-4 w-4" />
          Clear Filters
        </Button>
      </div>
    </div>
  );
};
