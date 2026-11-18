import { useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { usePlaystations } from '../hooks/usePlaystations';

/** Refreshes shared console state and asks any mounted data views (such as Ledger) to reload. */
const RefreshButton: React.FC = () => {
  const { getAllPlaystations } = usePlaystations();
  const [refreshing, setRefreshing] = useState(false);

  const refreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);

    // Ledger listens for this event and reloads using its currently selected date range.
    window.dispatchEvent(new Event('app:refresh-ledger'));

    const result = await getAllPlaystations();
    setRefreshing(false);

    if (!result.success) {
      toast.error(result.message || 'Could not refresh console data.');
      return;
    }

  };

  return (
    <button
      type="button"
      onClick={refreshAll}
      disabled={refreshing}
      aria-label="Refresh all data"
      title="Refresh consoles and ledger"
      className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/25 bg-black/40 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-black/60 active:scale-[.98] disabled:cursor-wait disabled:opacity-60 sm:text-sm"
    >
      <FiRefreshCw className={refreshing ? 'animate-spin' : ''} size={16} />
      <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
    </button>
  );
};

export default RefreshButton;
