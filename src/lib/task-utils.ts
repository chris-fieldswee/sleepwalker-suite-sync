/** Minimal shape needed to reason about the ready-to-clean flag. */
export interface ReadyToCleanTask {
  status?: string | null;
  ready_to_clean?: boolean | null;
}

/**
 * A room flagged ready to clean stops being urgent once its task is finished,
 * so a done task never counts as awaiting cleaning.
 */
export const isAwaitingCleaning = (task: ReadyToCleanTask): boolean =>
  !!task.ready_to_clean && task.status !== 'done';

/**
 * Rooms flagged ready to clean go to the top of the list. The sort is stable,
 * so everything else keeps the order it was given in.
 */
export function sortReadyToCleanFirst<T extends ReadyToCleanTask>(tasks: T[]): T[] {
  return [...tasks].sort(
    (a, b) => Number(isAwaitingCleaning(b)) - Number(isAwaitingCleaning(a))
  );
}
