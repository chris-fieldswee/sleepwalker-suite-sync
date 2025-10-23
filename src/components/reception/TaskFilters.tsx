// src/components/reception/TaskFilters.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Staff } from '@/hooks/useReceptionData'; // Import type

interface TaskFiltersProps {
  // *** MODIFIED: date can be string or null ***
  date: string | null;
  status: string;
  staffId: string;
  roomGroup: string;
  staff: Staff[];
  // *** MODIFIED: onDateChange accepts string or null ***
  onDateChange: (date: string | null) => void;
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

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // If the input is cleared, pass null. Otherwise, pass the date string.
      onDateChange(e.target.value || null);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-4 items-end">
      {/* Date Filter */}
      <div className="space-y-2">
        <Label htmlFor="date-filter">Date</Label>
        <Input
          id="date-filter"
          type="date"
          // *** MODIFIED: Handle null value for input ***
          value={date ?? ''} // Use empty string if date is null
          onChange={handleDateInputChange}
          className="bg-card"
          // Add max/min if desired
        />
      </div>

      {/* Status Filter */}
      <div className="space-y-2">
        <Label htmlFor="status-filter">Status</Label>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger id="status-filter" className="bg-card">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="bg-card z-50">
            {/* ... status options unchanged ... */}
          </SelectContent>
        </Select>
      </div>

      {/* Staff Filter */}
      <div className="space-y-2">
        <Label htmlFor="staff-filter">Staff</Label>
        <Select value={staffId} onValueChange={onStaffChange}>
           {/* ... staff options unchanged ... */}
        </Select>
      </div>

      {/* Room Group Filter */}
      <div className="space-y-2">
        <Label htmlFor="group-filter">Room Group</Label>
        <Select value={roomGroup} onValueChange={onRoomGroupChange}>
          {/* ... group options unchanged ... */}
        </Select>
      </div>

      {/* Clear Button */}
      {/* (No className="flex items-end" needed if grid items-end is used) */}
      <Button
          variant="outline"
          onClick={onClearFilters}
          className="w-full" // Takes full grid column width
        >
          <X className="mr-2 h-4 w-4" />
          Clear Filters
      </Button>
    </div>
  );
};
