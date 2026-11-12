import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Header from '../components/Header';
import PasswordInput from '../components/PasswordInput';
import { confirmPassword } from '../functions/confirmByPass';
import { usePlaystations } from '../hooks/usePlaystations';
import { IPC } from '../../common/constants';

const inputClass = 'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-white outline-none focus:border-sky-500';

const Admin: React.FC = () => {
  const { playstations, getAllPlaystations } = usePlaystations();
  const [selectedConsole, setSelectedConsole] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => { getAllPlaystations(); }, [getAllPlaystations]);

  const deleteConsole = async () => {
    if (!selectedConsole) return toast.error('Select a console to delete.');
    if (!(await confirmPassword(currentPassword))) return toast.error('Invalid admin password.');
    const response = await window.ipcRenderer.invoke(IPC.Delete, { PlayStationID: Number(selectedConsole) });
    if (response.code !== 1) return toast.error(response.msg || 'Could not delete console.');
    toast.success('Console removed from the active console list. Its billing history is retained.');
    setSelectedConsole('');
    setCurrentPassword('');
    await getAllPlaystations();
  };

  const updatePassword = async () => {
    if (!(await confirmPassword(currentPassword))) return toast.error('Invalid current password.');
    if (newPassword.length < 6) return toast.error('New password must contain at least 6 characters.');
    if (newPassword !== confirmNewPassword) return toast.error('New passwords do not match.');
    const response = await window.ipcRenderer.invoke(IPC.UpdataPassword, { newPassword });
    if (response.code !== 1) return toast.error(response.msg || 'Could not update password.');
    toast.success('Admin password updated.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const resetDatabase = async () => {
    if (!(await confirmPassword(currentPassword))) return toast.error('Invalid admin password.');
    if (!window.confirm('This permanently deletes all consoles, sessions and billing records in PlayStationManager. Continue?')) return;
    const response = await window.ipcRenderer.invoke(IPC.Reset);
    if (response.code !== 1) return toast.error(response.msg || 'Could not reset database.');
    toast.success('All PlayStation Manager records were deleted.');
    setCurrentPassword('');
    await getAllPlaystations();
  };

  return (
    <main className="h-screen min-w-0 flex-1 overflow-y-auto bg-black p-2 text-white sm:p-3 sm:pr-4">
      <Header className="rounded-2xl">
        <div className="px-1 py-1 sm:px-2 sm:py-2">
          <h1 className="text-xl font-bold sm:text-2xl">Admin settings</h1>
          <p className="mt-1 text-xs text-neutral-300 sm:text-sm">Manage console inventory and local administrator access.</p>
        </div>
      </Header>
      <div className="mx-auto mt-5 grid max-w-5xl gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Delete a console</h2>
          <p className="mt-1 text-sm text-neutral-500">Only available consoles can be removed. Historical session and billing records remain in Azure SQL.</p>
          <label className="mb-1.5 mt-5 block text-sm text-neutral-400">Console</label>
          <select className={inputClass} value={selectedConsole} onChange={(event) => setSelectedConsole(event.target.value)}>
            <option value="">Select console</option>
            {playstations.map((ps) => <option key={ps.PlayStationID} value={ps.PlayStationID}>{ps.PlayStationName} ({ps.PlayStationType}){!ps.IsAvailable ? ' — In session' : ''}</option>)}
          </select>
          <div className="mt-4"><PasswordInput label="Admin password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full rounded-lg bg-neutral-900 p-2.5" /></div>
          <button onClick={deleteConsole} className="mt-4 w-full rounded-lg bg-rose-700 py-2.5 font-semibold hover:bg-rose-600">Delete console</button>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
          <h2 className="text-lg font-semibold">Change admin password</h2>
          <p className="mt-1 text-sm text-neutral-500">The password is stored locally on this Windows machine.</p>
          <div className="mt-5 space-y-3">
            <PasswordInput label="Current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full rounded-lg bg-neutral-900 p-2.5" />
            <PasswordInput label="New password (minimum 6 characters)" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-lg bg-neutral-900 p-2.5" />
            <PasswordInput label="Confirm new password" value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} className="w-full rounded-lg bg-neutral-900 p-2.5" />
          </div>
          <button onClick={updatePassword} className="mt-4 w-full rounded-lg bg-sky-700 py-2.5 font-semibold hover:bg-sky-600">Update password</button>
        </section>

        <section className="rounded-2xl border border-rose-950 bg-rose-950/10 p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-rose-300">Reset all data</h2>
          <p className="mt-1 text-sm text-neutral-500">This clears consoles, pricing, active sessions and billing history from the PlayStationManager database.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1"><PasswordInput label="Admin password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full rounded-lg bg-neutral-950 p-2.5" /></div>
            <button onClick={resetDatabase} className="rounded-lg bg-rose-800 px-6 py-2.5 font-semibold hover:bg-rose-700">Reset database</button>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Admin;
