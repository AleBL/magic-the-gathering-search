import { ReactNode } from 'react';

interface DeckPreviewShellProps {
  /**
   * Amber rail down the left edge, marking the working deck as "you are editing a saved deck".
   * Easy to lose in a merge, so it lives here rather than in a caller's class string.
   */
  accent?: boolean;
  /** Deck identity: a name and its metadata, or the editing/unsaved state. */
  header: ReactNode;
  /** View options and the action bar. Omitted when there is nothing to act on. */
  controls?: ReactNode;
  children: ReactNode;
}

/**
 * The frame both deck previews share: the panel surface and the sticky header that holds
 * identity on the left and controls on the right.
 *
 * `DeckPreview` used to return this markup from two places — once for a saved deck, once for
 * the working deck — with only the header content genuinely differing. Extracting the frame
 * keeps the two headers free to be different without the surrounding chrome being written out
 * twice and drifting apart.
 */
export function DeckPreviewShell({ accent, header, controls, children }: DeckPreviewShellProps) {
  return (
    <div
      className={`deck-preview-section relative ${accent ? 'border-l-4 border-amber-400 dark:border-amber-500 pl-3' : ''}`}
    >
      <div className="panel-header panel-header-sticky relative">
        {/* `min-w-0` so a long deck name truncates instead of pushing the controls off. */}
        <div className="min-w-0">{header}</div>
        {controls ? <div className="flex flex-wrap gap-2 items-center">{controls}</div> : null}
      </div>
      {children}
    </div>
  );
}
