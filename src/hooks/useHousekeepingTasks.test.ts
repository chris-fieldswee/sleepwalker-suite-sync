import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Response = { data: any[] | null; error: any };

// Each call to the tasks query takes the next queued response. A queued entry may be
// a plain response or a promise, which lets a test control the order responses arrive in.
const mock = {
  queue: [] as Array<Response | Promise<Response>>,
  calls: 0,
};

vi.mock('@/integrations/supabase/client', () => {
  const makeChain = () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      range: () => {
        mock.calls++;
        const next = mock.queue.shift() ?? { data: [], error: null };
        return Promise.resolve(next);
      },
    };
    return chain;
  };

  const channelMock = () => {
    const channel: any = {
      on: vi.fn(() => channel),
      subscribe: vi.fn(() => channel),
    };
    return channel;
  };

  return {
    supabase: {
      from: () => makeChain(),
      channel: vi.fn(channelMock),
      removeChannel: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ userId: 'user-1', userRole: 'housekeeping' }),
}));

const toast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}));

import { useHousekeepingTasks } from './useHousekeepingTasks';

const task = (id: string, name: string, status = 'todo') => ({
  id,
  date: '2026-11-13',
  status,
  created_at: '2026-11-12T18:00:00Z',
  room: { id: `room-${id}`, name, group_type: 'OTHER', color: null },
  user: { id: 'user-1', name: 'Test' },
});

const ok = (rows: any[]): Response => ({ data: rows, error: null });

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
};

describe('useHousekeepingTasks', () => {
  beforeEach(() => {
    mock.queue = [];
    mock.calls = 0;
    toast.mockClear();
    setVisibility('visible');
  });

  afterEach(() => {
    setVisibility('visible');
  });

  it('loads tasks and records when the list was last updated', async () => {
    mock.queue.push(ok([task('t1', 'Parter + winda')]));

    const { result } = renderHook(() => useHousekeepingTasks());

    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    expect(result.current.tasks[0].room.name).toBe('Parter + winda');
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
    expect(result.current.loading).toBe(false);
  });

  it('re-fetches when the app comes back to the foreground', async () => {
    mock.queue.push(ok([task('t1', 'Old name')]));
    const { result } = renderHook(() => useHousekeepingTasks());
    await waitFor(() => expect(result.current.tasks[0]?.room.name).toBe('Old name'));

    mock.queue.push(ok([task('t1', 'Parter + winda')]));
    await act(async () => {
      setVisibility('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(result.current.tasks[0].room.name).toBe('Parter + winda'));
  });

  it('does not re-fetch when the app goes to the background', async () => {
    mock.queue.push(ok([task('t1', 'Parter + winda')]));
    const { result } = renderHook(() => useHousekeepingTasks());
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));
    const callsBefore = mock.calls;

    await act(async () => {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mock.calls).toBe(callsBefore);
  });

  it('re-fetches when the connection comes back', async () => {
    mock.queue.push(ok([task('t1', 'Old name')]));
    const { result } = renderHook(() => useHousekeepingTasks());
    await waitFor(() => expect(result.current.tasks[0]?.room.name).toBe('Old name'));

    mock.queue.push(ok([task('t1', 'Parter + winda')]));
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.tasks[0].room.name).toBe('Parter + winda'));
  });

  it('clears the list when the server returns no tasks', async () => {
    mock.queue.push(ok([task('t1', 'Parter + winda')]));
    const { result } = renderHook(() => useHousekeepingTasks());
    await waitFor(() => expect(result.current.tasks).toHaveLength(1));

    mock.queue.push(ok([]));
    await act(async () => {
      await result.current.fetchTasks();
    });

    expect(result.current.tasks).toHaveLength(0);
  });

  it('ignores an older response that arrives after a newer one', async () => {
    mock.queue.push(ok([task('t1', 'Initial')]));
    const { result } = renderHook(() => useHousekeepingTasks());
    await waitFor(() => expect(result.current.tasks[0]?.room.name).toBe('Initial'));

    let resolveSlow!: (r: Response) => void;
    const slow = new Promise<Response>((resolve) => { resolveSlow = resolve; });
    mock.queue.push(slow);
    mock.queue.push(ok([task('t1', 'Newest')]));

    let slowFetch!: Promise<void>;
    await act(async () => {
      slowFetch = result.current.fetchTasks(); // older request, still in flight
      await result.current.fetchTasks();       // newer request, resolves first
    });
    expect(result.current.tasks[0].room.name).toBe('Newest');

    await act(async () => {
      resolveSlow(ok([task('t1', 'Stale')]));
      await slowFetch;
    });

    expect(result.current.tasks[0].room.name).toBe('Newest');
  });

  it('keeps the current list and does not advance lastUpdated when a fetch fails', async () => {
    mock.queue.push(ok([task('t1', 'Parter + winda')]));
    const { result } = renderHook(() => useHousekeepingTasks());
    await waitFor(() => expect(result.current.lastUpdated).not.toBeNull());
    const updatedBefore = result.current.lastUpdated;

    mock.queue.push({ data: null, error: { message: 'Failed to fetch' } });
    await act(async () => {
      await result.current.fetchTasks();
    });

    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.lastUpdated).toBe(updatedBefore);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });
});
