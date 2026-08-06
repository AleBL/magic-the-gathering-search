/**
 * Centralized logging wrapper so call sites stay lint-clean (no-console) and
 * logging behavior can be adjusted in a single place (e.g. silenced in tests
 * or forwarded to a reporter later).
 */
/* eslint-disable no-console */
export const logger = {
  error: (...args: unknown[]): void => console.error(...args),
  warn: (...args: unknown[]): void => console.warn(...args),
  info: (...args: unknown[]): void => console.info(...args)
};
