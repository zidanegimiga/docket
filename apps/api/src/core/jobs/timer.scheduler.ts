import type { Logger } from "../logger/logger.interface.js";
import type { Monitor } from "../monitoring/monitor.interface.js";
import type { Scheduler } from "./scheduler.interface.js";

const DEFAULT_FIRST_RUN_MS = 60_000;

/**
 * Timers in this process. Enough for one instance; with several, each runs the tasks, which must
 * therefore be safe to repeat (token cleanup is). A queue or the platform's cron replaces it.
 */
export class TimerScheduler implements Scheduler {
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly running = new Set<Promise<void>>();
  private stopped = false;

  constructor(
    private readonly logger: Logger,
    private readonly monitor: Monitor,
  ) {}

  every(
    name: string,
    intervalMs: number,
    task: () => Promise<void>,
    firstRunMs = DEFAULT_FIRST_RUN_MS,
  ): void {
    const schedule = (delayMs: number) => {
      if (this.stopped) return;
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        const run = this.runOnce(name, task).finally(() => {
          this.running.delete(run);
          schedule(intervalMs);
        });
        this.running.add(run);
      }, delayMs);
      // Scheduled work never keeps the process alive on its own.
      timer.unref();
      this.timers.add(timer);
    };
    schedule(firstRunMs);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    await Promise.allSettled(this.running);
  }

  private async runOnce(name: string, task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (error) {
      this.logger.error("Scheduled task failed", { task: name, err: error });
      this.monitor.captureException(error, { task: name });
    }
  }
}
