// src/components/reception/TaskDetailDialog.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, User, DoorOpen, BedDouble, StickyNote, AlertTriangle, Image as ImageIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { Room, Staff } from '@/hooks/useReceptionData'; // Reuse types
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatTimeForInput } from '@/lib/utils'; // Import helper

// Define Cleaning Types Array (if not imported)
type CleaningType = Database["public"]["Enums"]["cleaning_type"];
const cleaningTypes: CleaningType[] = ["W", "P", "T", "O", "G", "S"];

// Interface for the task prop
interface Task {
  id: string;
  date: string;
  status: string;
  room: { id: string; name: string; group_type: string; color: string | null };
  user: { id: string; name: string } | null;
  cleaning_type: CleaningType;
  guest_count: number;
  time_limit: number | null;
  actual_time: number | null;
  difference: number | null;
  issue_flag: boolean;
  issue_description: string | null;
  issue_photo: string | null;
  housekeeping_notes: string | null;
  reception_notes: string | null;
  start_time: string | null;
  pause_start: string | null;
  pause_stop: string | null;
  total_pause: number | null;
  stop_time: string | null;
  created_at?: string;
}

// Interface for editable fields
interface EditableTaskState {
    roomId: string;
    cleaningType: CleaningType;
    guestCount: number;
    staffId: string | 'unassigned';
    notes: string;
    date: string;
    timeLimit: number | null;
    // Potentially add issue fields if editing here is desired
    // issueDescription: string | null;
}

interface TaskDetailDialogProps {
  task: Task | null;
  allStaff: Staff[];
  availableRooms: Room[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (taskId: string, updates: Partial<EditableTaskState>) => Promise<boolean>;
  isUpdating: boolean;
}

export function TaskDetailDialog({
    task,
    allStaff,
    availableRooms,
    isOpen,
    onOpenChange,
    onUpdate,
    isUpdating
}: TaskDetailDialogProps) {
    const { toast } = useToast();
    const [editableState, setEditableState] = useState<EditableTaskState | null>(null);

    // Populate editable state when task or isOpen changes
    useEffect(() => {
        if (isOpen && task) {
            setEditableState({
                roomId: task.room.id,
                cleaningType: task.cleaning_type,
                guestCount: task.guest_count,
                staffId: task.user?.id || 'unassigned',
                notes: task.reception_notes || '',
                date: task.date,
                timeLimit: task.time_limit,
                // issueDescription: task.issue_description, // If editing issues here
            });
        } else if (!isOpen) {
            setEditableState(null); // Reset on close
        }
    }, [task, isOpen]);

    const handleFieldChange = <K extends keyof EditableTaskState>(field: K, value: EditableTaskState[K]) => {
        setEditableState(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleSave = async () => {
        if (!task || !editableState) return;

        // Basic Validation (consider using Zod for more complex cases)
        if (!editableState.roomId) {
            toast({ title: "Validation Error", description: "Room cannot be empty.", variant: "destructive" });
            return;
        }
        if (editableState.guestCount < 1) {
            toast({ title: "Validation Error", description: "Guest count must be at least 1.", variant: "destructive" });
            return;
        }
         if (editableState.notes && editableState.notes.length > 2000) {
            toast({ title: "Validation Error", description: "Notes cannot exceed 2000 characters.", variant: "destructive" });
            return;
         }

        const updates: Partial<EditableTaskState> = {};
        let changed = false;

        // Compare only editable fields
        if (editableState.roomId !== task.room.id) { updates.roomId = editableState.roomId; changed = true; }
        if (editableState.cleaningType !== task.cleaning_type) { updates.cleaningType = editableState.cleaningType; changed = true; }
        if (editableState.guestCount !== task.guest_count) { updates.guestCount = editableState.guestCount; changed = true; }
        if (editableState.staffId !== (task.user?.id || 'unassigned')) { updates.staffId = editableState.staffId; changed = true; }
        if (editableState.notes !== (task.reception_notes || '')) { updates.notes = editableState.notes; changed = true; }
        if (editableState.date !== task.date) { updates.date = editableState.date; changed = true; }
        if (editableState.timeLimit !== task.time_limit) { updates.timeLimit = editableState.timeLimit; changed = true; }
        // Add comparisons for other editable fields if needed

        if (!changed) {
            toast({ title: "No Changes", description: "No details were modified." });
            onOpenChange(false); // Close if no changes
            return;
        }

        const success = await onUpdate(task.id, updates);
        if (success) {
            onOpenChange(false); // Close dialog on successful update
        }
        // Keep dialog open on failure
    };

     const formatDisplayTime = (isoString: string | null): string => {
        if (!isoString) return '-';
        try {
            return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch { return 'Invalid Date'; }
     };

     const formatDisplayDate = (dateString: string | null) => {
        if (!dateString) return "N/A";
        try {
            return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
            });
        } catch { return dateString; }
     };

    if (!task || !editableState) return null; // Don't render if no task or state not ready

    const getStatusLabel = (status: string) => {
      const labels: Record<string, string> = { todo: "To Clean", in_progress: "In Progress", paused: "Paused", done: "Done", repair_needed: "Repair" };
      return labels[status] || status;
    };
    const getStatusColor = (status: string) => {
      const colors: Record<string, string> = { todo: "bg-status-todo text-white", in_progress: "bg-status-in-progress text-white", paused: "bg-status-paused text-white", done: "bg-status-done text-white", repair_needed: "bg-status-repair text-white"};
      return colors[status] || "bg-muted";
    };

    const todayDateString = new Date().toISOString().split("T")[0]; // For min date

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                         <div>
                             <DialogTitle className="text-2xl">Task Details - {task.room.name}</DialogTitle>
                             <DialogDescription>
                                 View and edit task information. Current status: <Badge className={cn(getStatusColor(task.status), "ml-1")}>{getStatusLabel(task.status)}</Badge>
                             </DialogDescription>
                         </div>
                         {task.issue_flag && <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Issue Reported</Badge>}
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 overflow-y-auto px-1 flex-grow">
                    {/* Column 1: Core Task Info */}
                    <div className="space-y-4">
                        {/* Date */}
                        <div className="space-y-1">
                            <Label htmlFor="detail-date" className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-4 w-4"/>Date*</Label>
                            <Input
                                id="detail-date"
                                type="date"
                                value={editableState.date}
                                onChange={(e) => handleFieldChange('date', e.target.value)}
                                min={todayDateString} // Prevent past dates
                                required
                                disabled={isUpdating}
                            />
                        </div>
                        {/* Room */}
                        <div className="space-y-1">
                            <Label htmlFor="detail-room" className="flex items-center gap-1 text-muted-foreground"><DoorOpen className="h-4 w-4"/>Room*</Label>
                             <Select value={editableState.roomId} onValueChange={(value) => handleFieldChange('roomId', value)} disabled={isUpdating}>
                                <SelectTrigger id="detail-room"> <SelectValue placeholder="Select a room" /> </SelectTrigger>
                                <SelectContent>{availableRooms.map(room => ( <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem> ))}</SelectContent>
                            </Select>
                        </div>
                        {/* Cleaning Type */}
                        <div className="space-y-1">
                            <Label htmlFor="detail-cleaningType" className="flex items-center gap-1 text-muted-foreground"><BedDouble className="h-4 w-4"/>Type*</Label>
                            <Select value={editableState.cleaningType} onValueChange={(value: CleaningType) => handleFieldChange('cleaningType', value)} disabled={isUpdating}>
                                <SelectTrigger id="detail-cleaningType"> <SelectValue placeholder="Select type" /> </SelectTrigger>
                                <SelectContent>{cleaningTypes.map(type => ( <SelectItem key={type} value={type}>{type}</SelectItem> ))}</SelectContent>
                            </Select>
                        </div>
                        {/* Guest Count */}
                        <div className="space-y-1">
                            <Label htmlFor="detail-guestCount" className="flex items-center gap-1 text-muted-foreground"><User className="h-4 w-4"/>Guests*</Label>
                            <Input id="detail-guestCount" type="number" min="1" max="10" value={editableState.guestCount} onChange={(e) => handleFieldChange('guestCount', parseInt(e.target.value, 10) || 1)} required disabled={isUpdating}/>
                        </div>
                         {/* Staff */}
                        <div className="space-y-1">
                            <Label htmlFor="detail-assignStaff" className="flex items-center gap-1 text-muted-foreground"><User className="h-4 w-4"/>Assigned Staff</Label>
                            <Select value={editableState.staffId} onValueChange={(value) => handleFieldChange('staffId', value)} disabled={isUpdating}>
                                <SelectTrigger id="detail-assignStaff"> <SelectValue placeholder="Select staff..." /> </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {allStaff.map(staff => ( <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem> ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {/* Reception Notes */}
                        <div className="space-y-1">
                            <Label htmlFor="detail-notes" className="flex items-center gap-1 text-muted-foreground"><StickyNote className="h-4 w-4"/>Reception Notes</Label>
                            <Textarea id="detail-notes" placeholder="Optional notes for housekeeping..." value={editableState.notes} onChange={(e) => handleFieldChange('notes', e.target.value)} className="min-h-[80px]" maxLength={2000} disabled={isUpdating}/>
                            <p className="text-xs text-muted-foreground text-right">{editableState.notes.length} / 2000</p>
                        </div>
                    </div>

                    {/* Column 2: Time & Issue Info */}
                    <div className="space-y-4">
                         {/* Time Limit */}
                        <div className="space-y-1">
                             <Label htmlFor="detail-timeLimit" className="flex items-center gap-1 text-muted-foreground"><Clock className="h-4 w-4"/>Time Limit (min)</Label>
                             <Input id="detail-timeLimit" type="number" min="0" value={editableState.timeLimit ?? ''} onChange={(e) => handleFieldChange('timeLimit', e.target.value ? parseInt(e.target.value, 10) : null)} placeholder="Optional" disabled={isUpdating}/>
                        </div>
                        {/* Timing Readonly Info */}
                        <Card className="bg-muted/30">
                            <CardHeader className="p-3">
                                <CardTitle className="text-base flex items-center gap-1"><Clock className="h-4 w-4"/>Timing</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div><span className="text-muted-foreground">Start:</span> {formatDisplayTime(task.start_time)}</div>
                                <div><span className="text-muted-foreground">Stop:</span> {formatDisplayTime(task.stop_time)}</div>
                                <div><span className="text-muted-foreground">Pause Start:</span> {formatDisplayTime(task.pause_start)}</div>
                                <div><span className="text-muted-foreground">Pause Stop:</span> {formatDisplayTime(task.pause_stop)}</div>
                                <div className="col-span-1"><span className="text-muted-foreground">Total Pause:</span> {task.total_pause ?? 0} min</div>
                                <div className="col-span-1"><span className="text-muted-foreground">Actual Time:</span> {task.actual_time ?? '-'} min</div>
                                {task.difference !== null && (
                                     <div className={cn("col-span-2 font-medium", task.difference > 0 ? "text-red-600" : "text-green-600")}>
                                        <span className="text-muted-foreground font-normal">Difference:</span> {task.difference > 0 ? '+' : ''}{task.difference} min
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Housekeeping Notes Readonly */}
                        {task.housekeeping_notes && (
                            <div className="space-y-1">
                                <Label className="flex items-center gap-1 text-muted-foreground"><StickyNote className="h-4 w-4"/>Housekeeping Note</Label>
                                <p className="text-sm border p-2 rounded bg-muted/30 min-h-[40px]">{task.housekeeping_notes}</p>
                            </div>
                        )}

                        {/* Issue Readonly Info */}
                        {task.issue_flag && (
                            <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
                                <CardHeader className="p-3">
                                    <CardTitle className="text-base flex items-center gap-1 text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4"/>Issue Details</CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 pt-0 space-y-2">
                                    {task.issue_description && <p className="text-sm">{task.issue_description}</p>}
                                    {task.issue_photo && (
                                        <a href={task.issue_photo} target="_blank" rel="noopener noreferrer" className="block w-fit">
                                            <img src={task.issue_photo} alt="Issue evidence" className="max-h-24 w-auto object-contain rounded border hover:opacity-80 transition-opacity" />
                                            <span className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"><ImageIcon className="h-3 w-3" /> View Photo</span>
                                        </a>
                                    )}
                                    {/* Link/Button to go to Issues page for editing issue could be added here */}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isUpdating}>Cancel</Button></DialogClose>
                    <Button type="button" onClick={handleSave} disabled={isUpdating}>
                        {isUpdating ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
