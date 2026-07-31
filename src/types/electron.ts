/** Renderer-facing bridge exposed by `electron/preload.ts` via `contextBridge.exposeInMainWorld('electronAPI', ...)`. */
interface ElectronAPI {
  send: (channel: string, ...args: unknown[]) => void;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  /** Subscribes to a main-process channel; returns the unsubscribe function. */
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
}

export interface WindowWithElectronAPI {
  electronAPI?: ElectronAPI;
}
