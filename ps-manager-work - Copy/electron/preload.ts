import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('ipcRenderer', {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),

  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
