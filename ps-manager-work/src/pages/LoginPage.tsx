import { FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { IPC } from '../../common/constants';
import logo from '../assets/logo.png';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await window.ipcRenderer.invoke(IPC.Login, { username, password });

      if (result?.code !== 1) {
        const message = result?.msg || 'Login failed. Check your credentials.';
        setError(message);
        return;
      }

      setPassword('');
      toast.success('Login successful.');
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-black px-4 text-white">
      <section className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-7 shadow-2xl sm:p-9">
        <div className="mb-7 flex flex-col items-center text-center">
          <img src={logo} alt="GRINDxGAMING" className="mb-4 h-20 w-20 rounded-2xl object-cover" />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-400">GRINDxGAMING</p>
          <h1 className="mt-2 text-2xl font-bold">PlayStation Manager</h1>
          <p className="mt-2 text-sm text-neutral-400">Sign in with your administrator account</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="admin-username" className="mb-1.5 block text-sm text-neutral-300">
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none transition focus:border-red-500"
              placeholder="Administrator username"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-sm text-neutral-300">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none transition focus:border-red-500"
              placeholder="Administrator password"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full rounded-lg bg-red-700 py-3 font-semibold transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Your administrator session is secured by the GRINDxGAMING API.
        </p>
      </section>
    </main>
  );
};

export default LoginPage;
