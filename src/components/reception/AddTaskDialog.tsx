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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";

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
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<RoomGroup | null>(null);
    const [newTask, setNewTask] = useState<NewTaskState>(initialState);
    const prevIsOpen = useRef(isOpen);
    const [todayDateString, setTodayDateString] = useState<string>('');
    // State to store room IDs that already have a task on the selected date
    const [assignedRoomIds, setAssignedRoomIds] = useState<Set<string>>(new Set());
    const [availableStaff, setAvailableStaff] = useState<Staff[]>([]);
    const [availabilityData, setAvailabilityData] = useState<any[]>([]);
    const [taskTimeLimit, setTaskTimeLimit] = useState<number | null>(null);

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

    // Fetch time limit when room, cleaning type, and guest count are selected
    useEffect(() => {
        if (!newTask.roomId || !newTask.cleaningType || !newTask.guestCount || !isOpen) {
            setTaskTimeLimit(null);
            return;
        }

        const fetchTimeLimit = async () => {
            try {
                const selectedRoom = availableRooms.find(r => r.id === newTask.roomId);
                if (!selectedRoom) return;

                const { data: limitData, error: limitError } = await supabase
                    .from('limits')
                    .select('time_limit')
                    .eq('group_type', selectedRoom.group_type)
                    .eq('cleaning_type', newTask.cleaningType)
                    .eq('guest_count', newTask.guestCount)
                    .maybeSingle();

                if (limitError) {
                    console.error('Error fetching time limit:', limitError);
                    setTaskTimeLimit(null);
                    return;
                }

                const timeLimit = limitData?.time_limit ?? null;
                setTaskTimeLimit(timeLimit);
                console.log(`Time limit for ${selectedRoom.group_type}/${newTask.cleaningType}/${newTask.guestCount}: ${timeLimit} minutes`);
            } catch (error) {
                console.error('Error in fetchTimeLimit:', error);
                setTaskTimeLimit(null);
            }
        };

        fetchTimeLimit();
    }, [newTask.roomId, newTask.cleaningType, newTask.guestCount, isOpen, availableRooms]);

    // Fetch available staff for the selected date and task requirements
    useEffect(() => {
        if (!newTask.date || !isOpen) return;

        const fetchAvailableStaff = async () => {
            try {
                // Get staff availability for the selected date
                const { data: availabilityData, error: availabilityError } = await supabase
                    .from('staff_availability')
                    .select(`
                        staff_id,
                        available_hours,
                        staff:users(id, name, first_name, last_name, role)
                    `)
                    .eq('date', newTask.date);

                if (availabilityError) {
                    console.error('Error fetching staff availability:', availabilityError);
                    // Fallback to all staff if availability check fails
                    setAvailableStaff(allStaff);
                    setAvailabilityData([]);
                    return;
                }

                // Store availability data for display
                setAvailabilityData(availabilityData || []);

                // Convert task time limit from minutes to hours for comparison
                const requiredHours = taskTimeLimit ? taskTimeLimit / 60 : 0;

                // Filter staff based on availability and task requirements
                const filteredStaff = allStaff.filter(staff => {
                    // Always include admins
                    if (staff.role === 'admin') return true;

                    // Find availability data for this staff member
                    const availabilityInfo = availabilityData?.find(item => item.staff_id === staff.id);
                    
                    if (!availabilityInfo) return false; // No availability data

                    // Check if staff has enough available hours for the task
                    const hasEnoughHours = requiredHours === 0 || availabilityInfo.available_hours >= requiredHours;
                    
                    return hasEnoughHours;
                });

                console.log('Availability data:', availabilityData);
                console.log('Task time limit:', taskTimeLimit, 'minutes (', requiredHours, 'hours)');
                console.log('All staff:', allStaff.map(s => ({ id: s.id, name: s.name, role: s.role })));
                console.log(`Found ${filteredStaff.length} available staff for ${newTask.date} (requiring ${requiredHours}h)`);

                setAvailableStaff(filteredStaff);
            } catch (error) {
                console.error('Error in fetchAvailableStaff:', error);
                // Fallback to all staff
                setAvailableStaff(allStaff);
            }
        };

        fetchAvailableStaff();
    }, [newTask.date, isOpen, allStaff, taskTimeLimit]);

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
            setAvailableStaff(allStaff); // Initialize with all staff
            setAvailabilityData([]); // Clear availability data initially
            setTaskTimeLimit(null); // Clear task time limit
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
                                {availableStaff.length === 0 && taskTimeLimit && (
                                    <SelectItem value="no-staff" disabled>
                                        No staff available for this task ({taskTimeLimit} min)
                                    </SelectItem>
                                )}
                                {availableStaff.map(staff => {
                                    // Find availability info for this staff member
                                    const availabilityInfo = availabilityData?.find(item => item.staff_id === staff.id);
                                    const availableHours = availabilityInfo?.available_hours || 0;
                                    const requiredHours = taskTimeLimit ? taskTimeLimit / 60 : 0;
                                    
                                    return (
                                        <SelectItem key={staff.id} value={staff.id}>
                                            <div className="flex justify-between items-center w-full">
                                                <span>{staff.name}</span>
                                                {staff.role !== 'admin' && (
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                        {availableHours.toFixed(1)}h available
                                                        {requiredHours > 0 && (
                                                            <span className="text-green-600 ml-1">
                                                                (needs {requiredHours.toFixed(1)}h)
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </SelectItem>
                                    );
                                })}
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
