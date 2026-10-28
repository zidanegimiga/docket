import type { LogContext, Logger } from "../../src/core/logger/logger.interface.js";

export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context: LogContext;
}

export class RecordingLogger implements Logger {
  constructor(
    readonly entries: LogEntry[] = [],
    private readonly bindings: LogContext = {},
  ) {}

  debug(message: string, context: LogContext = {}): void {
    this.record("debug", message, context);
  }

  info(message: string, context: LogContext = {}): void {
    this.record("info", message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.record("warn", message, context);
  }

  error(message: string, context: LogContext = {}): void {
    this.record("error", message, context);
  }

  child(bindings: LogContext): Logger {
    return new RecordingLogger(this.entries, { ...this.bindings, ...bindings });
  }

  private record(level: LogEntry["level"], message: string, context: LogContext): void {
    this.entries.push({ level, message, context: { ...this.bindings, ...context } });
  }
}
