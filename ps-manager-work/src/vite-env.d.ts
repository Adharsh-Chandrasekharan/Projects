/// <reference types="vite/client" />

export {};

declare global {
  interface Window {
    ipcRenderer: {
      invoke: (channel: string, ...args: unknown[]) => Promise<any>;
    };
  }
}
