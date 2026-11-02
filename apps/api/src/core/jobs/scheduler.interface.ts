/** Runs background tasks on a schedule inside the API process. */
export interface Scheduler {
  /**
   * Runs the task after `firstRunMs` and then every `intervalMs` after each run finishes, so a
   * slow run never overlaps the next. Failures are reported and the schedule continues.
   */
  every(name: string, intervalMs: number, task: () => Promise<void>, firstRunMs?: number): void;
  /** Cancels future runs and waits for any run in progress. */
  stop(): Promise<void>;
}
