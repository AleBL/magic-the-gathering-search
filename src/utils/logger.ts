// The one place `no-console` is off, so call sites stay lint-clean and logging can later be
// silenced or forwarded from here alone.
/* eslint-disable no-console */
export const logger = {
  error: (...args: unknown[]): void => console.error(...args),
  warn: (...args: unknown[]): void => console.warn(...args),
  info: (...args: unknown[]): void => console.info(...args)
};
