// src/components/reception/AddTaskDialog.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, User } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { Room, Staff } from '@/hooks/useReceptionData';
import type { NewTaskState } from '@/hooks/useReceptionActions';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { getCapacitySortKey, normalizeCapacityLabel, renderCapacityIconPattern, LABEL_TO_CAPACITY_ID, CAPACITY_ID_TO_LABEL } from "@/lib/capacity-utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

type CleaningType = Database["public"]["Enums"]["cleaning_type"];
type RoomGroup = Database["public"]["Enums"]["room_group"];
type TaskStatus = Database["public"]["Enums"]["task_status"];

const OPEN_TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'paused', 'repair_needed'];

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

// Render icons for capacity label

const prepareGuestOptions = (options: GuestOption[]): GuestOption[] => {
    const uniqueByLabel = new Map<string, GuestOption>();

    options.forEach((option) => {
        const normalizedLabel = normalizeCapacityLabel(option.label);

        if (!uniqueByLabel.has(normalizedLabel)) {
            uniqueByLabel.set(normalizedLabel, {
                value: option.value,
                label: normalizedLabel,
                display: option.display ?? renderCapacityIconPattern(normalizedLabel),
            });
        }
    });

    return Array.from(uniqueByLabel.values()).sort(
        (a, b) => getCapacitySortKey(a.label) - getCapacitySortKey(b.label)
    );
};

// Get guest count options from room's capacity_configurations
// Now uses capacity_id (string) instead of numeric value
type GuestOption = {
    value: string; // Now capacity_id
    label: string;
    display: React.ReactNode;
};

const getGuestOptionValue = (option: GuestOption): string =>
    option.value; // Now just return capacity_id directly

const getGuestCountOptionsFromRoom = (room: Room | null): GuestOption[] => {
    if (!room) return [];

    const configs = parseCapacityConfigurations(room);

    // If room has capacity_configurations, use them
    if (configs.length > 0) {
        const options = configs.map(config => {
            const normalizedLabel = normalizeCapacityLabel(config.capacity_label || '');
            return {
                value: config.capacity_id,
                label: normalizedLabel,
                display: renderCapacityIconPattern(normalizedLabel)
            };
        });

        return prepareGuestOptions(options);
    }

    // Fallback to legacy behavior based on group_type for rooms without configurations
    const roomGroup = room.group_type;

    switch (roomGroup) {
        case 'P1':
            return prepareGuestOptions([{ value: 'a', label: '1', display: renderCapacityIconPattern('1') }]);

        case 'P2':
            return prepareGuestOptions([
                { value: 'a', label: '1', display: renderCapacityIconPattern('1') },
                { value: 'd', label: '2', display: renderCapacityIconPattern('2') },
                { value: 'b', label: '1+1', display: renderCapacityIconPattern('1+1') },
            ]);

        case 'A1S':
            return prepareGuestOptions([
                { value: 'a', label: '1', display: renderCapacityIconPattern('1') },
                { value: 'd', label: '2', display: renderCapacityIconPattern('2') },
                { value: 'b', label: '1+1', display: renderCapacityIconPattern('1+1') },
                { value: 'e', label: '2+1', display: renderCapacityIconPattern('2+1') },
                { value: 'f', label: '2+2', display: renderCapacityIconPattern('2+2') },
            ]);

        case 'A2S':
            return prepareGuestOptions([
                { value: 'a', label: '1', display: renderCapacityIconPattern('1') },
                { value: 'd', label: '2', display: renderCapacityIconPattern('2') },
                { value: 'b', label: '1+1', display: renderCapacityIconPattern('1+1') },
                { value: 'e', label: '2+1', display: renderCapacityIconPattern('2+1') },
                { value: 'f', label: '2+2', display: renderCapacityIconPattern('2+2') },
                { value: 'c', label: '1+1+1', display: renderCapacityIconPattern('1+1+1') },
                { value: 'g', label: '2+2+1', display: renderCapacityIconPattern('2+2+1') },
                { value: 'h', label: '2+2+2', display: renderCapacityIconPattern('2+2+2') },
            ]);

        case 'OTHER':
            return prepareGuestOptions(
                Array.from({ length: 10 }, (_, i) => {
                    const label = String(i + 1);
                    const capacityId = LABEL_TO_CAPACITY_ID[label] || label;
                    return {
                        value: capacityId,
                        label,
                        display: renderCapacityIconPattern(label),
                    };
                })
            );

        default:
            return [];
    }
};

const useGuestCountOptions = (selectedRoom: Room | null) => {
    return useMemo(() => {
        if (!selectedRoom) {
            return [];
        }
        return getGuestCountOptionsFromRoom(selectedRoom);
    }, [selectedRoom]);
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
                .select('room_id, status')
                .eq('date', newTask.date)
                .in('status', OPEN_TASK_STATUSES);

            if (error) {
                console.error('Error fetching assigned rooms:', error);
                setAssignedRoomIds(new Set()); // Reset on error
                return;
            }

            const roomIds = new Set(
                data
                    ?.map(task => task.room_id)
                    .filter((roomId): roomId is string => Boolean(roomId))
            );
            console.log('Assigned room IDs:', roomIds); // Debug log
            setAssignedRoomIds(roomIds);
        };

        fetchAssignedRooms();
    }, [newTask.date, isOpen]); // Rerun when date changes or dialog opens

    // Get time limit from room's capacity_configurations when room, cleaning type, and guest count are selected
    useEffect(() => {
        if (!newTask.roomId || !newTask.cleaningType || !newTask.capacityId || !isOpen) {
            setTaskTimeLimit(null);
            return;
        }

        const selectedRoom = availableRooms.find(r => r.id === newTask.roomId);
        if (!selectedRoom) {
            setTaskTimeLimit(null);
            return;
        }

        // Get time limit from room's capacity_configurations
        const timeLimit = getTimeLimitFromRoom(selectedRoom, newTask.capacityId, newTask.cleaningType);
        setTaskTimeLimit(timeLimit);

        if (timeLimit !== null) {
            console.log(`Time limit from room config for ${selectedRoom.name}/${newTask.cleaningType}/${newTask.capacityId}: ${timeLimit} minutes`);
        } else {
            console.log(`No time limit found in room config for ${selectedRoom.name}/${newTask.cleaningType}/${newTask.capacityId}`);
        }
    }, [newTask.roomId, newTask.cleaningType, newTask.capacityId, isOpen, availableRooms]);

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
                    // Fallback to housekeeping staff only if availability check fails
                    const housekeepingStaff = allStaff.filter(staff =>
                        staff.role === 'housekeeping'
                    );
                    setAvailableStaff(housekeepingStaff);
                    setAvailabilityData([]);
                    return;
                }

                // Store availability data for display
                setAvailabilityData(availabilityData || []);

                // Convert task time limit from minutes to hours for comparison
                const requiredHours = taskTimeLimit ? taskTimeLimit / 60 : 0;

                // Filter staff: only housekeeping (no admins)
                // First filter by role to only include housekeeping
                const housekeepingStaff = allStaff.filter(staff =>
                    staff.role === 'housekeeping'
                );

                // Then filter based on availability and task requirements
                const filteredStaff = housekeepingStaff.filter(staff => {
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
                // Fallback to housekeeping staff only
                const housekeepingStaff = allStaff.filter(staff =>
                    staff.role === 'housekeeping'
                );
                setAvailableStaff(housekeepingStaff);
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

    // Clear selected room if it becomes unavailable (filtered out or assigned)
    useEffect(() => {
        if (!newTask.roomId || !isOpen) return;

        // Check if the selected room is still available in filteredRooms
        const isRoomStillAvailable = filteredRooms.some(room => room.id === newTask.roomId);

        // Also check if it's in availableRooms (in case it was deactivated)
        const isRoomInAvailableRooms = availableRooms.some(room => room.id === newTask.roomId);

        // Check if the room is now assigned
        const isRoomAssigned = assignedRoomIds.has(newTask.roomId);

        if (!isRoomStillAvailable || !isRoomInAvailableRooms || isRoomAssigned) {
            console.log("Selected room is no longer available, clearing selection:", {
                roomId: newTask.roomId,
                isRoomStillAvailable,
                isRoomInAvailableRooms,
                isRoomAssigned
            });

            setNewTask(prev => ({
                ...prev,
                roomId: "", // Clear the room selection
                staffId: "", // Also clear staff selection
                capacityId: 'a', // Reset to default (1)
            }));
        }
    }, [filteredRooms, availableRooms, assignedRoomIds, newTask.roomId, isOpen]);

    // Get selected room
    const selectedRoom = useMemo(() => {
        if (!newTask.roomId) return null;
        return availableRooms.find(r => r.id === newTask.roomId) || null;
    }, [newTask.roomId, availableRooms]);

    const isGuestCountDisabled = selectedRoom?.group_type === 'OTHER';

    // Get available cleaning types based on selected room's capacity_configurations
    const availableCleaningTypes = useMemo(() => {
        if (selectedRoom) {
            return getAvailableCleaningTypesFromRoom(selectedRoom);
        }
        // Fallback to group-based if no room selected
        if (!selectedGroup) return [];
        if (selectedGroup === 'OTHER') return ['S', 'G'];
        return ['W', 'P', 'T', 'O', 'G'];
    }, [selectedRoom, selectedGroup]);

    const guestCountOptions = useGuestCountOptions(selectedRoom);

    useEffect(() => {
        if (!isOpen || !selectedRoom) return;
        if (isGuestCountDisabled) return;
        if (guestCountOptions.length === 0) return;

        const hasMatchingOption = guestCountOptions.some(
            (option) => option.value === newTask.capacityId
        );

        if (!hasMatchingOption) {
            setNewTask((prev) => ({
                ...prev,
                capacityId: guestCountOptions[0].value,
            }));
        }
    }, [isOpen, selectedRoom, isGuestCountDisabled, guestCountOptions, newTask.capacityId]);

    const selectedGuestOptionValue = useMemo(() => {
        if (isGuestCountDisabled || !selectedRoom || guestCountOptions.length === 0) return "";

        const matchingOption = guestCountOptions.find(
            (option) => option.value === newTask.capacityId
        );

        if (matchingOption) {
            return getGuestOptionValue(matchingOption);
        }

        return getGuestOptionValue(guestCountOptions[0]);
    }, [selectedRoom, isGuestCountDisabled, guestCountOptions, newTask.capacityId]);

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
            // Initialize with only housekeeping staff
            setAvailableStaff(allStaff.filter(staff => staff.role === 'housekeeping'));
            setAvailabilityData([]); // Clear availability data initially
            setTaskTimeLimit(null); // Clear task time limit
        }
        prevIsOpen.current = isOpen;
    }, [isOpen, initialState, todayDateString]);

    // Handle group change
    const handleGroupChange = (group: RoomGroup) => {
        setSelectedGroup(group);

        // Reset room and cleaning type when group changes
        const defaultTypes = group === 'OTHER' ? ['S', 'G'] : ['W', 'P', 'T', 'O', 'G'];
        setNewTask(prev => ({
            ...prev,
            roomId: "", // Clear selected room
            cleaningType: defaultTypes[0] || 'W', // Set first available type or default
            guestCount: 1, // Reset guest count; will be ignored for OTHER
        }));
    };

    // Handle room change
    const handleRoomChange = (roomId: string) => {
        const selectedRoom = availableRooms.find(r => r.id === roomId);
        if (!selectedRoom) return;

        const guestOptions = getGuestCountOptionsFromRoom(selectedRoom);
        const defaultGuestCount = selectedRoom.group_type === 'OTHER'
            ? 1
            : guestOptions.length > 0
                ? guestOptions[0].value
                : 1;

        // Get available cleaning types for this room
        const availableTypes = getAvailableCleaningTypesFromRoom(selectedRoom);
        const defaultCleaningType = availableTypes.length > 0 ? availableTypes[0] : 'W';

        setNewTask(prev => ({
            ...prev,
            roomId,
            staffId: "", // Clear staff selection when room changes
            capacityId: defaultGuestCount, // Reset to first available capacity option (now capacity_id)
            cleaningType: defaultCleaningType // Reset to first available cleaning type for this room
        }));
    };

    const handleSubmit = async () => {
        // Validation: Check if roomId is set
        if (!newTask.roomId) {
            toast({
                title: "Wymagany Pokój",
                description: "Proszę wybrać pokój przed zatwierdzeniem.",
                variant: "destructive",
            });
            return;
        }

        // Validation: Check if the selected room exists in availableRooms
        // Normalize room ID for comparison
        const normalizedRoomId = String(newTask.roomId).trim();
        let selectedRoom = availableRooms.find(r => String(r.id).trim() === normalizedRoomId);

        // If still not found, try case-insensitive comparison
        if (!selectedRoom) {
            selectedRoom = availableRooms.find(r =>
                String(r.id).trim().toLowerCase() === normalizedRoomId.toLowerCase()
            );
        }

        if (!selectedRoom) {
            console.error("Room validation failed in handleSubmit:", {
                roomId: newTask.roomId,
                normalizedRoomId,
                roomIdType: typeof newTask.roomId,
                availableRoomsCount: availableRooms.length,
                availableRoomIds: availableRooms.map(r => ({ id: r.id, idType: typeof r.id, idString: String(r.id) })),
                availableRoomNames: availableRooms.map(r => r.name),
                filteredRoomsCount: filteredRooms.length,
                isRoomInFiltered: filteredRooms.some(r => String(r.id).trim() === normalizedRoomId),
                isRoomAssigned: assignedRoomIds.has(newTask.roomId)
            });
            toast({
                title: "Nieprawidłowy Wybór Pokoju",
                description: "Wybrany pokój nie jest już dostępny. Proszę wybrać inny pokój.",
                variant: "destructive",
            });
            return; // Prevent submission
        }

        // Validation: Check if the selected room is still available (double-check against latest assignedRoomIds)
        if (assignedRoomIds.has(newTask.roomId)) {
            toast({
                title: "Pokój Już Przypisany",
                description: "Ten pokój ma już przypisane zadanie na wybraną datę. Proszę wybrać inny pokój.",
                variant: "destructive",
            });
            return; // Prevent submission
        }

        // Validation: Check if room is in filteredRooms (should be if it passed the above checks)
        const isRoomInFiltered = filteredRooms.some(r => r.id === newTask.roomId);
        if (!isRoomInFiltered && selectedGroup) {
            console.warn("Room is in availableRooms but not in filteredRooms:", {
                roomId: newTask.roomId,
                selectedGroup,
                filteredRooms: filteredRooms.map(r => ({ id: r.id, name: r.name }))
            });
            toast({
                title: "Pokój Niedostępny",
                description: "Ten pokój nie jest dostępny dla wybranej grupy lub daty. Proszę wybrać inny pokój.",
                variant: "destructive",
            });
            return; // Prevent submission
        }

        // Double-check just before submission to prevent race conditions
        try {
            const { data: existingOpenTasks, error: existingCheckError } = await supabase
                .from('tasks')
                .select('id')
                .eq('date', newTask.date)
                .eq('room_id', newTask.roomId)
                .in('status', OPEN_TASK_STATUSES);

            if (existingCheckError) {
                console.error("Error verifying existing tasks before submit:", existingCheckError);
                toast({
                    title: "Weryfikacja Nieudana",
                    description: "Nie udało się zweryfikować dostępności pokoju. Spróbuj ponownie.",
                    variant: "destructive",
                });
                return;
            }

            if (existingOpenTasks && existingOpenTasks.length > 0) {
                toast({
                    title: "Pokój Już Przypisany",
                    description: "Istnieje już otwarte zadanie dla tego pokoju w wybranym dniu. Zamknij je przed utworzeniem kolejnego.",
                    variant: "destructive",
                });
                return;
            }
        } catch (verificationError) {
            console.error("Unexpected error during duplicate task verification:", verificationError);
            toast({
                title: "Błąd Weryfikacji",
                description: "Coś poszło nie tak podczas sprawdzania dostępności pokoju. Spróbuj ponownie.",
                variant: "destructive",
            });
            return;
        }

        const success = await onSubmit(newTask);
        if (success) {
            setIsOpen(false);
        }
    };

    // For displaying placeholder text in room dropdown
    const getRoomPlaceholder = () => {
        if (!selectedGroup) {
            return "Najpierw wybierz grupę";
        }
        if (filteredRooms.length === 0) {
            return assignedRoomIds.size > 0 ? "Wszystkie pokoje w grupie przypisane" : "Brak pokoi w tej grupie";
        }
        return "Wybierz pokój";
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
                        <Plus className="mr-2 h-4 w-4" /> Dodaj Zadanie
                    </Button>
                </DialogTrigger>
            )}

            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Dodaj Nowe Zadanie Sprzątania</DialogTitle>
                    <DialogDescription>
                        Wybierz datę, grupę, pokój, typ sprzątania, gości i przypisz personel.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Date Input with Calendar Picker */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="task-date-modal" className="text-right">Data*</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="task-date-modal"
                                    variant="outline"
                                    className={`col-span-3 justify-start text-left font-normal ${!newTask.date && "text-muted-foreground"
                                        }`}
                                    disabled={isSubmitting}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {newTask.date ? (
                                        format(new Date(newTask.date), "PPP", { locale: pl })
                                    ) : (
                                        <span>Wybierz datę</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={newTask.date ? new Date(newTask.date) : undefined}
                                    onSelect={(date) => {
                                        if (date) {
                                            setNewTask(prev => ({ ...prev, date: format(date, 'yyyy-MM-dd') }));
                                        }
                                    }}
                                    disabled={(date) => {
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        return date < today;
                                    }}
                                    initialFocus
                                    locale={pl}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Group Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="group-modal" className="text-right">Grupa*</Label>
                        <Select
                            value={selectedGroup || ""}
                            onValueChange={(value) => handleGroupChange(value as RoomGroup)}
                            disabled={isSubmitting} // Disable during submission
                        >
                            <SelectTrigger id="group-modal" className="col-span-3">
                                <SelectValue placeholder="Wybierz grupę" />
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
                        <Label htmlFor="room-modal" className="text-right">Pokój*</Label>
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
                                        {assignedRoomIds.size > 0 ? "Wszystkie pokoje przypisane" : "Brak dostępnych pokoi"}
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Cleaning Type Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="cleaningType-modal" className="text-right">Typ*</Label>
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

                    {/* Guest Count Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="guestCount-modal" className="text-right">
                            {isGuestCountDisabled ? "Guests" : "Guests*"}
                        </Label>
                        {isGuestCountDisabled ? (
                            <div className="col-span-3 border rounded p-2 text-sm text-muted-foreground italic bg-muted/30">
                                Capacity not tracked for other locations
                            </div>
                        ) : (
                            <Select
                                value={newTask.capacityId || ''}
                                onValueChange={(value) => {
                                    // value is now capacity_id directly
                                    setNewTask(prev => ({ ...prev, capacityId: value }));
                                }}
                                disabled={isSubmitting || !newTask.roomId}
                            >
                                <SelectTrigger id="guestCount-modal" className="col-span-3">
                                    <SelectValue placeholder={newTask.roomId ? "Select guest count" : "Select room first"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {newTask.roomId && selectedRoom ? (
                                        guestCountOptions.map((option, index) => {
                                            return (
                                                <SelectItem key={`${option.value}-${index}`} value={option.value}>
                                                    {option.display}
                                                </SelectItem>
                                            );
                                        })
                                    ) : (
                                        <SelectItem value="placeholder" disabled>Select room first</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Staff Select */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="assignStaff-modal" className="text-right">Assign Staff</Label>
                        <Select
                            value={newTask.staffId}
                            onValueChange={(value) => setNewTask(prev => ({ ...prev, staffId: value }))}
                            disabled={isSubmitting || !newTask.roomId} // Disable until room is selected
                        >
                            <SelectTrigger id="assignStaff-modal" className="col-span-3">
                                <SelectValue placeholder={newTask.roomId ? "Unassigned" : "Select room first"} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {!newTask.roomId && (
                                    <SelectItem value="select-room" disabled>
                                        Please select a room first
                                    </SelectItem>
                                )}
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
                        disabled={
                            isSubmitting ||
                            !newTask.roomId ||
                            !newTask.date ||
                            !selectedGroup ||
                            !newTask.cleaningType ||
                            (!isGuestCountDisabled && !newTask.capacityId)
                        }
                    >
                        {isSubmitting ? "Adding..." : "Add Task"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
