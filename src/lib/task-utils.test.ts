import { describe, it, expect } from 'vitest';
import { isAwaitingCleaning, sortReadyToCleanFirst } from './task-utils';

describe('isAwaitingCleaning', () => {
  it('is true for an open task flagged ready to clean', () => {
    expect(isAwaitingCleaning({ status: 'todo', ready_to_clean: true })).toBe(true);
  });

  it('is false when the task is not flagged', () => {
    expect(isAwaitingCleaning({ status: 'todo', ready_to_clean: false })).toBe(false);
  });

  it('is false when the flag is missing (migration pending)', () => {
    expect(isAwaitingCleaning({ status: 'todo' })).toBe(false);
  });

  it('is false for a done task even when flagged', () => {
    expect(isAwaitingCleaning({ status: 'done', ready_to_clean: true })).toBe(false);
  });
});

describe('sortReadyToCleanFirst', () => {
  it('moves flagged tasks to the top', () => {
    const tasks = [
      { id: 'a', status: 'todo', ready_to_clean: false },
      { id: 'b', status: 'todo', ready_to_clean: true },
      { id: 'c', status: 'paused', ready_to_clean: false },
      { id: 'd', status: 'in_progress', ready_to_clean: true },
    ];

    expect(sortReadyToCleanFirst(tasks).map(t => t.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('preserves the incoming order within each group', () => {
    const tasks = [
      { id: 'a', status: 'todo', ready_to_clean: false },
      { id: 'b', status: 'todo', ready_to_clean: false },
      { id: 'c', status: 'todo', ready_to_clean: false },
    ];

    expect(sortReadyToCleanFirst(tasks).map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not promote a flagged task that is already done', () => {
    const tasks = [
      { id: 'a', status: 'todo', ready_to_clean: false },
      { id: 'b', status: 'done', ready_to_clean: true },
    ];

    expect(sortReadyToCleanFirst(tasks).map(t => t.id)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const tasks = [
      { id: 'a', status: 'todo', ready_to_clean: false },
      { id: 'b', status: 'todo', ready_to_clean: true },
    ];

    sortReadyToCleanFirst(tasks);

    expect(tasks.map(t => t.id)).toEqual(['a', 'b']);
  });
});
