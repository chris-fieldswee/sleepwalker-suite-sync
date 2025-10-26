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
    const [assignedRoomIds, setAssignedRoomIds] = useState<Set<string>>(new Set());

    // Set today's date string once on mount
    useEffect(() => {
        setTodayDateString(getTodayDateString());
    }, []);

    // Fetch assigned rooms for the selected date
    useEffect(() => {
        if (!newTask.date) return;
        
        const fetchAssignedRooms = async () => {
            const { data, error } = await supabase
                .from('tasks')
                .select('room_id')
                .eq('date', newTask.date);
            
            if (error) {
                console.error('Error fetching assigned rooms:', error);
                return;
            }
            
            const roomIds = new Set(data?.map(task => task.room_id).filter(Boolean) as string[]);
            setAssignedRoomIds(roomIds);
        };
        
        fetchAssignedRooms();
    }, [newTask.date]);

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
            .filter(room => room.group_type === selectedGroup && !assignedRoomIds.has(room.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedGroup, availableRooms, assignedRoomIds]);

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
        }
        prevIsOpen.current = isOpen;
    }, [isOpen, initialState, todayDateString]);

    // Handle group change
    const handleGroupChange = (group: RoomGroup) => {
        setSelectedGroup(group);
        
        // Reset room and cleaning type when group changes
        setNewTask(prev => ({
            ...prev,
            roomId: "",
            cleaningType: getAvailableCleaningTypes(group)[0] || 'W' // Set first available type
        }));
    };

    // Handle room change
    const handleRoomChange = (roomId: string) => {
        setNewTask(prev => ({ ...prev, roomId }));
    };

    const handleSubmit = async () => {
        const success = await onSubmit(newTask);
        if (success) {
            setIsOpen(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {triggerButton ? (
                <DialogTrigger>
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
                        Select group, room, cleaning type, guests, and assign staff.
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
                            min={todayDateString}
                            required
                        />
                    </div>

                    {/* Group Select - NEW */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="group-modal" className="text-right">Group*</Label>
                        <Select 
                            value={selectedGroup || ""} 
                            onValueChange={(value) => handleGroupChange(value as RoomGroup)}
                        >
                            <SelectTrigger id="group-modal" className="col-span-3">
                                <SelectValue placeholder="Select a group first" />
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

                    {/* Room Select - Conditional on group selection */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="room-modal" className="text-right">Room*</Label>
                        <Select 
                            value={newTask.roomId} 
                            onValueChange={handleRoomChange}
                            disabled={!selectedGroup}
                        >
                            <SelectTrigger id="room-modal" className="col-span-3">
                                <SelectValue placeholder={selectedGroup ? (filteredRooms.length > 0 ? "Select a room" : "No rooms available") : "Select group first"} />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredRooms.map(room => (
                                    <SelectItem key={room.id} value={room.id}>
                                        {room.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Cleaning Type Select - Conditional on group selection */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cleaningType-modal" className="text-right">Type*</Label>
                        <Select 
                            value={newTask.cleaningType} 
                            onValueChange={(value: CleaningType) => setNewTask(prev => ({ ...prev, cleaningType: value }))}
                            disabled={!selectedGroup}
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
                        />
                    </div>

                    {/* Staff Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="assignStaff-modal" className="text-right">Assign Staff</Label>
                        <Select 
                            value={newTask.staffId} 
                            onValueChange={(value) => setNewTask(prev => ({ ...prev, staffId: value }))}
                        >
                            <SelectTrigger id="assignStaff-modal" className="col-span-3">
                                <SelectValue placeholder="Select staff or leave unassigned" />
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
                            placeholder="Optional notes for housekeeping..." 
                            value={newTask.notes} 
                            onChange={(e) => setNewTask(prev => ({ ...prev, notes: e.target.value }))} 
                            className="col-span-3 min-h-[60px]"
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
                        disabled={isSubmitting || !newTask.roomId || !newTask.date || !selectedGroup}
                    >
                        {isSubmitting ? "Adding..." : "Add Task"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
