/// <reference types="vite/client" />

export {};

declare global {
  interface Window {
    ipcRenderer: {
      invoke: (channel: string, ...args: unknown[]) => Promise<any>;
      on?: (channel: string, listener: (...args: any[]) => void) => () => void;
    };
  }
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}
