import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Table, TableBody } from '@/components/ui/table';
import { TaskTableRow } from './TaskTableRow';

const baseTask = {
  id: 'task-1',
  date: '2026-08-15',
  status: 'todo',
  room: { name: '101', group_type: 'P1' },
  user: null,
  cleaning_type: 'W',
  guest_count: 'a',
  time_limit: 30,
  actual_time: null,
  difference: null,
  issue_flag: false,
  ready_to_clean: false,
  housekeeping_notes: null,
  reception_notes: null,
  start_time: null,
  stop_time: null,
};

const renderRow = (task: Partial<typeof baseTask>, props: Record<string, unknown> = {}) =>
  render(
    <TooltipProvider>
      <Table>
        <TableBody>
          <TaskTableRow
            task={{ ...baseTask, ...task } as any}
            staff={[]}
            onViewDetails={vi.fn()}
            onDeleteTask={vi.fn()}
            isDeleting={false}
            {...props}
          />
        </TableBody>
      </Table>
    </TooltipProvider>
  );

beforeEach(() => vi.clearAllMocks());

describe('room free switch', () => {
  it('is off by default', () => {
    renderRow({}, { onToggleReadyToClean: vi.fn() });
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('is on when the task is flagged', () => {
    renderRow({ ready_to_clean: true }, { onToggleReadyToClean: vi.fn() });
    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('turning it on reports true for that task', async () => {
    const onToggle = vi.fn().mockResolvedValue(true);
    renderRow({}, { onToggleReadyToClean: onToggle });

    await userEvent.click(screen.getByRole('switch'));

    expect(onToggle).toHaveBeenCalledWith('task-1', true);
  });

  it('turning it off reports false for that task', async () => {
    const onToggle = vi.fn().mockResolvedValue(true);
    renderRow({ ready_to_clean: true }, { onToggleReadyToClean: onToggle });

    await userEvent.click(screen.getByRole('switch'));

    expect(onToggle).toHaveBeenCalledWith('task-1', false);
  });

  it('is disabled for a completed task', () => {
    renderRow({ status: 'done' }, { onToggleReadyToClean: vi.fn() });
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('is disabled while a toggle is in flight', () => {
    renderRow({}, { onToggleReadyToClean: vi.fn(), isTogglingReadyToClean: true });
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('renders no switch when no handler is supplied', () => {
    renderRow({});
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});

describe('room indicator', () => {
  it('is shown for a task awaiting cleaning', () => {
    renderRow({ status: 'todo' });
    expect(screen.getByTestId('room-indicator')).toBeInTheDocument();
  });

  it('is red while the room is not free', () => {
    renderRow({ status: 'todo', ready_to_clean: false });
    expect(screen.getByTestId('room-indicator').className).toContain('bg-red-500');
  });

  it('is green once the room is free', () => {
    renderRow({ status: 'todo', ready_to_clean: true });
    expect(screen.getByTestId('room-indicator').className).toContain('bg-emerald-500');
  });

  it.each(['in_progress', 'paused', 'done', 'repair_needed'])(
    'is hidden for status %s',
    (status) => {
      renderRow({ status });
      expect(screen.queryByTestId('room-indicator')).not.toBeInTheDocument();
    }
  );
});
