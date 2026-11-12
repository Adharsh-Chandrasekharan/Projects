import Header from '../components/Header';
import Content from '../components/PageContent';
import { lables } from '../../common/constants';
import imagePath from '../assets/logo.png';

const MainPage = () => (
  <main className="flex h-screen min-w-0 flex-1 flex-col gap-y-4 overflow-hidden bg-black p-2 sm:p-3 sm:pr-4">
    <Header className="rounded-2xl">
      <div className="flex items-center gap-3 px-1 py-1 sm:gap-4 sm:px-3 sm:py-2">
        <img className="h-12 w-12 shrink-0 rounded-xl object-cover sm:h-14 sm:w-14" src={imagePath} alt="PlayStation Manager logo" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-white sm:text-lg">PlayStation Manager</p>
          <p className="text-xs text-neutral-400 sm:text-sm">Console availability and live session control</p>
        </div>
      </div>
    </Header>
    <div className="flex items-end justify-between px-1">
      <div>
        <h1 className="text-xl font-bold text-white sm:text-2xl">{lables.AllPlayStations}</h1>
        <p className="mt-1 text-xs text-neutral-500 sm:text-sm">Select any console to reserve or manage its session.</p>
      </div>
    </div>
    <Content />
  </main>
);

export default MainPage;
