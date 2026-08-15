/**
 * Single `keydown` dispatcher for every global shortcut in the app.
 *
 * Each surface used to own its own `window.addEventListener('keydown')`, so a keypress
 * reached all of them at once, in whatever order they happened to mount: one Escape closed
 * the dialog *and* the surface underneath it, and the playtest had to flag itself on
 * `<body>` so the app-level bindings would stand down. Arbitration is explicit here
 * instead — the key walks a layer stack from the top down and stops at the first handler
 * that claims it.
 */

/** Where a handler sits in the stack. */
export type ShortcutLayer = 'app' | 'playtest' | 'modal';

/**
 * Higher wins. A modal outranks the playtest it was opened from, which outranks the app
 * behind it.
 */
const LAYER_PRIORITY: Record<ShortcutLayer, number> = {
  app: 0,
  playtest: 1,
  modal: 2
};

/** Return `true` to consume the event; no handler below this one then runs. */
export type ShortcutHandler = (event: KeyboardEvent) => boolean | void;

export interface ShortcutHandlerOptions {
  layer: ShortcutLayer;
  /**
   * Hides every lower layer while registered, including for keys this handler ignores.
   * The playtest needs it: it is a fullscreen mode, and app shortcuts firing underneath
   * would act on a UI the user cannot see.
   */
  blocksLowerLayers?: boolean;
}

interface RegisteredHandler {
  handle: ShortcutHandler;
  layer: ShortcutLayer;
  blocksLowerLayers: boolean;
  /** Cleared on unregister, so a handler torn down mid-dispatch is skipped. */
  registered: boolean;
}

/** Kept sorted: highest layer first, and newest first within a layer. */
const handlers: RegisteredHandler[] = [];
let listening = false;

function dispatch(event: KeyboardEvent) {
  // Iterate a snapshot: a handler that closes a dialog unmounts its neighbours while the
  // loop is still running, because React flushes state updates from a discrete event
  // synchronously. `registered` is what keeps a torn-down handler from being called.
  const stack = handlers.slice();
  let floor = -1;

  for (const entry of stack) {
    if (!entry.registered) continue;
    const priority = LAYER_PRIORITY[entry.layer];
    if (priority < floor) return;
    if (entry.handle(event) === true) return;
    if (entry.blocksLowerLayers) floor = priority;
  }
}

/**
 * Registers `handle` on `options.layer` and returns its unregister function.
 *
 * Ordering caveat: handlers are stacked in registration order, and React runs child
 * effects before parent ones. Two surfaces of the same layer mounting in a single commit
 * therefore register inner-first, leaving the outer one on top. In practice a nested
 * surface is opened by a later commit, which lands it in front as expected.
 */
export function registerShortcutHandler(handle: ShortcutHandler, options: ShortcutHandlerOptions): () => void {
  const entry: RegisteredHandler = {
    handle,
    layer: options.layer,
    blocksLowerLayers: options.blocksLowerLayers ?? false,
    registered: true
  };

  const index = handlers.findIndex((existing) => LAYER_PRIORITY[existing.layer] <= LAYER_PRIORITY[entry.layer]);
  handlers.splice(index === -1 ? handlers.length : index, 0, entry);

  if (!listening) {
    window.addEventListener('keydown', dispatch);
    listening = true;
  }

  return () => {
    if (!entry.registered) return;
    entry.registered = false;
    handlers.splice(handlers.indexOf(entry), 1);
    if (handlers.length === 0 && listening) {
      window.removeEventListener('keydown', dispatch);
      listening = false;
    }
  };
}
