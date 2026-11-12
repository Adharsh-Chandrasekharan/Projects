import { useNavigate } from 'react-router-dom';
import { Playstation } from '../types';
import imagePath from '../assets/photo1.jpg';
import ElapsedTimer from './ElapsedTimer';

interface CardProps {
  ps: Playstation;
}

const Card: React.FC<CardProps> = ({ ps }) => {
  const navigate = useNavigate();
  const available = ps.IsAvailable;

  return (
    <article className={`group relative flex min-h-[270px] flex-col overflow-hidden rounded-2xl border p-3 transition ${available ? 'border-emerald-900/70 bg-emerald-950/20 hover:border-emerald-700' : 'border-rose-900/70 bg-rose-950/20 hover:border-rose-700'}`}>
      <div className="relative h-36 overflow-hidden rounded-xl bg-neutral-900">
        <img src={imagePath} alt="PlayStation console" className="h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-105" />
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${available ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
          {available ? 'Available' : 'In session'}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-1 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-white">{ps.PlayStationName}</h3>
            <p className="mt-1 text-xs text-neutral-500">{ps.PlayStationType} · Console #{ps.PlayStationID}</p>
          </div>
          <span className="rounded-lg bg-neutral-800 px-2 py-1 text-xs text-neutral-300">{ps.rates?.length || 0} rate tiers</span>
        </div>
        {!available && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-black/30 px-3 py-2">
            <span className="text-xs text-neutral-400">Elapsed time</span>
            <ElapsedTimer startTime={ps.StartTime} compact />
          </div>
        )}
        <button type="button" onClick={() => navigate(`/console/${ps.PlayStationID}`)} className="mt-auto w-full rounded-lg bg-gradient-to-r from-sky-700 to-fuchsia-700 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-sky-400">
          Manage console
        </button>
      </div>
    </article>
  );
};

export default Card;
