import { useShortcutHandler } from './useShortcutHandler';

/**
 * Registers on the registry's modal layer and consumes Escape, so it reaches the surface the
 * user is looking at and stops there: without that arbitration, closing a context menu also
 * closed the modal hosting it. Other keys fall through, which is what still lets Ctrl+K
 * toggle the command palette shut while the palette is open.
 */
export function useEscapeKey(onEscape: () => void, active = true) {
  useShortcutHandler(
    (event) => {
      if (event.key !== 'Escape') return false;
      onEscape();
      return true;
    },
    { layer: 'modal', active }
  );
}
