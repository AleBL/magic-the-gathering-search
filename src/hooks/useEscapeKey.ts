import { useShortcutHandler } from './useShortcutHandler';

/**
 * Calls `onEscape` when Escape is pressed anywhere in the window, while `active`.
 *
 * Registers on the registry's modal layer and consumes the key, so Escape reaches the
 * surface the user is actually looking at and stops there. Before that arbitration existed
 * every active call site heard the same keypress: closing a context menu also closed the
 * modal hosting it, and closing any dialog also blurred the search field behind it.
 *
 * Other keys deliberately fall through to the layers below — that is what still lets
 * Ctrl+K toggle the command palette shut while the palette itself is open.
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
