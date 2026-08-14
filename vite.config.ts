import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { UserConfig, ConfigEnv, Plugin } from 'vite';
import { rmSync } from 'node:fs';
import { join } from 'path';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import pkg from './package.json';

const root = join(__dirname);
const srcRoot = join(__dirname, 'src');
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
        options.startup();
      },
      vite: {
        build: buildElectron(isDev)
      }
    },
    {
      entry: join(root, 'electron/preload.ts'),
      onstart(options) {
        // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
        // instead of restarting the entire Electron App.
        options.reload();
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
