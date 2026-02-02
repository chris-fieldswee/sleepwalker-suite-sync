// src/components/reception/TaskFilters.tsx
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Staff, Room } from '@/hooks/useReceptionData'; // Import Room type
import type { Database } from "@/integrations/supabase/types"; // Import Database types

type TaskStatus = Database["public"]["Enums"]["task_status"];
type RoomGroup = Database["public"]["Enums"]["room_group"];

// Base statuses available in the filter dropdown
const baseFilterableStatuses: Array<{ value: TaskStatus | 'all', label: string }> = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'todo', label: 'Do sprzątania' },
  { value: 'in_progress', label: 'W trakcie' },
  { value: 'paused', label: 'Wstrzymane' },
];

// Additional status for "all tasks" tab
const doneStatusOption: Array<{ value: TaskStatus | 'all', label: string }> = [
  { value: 'done', label: 'Gotowe' },
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
  allowPastDates?: boolean;
  showDoneStatus?: boolean; // Show "Gotowe" status option (for "all tasks" tab)
  // Date range mode (for "all tasks" tab): when true, show Od/Do instead of single date
  showDateRange?: boolean;
  dateRangeFrom?: string | null;
  dateRangeTo?: string | null;
  onDateRangeChange?: (from: string | null, to: string | null) => void;
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
  allowPastDates = false,
  showDoneStatus = false,
  showDateRange = false,
  dateRangeFrom = null,
  dateRangeTo = null,
  onDateRangeChange,
}: TaskFiltersProps) => {
  // Filter available rooms based on selected room group
  const filteredRooms = useMemo(() => {
    if (roomGroup === 'all') {
      return availableRooms;
    }
    return availableRooms.filter(room => room.group_type === roomGroup);
  }, [availableRooms, roomGroup]);

  // Build status options list - include "done" status if showDoneStatus is true
  const filterableStatuses = useMemo(() => {
    if (showDoneStatus) {
      return [...baseFilterableStatuses, ...doneStatusOption];
    }
    return baseFilterableStatuses;
  }, [showDoneStatus]);

  const handleDateSelect = (date: Date | undefined) => {
    onDateChange(date ? format(date, "yyyy-MM-dd") : null);
  };

  const handleDateRangeFromSelect = (date: Date | undefined) => {
    onDateRangeChange?.(date ? format(date, "yyyy-MM-dd") : null, dateRangeTo);
  };

  const handleDateRangeToSelect = (date: Date | undefined) => {
    onDateRangeChange?.(dateRangeFrom, date ? format(date, "yyyy-MM-dd") : null);
  };

  const handleClearFilters = () => {
    onClearFilters();
    if (showDateRange && onDateRangeChange) {
      onDateRangeChange(null, null);
    }
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
    <div className={`grid gap-4 md:grid-cols-2 ${showRoomGroupFilter ? (showDateRange ? 'lg:grid-cols-7' : 'lg:grid-cols-6') : (showDateRange ? 'lg:grid-cols-6' : 'lg:grid-cols-5')} mb-4 items-end`}>
      {/* Date Filter: single date or date range (Od / Do) with calendar picker */}
      {showDateRange ? (
        <>
          <div className="space-y-1">
            <Label>Od</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9 text-sm bg-card",
                    !dateRangeFrom && "text-muted-foreground",
                    dateRangeFrom && "border-[#7d212b]"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRangeFrom
                    ? format(new Date(dateRangeFrom + "T12:00:00"), "d MMMM yyyy", { locale: pl })
                    : "Wybierz datę"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRangeFrom ? new Date(dateRangeFrom + "T12:00:00") : undefined}
                  onSelect={(d) => handleDateRangeFromSelect(d)}
                  locale={pl}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label>Do</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9 text-sm bg-card",
                    !dateRangeTo && "text-muted-foreground",
                    dateRangeTo && "border-[#7d212b]"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRangeTo
                    ? format(new Date(dateRangeTo + "T12:00:00"), "d MMMM yyyy", { locale: pl })
                    : "Wybierz datę"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateRangeTo ? new Date(dateRangeTo + "T12:00:00") : undefined}
                  onSelect={(d) => handleDateRangeToSelect(d)}
                  locale={pl}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </>
      ) : (
        <div className="space-y-1">
          <Label>Data</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal h-9 text-sm bg-card",
                  !date && "text-muted-foreground",
                  date && "border-[#7d212b]"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date
                  ? format(new Date(date + "T12:00:00"), "d MMMM yyyy", { locale: pl })
                  : "Wybierz datę"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date ? new Date(date + "T12:00:00") : undefined}
                onSelect={(d) => handleDateSelect(d)}
                disabled={allowPastDates ? undefined : (d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                locale={pl}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Status Filter */}
      <div className="space-y-1">
        <Label htmlFor="status-filter">Status</Label>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger 
            id="status-filter" 
            className={cn(
              "bg-card h-9 text-sm",
              status !== 'all' && "border-[#7d212b]"
            )}
          >
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
          <SelectTrigger 
            id="staff-filter" 
            className={cn(
              "bg-card h-9 text-sm",
              staffId !== 'all' && staffId !== 'unassigned' && "border-[#7d212b]"
            )}
          >
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
            <SelectTrigger 
              id="group-filter" 
              className={cn(
                "bg-card h-9 text-sm",
                roomGroup !== 'all' && "border-[#7d212b]"
              )}
            >
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
          <SelectTrigger 
            id="room-filter" 
            className={cn(
              "bg-card h-9 text-sm",
              roomId !== 'all' && "border-[#7d212b]"
            )}
          >
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
        onClick={handleClearFilters}
        className="w-full h-9 text-sm"
      >
        <X className="mr-1.5 h-4 w-4" />
        Wyczyść
      </Button>
    </div>
  );
};
