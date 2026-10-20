import type { MetricTags, Monitor } from "../../src/core/monitoring/monitor.interface.js";

interface RecordedMetric {
  name: string;
  value: number;
  tags: MetricTags;
}

export class RecordingMonitor implements Monitor {
  readonly exceptions: unknown[] = [];
  readonly metrics: RecordedMetric[] = [];

  captureException(error: unknown): void {
    this.exceptions.push(error);
  }

  recordMetric(name: string, value: number, tags: MetricTags = {}): void {
    this.metrics.push({ name, value, tags });
  }
}
