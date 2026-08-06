import { logger } from '../utils/logger';
import { useState, useEffect, useCallback } from 'react';
import { TOAST_DURATION_MS } from '../constants';
import { ToastState, ToastVariant, ToastAction } from '../types/Toast';

export default function useToast() {
  const [toastState, setToastState] = useState<ToastState>({ message: null, variant: 'success' });

  useEffect(() => {
    if (!toastState.message) return undefined;

    const timer = setTimeout(() => {
      setToastState((prev) => ({ ...prev, message: null }));
    }, TOAST_DURATION_MS);

    return () => clearTimeout(timer);
  }, [toastState.message]);

  const showToast = useCallback((text: string, variant: ToastVariant = 'success', action?: ToastAction) => {
    setToastState({ message: text, variant, action });

    // Trigger native desktop OS notification. Guarded: on mobile browsers
    // (e.g. Android Chrome) `new Notification()` throws — page-context
    // notifications are not allowed there — and that must never take the
    // in-app toast down with it.
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('MTG Deck Forge', { body: text, silent: false });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              try {
                new Notification('MTG Deck Forge', { body: text, silent: false });
              } catch {
                // Mobile: constructor unsupported — toast already shown.
              }
            }
          });
        }
      }
    } catch (error) {
      logger.error('OS notification failed:', error);
    }
  }, []);

  const dismissToast = useCallback(() => {
    setToastState((prev) => ({ ...prev, message: null }));
  }, []);

  return {
    toastMessage: toastState.message,
    toastVariant: toastState.variant,
    toastAction: toastState.action,
    showToast,
    dismissToast
  };
}
