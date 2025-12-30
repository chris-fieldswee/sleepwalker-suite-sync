// src/components/reception/TaskDetailDialog.tsx
import React, { useState, useEffect, useMemo } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { renderCapacityIconPattern, LABEL_TO_CAPACITY_ID, CAPACITY_ID_TO_LABEL, normalizeCapacityLabel } from "@/lib/capacity-utils";

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

const roomGroupLabels: Record<RoomGroup, string> = {
    P1: "Pokoje P1",
    P2: "Pokoje P2",
    A1S: "Apartamenty A1S",
    A2S: "Apartamenty A2S",
    OTHER: "Inne Przestrzenie"
};

// Helper function to parse capacity_configurations from a room
const parseCapacityConfigurations = (room: Room | null): Array<{
    capacity_id: string;
    capacity_label: string;
    cleaning_types: Array<{ type: CleaningType; time_limit: number }>;
}> => {
    if (!room || !room.capacity_configurations) return [];

    try {
        let configs: any[] = [];
        if (typeof room.capacity_configurations === 'string') {
            configs = JSON.parse(room.capacity_configurations);
        } else if (Array.isArray(room.capacity_configurations)) {
            configs = room.capacity_configurations;
        }

        return configs.map((config: any) => {
            // Prefer capacity_id, fallback to deriving from capacity_label
            let capacityId = config.capacity_id;
            const capacityLabel = config.capacity_label || '';
            
            if (!capacityId && capacityLabel) {
                capacityId = LABEL_TO_CAPACITY_ID[normalizeCapacityLabel(capacityLabel)] || '';
            }
            
            return {
                capacity_id: capacityId || 'd', // Default fallback
                capacity_label: capacityLabel,
                cleaning_types: Array.isArray(config.cleaning_types)
                    ? config.cleaning_types.map((ct: any) => ({
                        type: ct.type as CleaningType,
                        time_limit: Number(ct.time_limit) || 30
                    }))
                    : []
            };
        });
    } catch (e) {
        console.error("Error parsing capacity_configurations:", e);
        return [];
    }
};


// Guest count options based on room's capacity_configurations
// Now uses capacity_id (string) instead of numeric value
type GuestOption = {
    value: string; // Now capacity_id
    label: string;
    display: React.ReactNode;
};

const getGuestCountOptionsFromRoom = (room: Room | null): GuestOption[] => {
    if (!room) return [];

    const configs = parseCapacityConfigurations(room);

    // If room has capacity_configurations, use them
    if (configs.length > 0) {
        return configs.map(config => ({
            value: config.capacity_id,
            label: config.capacity_label,
            display: renderCapacityIconPattern(config.capacity_label)
        }));
    }

    // Fallback to legacy behavior based on group_type for rooms without configurations
    const roomGroup = room.group_type;

    switch (roomGroup) {
        case 'P1':
            return [{ value: 'a', label: '1', display: renderCapacityIconPattern('1') }];

        case 'P2':
            return [
                { value: 'a', label: '1', display: renderCapacityIconPattern('1') },
                { value: 'd', label: '2', display: renderCapacityIconPattern('2') },
                { value: 'b', label: '1+1', display: renderCapacityIconPattern('1+1') },
            ];

        case 'A1S':
            return [
                { value: 'a', label: '1', display: renderCapacityIconPattern('1') },
                { value: 'd', label: '2', display: renderCapacityIconPattern('2') },
                { value: 'b', label: '1+1', display: renderCapacityIconPattern('1+1') },
                { value: 'e', label: '2+1', display: renderCapacityIconPattern('2+1') },
                { value: 'f', label: '2+2', display: renderCapacityIconPattern('2+2') },
            ];

        case 'A2S':
            return [
                { value: 'a', label: '1', display: renderCapacityIconPattern('1') },
                { value: 'd', label: '2', display: renderCapacityIconPattern('2') },
                { value: 'b', label: '1+1', display: renderCapacityIconPattern('1+1') },
                { value: 'e', label: '2+1', display: renderCapacityIconPattern('2+1') },
                { value: 'f', label: '2+2', display: renderCapacityIconPattern('2+2') },
                { value: 'c', label: '1+1+1', display: renderCapacityIconPattern('1+1+1') },
                { value: 'g', label: '2+2+1', display: renderCapacityIconPattern('2+2+1') },
                { value: 'h', label: '2+2+2', display: renderCapacityIconPattern('2+2+2') },
            ];

        case 'OTHER':
            return Array.from({ length: 10 }, (_, i) => {
                const label = String(i + 1);
                const capacityId = LABEL_TO_CAPACITY_ID[label] || label;
                return {
                    value: capacityId,
                    label: label,
                    display: renderCapacityIconPattern(label),
                };
            });

        default:
            return [];
    }
};

// Get available cleaning types from room's capacity_configurations
const getAvailableCleaningTypesFromRoom = (room: Room | null): CleaningType[] => {
    if (!room) return [];

    const configs = parseCapacityConfigurations(room);

    // If room has capacity_configurations, extract unique cleaning types
    if (configs.length > 0) {
        const cleaningTypesSet = new Set<CleaningType>();
        configs.forEach(config => {
            config.cleaning_types.forEach(ct => {
                cleaningTypesSet.add(ct.type);
            });
        });
        return Array.from(cleaningTypesSet).sort();
    }

    // Fallback to group-based logic for rooms without configurations
    const roomGroup = room.group_type;
    if (roomGroup === 'OTHER') {
        return ['S', 'G'];
    }
    return ['W', 'P', 'T', 'O', 'G'];
};

// Get time limit from room's capacity_configurations
const getTimeLimitFromRoom = (room: Room | null, capacityId: string, cleaningType: CleaningType): number | null => {
    if (!room) return null;

    const configs = parseCapacityConfigurations(room);

    // Find the configuration matching the capacity_id
    const config = configs.find(c => c.capacity_id === capacityId);
    if (!config) return null;

    // Find the cleaning type in that configuration
    const cleaningTypeConfig = config.cleaning_types.find(ct => ct.type === cleaningType);
    if (!cleaningTypeConfig) return null;

    return cleaningTypeConfig.time_limit;
};

// Interface needs start_time and stop_time for display
interface Task {
    id: string;
    date: string;
    status: string;
    room: { id: string; name: string; group_type: string; color: string | null };
    user: { id: string; name: string } | null;
    cleaning_type: CleaningType;
    guest_count: string; // Now stores capacity_id (a, b, c, d, etc.) instead of numeric value
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
    capacityId: string; // Changed from guestCount: number to capacityId: string
    staffId: string | 'unassigned';
    notes: string;
    date: string;
    timeLimit: number | null;
    status: string;
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
    const { userRole } = useAuth();
    const [editableState, setEditableState] = useState<EditableTaskState | null>(null);
    const [selectedGroup, setSelectedGroup] = useState<RoomGroup | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [availableStaffOptions, setAvailableStaffOptions] = useState<Staff[]>([]);
    const housekeepingStaff = useMemo(
        () => allStaff.filter(staff => staff.role === 'housekeeping'),
        [allStaff]
    );

    const availableRoomGroups = useMemo<RoomGroup[]>(() => {
        const groups = new Set<RoomGroup>();
        availableRooms.forEach(room => groups.add(room.group_type as RoomGroup));
        return Array.from(groups).sort();
    }, [availableRooms]);

    const selectedRoom = useMemo(() => {
        if (!editableState?.roomId) return null;
        return availableRooms.find(room => room.id === editableState.roomId) || null;
    }, [editableState?.roomId, availableRooms]);

    const filteredRooms = useMemo(() => {
        if (!selectedGroup) return availableRooms;
        return availableRooms.filter(room => room.group_type === selectedGroup);
    }, [availableRooms, selectedGroup]);

    const availableCleaningTypes = useMemo(() => {
        if (selectedRoom) {
            return getAvailableCleaningTypesFromRoom(selectedRoom);
        }
        if (!selectedGroup) return [];
        if (selectedGroup === 'OTHER') {
            return ['S', 'G'];
        }
        return ['W', 'P', 'T', 'O', 'G'];
    }, [selectedRoom, selectedGroup]);

    useEffect(() => {
        if (isOpen && task) {
            const selectedRoom = availableRooms.find(r => r.id === task.room.id) || null;
            setEditableState({
                roomId: task.room.id,
                cleaningType: task.cleaning_type,
                capacityId: task.guest_count, // guest_count now stores capacity_id
                staffId: task.user?.id || 'unassigned',
                notes: task.reception_notes || '',
                date: task.date,
                timeLimit: task.time_limit,
                status: task.status,
            });
            setSelectedGroup((selectedRoom?.group_type ?? task.room.group_type) as RoomGroup);
            setIsEditMode(false);
        } else if (!isOpen) {
            setEditableState(null);
            setSelectedGroup(null);
            setIsEditMode(false);
        }
    }, [task, isOpen, availableRooms]);

    useEffect(() => {
        if (!isOpen) return;

        const fetchAvailableStaffForTask = async () => {
            const baseStaff = housekeepingStaff;

            if (!editableState?.date) {
                setAvailableStaffOptions(baseStaff);
                return;
            }

            const requiredMinutes = editableState.timeLimit ?? task?.time_limit ?? null;
            const requiredHours = requiredMinutes ? requiredMinutes / 60 : 0;

            try {
                const { data, error } = await supabase
                    .from('staff_availability')
                    .select('staff_id, available_hours')
                    .eq('date', editableState.date);

                if (error) {
                    console.error('Error fetching staff availability for task detail:', error);
                    setAvailableStaffOptions(baseStaff);
                    return;
                }

                const filtered = baseStaff.filter(staff => {
                    const availabilityInfo = data?.find(item => item.staff_id === staff.id);
                    if (!availabilityInfo) {
                        return requiredHours === 0;
                    }
                    return requiredHours === 0 || availabilityInfo.available_hours >= requiredHours;
                });

                setAvailableStaffOptions(filtered.length > 0 ? filtered : baseStaff);
            } catch (fetchError) {
                console.error('Unexpected error while fetching available staff for task detail:', fetchError);
                setAvailableStaffOptions(baseStaff);
            }
        };

        fetchAvailableStaffForTask();
    }, [isOpen, editableState?.date, editableState?.timeLimit, housekeepingStaff, task?.time_limit]);

    const staffOptions = useMemo(() => {
        const baseOptions = availableStaffOptions.length > 0 ? availableStaffOptions : housekeepingStaff;
        const assignedId = editableState?.staffId;
        if (assignedId && assignedId !== 'unassigned' && !baseOptions.some(staff => staff.id === assignedId)) {
            const assignedStaff = allStaff.find(staff => staff.id === assignedId);
            if (assignedStaff) {
                return [...baseOptions, assignedStaff];
            }
        }
        return baseOptions;
    }, [availableStaffOptions, housekeepingStaff, editableState?.staffId, allStaff]);

    const handleFieldChange = <K extends keyof EditableTaskState>(field: K, value: EditableTaskState[K]) => {
        if (field === 'timeLimit' && task?.status !== 'done') {
            return;
        }

        setEditableState(prev => {
            if (!prev) return null;

            let nextState: EditableTaskState = { ...prev, [field]: value } as EditableTaskState;

            if (field === 'roomId' && typeof value === 'string') {
                const selectedRoom = availableRooms.find(r => r.id === value) || null;

                if (selectedRoom) {
                    setSelectedGroup(selectedRoom.group_type);
                }

                const newAvailableTypes = getAvailableCleaningTypesFromRoom(selectedRoom);
                if (newAvailableTypes.length > 0 && !newAvailableTypes.includes(nextState.cleaningType)) {
                    nextState.cleaningType = newAvailableTypes[0];
                }

                const guestOptions = getGuestCountOptionsFromRoom(selectedRoom);
                nextState.capacityId = selectedRoom?.group_type === 'OTHER'
                    ? 'a' // Default to 'a' for OTHER rooms
                    : guestOptions.length > 0
                        ? guestOptions[0].value
                        : 'd'; // Default to 'd' (2) if no options
            }

            return nextState;
        });
    };

    const handleGroupChange = (group: RoomGroup) => {
        setSelectedGroup(group);
        setEditableState(prev => {
            if (!prev) return null;
            const defaultTypes = group === 'OTHER' ? ['S', 'G'] : ['W', 'P', 'T', 'O', 'G'];
            const nextCleaningType = defaultTypes.includes(prev.cleaningType) ? prev.cleaningType : (defaultTypes[0] || prev.cleaningType);
            return {
                ...prev,
                roomId: "",
                capacityId: 'a', // Default to 'a' (1)
                cleaningType: nextCleaningType as CleaningType,
            };
        });
    };

    const handleEditClick = () => {
        if (!selectedGroup && task) {
            setSelectedGroup(task.room.group_type as RoomGroup);
        }
        setIsEditMode(true);
    };

    const handleCancelEdit = () => {
        // ... (keep existing cancel logic) ...
        if (!task) return;

        const selectedRoom = availableRooms.find(r => r.id === task.room.id) || null;

        setEditableState({
            roomId: task.room.id,
            cleaningType: task.cleaning_type,
            guestCount: task.guest_count,
            staffId: task.user?.id || 'unassigned',
            notes: task.reception_notes || '',
            date: task.date,
            timeLimit: task.time_limit,
            status: task.status,
        });
        setSelectedGroup((selectedRoom?.group_type ?? task.room.group_type) as RoomGroup);
        setIsEditMode(false);
    };

    const handleSave = async () => {
        // ... (keep existing save logic) ...
        if (!task || !editableState) return;

        if (!editableState.roomId) {
            toast({ title: "Błąd Walidacji", description: "Pokój nie może być pusty.", variant: "destructive" });
            return;
        }
        // Validation: capacityId must be a valid letter identifier
        if (!editableState.capacityId || !CAPACITY_ID_TO_LABEL[editableState.capacityId]) {
            toast({ title: "Błąd Walidacji", description: "Nieprawidłowa pojemność.", variant: "destructive" });
            return;
        }
        if (editableState.notes && editableState.notes.length > 2000) {
            toast({ title: "Błąd Walidacji", description: "Notatki nie mogą przekraczać 2000 znaków.", variant: "destructive" });
            return;
        }
        if (editableState.timeLimit !== null && editableState.timeLimit < 0) {
            toast({ title: "Błąd Walidacji", description: "Limit czasu nie może być ujemny.", variant: "destructive" });
            return;
        }

        const updates: Partial<EditableTaskState> = {};
        let changed = false;

        if (editableState.roomId !== task.room.id) { updates.roomId = editableState.roomId; changed = true; }
        if (editableState.cleaningType !== task.cleaning_type) { updates.cleaningType = editableState.cleaningType; changed = true; }
        if (editableState.capacityId !== task.guest_count) { updates.capacityId = editableState.capacityId; changed = true; }
        if (editableState.staffId !== (task.user?.id || 'unassigned')) { updates.staffId = editableState.staffId; changed = true; }
        if (editableState.notes !== (task.reception_notes || '')) { updates.notes = editableState.notes; changed = true; }
        if (editableState.date !== task.date) { updates.date = editableState.date; changed = true; }
        if (editableState.timeLimit !== task.time_limit) { updates.timeLimit = editableState.timeLimit; changed = true; }
        if (editableState.status !== task.status) { updates.status = editableState.status; changed = true; }

        if (!changed) {
            toast({ title: "Brak Zmian", description: "Żadne szczegóły nie zostały zmienione." });
            setIsEditMode(false);
            return;
        }

        const success = await onUpdate(task.id, updates);
        if (success) {
            try {
                const { data: refreshedTask, error } = await supabase
                    .from('tasks')
                    .select(`
                        id,
                        date,
                        status,
                        cleaning_type,
                        guest_count,
                        time_limit,
                        reception_notes,
                        room:rooms(id, name, group_type, color),
                        user:users(id, name, first_name, last_name)
                    `)
                    .eq('id', task.id)
                    .single();

                if (!error && refreshedTask) {
                    const updatedRoom = refreshedTask.room;
                    const updatedUser = refreshedTask.user;

                    if (task) {
                        if (updatedRoom) {
                            task.room = {
                                id: updatedRoom.id,
                                name: updatedRoom.name,
                                group_type: updatedRoom.group_type,
                                color: updatedRoom.color,
                            };
                        }
                        task.cleaning_type = refreshedTask.cleaning_type as CleaningType;
                        task.guest_count = refreshedTask.guest_count;
                        task.time_limit = refreshedTask.time_limit;
                        task.reception_notes = refreshedTask.reception_notes;
                        task.date = refreshedTask.date;
                        task.status = refreshedTask.status;
                        task.user = updatedUser
                            ? {
                                id: updatedUser.id,
                                name: updatedUser.first_name && updatedUser.last_name
                                    ? `${updatedUser.first_name} ${updatedUser.last_name}`
                                    : updatedUser.name,
                            }
                            : null;
                    }

                    setEditableState({
                        roomId: updatedRoom?.id ?? '',
                        cleaningType: refreshedTask.cleaning_type as CleaningType,
                        capacityId: updatedRoom?.group_type === 'OTHER' ? 'a' : refreshedTask.guest_count, // guest_count now stores capacity_id
                        staffId: updatedUser?.id ?? 'unassigned',
                        notes: refreshedTask.reception_notes ?? '',
                        date: refreshedTask.date,
                        timeLimit: refreshedTask.time_limit,
                        status: refreshedTask.status,
                    });
                    setSelectedGroup((updatedRoom?.group_type ?? task.room.group_type) as RoomGroup);
                    if (updatedRoom?.group_type === 'OTHER') {
                        task.guest_count = 'a'; // Use 'a' for OTHER rooms
                    }
                } else {
                    setEditableState(prev => prev ? { ...prev, ...updates } : prev);
                }
            } catch (fetchError) {
                console.error("Error fetching updated task details:", fetchError);
                setEditableState(prev => prev ? { ...prev, ...updates } : prev);
            }

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

    const currentRoom = isEditMode
        ? selectedRoom
        : availableRooms.find(room => room.id === task.room.id) || null;

    const effectiveGroup = (currentRoom?.group_type ?? (isEditMode && selectedGroup ? selectedGroup : task.room.group_type)) as RoomGroup;
    const isOtherLocation = effectiveGroup === 'OTHER';
    const roomGroupLabel = roomGroupLabels[effectiveGroup] ?? effectiveGroup;

    const effectiveCapacityId = isEditMode ? editableState.capacityId : task.guest_count; // guest_count now stores capacity_id
    const effectiveCleaningType = (isEditMode ? editableState.cleaningType : task.cleaning_type) as CleaningType;

    // Lookup capacity label from capacity_id
    let capacityLabel = CAPACITY_ID_TO_LABEL[effectiveCapacityId] || effectiveCapacityId;
    if (currentRoom) {
        const configs = parseCapacityConfigurations(currentRoom);
        if (configs.length > 0) {
            // Find config matching capacity_id
            const matchingByCapacityId = configs.filter(config => config.capacity_id === effectiveCapacityId);
            const matchByCleaning = matchingByCapacityId.find(config =>
                config.cleaning_types.some(ct => ct.type === effectiveCleaningType)
            );
            const chosenConfig = matchByCleaning ?? matchingByCapacityId[0];
            if (chosenConfig) {
                capacityLabel = chosenConfig.capacity_label || CAPACITY_ID_TO_LABEL[effectiveCapacityId] || effectiveCapacityId;
            }
        } else if (currentRoom.capacity_label) {
            capacityLabel = currentRoom.capacity_label;
        }
    }

    const capacityDisplay = currentRoom
        ? (
            isOtherLocation ? (
                <span className="text-sm text-muted-foreground italic">Pojemność nie jest śledzona dla innych lokalizacji</span>
            ) : (
                <div className="flex items-center gap-2">
                    {renderCapacityIconPattern(capacityLabel)}
                    <span className="text-xs text-muted-foreground">{capacityLabel}</span>
                </div>
            )
        )
        : (
            <span className="text-sm text-muted-foreground italic">
                {isOtherLocation
                    ? "Pojemność nie jest śledzona dla innych lokalizacji"
                    : isEditMode
                        ? "Wybierz pokój aby zobaczyć pojemność"
                        : "Szczegóły pojemności niedostępne"}
            </span>
        );

    const isTaskClosed = task.status === 'done';
    const canEditTimeLimit = isTaskClosed;

    const getStatusLabel = (status: string) => {
        // ... (keep existing getStatusLabel) ...
        const labels: Record<string, string> = {
            todo: "Do sprzątania",
            in_progress: "W trakcie",
            paused: "Wstrzymane",
            done: "Gotowe",
            repair_needed: "Naprawa"
        };
        return labels[status] || (status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '));
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
                                {isEditMode ? 'Edytuj' : 'Szczegóły'} Zadania - {task.room.name}
                            </DialogTitle>
                            <DialogDescription>
                                {isEditMode ? 'Zmodyfikuj informacje o zadaniu poniżej.' : 'Szczegóły i informacje o zadaniu.'}
                            </DialogDescription>
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Status:</span>
                                {isEditMode && (userRole === 'admin' || userRole === 'reception') ? (
                                    <Select
                                        value={editableState?.status || task.status}
                                        onValueChange={(value) => handleFieldChange('status', value)}
                                        disabled={isUpdating}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="todo">Do sprzątania</SelectItem>
                                            <SelectItem value="in_progress">W trakcie</SelectItem>
                                            <SelectItem value="paused">Wstrzymane</SelectItem>
                                            <SelectItem value="done">Gotowe</SelectItem>
                                            <SelectItem value="repair_needed">Naprawa</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Badge className={cn(getStatusColor(task.status))}>{getStatusLabel(task.status)}</Badge>
                                )}
                            </div>
                        </div>
                        {task.issue_flag && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Zgłoszono Problem
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 overflow-y-auto px-1 flex-grow">
                    {/* Column 1: Core Task Info */}
                    <div className="space-y-4">
                        {/* ... (Date, Room, Type, Guests, Staff, Reception Notes - keep existing structure) ... */}
                        <div className="space-y-1">
                            <Label htmlFor="detail-date" className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-4 w-4" />Data*</Label>
                            {isEditMode ? (<Input id="detail-date" type="date" value={editableState.date} onChange={(e) => handleFieldChange('date', e.target.value)} min={todayDateString} required disabled={isUpdating} />)
                                : (<p className="text-sm border p-2 rounded bg-muted/30">{formatDisplayDate(task.date)}</p>)}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="detail-room-group" className="flex items-center gap-1 text-muted-foreground"><DoorOpen className="h-4 w-4" />Grupa Pokoi*</Label>
                            {isEditMode ? (
                                <Select
                                    value={selectedGroup ?? undefined}
                                    onValueChange={(value: RoomGroup) => {
                                        if (!value) return;
                                        handleGroupChange(value);
                                    }}
                                    disabled={isUpdating}
                                >
                                    <SelectTrigger id="detail-room-group">
                                        <SelectValue placeholder="Wybierz grupę pokoi" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableRoomGroups.map(group => (
                                            <SelectItem key={group} value={group}>
                                                {roomGroupLabels[group] ?? group}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-sm border p-2 rounded bg-muted/30">{roomGroupLabel}</p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="detail-room" className="flex items-center gap-1 text-muted-foreground"><DoorOpen className="h-4 w-4" />Pokój*</Label>
                            {isEditMode ? (
                                <Select
                                    value={editableState.roomId || undefined}
                                    onValueChange={(value) => handleFieldChange('roomId', value)}
                                    disabled={isUpdating || !selectedGroup}
                                >
                                    <SelectTrigger id="detail-room">
                                        <SelectValue placeholder={selectedGroup ? "Wybierz pokój" : "Najpierw wybierz grupę"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {selectedGroup && filteredRooms.length === 0 && (
                                            <SelectItem value="__no_rooms__" disabled>
                                                Brak pokoi w tej grupie
                                            </SelectItem>
                                        )}
                                        {filteredRooms.map(room => (
                                            <SelectItem key={room.id} value={room.id}>
                                                {room.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-sm border p-2 rounded bg-muted/30">{task.room.name}</p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="detail-cleaningType" className="flex items-center gap-1 text-muted-foreground"><BedDouble className="h-4 w-4" />Typ*</Label>
                            {isEditMode ? (
                                <Select
                                    value={editableState.cleaningType}
                                    onValueChange={(value: CleaningType) => handleFieldChange('cleaningType', value)}
                                    disabled={isUpdating || availableCleaningTypes.length === 0}
                                >
                                    <SelectTrigger id="detail-cleaningType">
                                        <SelectValue placeholder="Wybierz typ" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableCleaningTypes.length === 0 ? (
                                            <SelectItem value="__no_types__" disabled>
                                                Brak dostępnych typów sprzątania
                                            </SelectItem>
                                        ) : (
                                            availableCleaningTypes.map(type => (
                                                <SelectItem key={type} value={type}>
                                                    {cleaningTypeLabels[type]}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            )
                                : (<p className="text-sm border p-2 rounded bg-muted/30">{cleaningTypeLabels[task.cleaning_type]}</p>)}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="detail-guestCount" className="flex items-center gap-1 text-muted-foreground"><User className="h-4 w-4" />Goście*</Label>
                            {isEditMode ? (
                                isOtherLocation ? (
                                    <div className="text-sm border p-2 rounded bg-muted/30 text-muted-foreground italic">
                                        Pojemność nie jest śledzona dla innych lokalizacji
                                    </div>
                                ) : (
                                    <Select
                                        value={editableState.capacityId || 'd'} // Default to 'd' if not set
                                        onValueChange={(value) => {
                                            handleFieldChange('capacityId', value);
                                        }}
                                        disabled={isUpdating}
                                    >
                                        <SelectTrigger id="detail-guestCount">
                                            <SelectValue placeholder="Wybierz liczbę gości" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(() => {
                                                const selectedRoom = availableRooms.find(r => r.id === editableState.roomId) || null;
                                                const options = getGuestCountOptionsFromRoom(selectedRoom);
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
                                )
                            ) : (
                                <div className="text-sm border p-2 rounded bg-muted/30">
                                    {capacityDisplay}
                                </div>
                            )}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="detail-assignStaff" className="flex items-center gap-1 text-muted-foreground"><User className="h-4 w-4" />Assigned Staff</Label>
                            {isEditMode ? (
                                <Select
                                    value={editableState.staffId}
                                    onValueChange={(value) => handleFieldChange('staffId', value)}
                                    disabled={isUpdating}
                                >
                                    <SelectTrigger id="detail-assignStaff">
                                        <SelectValue placeholder="Select staff..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Unassigned</SelectItem>
                                        {staffOptions.map(staff => (
                                            <SelectItem key={staff.id} value={staff.id}>
                                                {staff.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )
                                : (<p className="text-sm border p-2 rounded bg-muted/30">{task.user?.name || 'Unassigned'}</p>)}
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="detail-notes" className="flex items-center gap-1 text-muted-foreground"><StickyNote className="h-4 w-4" />Reception Notes</Label>
                            {isEditMode ? (<><Textarea id="detail-notes" placeholder="Optional notes..." value={editableState.notes} onChange={(e) => handleFieldChange('notes', e.target.value)} className="min-h-[80px]" maxLength={2000} disabled={isUpdating} /><p className="text-xs text-muted-foreground text-right">{editableState.notes.length} / 2000</p></>)
                                : (<p className="text-sm border p-2 rounded bg-muted/30 min-h-[40px]">{task.reception_notes || <span className="text-muted-foreground italic">No notes</span>}</p>)}
                        </div>
                    </div>

                    {/* Column 2: Time & Issue Info */}
                    <div className="space-y-4">
                        {/* Time Limit */}
                        <div className="space-y-1">
                            <Label htmlFor="detail-timeLimit" className="flex items-center gap-1 text-muted-foreground"><Clock className="h-4 w-4" />Time Limit (min)</Label>
                            {isEditMode ? (
                                <>
                                    <Input
                                        id="detail-timeLimit"
                                        type="number"
                                        min="0"
                                        value={editableState.timeLimit ?? ''}
                                        onChange={(e) => handleFieldChange('timeLimit', e.target.value ? parseInt(e.target.value, 10) : null)}
                                        placeholder="None"
                                        disabled={isUpdating || !canEditTimeLimit}
                                    />
                                    {!canEditTimeLimit && (
                                        <p className="text-xs text-muted-foreground">Close the task to adjust the time limit.</p>
                                    )}
                                </>
                            )
                                : (<p className="text-sm border p-2 rounded bg-muted/30">{task.time_limit ?? 'None'}</p>)}
                        </div>

                        {/* ** MODIFICATION START: Simplified Time Display Card ** */}
                        {(task.start_time || task.actual_time !== null) && ( // Show if started or completed
                            <Card className="bg-muted/30">
                                <CardHeader className="p-3">
                                    <CardTitle className="text-base flex items-center gap-1"><Timer className="h-4 w-4" />Timing</CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 pt-0 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    {/* Start Time */}
                                    <div className="flex items-center gap-1">
                                        <PlayCircle className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-muted-foreground">Start:</span> {formatDisplayTime(task.start_time)}
                                    </div>
                                    {/* Stop Time */}
                                    <div className="flex items-center gap-1">
                                        <Square className="h-3 w-3 text-muted-foreground" />
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
                                <Label className="flex items-center gap-1 text-muted-foreground"><StickyNote className="h-4 w-4" />Housekeeping Note</Label>
                                <p className="text-sm border p-2 rounded bg-muted/30 min-h-[40px]">{task.housekeeping_notes}</p>
                            </div>
                        )}

                        {/* Issue Details */}
                        {task.issue_flag && (
                            <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
                                <CardHeader className="p-3">
                                    <CardTitle className="text-base flex items-center gap-1 text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" />Issue Details</CardTitle>
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
                                <Label className="flex items-center gap-1 text-muted-foreground"><AlertTriangle className="h-4 w-4" />Issue</Label>
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
                            <Button type="button" onClick={handleEditClick}>
                                <Edit2 className="mr-2 h-4 w-4" /> Edit
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
