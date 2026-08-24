import { AppTab } from '../types';
import { ToastVariant } from '../types/Toast';

/**
 * The app's own `window` events, with the shape of each one's payload.
 *
 * These are a contract between files that never import each other: the toast helper and
 * the shell that renders toasts, the shortcut layer and the search box that clears on
 * Escape. Spelled out as bare strings on both sides, a typo in either half compiled fine
 * and simply never fired, and `event.detail` arrived untyped at every listener.
 */
export const APP_EVENTS = {
  toast: 'global-toast',
  escape: 'mtg-escape',
  navigateTab: 'mtg-navigate-tab'
} as const;

export interface AppEventDetail {
  [APP_EVENTS.toast]: { message: string; variant: ToastVariant };
  [APP_EVENTS.escape]: undefined;
  [APP_EVENTS.navigateTab]: AppTab;
}

type AppEventName = keyof AppEventDetail;

export function emitAppEvent<K extends AppEventName>(
  ...[name, detail]: AppEventDetail[K] extends undefined ? [K] : [K, AppEventDetail[K]]
): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** Subscribes to an app event and returns the unsubscribe, ready to be an effect's cleanup. */
export function onAppEvent<K extends AppEventName>(name: K, handler: (detail: AppEventDetail[K]) => void): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<AppEventDetail[K]>).detail);
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
