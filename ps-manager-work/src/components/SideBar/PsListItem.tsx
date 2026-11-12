import { useNavigate } from 'react-router-dom';
import { Playstation } from '../../types';
import ElapsedTimer from '../ElapsedTimer';
import imagePath from '../../assets/photo1.jpg';

interface PsListItemProps {
  ps: Playstation;
}

const PsListItem: React.FC<PsListItemProps> = ({ ps }) => {
  const navigate = useNavigate();
  const busy = !ps.IsAvailable;

  return (
    <button
      type="button"
      onClick={() => navigate(`/console/${ps.PlayStationID}`)}
      className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left transition hover:border-neutral-700 hover:bg-neutral-800/70 focus:outline-none focus:ring-2 focus:ring-sky-500"
      title={`Manage ${ps.PlayStationName}`}
    >
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
        <img src={imagePath} alt="PlayStation" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{ps.PlayStationName}</p>
        <p className="truncate text-xs text-neutral-500">{ps.PlayStationType} · Console #{ps.PlayStationID}</p>
        {busy && <ElapsedTimer startTime={ps.StartTime} compact />}
      </div>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${busy ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,.6)]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,.5)]'}`} />
    </button>
  );
};

export default PsListItem;
