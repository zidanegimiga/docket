export type MetricTags = Record<string, string>;

export interface Monitor {
  captureException(error: unknown, context?: Record<string, unknown>): void;
  recordMetric(name: string, value: number, tags?: MetricTags): void;
}
