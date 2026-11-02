import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimerScheduler } from "../../src/core/jobs/timer.scheduler.js";
import { RecordingLogger } from "../helpers/recording.logger.js";
import { RecordingMonitor } from "../helpers/recording.monitor.js";

describe("TimerScheduler", () => {
  let monitor: RecordingMonitor;
  let scheduler: TimerScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    monitor = new RecordingMonitor();
    scheduler = new TimerScheduler(new RecordingLogger(), monitor);
  });

  afterEach(async () => {
    // A run may still be sleeping on a fake timer; let it finish so stop() can resolve.
    const stopped = scheduler.stop();
    await vi.runAllTimersAsync();
    await stopped;
    vi.useRealTimers();
  });

  it("runs after the first delay and then on every interval", async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    scheduler.every("job", 1_000, task, 100);

    await vi.advanceTimersByTimeAsync(99);
    expect(task).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("measures the interval from the end of a run, so slow runs never overlap", async () => {
    let active = 0;
    let maxActive = 0;
    const task = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      active -= 1;
    });
    scheduler.every("slow", 1_000, task, 0);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(task).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
  });

  it("reports a failure and keeps the schedule going", async () => {
    const failure = new Error("database unavailable");
    const task = vi.fn().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
    scheduler.every("flaky", 1_000, task, 0);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(monitor.exceptions).toEqual([failure]);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("stops future runs and waits for the one in progress", async () => {
    let finished = false;
    const task = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      finished = true;
    });
    scheduler.every("job", 1_000, task, 0);
    await vi.advanceTimersByTimeAsync(0);

    const stopped = scheduler.stop();
    await vi.advanceTimersByTimeAsync(500);
    await stopped;
    await vi.advanceTimersByTimeAsync(10_000);

    expect(finished).toBe(true);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
