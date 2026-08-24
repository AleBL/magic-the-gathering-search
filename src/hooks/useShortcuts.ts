import { useShortcutHandler } from './useShortcutHandler';

interface ShortcutOptions {
  onSearchFocus?: () => void;
  onEscape?: () => void;
  onSaveDeck?: () => void;
  onPlaytest?: () => void;
  onClearDeck?: () => void;
}

/** Read at dispatch time: the platform check has to see the event that just fired. */
function isModifierKeyPressed(event: KeyboardEvent): boolean {
  const safeNavigator: Navigator & { userAgentData?: { platform?: string } } = navigator;
  const isMacOS = safeNavigator.userAgentData?.platform === 'macOS' || /Mac/i.test(navigator.userAgent);
  return isMacOS ? event.metaKey : event.ctrlKey;
}

/**
 * The app-wide bindings, on the registry's bottom layer: a modal or the playtest above
 * them takes the key first, and only what neither of them claimed lands here.
 */
export function useShortcuts({ onSearchFocus, onEscape, onSaveDeck, onPlaytest, onClearDeck }: ShortcutOptions) {
  useShortcutHandler(
    (event) => {
      const hasModifierKey = isModifierKeyPressed(event);
      const pressedKey = event.key.toLowerCase();

      // Escape stays unprevented: it is the browser's own dismiss key.
      if (event.key === 'Escape' && onEscape) {
        onEscape();
        return true;
      }

      if (hasModifierKey && pressedKey === 'f' && onSearchFocus) {
        event.preventDefault();
        onSearchFocus();
        return true;
      }

      if (hasModifierKey && pressedKey === 's' && onSaveDeck) {
        event.preventDefault();
        onSaveDeck();
        return true;
      }

      if (hasModifierKey && pressedKey === 'p' && onPlaytest) {
        event.preventDefault();
        onPlaytest();
        return true;
      }

      if (hasModifierKey && event.shiftKey && pressedKey === 'n' && onClearDeck) {
        event.preventDefault();
        onClearDeck();
        return true;
      }

      return false;
    },
    { layer: 'app' }
  );
}
