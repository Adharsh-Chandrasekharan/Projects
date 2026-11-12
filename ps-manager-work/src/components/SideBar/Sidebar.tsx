import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { HiHome, HiOutlineX } from 'react-icons/hi';
import { TbUserEdit } from 'react-icons/tb';
import { twMerge } from 'tailwind-merge';
import { useMobileSidebar } from '../../context/MobileSidebarContext';
import Box from './Box';
import Library from './Library';
import SidebarItem from './SidebarItem';

function Sidebar() {
  const location = useLocation();
  const { isOpen, close } = useMobileSidebar();

  const routes = useMemo(() => [
    { icon: HiHome, label: 'Home', active: location.pathname === '/' || location.pathname.startsWith('/console/'), href: '/' },
    { icon: TbUserEdit, label: 'Admin', active: location.pathname === '/admin', href: '/admin' },
  ], [location.pathname]);

  useEffect(() => {
    close();
  }, [location.pathname, close]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
        onClick={close}
        className={twMerge(
          'fixed inset-0 z-40 bg-black/60 transition-opacity md:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={twMerge(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-[min(280px,85vw)] shrink-0 flex-col gap-y-3 bg-black p-3 transition-transform duration-300 ease-out md:relative md:z-auto md:w-[280px] md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between px-2 md:hidden">
          <p className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Menu</p>
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
          >
            <HiOutlineX size={22} />
          </button>
        </div>

        <Box>
          <div className="flex flex-col gap-y-3 px-5 py-4">
            {routes.map((item) => <SidebarItem key={item.label} {...item} />)}
          </div>
        </Box>
        <Box className="h-full overflow-y-auto">
          <Library />
        </Box>
      </aside>
    </>
  );
}

export default Sidebar;
