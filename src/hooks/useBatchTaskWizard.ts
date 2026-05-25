import { useState, useMemo } from 'react';
import type { Staff } from './useReceptionData';
import type { NewTaskState } from './useReceptionActions';

export type BatchTaskStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface BatchTask {
  id: string;
  roomId: string;
  cleaningType: string;
  capacityId: string;
  notes: string;
  expanded: boolean;
  status: BatchTaskStatus;
  errorMessage?: string;
}

export interface AssignmentGroup {
  id: string;
  staffId: string | 'unassigned';
  expanded: boolean;
  tasks: BatchTask[];
}

interface UseBatchTaskWizardParams {
  allStaff: Staff[];
  onSubmit: (task: NewTaskState) => Promise<boolean>;
}

function uuid(): string {
  return Math.random().toString(36).slice(2);
}

export function useBatchTaskWizard({ allStaff, onSubmit }: UseBatchTaskWizardParams) {
  const [date, setDate] = useState('');
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);

  const reset = () => {
    setDate('');
    setGroups([]);
  };

  const availableStaff = useMemo(() => {
    const assignedIds = new Set(groups.map(g => g.staffId));
    return allStaff.filter(s => !assignedIds.has(s.id));
  }, [allStaff, groups]);

  const addGroup = (staffId: string | 'unassigned') => {
    setGroups(prev => [...prev, { id: uuid(), staffId, expanded: true, tasks: [] }]);
  };

  const removeGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const addTask = (groupId: string) => {
    setGroups(prev => prev.map(g =>
      g.id !== groupId ? g : {
        ...g,
        tasks: [...g.tasks, {
          id: uuid(),
          roomId: '',
          cleaningType: 'W',
          capacityId: 'd',
          notes: '',
          expanded: true,
          status: 'idle',
        }],
      }
    ));
  };

  const removeTask = (groupId: string, taskId: string) => {
    setGroups(prev => prev.map(g =>
      g.id !== groupId ? g : { ...g, tasks: g.tasks.filter(t => t.id !== taskId) }
    ));
  };

  const updateTask = (groupId: string, taskId: string, updates: Partial<BatchTask>) => {
    setGroups(prev => prev.map(g =>
      g.id !== groupId ? g : {
        ...g,
        tasks: g.tasks.map(t => t.id !== taskId ? t : { ...t, ...updates }),
      }
    ));
  };

  const toggleGroupExpanded = (groupId: string) => {
    setGroups(prev => prev.map(g =>
      g.id !== groupId ? g : { ...g, expanded: !g.expanded }
    ));
  };

  const toggleTaskExpanded = (groupId: string, taskId: string) => {
    setGroups(prev => prev.map(g =>
      g.id !== groupId ? g : {
        ...g,
        tasks: g.tasks.map(t => t.id !== taskId ? t : { ...t, expanded: !t.expanded }),
      }
    ));
  };

  const allTasks = groups.flatMap(g => g.tasks);
  const canSubmit =
    allTasks.length > 0 &&
    allTasks.every(t => t.roomId !== '' && t.status !== 'submitting');

  const submit = async () => {
    for (const group of groups) {
      for (const task of group.tasks) {
        if (task.status === 'success' || !task.roomId) continue;

        setGroups(prev => prev.map(g =>
          g.id !== group.id ? g : {
            ...g,
            tasks: g.tasks.map(t => t.id !== task.id ? t : { ...t, status: 'submitting' }),
          }
        ));

        const newTaskState: NewTaskState = {
          roomId: task.roomId,
          cleaningType: task.cleaningType as any,
          capacityId: task.capacityId,
          staffId: group.staffId === 'unassigned' ? 'unassigned' : group.staffId,
          notes: task.notes,
          date,
        };

        const succeeded = await onSubmit(newTaskState);

        setGroups(prev => prev.map(g =>
          g.id !== group.id ? g : {
            ...g,
            tasks: g.tasks.map(t =>
              t.id !== task.id ? t : { ...t, status: succeeded ? 'success' : 'error' }
            ),
          }
        ));
      }
    }
  };

  return {
    date,
    setDate,
    groups,
    availableStaff,
    addGroup,
    removeGroup,
    addTask,
    removeTask,
    updateTask,
    toggleGroupExpanded,
    toggleTaskExpanded,
    canSubmit,
    submit,
    reset,
  };
}
