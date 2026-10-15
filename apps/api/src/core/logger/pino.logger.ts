import { pino, type Level, type Logger as PinoInstance } from "pino";

import type { LogContext, Logger } from "./logger.interface.js";

export interface PinoLoggerOptions {
  level: Level | "silent";
  pretty?: boolean;
}

export class PinoLogger implements Logger {
  private constructor(private readonly instance: PinoInstance) {}

  static create({ level, pretty = false }: PinoLoggerOptions): PinoLogger {
    const instance = pino({
      level,
      ...(pretty && { transport: { target: "pino-pretty" } }),
    });

    return new PinoLogger(instance);
  }

  debug(message: string, context: LogContext = {}): void {
    this.instance.debug(context, message);
  }

  info(message: string, context: LogContext = {}): void {
    this.instance.info(context, message);
  }

  warn(message: string, context: LogContext = {}): void {
    this.instance.warn(context, message);
  }

  error(message: string, context: LogContext = {}): void {
    this.instance.error(context, message);
  }

  child(bindings: LogContext): Logger {
    return new PinoLogger(this.instance.child(bindings));
  }
}
