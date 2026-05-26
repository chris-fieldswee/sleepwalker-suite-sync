import React, { useState, useMemo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarIcon, ChevronDown, ChevronRight, GripVertical, Plus, Trash2, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { Room, Staff } from '@/hooks/useReceptionData';
import type { NewTaskState } from '@/hooks/useReceptionActions';
import { useBatchTaskWizard, type AssignmentGroup, type BatchTask } from '@/hooks/useBatchTaskWizard';
import { normalizeCapacityLabel, renderCapacityIconPattern, LABEL_TO_CAPACITY_ID, getCapacitySortKey } from "@/lib/capacity-utils";
import { cn } from "@/lib/utils";

type CleaningType = Database["public"]["Enums"]["cleaning_type"];
type RoomGroup = Database["public"]["Enums"]["room_group"];

const cleaningTypeLabels: Record<CleaningType, string> = {
    W: "Wyjazd", P: "Przyjazd", T: "Trakt", O: "Odświeżenie", G: "Generalne", S: "Standard"
};

const roomGroupLabels: Record<RoomGroup, string> = {
    P1: "Pokoje P1", P2: "Pokoje P2", A1S: "Apartamenty A1S", A2S: "Apartamenty A2S", OTHER: "Inne Przestrzenie"
};

type GuestOption = { value: string; label: string; display: React.ReactNode };

function parseCapacityConfigurations(room: Room | null) {
    if (!room?.capacity_configurations) return [];
    try {
        const configs: any[] = Array.isArray(room.capacity_configurations)
            ? room.capacity_configurations
            : JSON.parse(room.capacity_configurations as string);
        return configs.map((c: any) => {
            let capacityId = c.capacity_id;
            const capacityLabel = c.capacity_label || '';
            if (!capacityId && capacityLabel) capacityId = LABEL_TO_CAPACITY_ID[normalizeCapacityLabel(capacityLabel)] || '';
            return {
                capacity_id: capacityId || 'd',
                capacity_label: capacityLabel,
                cleaning_types: Array.isArray(c.cleaning_types)
                    ? c.cleaning_types.map((ct: any) => ({ type: ct.type as CleaningType, time_limit: Number(ct.time_limit) || 30 }))
                    : [],
            };
        });
    } catch { return []; }
}

function prepareGuestOptions(options: GuestOption[]): GuestOption[] {
    const map = new Map<string, GuestOption>();
    options.forEach(o => {
        const norm = normalizeCapacityLabel(o.label);
        if (!map.has(norm)) map.set(norm, { value: o.value, label: norm, display: renderCapacityIconPattern(norm) });
    });
    return Array.from(map.values()).sort((a, b) => getCapacitySortKey(a.label) - getCapacitySortKey(b.label));
}

function getGuestCountOptionsFromRoom(room: Room | null): GuestOption[] {
    if (!room) return [];
    const configs = parseCapacityConfigurations(room);
    if (configs.length > 0) {
        return prepareGuestOptions(configs.map(c => ({
            value: c.capacity_id,
            label: normalizeCapacityLabel(c.capacity_label || ''),
            display: renderCapacityIconPattern(normalizeCapacityLabel(c.capacity_label || '')),
        })));
    }
    const base: GuestOption[] = {
        P1: [{ value: 'a', label: '1', display: null }],
        P2: [{ value: 'a', label: '1', display: null }, { value: 'd', label: '2', display: null }, { value: 'b', label: '1+1', display: null }],
        A1S: [{ value: 'a', label: '1', display: null }, { value: 'd', label: '2', display: null }, { value: 'b', label: '1+1', display: null }, { value: 'e', label: '2+1', display: null }, { value: 'f', label: '2+2', display: null }],
        A2S: [{ value: 'a', label: '1', display: null }, { value: 'd', label: '2', display: null }, { value: 'b', label: '1+1', display: null }, { value: 'e', label: '2+1', display: null }, { value: 'f', label: '2+2', display: null }, { value: 'c', label: '1+1+1', display: null }, { value: 'g', label: '2+2+1', display: null }, { value: 'h', label: '2+2+2', display: null }],
        OTHER: Array.from({ length: 10 }, (_, i) => ({ value: LABEL_TO_CAPACITY_ID[String(i + 1)] || String(i + 1), label: String(i + 1), display: null })),
    }[room.group_type as RoomGroup] || [];
    return prepareGuestOptions(base.map(o => ({ ...o, display: renderCapacityIconPattern(o.label) })));
}

function getAvailableCleaningTypesFromRoom(room: Room | null): CleaningType[] {
    if (!room) return [];
    const configs = parseCapacityConfigurations(room);
    if (configs.length > 0) {
        const set = new Set<CleaningType>();
        configs.forEach(c => c.cleaning_types.forEach(ct => set.add(ct.type)));
        return Array.from(set);
    }
    return room.group_type === 'OTHER' ? ['S', 'G'] : ['P', 'W', 'T', 'O', 'G'];
}

// ─── Task row ───────────────────────────────────────────────────────────────

interface TaskRowProps {
    task: BatchTask;
    groupId: string;
    availableRooms: Room[];
    roomGroupType: string;
    onRoomGroupChange: (groupType: string) => void;
    onUpdate: (updates: Partial<BatchTask>) => void;
    onRemove: () => void;
    onToggle: () => void;
    isSubmitting: boolean;
    dragListeners?: Record<string, unknown>;
    dragAttributes?: React.HTMLAttributes<HTMLElement>;
    innerRef?: React.Ref<HTMLDivElement>;
    dragStyle?: React.CSSProperties;
    isDragging?: boolean;
}

function TaskRow({ task, groupId, availableRooms, roomGroupType, onRoomGroupChange, onUpdate, onRemove, onToggle, isSubmitting, dragListeners, dragAttributes, innerRef, dragStyle, isDragging }: TaskRowProps) {
    const filteredRooms = useMemo(
        () => roomGroupType ? availableRooms.filter(r => r.group_type === roomGroupType) : [],
        [availableRooms, roomGroupType]
    );

    const selectedRoom = useMemo(
        () => availableRooms.find(r => r.id === task.roomId) ?? null,
        [availableRooms, task.roomId]
    );

    const cleaningTypes = useMemo(() => getAvailableCleaningTypesFromRoom(selectedRoom), [selectedRoom]);
    const guestOptions = useMemo(() => getGuestCountOptionsFromRoom(selectedRoom), [selectedRoom]);

    const roomName = selectedRoom?.name ?? '';
    const cleaningLabel = cleaningTypeLabels[task.cleaningType as CleaningType] ?? task.cleaningType;
    const collapsedLabel = roomName ? `${roomName} — ${cleaningLabel}` : 'Nowe zadanie';

    const statusColor = task.status === 'success' ? 'bg-green-100 text-green-800' : task.status === 'error' ? 'bg-red-100 text-red-800' : '';

    return (
        <div
          ref={innerRef}
          style={{ ...dragStyle, opacity: isDragging ? 0.5 : undefined }}
          {...(dragAttributes || {})}
          className={cn("border rounded-md", task.status === 'error' && "border-red-400", task.status === 'success' && "border-green-400")}
        >
            <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30"
                onClick={onToggle}
            >
                <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="cursor-grab touch-none text-muted-foreground" {...(dragListeners as any || {})} onClick={e => e.stopPropagation()}>
                        <GripVertical className="h-4 w-4" />
                    </span>
                    {task.expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span>{collapsedLabel}</span>
                    {task.status !== 'idle' && task.status !== 'submitting' && (
                        <Badge className={cn("text-xs", statusColor)}>
                            {task.status === 'success' ? 'Dodano' : 'Błąd'}
                        </Badge>
                    )}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={e => { e.stopPropagation(); onRemove(); }}
                    disabled={isSubmitting || task.status === 'success'}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            {task.expanded && (
                <div className="px-3 pb-3 space-y-3 border-t">
                    {task.status === 'error' && (
                        <p className="text-xs text-red-600 mt-2">Nie udało się utworzyć zadania. Sprawdź dane i spróbuj ponownie.</p>
                    )}
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        {/* Room group */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Grupa pokoi*</Label>
                            <Select
                                value={roomGroupType || ''}
                                onValueChange={val => {
                                    onRoomGroupChange(val);
                                    onUpdate({ roomId: '', cleaningType: 'W', capacityId: 'd' });
                                }}
                                disabled={isSubmitting || task.status === 'success'}
                            >
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Wybierz grupę" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(roomGroupLabels) as RoomGroup[]).map(g => (
                                        <SelectItem key={g} value={g}>{roomGroupLabels[g]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Room */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Pokój*</Label>
                            <Select
                                value={task.roomId || ''}
                                onValueChange={val => {
                                    const room = availableRooms.find(r => r.id === val) ?? null;
                                    const types = getAvailableCleaningTypesFromRoom(room);
                                    const opts = getGuestCountOptionsFromRoom(room);
                                    onUpdate({
                                        roomId: val,
                                        cleaningType: types[0] ?? 'W',
                                        capacityId: opts[0]?.value ?? 'd',
                                    });
                                }}
                                disabled={!roomGroupType || isSubmitting || task.status === 'success'}
                            >
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Wybierz pokój" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredRooms.length === 0
                                        ? <SelectItem value="__none__" disabled>Brak pokoi</SelectItem>
                                        : filteredRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)
                                    }
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Cleaning type */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Typ sprzątania*</Label>
                            <Select
                                value={task.cleaningType}
                                onValueChange={val => onUpdate({ cleaningType: val })}
                                disabled={!task.roomId || isSubmitting || task.status === 'success'}
                            >
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {cleaningTypes.map(t => (
                                        <SelectItem key={t} value={t}>{cleaningTypeLabels[t]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Guest count */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Goście*</Label>
                            <Select
                                value={task.capacityId}
                                onValueChange={val => onUpdate({ capacityId: val })}
                                disabled={!task.roomId || isSubmitting || task.status === 'success'}
                            >
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {guestOptions.map(o => (
                                        <SelectItem key={o.value} value={o.value}>{o.display}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Notatki</Label>
                        <Textarea
                            value={task.notes}
                            onChange={e => onUpdate({ notes: e.target.value })}
                            placeholder="Opcjonalne notatki..."
                            className="min-h-[56px] text-sm"
                            maxLength={2000}
                            disabled={isSubmitting || task.status === 'success'}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function SortableTaskRowWrapper(props: Omit<TaskRowProps, 'dragListeners' | 'dragAttributes' | 'innerRef' | 'dragStyle' | 'isDragging'>) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
    return (
        <TaskRow
            {...props}
            innerRef={setNodeRef as React.Ref<HTMLDivElement>}
            dragStyle={{ transform: CSS.Transform.toString(transform), transition }}
            dragListeners={listeners as Record<string, unknown>}
            dragAttributes={attributes}
            isDragging={isDragging}
        />
    );
}

// ─── Group section ───────────────────────────────────────────────────────────

interface GroupSectionProps {
    group: AssignmentGroup;
    allStaff: Staff[];
    availableRooms: Room[];
    taskRoomGroups: Record<string, string>;
    onRoomGroupChange: (taskId: string, groupType: string) => void;
    onToggle: () => void;
    onRemove: () => void;
    onAddTask: () => void;
    onRemoveTask: (taskId: string) => void;
    onUpdateTask: (taskId: string, updates: Partial<BatchTask>) => void;
    onToggleTask: (taskId: string) => void;
    onReorderTasks: (newTaskIds: string[]) => void;
    isSubmitting: boolean;
}

function GroupSection({
    group, allStaff, availableRooms, taskRoomGroups,
    onRoomGroupChange, onToggle, onRemove, onAddTask,
    onRemoveTask, onUpdateTask, onToggleTask, onReorderTasks, isSubmitting,
}: GroupSectionProps) {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const ids = group.tasks.map(t => t.id);
        const oldIndex = ids.indexOf(active.id as string);
        const newIndex = ids.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return;
        onReorderTasks(arrayMove(ids, oldIndex, newIndex));
    };
    const staffName = group.staffId === 'unassigned'
        ? 'Nieprzypisane'
        : allStaff.find(s => s.id === group.staffId)?.name ?? group.staffId;

    const taskCount = group.tasks.length;
    const successCount = group.tasks.filter(t => t.status === 'success').length;

    return (
        <div className="border rounded-lg">
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30"
                onClick={onToggle}
            >
                <div className="flex items-center gap-2">
                    {group.expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{staffName}</span>
                    <span className="text-xs text-muted-foreground">
                        {taskCount === 0 ? 'brak zadań' : `${successCount}/${taskCount} zadań`}
                    </span>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={e => { e.stopPropagation(); onRemove(); }}
                    disabled={isSubmitting}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            {group.expanded && (
                <div className="px-4 pb-4 space-y-2 border-t pt-3">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={group.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                                {group.tasks.map(task => (
                                    <SortableTaskRowWrapper
                                        key={task.id}
                                        task={task}
                                        groupId={group.id}
                                        availableRooms={availableRooms}
                                        roomGroupType={taskRoomGroups[task.id] ?? ''}
                                        onRoomGroupChange={gt => onRoomGroupChange(task.id, gt)}
                                        onUpdate={updates => onUpdateTask(task.id, updates)}
                                        onRemove={() => onRemoveTask(task.id)}
                                        onToggle={() => onToggleTask(task.id)}
                                        isSubmitting={isSubmitting}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full mt-1"
                        onClick={onAddTask}
                        disabled={isSubmitting}
                    >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj zadanie
                    </Button>
                </div>
            )}
        </div>
    );
}

// ─── Main wizard ─────────────────────────────────────────────────────────────

interface BatchTaskWizardProps {
    availableRooms: Room[];
    allStaff: Staff[];
    onSubmit: (task: NewTaskState) => Promise<boolean>;
    isSubmitting: boolean;
}

export function BatchTaskWizard({ availableRooms, allStaff, onSubmit, isSubmitting }: BatchTaskWizardProps) {
    const [open, setOpen] = useState(false);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [taskRoomGroups, setTaskRoomGroups] = useState<Record<string, string>>({});
    const { toast } = useToast();

    const wizard = useBatchTaskWizard({ allStaff, onSubmit });

    const handleClose = () => {
        setOpen(false);
        setTaskRoomGroups({});
        wizard.reset();
    };

    const handleAddGroup = (staffId: string) => {
        wizard.addGroup(staffId);
    };

    const handleRoomGroupChange = (taskId: string, groupType: string) => {
        setTaskRoomGroups(prev => ({ ...prev, [taskId]: groupType }));
    };

    const handleSubmit = async () => {
        const result = await wizard.submit();
        if (result.failed === 0 && result.succeeded > 0) {
            handleClose();
            toast({
                description: `${result.succeeded} ${result.succeeded === 1 ? 'zadanie zostało dodane' : result.succeeded < 5 ? 'zadania zostały dodane' : 'zadań zostało dodanych'}.`,
            });
        }
    };

    const allDone = wizard.groups.length > 0 &&
        wizard.groups.every(g => g.tasks.length === 0 || g.tasks.every(t => t.status === 'success'));

    const availableForNewGroup = wizard.availableStaff.filter(s => s.role === 'housekeeping');
    const canAddUnassigned = !wizard.groups.some(g => g.staffId === 'unassigned');

    return (
        <>
            <Button onClick={() => setOpen(true)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Dodaj zadania
            </Button>

            <Dialog open={open} onOpenChange={open => { if (!open) handleClose(); else setOpen(true); }}>
                <DialogContent
                    className="sm:max-w-2xl max-h-[90vh] flex flex-col"
                    onInteractOutside={e => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Dodaj zadania</DialogTitle>
                    </DialogHeader>

                    <div className="flex-grow overflow-y-auto space-y-4 px-2 py-2 pr-3">
                        {/* Date */}
                        <div className="space-y-1">
                            <Label>Data*</Label>
                            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn("w-full justify-start text-left font-normal", !wizard.date && "text-muted-foreground")}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {wizard.date ? format(new Date(wizard.date + 'T00:00:00'), 'PPP', { locale: pl }) : 'Wybierz datę'}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={wizard.date ? new Date(wizard.date + 'T00:00:00') : undefined}
                                        onSelect={date => {
                                            if (date) { wizard.setDate(format(date, 'yyyy-MM-dd')); }
                                            setDatePickerOpen(false);
                                        }}
                                        locale={pl}
                                        disabled={date => date < new Date(new Date().toDateString())}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Groups */}
                        <div className="space-y-2">
                            {wizard.groups.map(group => (
                                <GroupSection
                                    key={group.id}
                                    group={group}
                                    allStaff={allStaff}
                                    availableRooms={availableRooms}
                                    taskRoomGroups={taskRoomGroups}
                                    onRoomGroupChange={handleRoomGroupChange}
                                    onToggle={() => wizard.toggleGroupExpanded(group.id)}
                                    onRemove={() => wizard.removeGroup(group.id)}
                                    onAddTask={() => wizard.addTask(group.id)}
                                    onRemoveTask={taskId => wizard.removeTask(group.id, taskId)}
                                    onUpdateTask={(taskId, updates) => wizard.updateTask(group.id, taskId, updates)}
                                    onToggleTask={taskId => wizard.toggleTaskExpanded(group.id, taskId)}
                                    onReorderTasks={newTaskIds => wizard.reorderTasks(group.id, newTaskIds)}
                                    isSubmitting={isSubmitting}
                                />
                            ))}
                        </div>

                        {/* Add group — selecting a person immediately creates the group */}
                        {(availableForNewGroup.length > 0 || canAddUnassigned) && (
                            <div className="space-y-1">
                                <Label className="text-sm text-muted-foreground">
                                    {wizard.groups.length === 0 ? 'Wybierz osobę, aby zacząć' : 'Dodaj kolejną osobę'}
                                </Label>
                                <Select value="" onValueChange={handleAddGroup} disabled={isSubmitting || !wizard.date}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder={wizard.date ? 'Wybierz osobę...' : 'Najpierw wybierz datę'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {canAddUnassigned && (
                                            <SelectItem value="unassigned">Nieprzypisane</SelectItem>
                                        )}
                                        {availableForNewGroup.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {!wizard.date && (
                                    <p className="text-xs text-muted-foreground">Wybierz datę, aby odblokować wybór osoby.</p>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-2">
                        <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                            {allDone ? 'Zamknij' : 'Anuluj'}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!wizard.canSubmit || !wizard.date || isSubmitting || allDone}
                        >
                            {isSubmitting ? 'Tworzenie...' : 'Utwórz zadania'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
