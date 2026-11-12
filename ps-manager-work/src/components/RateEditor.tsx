import { ConsoleRate } from '../types';

interface RateEditorProps {
  rates: ConsoleRate[];
  onChange: (rates: ConsoleRate[]) => void;
}

const inputClass = 'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-right text-white outline-none focus:border-sky-500';

const RateEditor: React.FC<RateEditorProps> = ({ rates, onChange }) => {
  const update = (players: number, field: 'HourlyAmount' | 'HalfHourAmount', value: string) => {
    const parsed = value === '' ? 0 : Math.max(0, Number(value));
    onChange(rates.map((rate) => rate.PlayersNumber === players ? { ...rate, [field]: parsed } : rate));
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-800">
      <table className="w-full min-w-[390px] text-sm">
        <thead className="bg-neutral-900 text-neutral-400">
          <tr>
            <th className="px-3 py-3 text-left font-medium">Players</th>
            <th className="px-3 py-3 text-left font-medium">1 hour total (₹)</th>
            <th className="px-3 py-3 text-left font-medium">30 min total (₹)</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4].map((players) => {
            const rate = rates.find((item) => item.PlayersNumber === players) || {
              PlayersNumber: players, HourlyAmount: 0, HalfHourAmount: 0,
            };
            return (
              <tr key={players} className="border-t border-neutral-800">
                <td className="px-3 py-2.5 text-white">{players} {players === 1 ? 'player' : 'players'}</td>
                <td className="px-3 py-2"><input aria-label={`${players} player hourly rate`} className={inputClass} type="number" min="0" step="1" value={rate.HourlyAmount} onChange={(event) => update(players, 'HourlyAmount', event.target.value)} /></td>
                <td className="px-3 py-2"><input aria-label={`${players} player half-hour rate`} className={inputClass} type="number" min="0" step="1" value={rate.HalfHourAmount} onChange={(event) => update(players, 'HalfHourAmount', event.target.value)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="bg-neutral-950 px-3 py-2 text-xs text-neutral-500">Enter the total charge for the whole group, not the per-person rate.</p>
    </div>
  );
};

export default RateEditor;
