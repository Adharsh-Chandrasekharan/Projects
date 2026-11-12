import { useEffect, useState } from 'react';
import Admin from './pages/Admin';
import MainPage from './pages/MainPage';
import ConsolePage from './pages/ConsolePage';
import LoginPage from './pages/LoginPage';
import Sidebar from './components/SideBar/Sidebar';
import { Routes, Route } from 'react-router-dom';
import { MobileSidebarProvider } from './context/MobileSidebarContext';
import SessionAlarm from './components/SessionAlarm';
import { IPC } from '../common/constants';

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = window.ipcRenderer.on?.(IPC.AuthExpired, () => {
      setAuthenticated(false);
      setAuthChecked(true);
    });

    window.ipcRenderer.invoke(IPC.AuthStatus)
      .then((result) => {
        if (!mounted) return;
        setAuthenticated(Boolean(result?.authenticated));
        setAuthChecked(true);
      })
      .catch(() => {
        if (!mounted) return;
        setAuthenticated(false);
        setAuthChecked(true);
      });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-sm text-neutral-400">
        Starting GRINDxGAMING PlayStation Manager...
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <MobileSidebarProvider>
      <div className="relative flex h-screen overflow-hidden bg-black">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/console/:id" element={<ConsolePage />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </div>
      <SessionAlarm />
    </MobileSidebarProvider>
  );
}

export default App;
