import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { UserConfig, ConfigEnv, Plugin } from 'vite';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron, { type ElectronOptions } from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

// This config is ESM (`.mts`), so `package.json` cannot be imported as a module without an
// import attribute, and `__dirname` does not exist.
const pkg = createRequire(import.meta.url)('./package.json') as { dependencies?: Record<string, string> };

const root = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(root, 'src');
const electronOutDir = join(root, 'dist-electron');

// Only a real build may erase previous artifacts: tools that merely import this
// config (knip, editors) must not delete the desktop build as a side effect.
const cleanElectronOutDir = (): Plugin => ({
  name: 'clean-electron-out-dir',
  apply: 'build',
  buildStart() {
    rmSync(electronOutDir, { recursive: true, force: true });
  }
});

// vite-plugin-electron mounts the running app's child process on `process.electronApp`;
// v1 dropped the global type declaration for it, hence the cast.
const isElectronRunning = () => Boolean((process as unknown as { electronApp?: unknown }).electronApp);

type OnStartArgs = Parameters<NonNullable<ElectronOptions['onstart']>>[0];

// The plugin spawns Electron with `cwd` set to Vite's root, which here is `src/`. Electron
// would resolve the default `.` entry against that directory, find no package.json and exit
// with MODULE_NOT_FOUND, so the spawn is pinned to the project root, where `main` points at
// the built main process.
const startElectron = (options: OnStartArgs) => options.startup(['.', '--no-sandbox'], { cwd: root });

const buildElectron = (isDev: boolean) => ({
  sourcemap: isDev,
  minify: !isDev,
  outDir: electronOutDir,
  rollupOptions: {
    external: Object.keys(pkg.dependencies || {})
  }
});

const plugins = (isDev: boolean) => [
  cleanElectronOutDir(),
  react(),
  tailwindcss(),
  electron([
    {
      // Main-Process entry file of the Electron App.
      entry: join(root, 'electron/index.ts'),
      onstart(options) {
        startElectron(options);
      },
      vite: {
        build: buildElectron(isDev)
      }
    },
    {
      entry: join(root, 'electron/preload.ts'),
      onstart(options) {
        // On the first dev build vite-plugin-electron 1.x fires `onstart` only once, on whichever
        // entry finishes last, so this block has to be able to boot the app too. Afterwards each
        // rebuild triggers its own entry: a preload change only reloads the Renderer-Process,
        // instead of restarting the entire Electron App.
        if (isElectronRunning()) {
          options.reload();
        } else {
          startElectron(options);
        }
      },
      vite: {
        build: buildElectron(isDev)
      }
    }
  ]),

  renderer()
];

export default ({ command }: ConfigEnv): UserConfig => {
  const isServe = command === 'serve';

  return {
    root: srcRoot,
    base: isServe ? '/' : './',
    plugins: plugins(isServe),
    resolve: {
      alias: {
        '/@': srcRoot
      }
    },
    build: {
      outDir: join(root, '/dist-vite'),
      emptyOutDir: true,
      rollupOptions: {}
    },
    server: {
      port: process.env.PORT === undefined ? 3000 : +process.env.PORT
    },
    optimizeDeps: {
      exclude: ['path']
    }
  };
};
