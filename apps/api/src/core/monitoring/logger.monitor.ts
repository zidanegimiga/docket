import type { Logger } from "../logger/logger.interface.js";
import type { MetricTags, Monitor } from "./monitor.interface.js";

export class LoggerMonitor implements Monitor {
  constructor(private readonly logger: Logger) {}

  captureException(error: unknown, context: Record<string, unknown> = {}): void {
    this.logger.error("Exception captured", { ...context, err: error });
  }

  recordMetric(name: string, value: number, tags: MetricTags = {}): void {
    this.logger.debug("Metric recorded", { metric: name, value, tags });
  }
}
