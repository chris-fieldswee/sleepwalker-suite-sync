import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddTaskDialog } from './AddTaskDialog';
import type { NewTaskState } from '@/hooks/useReceptionActions';
import type { Staff } from '@/hooks/useReceptionData';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
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

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => <div data-testid="calendar" />,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }),
    }),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const housekeeper1: Staff = { id: 'h1', name: 'Anna Kowalska', role: 'housekeeping' };
const housekeeper2: Staff = { id: 'h2', name: 'Maria Nowak', role: 'housekeeping' };
const adminStaff: Staff = { id: 'a1', name: 'Jan Admin', role: 'admin' };

const initialState: NewTaskState = {
  roomId: '',
  cleaningType: 'W',
  capacityId: 'd',
  staffId: '',
  notes: '',
  date: '',
};

function renderDialog(allStaff: Staff[]) {
  render(
    <AddTaskDialog
      availableRooms={[]}
      allStaff={allStaff}
      initialState={initialState}
      onSubmit={vi.fn().mockResolvedValue(true)}
      isSubmitting={false}
    />
  );
}

beforeEach(() => vi.clearAllMocks());

describe('AddTaskDialog staff dropdown', () => {
  it('shows all housekeeping staff as options', () => {
    renderDialog([housekeeper1, housekeeper2, adminStaff]);
    expect(screen.getByRole('option', { name: housekeeper1.name })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: housekeeper2.name })).toBeInTheDocument();
  });

  it('excludes non-housekeeping roles', () => {
    renderDialog([housekeeper1, adminStaff]);
    expect(screen.getByRole('option', { name: housekeeper1.name })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: adminStaff.name })).not.toBeInTheDocument();
  });
});
