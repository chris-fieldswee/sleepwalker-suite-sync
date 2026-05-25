import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBatchTaskWizard } from './useBatchTaskWizard';
import type { Staff } from './useReceptionData';

const anna: Staff = { id: 'h1', name: 'Anna Kowalska', role: 'housekeeping' };
const maria: Staff = { id: 'h2', name: 'Maria Nowak', role: 'housekeeping' };
const allStaff = [anna, maria];

const onSubmit = vi.fn().mockResolvedValue(true);

beforeEach(() => vi.clearAllMocks());

describe('useBatchTaskWizard', () => {
  it('adding a group removes that staff member from availableStaff', () => {
    const { result } = renderHook(() => useBatchTaskWizard({ allStaff, onSubmit }));

    act(() => { result.current.addGroup(anna.id); });

    expect(result.current.availableStaff.map(s => s.id)).not.toContain(anna.id);
    expect(result.current.availableStaff.map(s => s.id)).toContain(maria.id);
  });

  it('removing a group returns that staff member to availableStaff', () => {
    const { result } = renderHook(() => useBatchTaskWizard({ allStaff, onSubmit }));

    act(() => { result.current.addGroup(anna.id); });
    const groupId = result.current.groups[0].id;
    act(() => { result.current.removeGroup(groupId); });

    expect(result.current.availableStaff.map(s => s.id)).toContain(anna.id);
  });

  it('adding a task initialises it expanded with idle status', () => {
    const { result } = renderHook(() => useBatchTaskWizard({ allStaff, onSubmit }));

    act(() => { result.current.addGroup(anna.id); });
    const groupId = result.current.groups[0].id;
    act(() => { result.current.addTask(groupId); });

    const task = result.current.groups[0].tasks[0];
    expect(task.expanded).toBe(true);
    expect(task.status).toBe('idle');
  });

  it('canSubmit is false when a task has no room selected', () => {
    const { result } = renderHook(() => useBatchTaskWizard({ allStaff, onSubmit }));

    act(() => { result.current.addGroup(anna.id); });
    const groupId = result.current.groups[0].id;
    act(() => { result.current.addTask(groupId); }); // roomId defaults to ''

    expect(result.current.canSubmit).toBe(false);
  });

  it('canSubmit is true and submit calls onSubmit when all tasks have a room', async () => {
    const { result } = renderHook(() => useBatchTaskWizard({ allStaff, onSubmit }));

    act(() => { result.current.addGroup(anna.id); });
    const groupId = result.current.groups[0].id;
    act(() => { result.current.addTask(groupId); });
    const taskId = result.current.groups[0].tasks[0].id;
    act(() => { result.current.updateTask(groupId, taskId, { roomId: 'room-1' }); });

    expect(result.current.canSubmit).toBe(true);

    await act(async () => { await result.current.submit(); });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'room-1', staffId: anna.id }));
  });

  it('empty groups are skipped during submit', async () => {
    const { result } = renderHook(() => useBatchTaskWizard({ allStaff, onSubmit }));

    // Anna gets a complete task; Maria gets an empty group (no tasks)
    act(() => { result.current.addGroup(anna.id); });
    act(() => { result.current.addGroup(maria.id); });
    const annaGroupId = result.current.groups[0].id;
    act(() => { result.current.addTask(annaGroupId); });
    const taskId = result.current.groups[0].tasks[0].id;
    act(() => { result.current.updateTask(annaGroupId, taskId, { roomId: 'room-1' }); });

    await act(async () => { await result.current.submit(); });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('successful tasks get status success and failed tasks get status error after submit', async () => {
    onSubmit
      .mockResolvedValueOnce(true)   // first task succeeds
      .mockResolvedValueOnce(false); // second task fails

    const { result } = renderHook(() => useBatchTaskWizard({ allStaff, onSubmit }));

    act(() => { result.current.addGroup(anna.id); });
    const groupId = result.current.groups[0].id;
    act(() => { result.current.addTask(groupId); });
    act(() => { result.current.addTask(groupId); });
    const [task1Id, task2Id] = result.current.groups[0].tasks.map(t => t.id);
    act(() => {
      result.current.updateTask(groupId, task1Id, { roomId: 'room-1' });
      result.current.updateTask(groupId, task2Id, { roomId: 'room-2' });
    });

    await act(async () => { await result.current.submit(); });

    const tasks = result.current.groups[0].tasks;
    expect(tasks[0].status).toBe('success');
    expect(tasks[1].status).toBe('error');
  });

  it('second submit only retries error tasks, skips already succeeded ones', async () => {
    onSubmit
      .mockResolvedValueOnce(true)   // first submit: task1 succeeds
      .mockResolvedValueOnce(false)  // first submit: task2 fails
      .mockResolvedValueOnce(true);  // second submit: task2 retry succeeds

    const { result } = renderHook(() => useBatchTaskWizard({ allStaff, onSubmit }));

    act(() => { result.current.addGroup(anna.id); });
    const groupId = result.current.groups[0].id;
    act(() => { result.current.addTask(groupId); });
    act(() => { result.current.addTask(groupId); });
    const [task1Id, task2Id] = result.current.groups[0].tasks.map(t => t.id);
    act(() => {
      result.current.updateTask(groupId, task1Id, { roomId: 'room-1' });
      result.current.updateTask(groupId, task2Id, { roomId: 'room-2' });
    });

    await act(async () => { await result.current.submit(); });
    await act(async () => { await result.current.submit(); });

    // onSubmit called 3 times total (not 4 — task1 not retried)
    expect(onSubmit).toHaveBeenCalledTimes(3);
    const tasks = result.current.groups[0].tasks;
    expect(tasks[0].status).toBe('success');
    expect(tasks[1].status).toBe('success');
  });
});
