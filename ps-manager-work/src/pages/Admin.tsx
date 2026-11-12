import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import { usePlaystations } from '../hooks/usePlaystations';
import { IPC } from '../../common/constants';

const inputClass = 'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-white outline-none focus:border-sky-500';

const Admin: React.FC = () => {
  const { playstations, getAllPlaystations } = usePlaystations();
  const [selectedConsole, setSelectedConsole] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAllPlaystations();
  }, [getAllPlaystations]);

  const deleteConsole = async () => {
    if (!selectedConsole) return toast.error('Select a console to delete.');

    const selected = playstations.find((item) => item.PlayStationID === Number(selectedConsole));
    if (!selected) return toast.error('The selected console could not be found.');
    if (!selected.IsAvailable) return toast.error('End the active session before deleting this console.');

    const confirmed = window.confirm(
      `Delete ${selected.PlayStationName}? Historical session and billing records will be retained.`,
    );
    if (!confirmed) return;

    setBusy(true);
    const response = await window.ipcRenderer.invoke(IPC.Delete, {
      PlayStationID: Number(selectedConsole),
    });
    setBusy(false);

    if (response.code !== 1) return toast.error(response.msg || 'Could not delete console.');

    toast.success('Console removed. Historical billing records are retained.');
    setSelectedConsole('');
    await getAllPlaystations();
  };

  const resetDatabase = async () => {
    const confirmation = window.prompt(
      'This permanently deletes all consoles, pricing, sessions and billing records. Type RESET ALL DATA to continue.',
    );
    if (confirmation !== 'RESET ALL DATA') {
      if (confirmation !== null) toast.error('Confirmation text did not match.');
      return;
    }

    setBusy(true);
    const response = await window.ipcRenderer.invoke(IPC.Reset, {
      confirmation: 'RESET ALL DATA',
    });
    setBusy(false);

    if (response.code !== 1) return toast.error(response.msg || 'Could not reset database.');

    toast.success('All PlayStation Manager records were deleted.');
    await getAllPlaystations();
  };

  return (
    <main className="h-screen min-w-0 flex-1 overflow-y-auto bg-black p-2 text-white sm:p-3 sm:pr-4">
      <Header className="rounded-2xl">
        <div className="px-1 py-1 sm:px-2 sm:py-2">
          <h1 className="text-xl font-bold sm:text-2xl">Admin settings</h1>
          <p className="mt-1 text-xs text-neutral-300 sm:text-sm">
            Manage console inventory and administrator access.
          </p>
        </div>
      </Header>

      <div className="mx-auto mt-5 grid max-w-5xl gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Delete a console</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Only available consoles can be removed. Historical session and billing records remain in Azure SQL.
          </p>

          <label className="mb-1.5 mt-5 block text-sm text-neutral-400" htmlFor="delete-console">
            Console
          </label>
          <select
            id="delete-console"
            className={inputClass}
            value={selectedConsole}
            onChange={(event) => setSelectedConsole(event.target.value)}
          >
            <option value="">Select console</option>
            {playstations.map((ps) => (
              <option key={ps.PlayStationID} value={ps.PlayStationID}>
                {ps.PlayStationName} ({ps.PlayStationType}){!ps.IsAvailable ? ' — In session' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={deleteConsole}
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-rose-700 py-2.5 font-semibold hover:bg-rose-600 disabled:opacity-50"
          >
            Delete console
          </button>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="text-lg font-semibold">Administrator login</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Administrator credentials are managed by the API server, not stored on this Windows computer.
            To change the username or password, update API_ADMIN_USERNAME or API_ADMIN_PASSWORD in the
            API server environment settings, then restart the API service. Sign in again with the new credentials.
          </p>
          <p className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-xs text-neutral-500">
            For security, the desktop application does not save your administrator password.
            Your login token is held in memory and expires after the configured session period.
          </p>
        </section>

        <section className="rounded-2xl border border-rose-950 bg-rose-950/10 p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-rose-300">Reset all data</h2>
          <p className="mt-1 text-sm text-neutral-500">
            This permanently clears consoles, pricing, active sessions and billing history from PlayStationManager.
          </p>
          <button
            onClick={resetDatabase}
            disabled={busy}
            className="mt-4 rounded-lg bg-rose-800 px-6 py-2.5 font-semibold hover:bg-rose-700 disabled:opacity-50"
          >
            Reset database
          </button>
        </section>
      </div>
    </main>
  );
};

export default Admin;
