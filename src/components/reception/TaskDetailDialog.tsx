// src/components/reception/TaskDetailDialog.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Added PlayCircle and Square icons
import { CalendarDays, Clock, User, DoorOpen, BedDouble, StickyNote, AlertTriangle, Image as ImageIcon, Edit2, X, Timer, PlayCircle, Square } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { Room, Staff } from '@/hooks/useReceptionData';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type CleaningType = Database["public"]["Enums"]["cleaning_type"];
type RoomGroup = Database["public"]["Enums"]["room_group"];

// Cleaning type labels
const cleaningTypeLabels: Record<CleaningType, string> = {
  W: "Wyjazd",
  P: "Przyjazd",
  T: "Trakt",
  O: "Odświeżenie",
  G: "Generalne",
  S: "Standard"
};

// Available cleaning types based on room group
const getAvailableCleaningTypes = (roomGroup: RoomGroup | null): CleaningType[] => {
  if (!roomGroup) return ['W', 'P', 'T', 'O', 'G', 'S'];

  if (roomGroup === 'OTHER') {
    return ['S', 'G'];
  }

  return ['W', 'P', 'T', 'O', 'G'];
};

// Guest count options based on room group type (same as AddTaskDialog)
type GuestOption = {
  value: number;
  label: string;
  display: React.ReactNode;
};

const getGuestCountOptions = (roomGroup: RoomGroup | null): GuestOption[] => {
  if (!roomGroup) return [];

  const renderIcons = (config: string): React.ReactNode => {
    // Parse configurations like "1", "2", "1+1", "2+2", "2+2+2"
    const parts = config.split('+').map(p => parseInt(p.trim()));
    
    return (
      <div className="flex items-center gap-1">
        {parts.map((count, partIndex) => {
          const icons = [];
          for (let i = 0; i < count; i++) {
            icons.push(<User key={`${partIndex}-${i}`} className="h-4 w-4 text-muted-foreground" />);
          }
          return (
            <div key={partIndex} className="flex items-center gap-0.5">
              {icons}
              {partIndex < parts.length - 1 && <span className="mx-0.5 text-muted-foreground">+</span>}
            </div>
          );
        })}
      </div>
    );
  };

  switch (roomGroup) {
    case 'P1':
      return [{ value: 1, label: '1', display: renderIcons('1') }];
    
    case 'P2':
      return [
        { value: 1, label: '1', display: renderIcons('1') },
        { value: 2, label: '2', display: renderIcons('2') },
        { value: 2, label: '1+1', display: renderIcons('1+1') },
      ];
    
    case 'A1S':
      return [
        { value: 1, label: '1', display: renderIcons('1') },
        { value: 2, label: '2', display: renderIcons('2') },
        { value: 2, label: '1+1', display: renderIcons('1+1') },
        { value: 3, label: '2+1', display: renderIcons('2+1') },
        { value: 4, label: '2+2', display: renderIcons('2+2') },
      ];
    
    case 'A2S':
      return [
        { value: 1, label: '1', display: renderIcons('1') },
        { value: 2, label: '2', display: renderIcons('2') },
        { value: 2, label: '1+1', display: renderIcons('1+1') },
        { value: 3, label: '2+1', display: renderIcons('2+1') },
        { value: 4, label: '2+2', display: renderIcons('2+2') },
        { value: 3, label: '1+1+1', display: renderIcons('1+1+1') },
        { value: 5, label: '2+2+1', display: renderIcons('2+2+1') },
        { value: 6, label: '2+2+2', display: renderIcons('2+2+2') },
      ];
    
    case 'OTHER':
      // Default options for other locations
      return Array.from({ length: 10 }, (_, i) => ({
        value: i + 1,
        label: String(i + 1),
        display: renderIcons(String(i + 1)),
      }));
    
    default:
      return [];
  }
};

// Interface needs start_time and stop_time for display
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
  start_time: string | null; // Keep for display
  stop_time: string | null; // Keep for display
  // These can remain if needed for other logic, but won't be displayed directly
  pause_start: string | null;
  pause_stop: string | null;
  total_pause: number | null;
  created_at?: string;
}

interface EditableTaskState {
    roomId: string;
    cleaningType: CleaningType;
    guestCount: number;
    staffId: string | 'unassigned';
    notes: string;
    date: string;
    timeLimit: number | null;
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
    const [availableCleaningTypes, setAvailableCleaningTypes] = useState<CleaningType[]>([]);
    const [isEditMode, setIsEditMode] = useState(false);

    useEffect(() => {
        // ... (keep existing useEffect logic) ...
        if (isOpen && task) {
            const roomGroup = availableRooms.find(r => r.id === task.room.id)?.group_type || null;
            setAvailableCleaningTypes(getAvailableCleaningTypes(roomGroup));

            setEditableState({
                roomId: task.room.id,
                cleaningType: task.cleaning_type,
                guestCount: task.guest_count,
                staffId: task.user?.id || 'unassigned',
                notes: task.reception_notes || '',
                date: task.date,
                timeLimit: task.time_limit,
            });
            setIsEditMode(false);
        } else if (!isOpen) {
            setEditableState(null);
            setAvailableCleaningTypes([]);
            setIsEditMode(false);
        }
    }, [task, isOpen, availableRooms]);

    const handleFieldChange = <K extends keyof EditableTaskState>(field: K, value: EditableTaskState[K]) => {
         // ... (keep existing field change logic) ...
        setEditableState(prev => prev ? { ...prev, [field]: value } : null);

        if (field === 'roomId' && typeof value === 'string') {
            const roomGroup = availableRooms.find(r => r.id === value)?.group_type || null;
            const newAvailableTypes = getAvailableCleaningTypes(roomGroup);
            setAvailableCleaningTypes(newAvailableTypes);

            if (editableState && !newAvailableTypes.includes(editableState.cleaningType)) {
                setEditableState(p => p ? { ...p, cleaningType: newAvailableTypes[0] || 'W' } : null);
            }
        }
    };

    const handleEditClick = () => {
        setIsEditMode(true);
    };

    const handleCancelEdit = () => {
        // ... (keep existing cancel logic) ...
        if (!task) return;

        const roomGroup = availableRooms.find(r => r.id === task.room.id)?.group_type || null;
        setAvailableCleaningTypes(getAvailableCleaningTypes(roomGroup));

        setEditableState({
            roomId: task.room.id,
            cleaningType: task.cleaning_type,
            guestCount: task.guest_count,
            staffId: task.user?.id || 'unassigned',
            notes: task.reception_notes || '',
            date: task.date,
            timeLimit: task.time_limit,
        });
        setIsEditMode(false);
    };

    const handleSave = async () => {
        // ... (keep existing save logic) ...
        if (!task || !editableState) return;

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
         if (editableState.timeLimit !== null && editableState.timeLimit < 0) {
              toast({ title: "Validation Error", description: "Time limit cannot be negative.", variant: "destructive" });
              return;
         }

        const updates: Partial<EditableTaskState> = {};
        let changed = false;

        if (editableState.roomId !== task.room.id) { updates.roomId = editableState.roomId; changed = true; }
        if (editableState.cleaningType !== task.cleaning_type) { updates.cleaningType = editableState.cleaningType; changed = true; }
        if (editableState.guestCount !== task.guest_count) { updates.guestCount = editableState.guestCount; changed = true; }
        if (editableState.staffId !== (task.user?.id || 'unassigned')) { updates.staffId = editableState.staffId; changed = true; }
        if (editableState.notes !== (task.reception_notes || '')) { updates.notes = editableState.notes; changed = true; }
        if (editableState.date !== task.date) { updates.date = editableState.date; changed = true; }
        if (editableState.timeLimit !== task.time_limit) { updates.timeLimit = editableState.timeLimit; changed = true; }

        if (!changed) {
            toast({ title: "No Changes", description: "No details were modified." });
            setIsEditMode(false);
            return;
        }

        const success = await onUpdate(task.id, updates);
        if (success) {
            setIsEditMode(false);
        }
    };

    // Format HH:MM from ISO string or return '-'
    const formatDisplayTime = (isoString: string | null): string => {
        if (!isoString) return '-';
        try {
            // Use local time for display purposes
            return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch { return 'Invalid'; }
    };


    const formatDisplayDate = (dateString: string | null) => {
        // ... (keep existing formatDisplayDate) ...
        if (!dateString) return "N/A";
        try {
            return new Date(dateString + 'T00:00:00Z').toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
            });
        } catch { return dateString; }
    };


    if (!task || !editableState) return null;

    const getStatusLabel = (status: string) => {
         // ... (keep existing getStatusLabel) ...
        const labels: Record<string, string> = {
            todo: "To Clean",
            in_progress: "In Progress",
            paused: "Paused",
            done: "Done",
            repair_needed: "Repair"
        };
        return labels[status] || status;
    };

    const getStatusColor = (status: string) => {
        // ... (keep existing getStatusColor) ...
        const colors: Record<string, string> = {
            todo: "bg-status-todo text-white",
            in_progress: "bg-status-in-progress text-white",
            paused: "bg-status-paused text-white",
            done: "bg-status-done text-white",
            repair_needed: "bg-status-repair text-white"
        };
        return colors[status] || "bg-muted";
    };

    const todayDateString = new Date().toISOString().split("T")[0];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    {/* ... (keep existing header) ... */}
                     <div className="flex justify-between items-start">
                         <div>
                             <DialogTitle className="text-2xl">
                                 {isEditMode ? 'Edit' : 'View'} Task - {task.room.name}
                             </DialogTitle>
                             <DialogDescription>
                                 {isEditMode ? 'Modify task information below.' : 'Task details and information.'} Current status: <Badge className={cn(getStatusColor(task.status), "ml-1")}>{getStatusLabel(task.status)}</Badge>
                             </DialogDescription>
                         </div>
                         {task.issue_flag && <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Issue Reported</Badge>}
                     </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 overflow-y-auto px-1 flex-grow">
                    {/* Column 1: Core Task Info */}
                    <div className="space-y-4">
                        {/* ... (Date, Room, Type, Guests, Staff, Reception Notes - keep existing structure) ... */}
                        <div className="space-y-1">
                            <Label htmlFor="detail-date" className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-4 w-4"/>Date*</Label>
                            {isEditMode ? (<Input id="detail-date" type="date" value={editableState.date} onChange={(e) => handleFieldChange('date', e.target.value)} min={todayDateString} required disabled={isUpdating}/>)
                            : (<p className="text-sm border p-2 rounded bg-muted/30">{formatDisplayDate(task.date)}</p>)}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="detail-room" className="flex items-center gap-1 text-muted-foreground"><DoorOpen className="h-4 w-4"/>Room*</Label>
                            {isEditMode ? (<Select value={editableState.roomId} onValueChange={(value) => handleFieldChange('roomId', value)} disabled={isUpdating}><SelectTrigger id="detail-room"><SelectValue placeholder="Select a room" /></SelectTrigger><SelectContent>{availableRooms.map(room => (<SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>))}</SelectContent></Select>)
                            : (<p className="text-sm border p-2 rounded bg-muted/30">{task.room.name}</p>)}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="detail-cleaningType" className="flex items-center gap-1 text-muted-foreground"><BedDouble className="h-4 w-4"/>Type*</Label>
                            {isEditMode ? (<Select value={editableState.cleaningType} onValueChange={(value: CleaningType) => handleFieldChange('cleaningType', value)} disabled={isUpdating}><SelectTrigger id="detail-cleaningType"><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{availableCleaningTypes.map(type => (<SelectItem key={type} value={type}>{cleaningTypeLabels[type]}</SelectItem>))}</SelectContent></Select>)
                            : (<p className="text-sm border p-2 rounded bg-muted/30">{cleaningTypeLabels[task.cleaning_type]}</p>)}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="detail-guestCount" className="flex items-center gap-1 text-muted-foreground"><User className="h-4 w-4"/>Guests*</Label>
                            {isEditMode ? (
                                <Select
                                    value={(() => {
                                        const roomGroup = availableRooms.find(r => r.id === editableState.roomId)?.group_type || null;
                                        const options = getGuestCountOptions(roomGroup);
                                        const matchingOption = options.find(opt => opt.value === editableState.guestCount);
                                        return matchingOption ? `${matchingOption.value}-${matchingOption.label}` : String(editableState.guestCount);
                                    })()}
                                    onValueChange={(value) => {
                                        // Extract numeric value from composite "value-label" format
                                        const numericValue = parseInt(value.split('-')[0], 10);
                                        handleFieldChange('guestCount', numericValue);
                                    }}
                                    disabled={isUpdating}
                                >
                                    <SelectTrigger id="detail-guestCount">
                                        <SelectValue placeholder="Select guest count" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(() => {
                                            const roomGroup = availableRooms.find(r => r.id === editableState.roomId)?.group_type || null;
                                            const options = getGuestCountOptions(roomGroup);
                                            // Use composite value: value-label to handle duplicates
                                            return options.map((option, index) => {
                                                const uniqueValue = `${option.value}-${option.label}`;
                                                return (
                                                    <SelectItem key={`${option.value}-${option.label}-${index}`} value={uniqueValue}>
                                                        {option.display}
                                                    </SelectItem>
                                                );
                                            });
                                        })()}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-sm border p-2 rounded bg-muted/30">{task.guest_count}</p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="detail-assignStaff" className="flex items-center gap-1 text-muted-foreground"><User className="h-4 w-4"/>Assigned Staff</Label>
                            {isEditMode ? (<Select value={editableState.staffId} onValueChange={(value) => handleFieldChange('staffId', value)} disabled={isUpdating}><SelectTrigger id="detail-assignStaff"><SelectValue placeholder="Select staff..." /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{allStaff.map(staff => (<SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>))}</SelectContent></Select>)
                            : (<p className="text-sm border p-2 rounded bg-muted/30">{task.user?.name || 'Unassigned'}</p>)}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="detail-notes" className="flex items-center gap-1 text-muted-foreground"><StickyNote className="h-4 w-4"/>Reception Notes</Label>
                            {isEditMode ? (<><Textarea id="detail-notes" placeholder="Optional notes..." value={editableState.notes} onChange={(e) => handleFieldChange('notes', e.target.value)} className="min-h-[80px]" maxLength={2000} disabled={isUpdating}/><p className="text-xs text-muted-foreground text-right">{editableState.notes.length} / 2000</p></>)
                            : (<p className="text-sm border p-2 rounded bg-muted/30 min-h-[40px]">{task.reception_notes || <span className="text-muted-foreground italic">No notes</span>}</p>)}
                        </div>
                    </div>

                    {/* Column 2: Time & Issue Info */}
                    <div className="space-y-4">
                        {/* Time Limit */}
                        <div className="space-y-1">
                            <Label htmlFor="detail-timeLimit" className="flex items-center gap-1 text-muted-foreground"><Clock className="h-4 w-4"/>Time Limit (min)</Label>
                            {isEditMode ? (<Input id="detail-timeLimit" type="number" min="0" value={editableState.timeLimit ?? ''} onChange={(e) => handleFieldChange('timeLimit', e.target.value ? parseInt(e.target.value, 10) : null)} placeholder="None" disabled={isUpdating}/>)
                            : (<p className="text-sm border p-2 rounded bg-muted/30">{task.time_limit ?? 'None'}</p>)}
                        </div>

                         {/* ** MODIFICATION START: Simplified Time Display Card ** */}
                         {(task.start_time || task.actual_time !== null) && ( // Show if started or completed
                            <Card className="bg-muted/30">
                                <CardHeader className="p-3">
                                    <CardTitle className="text-base flex items-center gap-1"><Timer className="h-4 w-4"/>Timing</CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 pt-0 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    {/* Start Time */}
                                    <div className="flex items-center gap-1">
                                         <PlayCircle className="h-3 w-3 text-muted-foreground"/>
                                         <span className="text-muted-foreground">Start:</span> {formatDisplayTime(task.start_time)}
                                    </div>
                                    {/* Stop Time */}
                                    <div className="flex items-center gap-1">
                                        <Square className="h-3 w-3 text-muted-foreground"/>
                                        <span className="text-muted-foreground">Stop:</span> {formatDisplayTime(task.stop_time)}
                                    </div>
                                    {/* Actual Time */}
                                     {task.actual_time !== null && (
                                         <div className="col-span-1 mt-1">
                                             <span className="text-muted-foreground">Actual:</span> {task.actual_time} min
                                         </div>
                                     )}
                                     {/* Difference */}
                                     {task.difference !== null && (
                                         <div className={cn("col-span-1 mt-1 font-medium", task.difference > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400")}>
                                             <span className="text-muted-foreground font-normal">Diff:</span> {task.difference > 0 ? '+' : ''}{task.difference} min
                                         </div>
                                     )}
                                </CardContent>
                            </Card>
                        )}
                        {/* ** MODIFICATION END ** */}

                        {/* Housekeeping Note */}
                        {task.housekeeping_notes && (
                            <div className="space-y-1">
                                <Label className="flex items-center gap-1 text-muted-foreground"><StickyNote className="h-4 w-4"/>Housekeeping Note</Label>
                                <p className="text-sm border p-2 rounded bg-muted/30 min-h-[40px]">{task.housekeeping_notes}</p>
                            </div>
                        )}

                        {/* Issue Details */}
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
                                </CardContent>
                            </Card>
                        )}
                        {/* Add a placeholder if no issue and in view mode */}
                        {!task.issue_flag && !isEditMode && (
                           <div className="space-y-1">
                               <Label className="flex items-center gap-1 text-muted-foreground"><AlertTriangle className="h-4 w-4"/>Issue</Label>
                               <p className="text-sm border p-2 rounded bg-muted/30 italic text-muted-foreground/70">No issue reported for this task.</p>
                           </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    {/* ... (keep existing footer logic) ... */}
                    {isEditMode ? (
                        <>
                            <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isUpdating}>
                                <X className="mr-2 h-4 w-4" /> Cancel
                            </Button>
                            <Button type="button" onClick={handleSave} disabled={isUpdating}>
                                {isUpdating ? "Saving..." : "Save Changes"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <DialogClose asChild>
                                <Button type="button" variant="outline">Close</Button>
                            </DialogClose>
                            {task.status !== 'done' && ( // Only allow editing if not done
                                <Button type="button" onClick={handleEditClick}>
                                    <Edit2 className="mr-2 h-4 w-4" /> Edit
                                </Button>
                            )}
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
