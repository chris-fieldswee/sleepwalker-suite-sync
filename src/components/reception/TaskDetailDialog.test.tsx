import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskDetailDialog } from './TaskDetailDialog';
import type { Staff } from '@/hooks/useReceptionData';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogClose: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children, id, ...props }: any) => <button role="combobox" id={id} {...props}>{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div role="option" data-value={value}>{children}</div>,
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/capacity-utils', () => ({
  renderCapacityIconPattern: (label: string) => label,
  LABEL_TO_CAPACITY_ID: {},
  CAPACITY_ID_TO_LABEL: {},
  normalizeCapacityLabel: (label: string) => label,
}));

vi.mock('./ActualTimeDialog', () => ({
  ActualTimeDialog: () => null,
}));

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const housekeeper: Staff = { id: 'h1', name: 'Anna Kowalska', role: 'housekeeping' };

const baseTask = {
  id: 'task-1',
  date: '2026-05-25',
  room: { id: 'room-1', name: '101', group_type: 'P2', color: null },
  user: { id: 'h1', name: 'Anna Kowalska' },
  cleaning_type: 'W' as const,
  guest_count: 'd',
  time_limit: 30,
  actual_time: 45,
  difference: 15,
  issue_flag: false,
  issue_description: null,
  issue_photo: null,
  housekeeping_notes: null,
  reception_notes: null,
  start_time: null,
  stop_time: null,
  pause_start: null,
  pause_stop: null,
  total_pause: null,
};

const todayDate = new Date().toISOString().split('T')[0];
const futureDate = '2099-12-31';

const doneTask = { ...baseTask, status: 'done' };
const openTask = { ...baseTask, status: 'open', actual_time: null };
const futureTask = { ...baseTask, date: futureDate, status: 'todo', actual_time: null };
const todayTask = { ...baseTask, date: todayDate, status: 'todo', actual_time: null };
const todayInProgressTask = { ...baseTask, date: todayDate, status: 'in_progress', actual_time: null };

function renderDialog(task: typeof doneTask) {
  render(
    <TaskDetailDialog
      task={task}
      allStaff={[housekeeper]}
      availableRooms={[]}
      isOpen={true}
      onOpenChange={vi.fn()}
      onUpdate={vi.fn().mockResolvedValue(true)}
      isUpdating={false}
    />
  );
}

beforeEach(() => vi.clearAllMocks());

describe('TaskDetailDialog future task status lock', () => {
  it('status options are absent in edit mode for a future task', async () => {
    mockUseAuth.mockReturnValue({ userRole: 'admin' });
    renderDialog(futureTask);

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.queryByRole('option', { name: 'Skończone' })).not.toBeInTheDocument();
  });

  it('status dropdown is available in edit mode for a today task', async () => {
    mockUseAuth.mockReturnValue({ userRole: 'admin' });
    renderDialog(todayTask);

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByRole('option', { name: 'Skończone' })).toBeInTheDocument();
  });

  it('status resets to todo when date is changed to a future date', async () => {
    mockUseAuth.mockReturnValue({ userRole: 'admin' });
    renderDialog(todayInProgressTask);

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    fireEvent.change(screen.getByDisplayValue(todayDate), { target: { value: futureDate } });

    expect(screen.queryByText('W trakcie')).not.toBeInTheDocument();
  });
});

describe('TaskDetailDialog OTHER-location capacity validation', () => {
  // OTHER locations (e.g. "Parter + winda") do not track capacity. Their tasks are
  // stored with the legacy capacity_id 'other' (the value parseCapacityConfigurations
  // and the Zod schema both treat as canonical for OTHER rooms). Editing such a task —
  // e.g. just changing the reception notes — must not fail with "Nieprawidłowa pojemność".
  const otherRoom = {
    id: 'room-other',
    name: 'Parter + winda',
    group_type: 'OTHER',
    color: null,
    capacity_configurations: [
      { capacity: 0, capacity_id: 'other', capacity_label: 'N/A', cleaning_types: [{ type: 'S', time_limit: 10 }] },
    ],
  } as never;

  const otherTask = {
    ...baseTask,
    date: todayDate,
    status: 'todo',
    actual_time: null,
    cleaning_type: 'S' as const,
    guest_count: 'other',
    reception_notes: null,
    room: { id: 'room-other', name: 'Parter + winda', group_type: 'OTHER', color: null },
  };

  it('saves an OTHER-location task with legacy guest_count "other" after editing notes', async () => {
    mockUseAuth.mockReturnValue({ userRole: 'admin' });
    const onUpdate = vi.fn().mockResolvedValue(true);

    render(
      <TaskDetailDialog
        task={otherTask}
        allStaff={[housekeeper]}
        availableRooms={[otherRoom]}
        isOpen={true}
        onOpenChange={vi.fn()}
        onUpdate={onUpdate}
        isUpdating={false}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    await userEvent.type(screen.getByPlaceholderText('Optional notes...'), 'Posprzatac podloge');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate.mock.calls[0][1]).toMatchObject({ notes: 'Posprzatac podloge' });
  });
});

describe('TaskDetailDialog actual-time gate', () => {
  it('actual time input is enabled for admin when task is done', async () => {
    mockUseAuth.mockReturnValue({ userRole: 'admin' });
    renderDialog(doneTask);

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    const input = screen.getByDisplayValue('45');
    expect(input).not.toBeDisabled();
  });

  it('shows hint and disables actual time input for admin when task is not done', async () => {
    mockUseAuth.mockReturnValue({ userRole: 'admin' });
    renderDialog(openTask);

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByText(/zamknij zadanie, aby edytować/i)).toBeInTheDocument();
  });
});
