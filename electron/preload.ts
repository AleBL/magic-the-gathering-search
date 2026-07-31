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
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function createLoading() {
  const styleContent = `
.sk-chase {

}

.sk-chase-dot {
    width: 40px;
    height: 40px;
    position: absolute;
    margin: auto;
    animation: sk-chase-dot 2.0s infinite ease-in-out both;
}

.sk-chase-dot:before {
  content: '';
  display: block;
  width: 25%;
  height: 25%;
  background-color: #fff;
  border-radius: 100%;
  animation: sk-chase-dot-before 2.0s infinite ease-in-out both; 
}

.sk-chase-dot:nth-child(1) { animation-delay: -1.1s; }
.sk-chase-dot:nth-child(2) { animation-delay: -1.0s; }
.sk-chase-dot:nth-child(3) { animation-delay: -0.9s; }
.sk-chase-dot:nth-child(4) { animation-delay: -0.8s; }
.sk-chase-dot:nth-child(5) { animation-delay: -0.7s; }
.sk-chase-dot:nth-child(6) { animation-delay: -0.6s; }
.sk-chase-dot:nth-child(1):before { animation-delay: -1.1s; }
.sk-chase-dot:nth-child(2):before { animation-delay: -1.0s; }
.sk-chase-dot:nth-child(3):before { animation-delay: -0.9s; }
.sk-chase-dot:nth-child(4):before { animation-delay: -0.8s; }
.sk-chase-dot:nth-child(5):before { animation-delay: -0.7s; }
.sk-chase-dot:nth-child(6):before { animation-delay: -0.6s; }

@keyframes sk-chase {
  100% { transform: rotate(360deg); } 
}

@keyframes sk-chase-dot {
  80%, 100% { transform: rotate(360deg); } 
}

@keyframes sk-chase-dot-before {
  50% {
    transform: scale(0.4); 
  } 100%, 0% {
    transform: scale(1.0); 
  } 
}

.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
  `;

  const oStyle = document.createElement('style');
  const oDiv = document.createElement('div');

  oStyle.id = 'app-loading-style';
  oStyle.innerHTML = styleContent;
  oDiv.id = 'loading-to-remove';
  oDiv.className = 'app-loading-wrap';
  oDiv.innerHTML = `<div clas="sk-chase">
  <div class="sk-chase-dot"></div>
  <div class="sk-chase-dot"></div>
  <div class="sk-chase-dot"></div>
  <div class="sk-chase-dot"></div>
  <div class="sk-chase-dot"></div>
  <div class="sk-chase-dot"></div></div>
`;

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle);
      safeDOM.append(document.body, oDiv);
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle);
      safeDOM.remove(document.body, oDiv);
    }
  };
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = createLoading();
domReady().then(appendLoading);

window.onmessage = (ev) => {
  if (ev.data.payload === 'removeLoading') removeLoading();
};

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
