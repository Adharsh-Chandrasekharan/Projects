import { twMerge } from 'tailwind-merge';
import { useNavigate } from 'react-router-dom';
import { HiOutlineMenuAlt2 } from 'react-icons/hi';
import { RxCaretLeft, RxCaretRight } from 'react-icons/rx';
import { useMobileSidebar } from '../context/MobileSidebarContext';
import RefreshButton from './RefreshButton';

interface HeaderProps {
  children?: React.ReactNode;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ children, className }) => {
  const navigate = useNavigate();
  const { open } = useMobileSidebar();

  return (
    <div
      className={twMerge(
        `
      h-fit
      min-w-0
      bg-gradient-to-b
      from-red-800
      p-3
      sm:p-6
      `,
        className,
      )}
    >
      <div className="mb-3 flex w-full items-center justify-between gap-3 sm:mb-4">
        <div className="hidden items-center gap-x-2 md:flex">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center justify-center rounded-full bg-black transition hover:opacity-75"
          >
            <RxCaretLeft className="text-white" size={35} />
          </button>

          <button
            type="button"
            onClick={() => navigate(1)}
            className="flex items-center justify-center rounded-full bg-black transition hover:opacity-75"
          >
            <RxCaretRight className="text-white" size={35} />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-x-2 md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              onClick={open}
              className="flex items-center justify-center rounded-full bg-white p-2 transition hover:opacity-75"
            >
              <HiOutlineMenuAlt2 className="text-black" size={20} />
            </button>
          </div>
          <RefreshButton />
        </div>
      </div>
      {children}
    </div>
  );
};

export default Header;
