// One `keydown` listener for the whole app. Each surface used to add its own, so a keypress
// reached all of them in mount order: one Escape closed the dialog *and* the surface under it,
// and the playtest had to flag itself on `<body>` to make app bindings stand down. Here the
// key walks the layer stack from the top and stops at the first handler that claims it.

export type ShortcutLayer = 'app' | 'playtest' | 'modal';

/** Higher wins: a modal outranks the playtest it opened from, which outranks the app behind it. */
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
   * Hides every lower layer while registered, even for keys this handler ignores. The
   * fullscreen playtest needs it: an app shortcut firing underneath acts on a hidden UI.
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
  // A snapshot, because React flushes state from a discrete event synchronously: a handler
  // that closes a dialog unmounts its neighbours while this loop is still running, and
  // `registered` is what keeps a torn-down handler from being called anyway.
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

// Ordering caveat: React runs child effects before parent ones, so two surfaces of the same
// layer mounting in one commit register inner-first and leave the outer one on top. In
// practice a nested surface opens in a later commit, which lands it in front as expected.
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
