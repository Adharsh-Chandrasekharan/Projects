import Admin from './pages/Admin';
import MainPage from './pages/MainPage';
import ConsolePage from './pages/ConsolePage';
import Sidebar from './components/SideBar/Sidebar';
import { Routes, Route } from 'react-router-dom';
import { MobileSidebarProvider } from './context/MobileSidebarContext';
import SessionAlarm from './components/SessionAlarm'

function App() {
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
