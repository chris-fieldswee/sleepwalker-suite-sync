// src/components/reception/TaskFilters.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Staff, Room } from '@/hooks/useReceptionData'; // Import Room type
import type { Database } from "@/integrations/supabase/types"; // Import Database types

type TaskStatus = Database["public"]["Enums"]["task_status"];
type RoomGroup = Database["public"]["Enums"]["room_group"];

// Define statuses available in the filter dropdown
const filterableStatuses: Array<{ value: TaskStatus | 'all', label: string }> = [
    { value: 'all', label: 'All Active' },
    { value: 'todo', label: 'To Clean' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'paused', label: 'Paused' },
    { value: 'repair_needed', label: 'Repair Needed' },
];

// Define room groups available
const roomGroups: Array<{ value: RoomGroup | 'all', label: string }> = [
    { value: 'all', label: 'All Groups' },
    { value: 'P1', label: 'P1' },
    { value: 'P2', label: 'P2' },
    { value: 'A1S', label: 'A1S' },
    { value: 'A2S', label: 'A2S' },
    { value: 'OTHER', label: 'Other' },
];

interface TaskFiltersProps {
  date: string | null;
  status: TaskStatus | 'all'; // Use union type
  staffId: string;
  roomGroup: RoomGroup | 'all'; // Use union type
  roomId: string; // Added roomId
  staff: Staff[];
  availableRooms: Room[]; // Added availableRooms
  onDateChange: (date: string | null) => void;
  onStatusChange: (status: TaskStatus | 'all') => void; // Use union type
  onStaffChange: (staffId: string) => void;
  onRoomGroupChange: (group: RoomGroup | 'all') => void; // Use union type
  onRoomChange: (roomId: string) => void; // Added onRoomChange
  onClearFilters: () => void;
}

export const TaskFilters = ({
  date,
  status,
  staffId,
  roomGroup,
  roomId, // Destructure roomId
  staff,
  availableRooms, // Destructure availableRooms
  onDateChange,
  onStatusChange,
  onStaffChange,
  onRoomGroupChange,
  onRoomChange, // Destructure onRoomChange
  onClearFilters,
}: TaskFiltersProps) => {

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onDateChange(e.target.value || null);
  };

  return (
    // Adjusted grid columns for the new filter
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 mb-4 items-end">
      {/* Date Filter */}
      <div className="space-y-1">
        <Label htmlFor="date-filter">Date</Label>
        <Input
          id="date-filter"
          type="date"
          value={date ?? ''}
          onChange={handleDateInputChange}
          className="bg-card h-9 text-sm" // Adjusted height/text size
        />
      </div>

      {/* Status Filter */}
      <div className="space-y-1">
        <Label htmlFor="status-filter">Status</Label>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger id="status-filter" className="bg-card h-9 text-sm">
            <SelectValue placeholder="Filter status..." />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            {filterableStatuses.map(s => (
                <SelectItem key={s.value} value={s.value} className="text-sm">
                    {s.label}
                </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Staff Filter */}
      <div className="space-y-1">
        <Label htmlFor="staff-filter">Staff</Label>
        <Select value={staffId} onValueChange={onStaffChange}>
           <SelectTrigger id="staff-filter" className="bg-card h-9 text-sm">
             <SelectValue placeholder="Filter staff..." />
           </SelectTrigger>
           <SelectContent className="bg-card z-50">
             <SelectItem value="all" className="text-sm">All Staff</SelectItem>
             <SelectItem value="unassigned" className="text-sm">Unassigned</SelectItem>
             {staff.map(s => (
                 <SelectItem key={s.id} value={s.id} className="text-sm">
                     {s.name}
                 </SelectItem>
             ))}
           </SelectContent>
        </Select>
      </div>

      {/* Room Group Filter */}
      <div className="space-y-1">
        <Label htmlFor="group-filter">Group</Label>
        <Select value={roomGroup} onValueChange={onRoomGroupChange}>
          <SelectTrigger id="group-filter" className="bg-card h-9 text-sm">
            <SelectValue placeholder="Filter group..." />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            {roomGroups.map(rg => (
                <SelectItem key={rg.value} value={rg.value} className="text-sm">
                    {rg.label}
                </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Room Filter (New) */}
      <div className="space-y-1">
        <Label htmlFor="room-filter">Room</Label>
        <Select value={roomId} onValueChange={onRoomChange}>
          <SelectTrigger id="room-filter" className="bg-card h-9 text-sm">
            <SelectValue placeholder="Filter room..." />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            <SelectItem value="all" className="text-sm">All Rooms</SelectItem>
            {availableRooms.map(room => (
              <SelectItem key={room.id} value={room.id} className="text-sm">
                {room.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear Button */}
      <Button
          variant="outline"
          onClick={onClearFilters}
          className="w-full h-9 text-sm" // Adjusted height/text size
        >
          <X className="mr-1.5 h-4 w-4" /> {/* Adjusted margin */}
          Clear
      </Button>
    </div>
  );
};
