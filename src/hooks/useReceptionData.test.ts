import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReceptionData } from './useReceptionData';

// Mutable state the mock reads from – update per test to control return values
const mockData = {
  scope: 'upcoming' as 'upcoming' | 'archive',
  upcomingTasks: [] as any[],
  archiveTasks: [] as any[],
};

vi.mock('@/integrations/supabase/client', () => {
  const makeChain = (table: string) => {
    let isHead = false;
    const chain: any = {
      select(_: any, opts?: { count?: string; head?: boolean }) {
        if (opts?.head) isHead = true;
        return chain;
      },
      order: () => chain,
      eq:    () => chain,
      gte:   () => chain,
      lt:    () => chain,
      lte:   () => chain,
      in:    () => chain,
      is:    () => chain,
      range: () => chain,
      not:   () => chain,
      then(resolve: any, reject?: any) {
        if (isHead) return Promise.resolve({ count: 0, error: null }).then(resolve, reject);
        if (table === 'tasks') {
          const data = mockData.scope === 'archive'
            ? mockData.archiveTasks
            : mockData.upcomingTasks;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    };
    return chain;
  };

  const channelMock = () => ({
    on:        vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  });

  return {
    supabase: {
      from:          (table: string) => makeChain(table),
      channel:       vi.fn(channelMock),
      removeChannel: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

beforeEach(() => {
  mockData.scope = 'upcoming';
  mockData.upcomingTasks = [];
  mockData.archiveTasks = [];
});

const upcomingTask = { id: '1', date: '2099-12-31', status: 'todo', room: { id: 'r1', name: '101', group_type: 'P1', color: null }, user: null, cleaning_type: 'W', guest_count: 'a', time_limit: null, actual_time: null, difference: null, issue_flag: false, housekeeping_notes: null, reception_notes: null, start_time: null, stop_time: null, issue_description: null, issue_photo: null, pause_start: null, pause_stop: null, total_pause: null, created_at: '2026-01-01' };
const archiveTask  = { ...upcomingTask, id: '2', date: '2020-01-01' };

describe('cachedUpcomingTasks', () => {
  it('is populated after an upcoming-scope fetch', async () => {
    mockData.upcomingTasks = [upcomingTask];
    const { result } = renderHook(() => useReceptionData());

    await waitFor(() => {
      expect(result.current.cachedUpcomingTasks).toHaveLength(1);
    });
    expect(result.current.cachedUpcomingTasks[0].id).toBe('1');
  });

  it('is not overwritten when scope switches to archive', async () => {
    mockData.upcomingTasks = [upcomingTask];
    const { result } = renderHook(() => useReceptionData());

    await waitFor(() => expect(result.current.cachedUpcomingTasks).toHaveLength(1));

    // Switch to archive scope
    act(() => {
      mockData.scope = 'archive';
      mockData.archiveTasks = [archiveTask];
      result.current.filterSetters.setTaskFetchScope('archive');
    });

    await waitFor(() => expect(result.current.tasks).toEqual([archiveTask]));

    // Cache must still reflect the previous upcoming fetch
    expect(result.current.cachedUpcomingTasks).toEqual([upcomingTask]);
  });

  it('updates when scope switches back to upcoming', async () => {
    mockData.upcomingTasks = [upcomingTask];
    const { result } = renderHook(() => useReceptionData());
    await waitFor(() => expect(result.current.cachedUpcomingTasks).toHaveLength(1));

    // Go to archive
    act(() => {
      mockData.scope = 'archive';
      mockData.archiveTasks = [archiveTask];
      result.current.filterSetters.setTaskFetchScope('archive');
    });
    await waitFor(() => expect(result.current.tasks).toEqual([archiveTask]));

    // Come back with fresh upcoming data
    const freshTask = { ...upcomingTask, id: '3' };
    act(() => {
      mockData.scope = 'upcoming';
      mockData.upcomingTasks = [freshTask];
      result.current.filterSetters.setTaskFetchScope('upcoming');
    });

    await waitFor(() => {
      expect(result.current.cachedUpcomingTasks).toEqual([freshTask]);
    });
  });
});
