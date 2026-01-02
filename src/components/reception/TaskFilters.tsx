// src/components/reception/TaskFilters.tsx
import { useMemo } from "react";
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
  { value: 'all', label: 'Wszystkie aktywne' },
  { value: 'todo', label: 'Do sprzątania' },
  { value: 'in_progress', label: 'W trakcie' },
  { value: 'paused', label: 'Wstrzymane' },
];

// *** MODIFICATION START: Define room group options type ***
export type RoomGroupOption = { value: RoomGroup | 'all', label: string };
// *** MODIFICATION END ***


interface TaskFiltersProps {
  date: string | null;
  status: TaskStatus | 'all';
  staffId: string;
  roomGroup: RoomGroup | 'all';
  roomId: string;
  staff: Staff[];
  availableRooms: Room[];
  // *** MODIFICATION START: Add roomGroups prop ***
  roomGroups: RoomGroupOption[];
  // *** MODIFICATION END ***
  onDateChange: (date: string | null) => void;
  onStatusChange: (status: TaskStatus | 'all') => void;
  onStaffChange: (staffId: string) => void;
  onRoomGroupChange: (group: RoomGroup | 'all') => void;
  onRoomChange: (roomId: string) => void;
  onClearFilters: () => void;
  showRoomGroupFilter?: boolean;
}

export const TaskFilters = ({
  date,
  status,
  staffId,
  roomGroup,
  roomId,
  staff,
  availableRooms,
  // *** MODIFICATION START: Destructure roomGroups prop ***
  roomGroups,
  // *** MODIFICATION END ***
  onDateChange,
  onStatusChange,
  onStaffChange,
  onRoomGroupChange,
  onRoomChange,
  onClearFilters,
  showRoomGroupFilter = true,
}: TaskFiltersProps) => {
  // Filter available rooms based on selected room group
  const filteredRooms = useMemo(() => {
    if (roomGroup === 'all') {
      return availableRooms;
    }
    return availableRooms.filter(room => room.group_type === roomGroup);
  }, [availableRooms, roomGroup]);

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateChange(e.target.value || null);
  };

  const handleRoomGroupChange = (value: RoomGroup | 'all') => {
    onRoomGroupChange(value);
    // If a specific room is selected and it doesn't belong to the new group, reset room selection
    if (value !== 'all' && roomId !== 'all') {
      const selectedRoom = availableRooms.find(r => r.id === roomId);
      if (selectedRoom && selectedRoom.group_type !== value) {
        onRoomChange('all');
      }
    }
  };

  const handleRoomChange = (value: string) => {
    onRoomChange(value);
    // If a specific room is selected, automatically set the room group to match
    if (value !== 'all') {
      const selectedRoom = availableRooms.find(r => r.id === value);
      if (selectedRoom && roomGroup !== selectedRoom.group_type) {
        onRoomGroupChange(selectedRoom.group_type);
      }
    }
  };

  return (
    <div className={`grid gap-4 md:grid-cols-2 ${showRoomGroupFilter ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} mb-4 items-end`}>
      {/* Date Filter */}
      <div className="space-y-1">
        <Label htmlFor="date-filter">Data</Label>
        <Input
          id="date-filter"
          type="date"
          value={date ?? ''}
          onChange={handleDateInputChange}
          min={new Date().toISOString().split('T')[0]} // Prevent selecting past dates
          className="bg-card h-9 text-sm"
        />
      </div>

      {/* Status Filter */}
      <div className="space-y-1">
        <Label htmlFor="status-filter">Status</Label>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger id="status-filter" className="bg-card h-9 text-sm">
            <SelectValue placeholder="Filtruj status..." />
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
        <Label htmlFor="staff-filter">Personel</Label>
        <Select value={staffId} onValueChange={onStaffChange}>
          <SelectTrigger id="staff-filter" className="bg-card h-9 text-sm">
            <SelectValue placeholder="Filtruj personel..." />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            <SelectItem value="all" className="text-sm">Cały personel</SelectItem>
            <SelectItem value="unassigned" className="text-sm">Nieprzypisane</SelectItem>
            {staff.map(s => (
              <SelectItem key={s.id} value={s.id} className="text-sm">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Room Group Filter - Conditionally rendered */}
      {showRoomGroupFilter && (
        <div className="space-y-1">
          <Label htmlFor="group-filter">Grupa</Label>
          <Select value={roomGroup} onValueChange={handleRoomGroupChange}>
            <SelectTrigger id="group-filter" className="bg-card h-9 text-sm">
              <SelectValue placeholder="Filtruj grupę..." />
            </SelectTrigger>
            <SelectContent className="bg-card z-50">
              {/* *** MODIFICATION START: Use roomGroups prop *** */}
              {roomGroups.map(rg => (
                <SelectItem key={rg.value} value={rg.value} className="text-sm">
                  {rg.label}
                </SelectItem>
              ))}
              {/* *** MODIFICATION END *** */}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Room Filter */}
      <div className="space-y-1">
        <Label htmlFor="room-filter">Pokój</Label>
        <Select value={roomId} onValueChange={handleRoomChange}>
          <SelectTrigger id="room-filter" className="bg-card h-9 text-sm">
            <SelectValue placeholder="Filtruj pokój..." />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            <SelectItem value="all" className="text-sm">Wszystkie pokoje</SelectItem>
            {filteredRooms.map(room => (
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
        className="w-full h-9 text-sm"
      >
        <X className="mr-1.5 h-4 w-4" />
        Wyczyść
      </Button>
    </div>
  );
};
