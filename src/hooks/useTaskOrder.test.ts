import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTaskOrder } from './useTaskOrder';

const { mockEq, mockUpdate } = vi.hoisted(() => {
  const mockEq = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn(() => ({ eq: mockEq }));
  return { mockEq, mockUpdate };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({ update: mockUpdate })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockEq.mockResolvedValue({ error: null });
  mockUpdate.mockImplementation(() => ({ eq: mockEq }));
});

describe('useTaskOrder', () => {
  it('reorder assigns sequential display_order values starting at 1', async () => {
    const { result } = renderHook(() => useTaskOrder());

    await act(async () => {
      await result.current.reorder(['id-a', 'id-b', 'id-c']);
    });

    expect(mockUpdate).toHaveBeenCalledTimes(3);
    expect(mockUpdate).toHaveBeenNthCalledWith(1, { display_order: 1 });
    expect(mockUpdate).toHaveBeenNthCalledWith(2, { display_order: 2 });
    expect(mockUpdate).toHaveBeenNthCalledWith(3, { display_order: 3 });
    expect(mockEq).toHaveBeenNthCalledWith(1, 'id', 'id-a');
    expect(mockEq).toHaveBeenNthCalledWith(2, 'id', 'id-b');
    expect(mockEq).toHaveBeenNthCalledWith(3, 'id', 'id-c');
  });

  it('reorder with a single task sets display_order to 1', async () => {
    const { result } = renderHook(() => useTaskOrder());

    await act(async () => {
      await result.current.reorder(['only-task']);
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ display_order: 1 });
    expect(mockEq).toHaveBeenCalledWith('id', 'only-task');
  });
});
