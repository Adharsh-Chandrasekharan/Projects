/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    DIST: string;
    VITE_PUBLIC: string;
  }
}

interface Window {
  ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<any>;
    on(channel: string, listener: (...args: unknown[]) => void): () => void;
  };
}
