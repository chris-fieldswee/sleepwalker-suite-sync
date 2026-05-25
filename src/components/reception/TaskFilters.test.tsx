import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskFilters } from './TaskFilters';
import type { RoomGroupOption } from './TaskFilters';

// Render Radix Select as plain DOM so items are always visible without opening a portal.
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value} onChange={(e: any) => onValueChange?.(e.target.value)}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => <button role="combobox" {...props}>{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div role="option" data-value={value}>{children}</div>,
  SelectGroup: ({ children }: any) => <div>{children}</div>,
  SelectLabel: ({ children }: any) => <span>{children}</span>,
  SelectSeparator: () => <hr />,
}));

const roomGroups: RoomGroupOption[] = [{ value: 'all', label: 'Wszystkie grupy' }];

const defaultProps = {
  date: null,
  status: 'all' as const,
  staffId: 'all',
  roomGroup: 'all' as const,
  roomId: 'all',
  staff: [],
  availableRooms: [],
  roomGroups,
  onDateChange: vi.fn(),
  onStatusChange: vi.fn(),
  onStaffChange: vi.fn(),
  onRoomGroupChange: vi.fn(),
  onRoomChange: vi.fn(),
  onClearFilters: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());

describe('lockedDate', () => {
  it('shows the locked date text on the date button', () => {
    render(<TaskFilters {...defaultProps} lockedDate="2026-05-25" />);
    expect(screen.getByText(/25 maja 2026/i)).toBeInTheDocument();
  });

  it('renders the date button as disabled', () => {
    render(<TaskFilters {...defaultProps} lockedDate="2026-05-25" />);
    expect(screen.getByRole('button', { name: /25 maja 2026/i })).toBeDisabled();
  });

  it('does not call onDateChange when clear-filters is clicked', async () => {
    render(<TaskFilters {...defaultProps} lockedDate="2026-05-25" />);
    await userEvent.click(screen.getByRole('button', { name: /wyczyść/i }));
    expect(defaultProps.onDateChange).not.toHaveBeenCalled();
    expect(defaultProps.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('renders the date button as enabled when lockedDate is not set', () => {
    render(<TaskFilters {...defaultProps} />);
    expect(screen.getByRole('button', { name: /wybierz datę/i })).not.toBeDisabled();
  });
});

describe('showDoneStatus', () => {
  it('includes Gotowe as a status option when showDoneStatus is true', () => {
    render(<TaskFilters {...defaultProps} showDoneStatus={true} />);
    expect(screen.getByRole('option', { name: 'Gotowe' })).toBeInTheDocument();
  });

  it('does not include Gotowe as a status option by default', () => {
    render(<TaskFilters {...defaultProps} />);
    expect(screen.queryByRole('option', { name: 'Gotowe' })).not.toBeInTheDocument();
  });
});
