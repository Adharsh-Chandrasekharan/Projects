import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../common/constants';

type ApiResult = {
  code: number;
  msg?: any;
};

export class Ipc {
  private token: string | null = null;
  private tokenExpiresAt = 0;
  private readonly apiBaseUrl: string;

  constructor(public win: BrowserWindow, apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, '');

    const clearAuthentication = () => {
      this.token = null;
      this.tokenExpiresAt = 0;
    };

    const request = async (
      endpoint: string,
      method = 'GET',
      body?: unknown,
    ): Promise<any> => {
      if (!this.token || Date.now() >= this.tokenExpiresAt) {
        clearAuthentication();
        throw new Error('Your login has expired. Please sign in again.');
      }

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.status === 401) {
        clearAuthentication();
        this.win.webContents.send(IPC.AuthExpired);
      }

      if (!response.ok) {
        throw new Error(payload?.message || `API request failed (${response.status}).`);
      }

      return payload;
    };

    ipcMain.handle(IPC.AuthStatus, async () => {
      if (!this.token || Date.now() >= this.tokenExpiresAt) {
        clearAuthentication();
        return { authenticated: false };
      }
      return { authenticated: true };
    });

    ipcMain.handle(IPC.Login, async (_event, credentials): Promise<ApiResult> => {
      try {
        const response = await fetch(`${this.apiBaseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: String(credentials?.username || ''),
            password: String(credentials?.password || ''),
          }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok || typeof payload?.token !== 'string') {
          throw new Error(payload?.message || 'Login failed. Check your username and password.');
        }

        this.token = payload.token;
        const expiresIn = Number(payload.expiresIn || 28800);
        this.tokenExpiresAt = Date.now() + expiresIn * 1000;

        return { code: 1 };
      } catch (error) {
        return {
          code: 0,
          msg: error instanceof Error ? error.message : String(error),
        };
      }
    });

    ipcMain.handle(IPC.Logout, async () => {
      clearAuthentication();
      return { code: 1 };
    });

    ipcMain.handle(IPC.getAllPlaystations, async (): Promise<ApiResult> => {
      try {
        return { code: 1, msg: await request('/api/consoles') };
      } catch (error) {
        return { code: 0, msg: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle(IPC.createPlaystation, async (_event, args): Promise<ApiResult> => {
      try {
        const created = await request('/api/consoles', 'POST', args);
        const consoles = await request('/api/consoles');
        return {
          code: 1,
          msg: consoles.find((item: any) => Number(item.PlayStationID) === Number(created.id)),
        };
      } catch (error) {
        return { code: 0, msg: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle(IPC.getSession, async (_event, args): Promise<ApiResult> => {
      try {
        const session = await request(`/api/consoles/${Number(args.PlayStationID)}/session`);
        return session
          ? { code: 1, msg: session }
          : { code: 0, msg: 'No active session found for this console.' };
      } catch (error) {
        return { code: 0, msg: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle(IPC.Reserve, async (_event, args): Promise<ApiResult> => {
      try {
        const result = await request('/api/sessions/reserve', 'POST', args);
        return { code: 1, msg: result };
      } catch (error) {
        return { code: 0, msg: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle(IPC.End, async (_event, args): Promise<ApiResult> => {
      try {
        const result = await request('/api/sessions/end', 'POST', args);
        return { code: 1, msg: result };
      } catch (error) {
        return { code: 0, msg: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle(IPC.AddPlayers, async (_event, args): Promise<ApiResult> => {
      try {
        const result = await request('/api/sessions/add-players', 'POST', args);
        return { code: 1, msg: result };
      } catch (error) {
        return { code: 0, msg: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle(IPC.ExtendTime, async (_event, args): Promise<ApiResult> => {
      try {
        const result = await request('/api/sessions/extend', 'POST', args);
        return { code: 1, msg: result };
      } catch (error) {
        return { code: 0, msg: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle(IPC.UpdateRates, async (_event, args): Promise<ApiResult> => {
      try {
        const result = await request(`/api/consoles/${Number(args.PlayStationID)}/rates`, 'PUT', {
          rates: args.rates,
        });
        return { code: 1, msg: result };
      } catch (error) {
        return { code: 0, msg: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle(IPC.Delete, async (_event, args): Promise<ApiResult> => {
      try {
        const result = await request(`/api/consoles/${Number(args.PlayStationID)}`, 'DELETE');
        return { code: 1, msg: result };
      } catch (error) {
        return { code: 0, msg: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcMain.handle(IPC.GetLedger, async (_event, args): Promise<ApiResult> => {
      try {
        const params = new URLSearchParams({ from: String(args?.from || ''), to: String(args?.to || '') });
        return { code: 1, msg: await request(`/api/ledger?${params.toString()}`) };
      } catch (error) { return { code: 0, msg: error instanceof Error ? error.message : String(error) }; }
    });

    ipcMain.handle(IPC.GetBillingHistory, async (_event, args): Promise<ApiResult> => {
      try { return { code: 1, msg: await request(`/api/ledger/${Number(args.SessionID)}/history`) }; }
      catch (error) { return { code: 0, msg: error instanceof Error ? error.message : String(error) }; }
    });

    ipcMain.handle(IPC.EditBilling, async (_event, args): Promise<ApiResult> => {
      try { return { code: 1, msg: await request(`/api/ledger/${Number(args.BillingID)}`, 'PUT', args) }; }
      catch (error) { return { code: 0, msg: error instanceof Error ? error.message : String(error) }; }
    });

    ipcMain.handle(IPC.DeleteBilling, async (_event, args): Promise<ApiResult> => {
      try { return { code: 1, msg: await request(`/api/ledger/${Number(args.BillingID)}`, 'DELETE', { reason: args.reason || '' }) }; }
      catch (error) { return { code: 0, msg: error instanceof Error ? error.message : String(error) }; }
    });

    ipcMain.handle(IPC.Reset, async (_event, args): Promise<ApiResult> => {
      try {
        const result = await request('/api/admin/reset', 'POST', {
          confirmation: String(args?.confirmation || ''),
        });
        return { code: 1, msg: result };
      } catch (error) {
        return { code: 0, msg: error instanceof Error ? error.message : String(error) };
      }
    });
  }
}
