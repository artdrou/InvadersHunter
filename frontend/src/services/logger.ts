/* eslint-disable no-console -- this module is the single sanctioned console sink */
/**
 * Thin logging façade. Call sites use `logger.*` instead of `console.*` so the
 * sink can be swapped for a crash reporter (e.g. Sentry) in one place without
 * touching them. See CONVENTIONS.md.
 *
 * In dev everything forwards to the console. In production, warn/error are the
 * levels you'd forward to the reporter (wired where noted below).
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function emit(level: LogLevel, message: string, ...args: unknown[]): void {
  if (__DEV__) {
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    sink(message, ...args);
    return;
  }
  // Production: forward the important levels to the crash reporter.
  // TODO(sentry): Sentry.captureMessage(message, level) / captureException(args[0]).
  if (level === 'error' || level === 'warn') {
    console[level](message, ...args);
  }
}

export const logger = {
  debug: (message: string, ...args: unknown[]) => emit('debug', message, ...args),
  info: (message: string, ...args: unknown[]) => emit('info', message, ...args),
  warn: (message: string, ...args: unknown[]) => emit('warn', message, ...args),
  error: (message: string, ...args: unknown[]) => emit('error', message, ...args),
};
