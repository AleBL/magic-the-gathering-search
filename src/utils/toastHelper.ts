import { APP_EVENTS, emitAppEvent } from '../constants/appEvents';
import { ToastVariant } from '../types/Toast';

/**
 * Fires a toast from outside the React tree (services, utils, non-component helpers).
 *
 * The variant is the Toast component's own vocabulary. It used to be the dialog's
 * (`'danger'`), which the toast has no entry for: every error toast in the app rendered
 * with no icon and no red border, because the untyped `CustomEvent.detail` let the
 * mismatch through silently.
 */
export function dispatchToast(message: string, variant: ToastVariant = 'success') {
  emitAppEvent(APP_EVENTS.toast, { message, variant });
}
