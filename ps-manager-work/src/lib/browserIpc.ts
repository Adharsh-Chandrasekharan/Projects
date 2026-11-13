import { IPC } from '../../common/constants';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ||
  'https://grindxgaming-h2agb4hgh7dhgmam.centralindia-01.azurewebsites.net').replace(/\/+$/, '');

const TOKEN_KEY = 'grindxgaming_api_token';
const EXPIRY_KEY = 'grindxgaming_api_token_expiry';

type Result = { code: number; msg?: any };

function getToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiry = Number(sessionStorage.getItem(EXPIRY_KEY) || 0);
  if (!token || Date.now() >= expiry) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRY_KEY);
    return null;
  }
  return token;
}

const listeners = new Map<string, Set<(...args: any[]) => void>>();
function emit(channel: string, ...args: any[]) {
  listeners.get(channel)?.forEach(listener => listener(...args));
}

async function apiRequest(path: string, method = 'GET', body?: unknown) {
  const token = getToken();
  if (!token) throw new Error('Your login has expired. Please sign in again.');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRY_KEY);
    emit(IPC.AuthExpired);
  }
  if (!response.ok) throw new Error(payload?.message || `API request failed (${response.status}).`);
  return payload;
}

async function invoke(channel: string, ...args: any[]): Promise<Result> {
  const input = args[0] || {};
  try {
    if (channel === IPC.AuthStatus) return { code: 1, authenticated: !!getToken() } as any;

    if (channel === IPC.Login) {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: String(input.username || ''), password: String(input.password || '') }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload?.token !== 'string') {
        throw new Error(payload?.message || 'Login failed. Check your username and password.');
      }
      sessionStorage.setItem(TOKEN_KEY, payload.token);
      sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + Number(payload.expiresIn || 28800) * 1000));
      return { code: 1 };
    }

    if (channel === IPC.Logout) {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(EXPIRY_KEY);
      return { code: 1 };
    }

    if (channel === IPC.getAllPlaystations) return { code: 1, msg: await apiRequest('/api/consoles') };

    if (channel === IPC.createPlaystation) {
      const created = await apiRequest('/api/consoles', 'POST', input);
      const consoles = await apiRequest('/api/consoles');
      return { code: 1, msg: consoles.find((item: any) => Number(item.PlayStationID) === Number(created.id)) };
    }

    if (channel === IPC.getSession) {
      const session = await apiRequest(`/api/consoles/${Number(input.PlayStationID)}/session`);
      return session ? { code: 1, msg: session } : { code: 0, msg: 'No active session found for this console.' };
    }

    if (channel === IPC.Reserve) return { code: 1, msg: await apiRequest('/api/sessions/reserve', 'POST', input) };
    if (channel === IPC.End) return { code: 1, msg: await apiRequest('/api/sessions/end', 'POST', input) };
    if (channel === IPC.AddPlayers) return { code: 1, msg: await apiRequest('/api/sessions/add-players', 'POST', input) };
    if (channel === IPC.ExtendTime) return { code: 1, msg: await apiRequest('/api/sessions/extend', 'POST', input) };
    if (channel === IPC.UpdateRates) return { code: 1, msg: await apiRequest(`/api/consoles/${Number(input.PlayStationID)}/rates`, 'PUT', { rates: input.rates }) };
    if (channel === IPC.Delete) return { code: 1, msg: await apiRequest(`/api/consoles/${Number(input.PlayStationID)}`, 'DELETE') };
    if (channel === IPC.GetLedger) {
      const params = new URLSearchParams({ from: String(input.from || ''), to: String(input.to || '') });
      return { code: 1, msg: await apiRequest(`/api/ledger?${params.toString()}`) };
    }
    if (channel === IPC.GetBillingHistory) return { code: 1, msg: await apiRequest(`/api/ledger/${Number(input.SessionID)}/history`) };
    if (channel === IPC.EditBilling) return { code: 1, msg: await apiRequest(`/api/ledger/${Number(input.BillingID)}`, 'PUT', input) };
    if (channel === IPC.DeleteBilling) return { code: 1, msg: await apiRequest(`/api/ledger/${Number(input.BillingID)}`, 'DELETE', { reason: input.reason || '' }) };

    if (channel === IPC.Reset) return { code: 1, msg: await apiRequest('/api/admin/reset', 'POST', { confirmation: String(input.confirmation || '') }) };

    return { code: 0, msg: `Unsupported browser operation: ${channel}` };
  } catch (error) {
    return { code: 0, msg: error instanceof Error ? error.message : String(error) };
  }
}

export function installBrowserIpc() {
  if (window.ipcRenderer) return;
  window.ipcRenderer = {
    invoke,
    on: (channel: string, listener: (...args: any[]) => void) => {
      if (!listeners.has(channel)) listeners.set(channel, new Set());
      listeners.get(channel)!.add(listener);
      return () => listeners.get(channel)?.delete(listener);
    },
  };
}
