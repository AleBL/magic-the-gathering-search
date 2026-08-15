import { contextBridge, ipcRenderer } from 'electron';

function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true);
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true);
        }
      });
    }
  });
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find((e) => e === child)) {
      return parent.appendChild(child);
    }

    return null;
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (parent && Array.from(parent.children).find((e) => e === child)) {
      return parent.removeChild(child);
    }

    return null;
  }
};

/**
 * Builds the boot overlay. Its CSS lives in src/style/loader.css, linked from index.html,
 * so nothing here injects a <style> element — that injection was one of the two reasons
 * style-src had to allow 'unsafe-inline' (see the CSP block in electron/index.ts).
 */
function createLoading() {
  const oDiv = document.createElement('div');

  oDiv.id = 'loading-to-remove';
  oDiv.className = 'app-loading-wrap';

  const spinner = document.createElement('div');
  spinner.className = 'sk-chase';
  for (let i = 0; i < 6; i += 1) {
    const dot = document.createElement('div');
    dot.className = 'sk-chase-dot';
    spinner.appendChild(dot);
  }
  oDiv.appendChild(spinner);

  return {
    appendLoading() {
      safeDOM.append(document.body, oDiv);
    },
    removeLoading() {
      safeDOM.remove(document.body, oDiv);
    }
  };
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = createLoading();
domReady().then(appendLoading);

// Only this window's own renderer may retract the boot overlay: a message from an iframe or
// another window arrives with a different `source`, and one from a foreign document with a
// different `origin`. `data` is untrusted input, so it is read defensively — the previous
// `ev.data.payload` threw on a bare `postMessage(null, '*')`. `addEventListener` instead of
// `window.onmessage` so this handler neither overwrites nor is overwritten by another one.
window.addEventListener('message', (ev: MessageEvent<unknown>) => {
  if (ev.source !== window) return;
  // The packaged app loads the bundle from file://, and Chromium serializes that opaque
  // origin as the string 'null' while `location.origin` reads 'file://' — equality alone
  // would reject every legitimate message in production and leave the overlay covering the
  // app. The `source` check above is what actually keeps foreign frames out.
  if (ev.origin !== window.location.origin && ev.origin !== 'null') return;

  const data = ev.data as { payload?: unknown } | null | undefined;
  if (data?.payload === 'removeLoading') removeLoading();
});

// ── WHITELIST: Only expose specific channels ──
const ALLOWED_SEND_CHANNELS = ['message', 'show-notification'] as const;

const ALLOWED_RECEIVE_CHANNELS = ['message', 'menu-clear-deck'] as const;

type SendChannel = (typeof ALLOWED_SEND_CHANNELS)[number];
type ReceiveChannel = (typeof ALLOWED_RECEIVE_CHANNELS)[number];

// Expose ipcRenderer safely to the renderer process
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // One-way: renderer -> main
    send: (channel: SendChannel, ...args: unknown[]) => {
      if (ALLOWED_SEND_CHANNELS.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },

    // Two-way: renderer -> main -> renderer
    invoke: (channel: SendChannel, ...args: unknown[]) => {
      if (ALLOWED_SEND_CHANNELS.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      return Promise.reject(new Error(`Channel "${channel}" is not allowed`));
    },

    // One-way: main -> renderer
    on: (channel: ReceiveChannel, callback: (...args: unknown[]) => void) => {
      if (ALLOWED_RECEIVE_CHANNELS.includes(channel)) {
        const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
      return () => {};
    }
  });
} catch (error) {
  // Preload runs before the renderer exists, so there is no logger or toast to
  // report through — console is the only channel available here.
  // eslint-disable-next-line no-console
  console.error('Failed to expose electronAPI', error);
}
