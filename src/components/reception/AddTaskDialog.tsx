// src/components/reception/AddTaskDialog.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { Room, Staff } from '@/hooks/useReceptionData';
import type { NewTaskState } from '@/hooks/useReceptionActions';
import { supabase } from '@/integrations/supabase/client'; // Import Supabase client

type CleaningType = Database["public"]["Enums"]["cleaning_type"];
type RoomGroup = Database["public"]["Enums"]["room_group"];

// Cleaning type labels with full descriptive names
const cleaningTypeLabels: Record<CleaningType, string> = {
  W: "Wyjazd",
  P: "Przyjazd",
  T: "Trakt",
  O: "Odświeżenie",
  G: "Generalne",
  S: "Standard"
};

// Room group labels
const roomGroupLabels: Record<RoomGroup, string> = {
  P1: "P1 Rooms",
  P2: "P2 Rooms",
  A1S: "A1S Apartments",
  A2S: "A2S Apartments",
  OTHER: "Other Spaces"
};

// Available cleaning types based on room group
const getAvailableCleaningTypes = (roomGroup: RoomGroup | null): CleaningType[] => {
  if (!roomGroup) return [];

  if (roomGroup === 'OTHER') {
    return ['S', 'G']; // Standard and Generalne for Other Spaces
  }

  // For all room/apartment groups
  return ['W', 'P', 'T', 'O', 'G'];
};

interface AddTaskDialogProps {
    availableRooms: Room[];
    allStaff: Staff[];
    initialState: NewTaskState;
    onSubmit: (newTask: NewTaskState) => Promise<boolean>;
    isSubmitting: boolean;
    triggerButton?: React.ReactNode;
}

const getTodayDateString = () => new Date().toISOString().split("T")[0];

export function AddTaskDialog({
    availableRooms,
    allStaff,
    initialState,
    onSubmit,
    isSubmitting,
    triggerButton
}: AddTaskDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<RoomGroup | null>(null);
    const [newTask, setNewTask] = useState<NewTaskState>(initialState);
    const prevIsOpen = useRef(isOpen);
    const [todayDateString, setTodayDateString] = useState<string>('');
    // State to store room IDs that already have a task on the selected date
    const [assignedRoomIds, setAssignedRoomIds] = useState<Set<string>>(new Set());

    // Set today's date string once on mount
    useEffect(() => {
        setTodayDateString(getTodayDateString());
    }, []);

    // Fetch assigned rooms for the selected date
    useEffect(() => {
        if (!newTask.date || !isOpen) return; // Only fetch if dialog is open and date is selected

        const fetchAssignedRooms = async () => {
            console.log(`Fetching assigned rooms for date: ${newTask.date}`); // Debug log
            const { data, error } = await supabase
                .from('tasks')
                .select('room_id')
                .eq('date', newTask.date)
                // Optionally filter out 'done' tasks if they can be reassigned
                // .not('status', 'eq', 'done');

            if (error) {
                console.error('Error fetching assigned rooms:', error);
                setAssignedRoomIds(new Set()); // Reset on error
                return;
            }

            const roomIds = new Set(data?.map(task => task.room_id).filter(Boolean) as string[]);
            console.log('Assigned room IDs:', roomIds); // Debug log
            setAssignedRoomIds(roomIds);
        };

        fetchAssignedRooms();
    }, [newTask.date, isOpen]); // Rerun when date changes or dialog opens

    // Get unique room groups from available rooms
    const availableGroups = useMemo(() => {
        const groups = new Set<RoomGroup>();
        availableRooms.forEach(room => groups.add(room.group_type));
        return Array.from(groups).sort();
    }, [availableRooms]);

    // Filter rooms by selected group and exclude already assigned rooms
    const filteredRooms = useMemo(() => {
        if (!selectedGroup) return [];
        return availableRooms
            // Filter by the selected group
            .filter(room => room.group_type === selectedGroup)
             // **NEW**: Filter out rooms that are already assigned on the selected date
            .filter(room => !assignedRoomIds.has(room.id))
            .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name
    }, [selectedGroup, availableRooms, assignedRoomIds]); // Add assignedRoomIds dependency

    // Get available cleaning types based on selected group
    const availableCleaningTypes = useMemo(() => {
        return getAvailableCleaningTypes(selectedGroup);
    }, [selectedGroup]);

    // Reset form when dialog opens
    useEffect(() => {
        if (!prevIsOpen.current && isOpen) {
            console.log("Dialog opened, resetting state.");
            const resetState = { ...initialState };

            // Ensure the date is set to today
            if (!resetState.date || resetState.date < todayDateString) {
                resetState.date = todayDateString;
            }

            setNewTask(resetState);
            setSelectedGroup(null); // Reset group selection
            setAssignedRoomIds(new Set()); // Clear assigned rooms initially
        }
        prevIsOpen.current = isOpen;
    }, [isOpen, initialState, todayDateString]);

    // Handle group change
    const handleGroupChange = (group: RoomGroup) => {
        setSelectedGroup(group);

        // Reset room and cleaning type when group changes
        setNewTask(prev => ({
            ...prev,
            roomId: "", // Clear selected room
            cleaningType: getAvailableCleaningTypes(group)[0] || 'W' // Set first available type or default
        }));
    };

    // Handle room change
    const handleRoomChange = (roomId: string) => {
        setNewTask(prev => ({ ...prev, roomId }));
    };

    const handleSubmit = async () => {
        // Validation: Check if the selected room is still available (double-check against latest assignedRoomIds)
        if (assignedRoomIds.has(newTask.roomId)) {
             toast({
                 title: "Room Already Assigned",
                 description: "This room has already been assigned a task for the selected date. Please choose another room.",
                 variant: "destructive",
             });
             // Optionally re-fetch assigned rooms here if needed, though the useEffect should cover it.
             return; // Prevent submission
        }

        const success = await onSubmit(newTask);
        if (success) {
            setIsOpen(false);
        }
    };

     // For displaying placeholder text in room dropdown
     const getRoomPlaceholder = () => {
         if (!selectedGroup) {
             return "Select group first";
         }
         if (filteredRooms.length === 0) {
             return assignedRoomIds.size > 0 ? "All rooms in group assigned" : "No rooms in this group";
         }
         return "Select a room";
     };


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {triggerButton ? (
                // Use asChild to prevent rendering an extra button element if triggerButton is already a button
                <DialogTrigger asChild>
                    {triggerButton}
                </DialogTrigger>
            ) : (
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Add Task
                    </Button>
                </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Add New Cleaning Task</DialogTitle>
                    <DialogDescription>
                        Select date, group, room, cleaning type, guests, and assign staff.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Date Input */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="task-date-modal" className="text-right">Date*</Label>
                        <Input
                            id="task-date-modal"
                            type="date"
                            value={newTask.date}
                            onChange={(e) => setNewTask(prev => ({ ...prev, date: e.target.value }))}
                            className="col-span-3"
                            min={todayDateString} // Prevent selecting past dates
                            required
                            disabled={isSubmitting} // Disable during submission
                        />
                    </div>

                    {/* Group Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="group-modal" className="text-right">Group*</Label>
                        <Select
                            value={selectedGroup || ""}
                            onValueChange={(value) => handleGroupChange(value as RoomGroup)}
                            disabled={isSubmitting} // Disable during submission
                        >
                            <SelectTrigger id="group-modal" className="col-span-3">
                                <SelectValue placeholder="Select a group" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableGroups.map(group => (
                                    <SelectItem key={group} value={group}>
                                        {roomGroupLabels[group]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Room Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="room-modal" className="text-right">Room*</Label>
                        <Select
                            value={newTask.roomId}
                            onValueChange={handleRoomChange}
                            // Disable if no group selected OR no rooms are available OR submitting
                            disabled={!selectedGroup || filteredRooms.length === 0 || isSubmitting}
                        >
                            <SelectTrigger id="room-modal" className="col-span-3">
                                {/* Updated Placeholder Logic */}
                                <SelectValue placeholder={getRoomPlaceholder()} />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredRooms.map(room => (
                                    <SelectItem key={room.id} value={room.id}>
                                        {room.name}
                                    </SelectItem>
                                ))}
                                {/* Optionally show a disabled item if list is empty */}
                                {selectedGroup && filteredRooms.length === 0 && (
                                    <SelectItem value="no-rooms" disabled>
                                         {assignedRoomIds.size > 0 ? "All rooms assigned" : "No rooms available"}
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Cleaning Type Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cleaningType-modal" className="text-right">Type*</Label>
                        <Select
                            value={newTask.cleaningType}
                            onValueChange={(value: CleaningType) => setNewTask(prev => ({ ...prev, cleaningType: value }))}
                            // Disable if no group selected OR no types available OR submitting
                            disabled={!selectedGroup || availableCleaningTypes.length === 0 || isSubmitting}
                        >
                            <SelectTrigger id="cleaningType-modal" className="col-span-3">
                                <SelectValue placeholder={selectedGroup ? "Select type" : "Select group first"} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableCleaningTypes.map(type => (
                                    <SelectItem key={type} value={type}>
                                        {cleaningTypeLabels[type]}
                                    </SelectItem>
                                ))}
                                {selectedGroup && availableCleaningTypes.length === 0 && (
                                     <SelectItem value="no-types" disabled>No types for this group</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Guest Count Input */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="guestCount-modal" className="text-right">Guests*</Label>
                        <Input
                            id="guestCount-modal"
                            type="number"
                            min="1"
                            max="10"
                            value={newTask.guestCount}
                            onChange={(e) => setNewTask(prev => ({ ...prev, guestCount: parseInt(e.target.value, 10) || 1 }))}
                            className="col-span-3"
                            required
                            disabled={isSubmitting} // Disable during submission
                        />
                    </div>

                    {/* Staff Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="assignStaff-modal" className="text-right">Assign Staff</Label>
                        <Select
                            value={newTask.staffId}
                            onValueChange={(value) => setNewTask(prev => ({ ...prev, staffId: value }))}
                            disabled={isSubmitting} // Disable during submission
                        >
                            <SelectTrigger id="assignStaff-modal" className="col-span-3">
                                <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {allStaff.map(staff => (
                                    <SelectItem key={staff.id} value={staff.id}>
                                        {staff.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Reception Notes Textarea */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="notes-modal" className="text-right">Notes</Label>
                        <Textarea
                            id="notes-modal"
                            placeholder="Optional notes..."
                            value={newTask.notes}
                            onChange={(e) => setNewTask(prev => ({ ...prev, notes: e.target.value }))}
                            className="col-span-3 min-h-[60px]"
                            disabled={isSubmitting} // Disable during submission
                            maxLength={2000} // Add max length
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        // Disable if submitting OR required fields are missing
                        disabled={isSubmitting || !newTask.roomId || !newTask.date || !selectedGroup || !newTask.cleaningType || newTask.guestCount < 1}
                    >
                        {isSubmitting ? "Adding..." : "Add Task"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Add toast import if not already present
import { useToast } from "@/hooks/use-toast";
