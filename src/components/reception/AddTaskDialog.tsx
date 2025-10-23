// src/components/reception/AddTaskDialog.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { Room, Staff } from '@/hooks/useReceptionData'; // Import types
import type { NewTaskState } from '@/hooks/useReceptionActions'; // Import types

type CleaningType = Database["public"]["Enums"]["cleaning_type"];
const cleaningTypes: CleaningType[] = ["W", "P", "T", "O", "G", "S"];

interface AddTaskDialogProps {
    availableRooms: Room[];
    allStaff: Staff[];
    initialState: NewTaskState;
    onSubmit: (newTask: NewTaskState) => Promise<boolean>; // Returns true on success
    isSubmitting: boolean;
    triggerButton?: React.ReactNode; // Optional custom trigger
}

export function AddTaskDialog({
    availableRooms,
    allStaff,
    initialState,
    onSubmit,
    isSubmitting,
    triggerButton
}: AddTaskDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [newTask, setNewTask] = useState<NewTaskState>(initialState);

    // Reset form when dialog opens or initial state changes
    useEffect(() => {
        if (isOpen) {
             // Set default room if available and not already set
             if (availableRooms.length > 0 && !newTask.roomId) {
                 setNewTask(prev => ({ ...initialState, roomId: availableRooms[0].id }));
             } else {
                 setNewTask(initialState);
             }
        }
    }, [isOpen, initialState, availableRooms, newTask.roomId]); // Added newTask.roomId to prevent resetting selection


    const handleSubmit = async () => {
        const success = await onSubmit(newTask);
        if (success) {
            setIsOpen(false); // Close dialog on success
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {triggerButton || <Button variant="outline" size="sm"> <Plus className="mr-2 h-4 w-4" /> Add Task </Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Add New Cleaning Task</DialogTitle>
                    <DialogDescription> Select room, cleaning type, guests, and assign staff. </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Room Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="room-modal" className="text-right">Room*</Label>
                        <Select
                            value={newTask.roomId}
                            onValueChange={(value) => setNewTask(prev => ({ ...prev, roomId: value }))}
                        >
                            <SelectTrigger id="room-modal" className="col-span-3"> <SelectValue placeholder="Select a room" /> </SelectTrigger>
                            <SelectContent>{availableRooms.length > 0 ? availableRooms.map(room => ( <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem> )) : <SelectItem value="loading" disabled>Loading rooms...</SelectItem>}</SelectContent>
                        </Select>
                    </div>
                    {/* Cleaning Type Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cleaningType-modal" className="text-right">Type*</Label>
                        <Select
                            value={newTask.cleaningType}
                            onValueChange={(value: CleaningType) => setNewTask(prev => ({ ...prev, cleaningType: value }))}
                         >
                            <SelectTrigger id="cleaningType-modal" className="col-span-3"> <SelectValue placeholder="Select type" /> </SelectTrigger>
                            <SelectContent>{cleaningTypes.map(type => ( <SelectItem key={type} value={type}>{type}</SelectItem> ))}</SelectContent>
                        </Select>
                    </div>
                    {/* Guest Count Input */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="guestCount-modal" className="text-right">Guests*</Label>
                        <Input
                            id="guestCount-modal" type="number" min="1" max="10" // Added max
                            value={newTask.guestCount}
                            onChange={(e) => setNewTask(prev => ({ ...prev, guestCount: parseInt(e.target.value, 10) || 1 }))}
                            className="col-span-3" required
                        />
                    </div>
                    {/* Staff Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="assignStaff-modal" className="text-right">Assign Staff</Label>
                        <Select
                            value={newTask.staffId}
                            onValueChange={(value) => setNewTask(prev => ({ ...prev, staffId: value }))}
                        >
                            <SelectTrigger id="assignStaff-modal" className="col-span-3"> <SelectValue placeholder="Select staff or leave unassigned" /> </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {allStaff.map(staff => ( <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem> ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {/* Reception Notes Textarea */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="notes-modal" className="text-right">Notes</Label>
                        <Textarea
                            id="notes-modal" placeholder="Optional notes for housekeeping..."
                            value={newTask.notes}
                            onChange={(e) => setNewTask(prev => ({ ...prev, notes: e.target.value }))}
                            className="col-span-3 min-h-[60px]"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                    <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !newTask.roomId}>
                        {isSubmitting ? "Adding..." : "Add Task"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
