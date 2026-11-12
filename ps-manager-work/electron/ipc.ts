import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../common/constants';
import { SqlServer } from './sqlServer';

const storage = require('electron-json-storage');

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class Ipc {
  constructor(public win: BrowserWindow, public sql: SqlServer) {
    ipcMain.handle(IPC.createPlaystation, async (_event, args) => {
      try {
        const id = await sql.addPlaystation(args);
        const all = await sql.getAllPlaystations();
        return { code: 1, msg: all.find((item) => item.PlayStationID === id) };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });

    ipcMain.handle(IPC.getAllPlaystations, async () => {
      try {
        return { code: 1, msg: await sql.getAllPlaystations() };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });

    ipcMain.handle(IPC.getSession, async (_event, args) => {
      try {
        const session = await sql.getSession(Number(args.PlayStationID));
        return session
          ? { code: 1, msg: session }
          : { code: 0, msg: 'No active session found for this console.' };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });

    ipcMain.handle(IPC.Reserve, async (_event, args) => {
      try {
        const result = await sql.reserve(
          Number(args.PlayStationID),
          Number(args.PlayersNumber),
          Number(args.DurationMinutes),
          Number(args.DiscountPercent ?? 0),
        );
        return { code: 1, msg: result };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });

    ipcMain.handle(IPC.End, async (_event, args) => {
      try {
        return { code: 1, msg: await sql.endSession(Number(args.PlayStationID)) };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });

    ipcMain.handle(IPC.AddPlayers, async (_event, args) => {
      try {
        await sql.addPlayers(Number(args.PlayStationID), Number(args.additionalPlayers));
        return { code: 1 };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });

    ipcMain.handle(IPC.ExtendTime, async (_event, args) => {
      try {
        await sql.extendTime(Number(args.PlayStationID), Number(args.additionalMinutes));
        return { code: 1 };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });

    ipcMain.handle(IPC.UpdateRates, async (_event, args) => {
      try {
        await sql.updateConsoleRates(Number(args.PlayStationID), args.rates);
        return { code: 1 };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });

    ipcMain.handle(IPC.Delete, async (_event, args) => {
      try {
        await sql.deletePlaystation(Number(args.PlayStationID));
        return { code: 1 };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });

    ipcMain.handle(IPC.Reset, async () => {
      try {
        await sql.resetAll();
        return { code: 1 };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });

    ipcMain.handle(IPC.getPass, async () => {
      try {
        const data = storage.getSync('myData');
        return { code: 1, password: data?.credentials?.password || 'password' };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });

    ipcMain.handle(IPC.UpdataPassword, async (_event, args) => {
      try {
        const data = storage.getSync('myData') || {};
        data.credentials = { ...(data.credentials || {}), password: String(args.newPassword) };
        await new Promise<void>((resolve, reject) => {
          storage.set('myData', data, (error: unknown) => error ? reject(error) : resolve());
        });
        return { code: 1 };
      } catch (error) {
        return { code: 0, msg: errorMessage(error) };
      }
    });
  }
}
