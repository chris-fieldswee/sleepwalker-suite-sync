import { render, screen, fireEvent } from '@testing-library/react';
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

    expect(screen.queryByRole('option', { name: 'Gotowe' })).not.toBeInTheDocument();
  });

  it('status dropdown is available in edit mode for a today task', async () => {
    mockUseAuth.mockReturnValue({ userRole: 'admin' });
    renderDialog(todayTask);

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByRole('option', { name: 'Gotowe' })).toBeInTheDocument();
  });

  it('status resets to todo when date is changed to a future date', async () => {
    mockUseAuth.mockReturnValue({ userRole: 'admin' });
    renderDialog(todayInProgressTask);

    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    fireEvent.change(screen.getByDisplayValue(todayDate), { target: { value: futureDate } });

    expect(screen.queryByText('W trakcie')).not.toBeInTheDocument();
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
