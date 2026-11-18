import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineMenuAlt2 } from 'react-icons/hi';
import { SESSION_DURATIONS } from '../../common/constants';
import { ConsoleRate } from '../types';
import { usePlaystations } from '../hooks/usePlaystations';
import { calculateClientQuote, currency } from '../functions/rates';
import { useMobileSidebar } from '../context/MobileSidebarContext';
import ElapsedTimer from '../components/ElapsedTimer';
import RateEditor from '../components/RateEditor';
import RefreshButton from '../components/RefreshButton';

const labelClass = 'mb-1.5 block text-sm text-neutral-400';
const fieldClass = 'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-white outline-none focus:border-sky-500';

const ConsolePage: React.FC = () => {
  const { id } = useParams();
  const consoleId = Number(id);
  const navigate = useNavigate();
  const { open: openMenu } = useMobileSidebar();
  const { playstations, hasLoaded, getAllPlaystations, reserveSession, endSession, addPlayers, extendTime, updateRates } = usePlaystations();
  const [players, setPlayers] = useState(2);
  const [duration, setDuration] = useState(60);
  const [discount, setDiscount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingRates, setEditingRates] = useState(false);
  const [draftRates, setDraftRates] = useState<ConsoleRate[]>([]);
  const initialFetchAttempted = useRef(false);

  useEffect(() => {
    // Normally Home has already loaded the console list. Fetch only once
    // when this route is opened directly and the in-memory store is empty.
    if (!hasLoaded && !initialFetchAttempted.current) {
      initialFetchAttempted.current = true;
      void getAllPlaystations();
    }
  }, [hasLoaded, getAllPlaystations]);

  const consoleData = playstations.find((item) => item.PlayStationID === consoleId);
  const active = Boolean(consoleData && !consoleData.IsAvailable);
  const selectedRate = useMemo(
    () => consoleData?.rates?.find((rate) => rate.PlayersNumber === players),
    [consoleData?.rates, players],
  );
  const quote = selectedRate ? calculateClientQuote(selectedRate, duration, Math.min(100, Math.max(0, discount))) : null;
  const missingRequiredRate = Boolean(selectedRate && (
    (duration >= 60 && selectedRate.HourlyAmount <= 0) ||
    (duration % 60 === 30 && selectedRate.HalfHourAmount <= 0)
  ));

  const showError = (message?: string) => toast.error(message || 'Something went wrong. Please try again.');

  const handleReserve = async () => {
    if (!consoleData || !selectedRate) return;
    if (missingRequiredRate) {
      showError('Set the required rate for this player count and duration before reserving.');
      return;
    }
    setSaving(true);
    const result = await reserveSession(consoleData.PlayStationID, players, duration, discount);
    setSaving(false);
    if (!result.success) {
      showError(result.message);
      return;
    }
    toast.success(`${consoleData.PlayStationName} reserved successfully.`);
  };

  const handleEnd = async () => {
    if (!consoleData) return;
    if (!window.confirm(`End the session on ${consoleData.PlayStationName}?`)) return;
    setSaving(true);
    const result = await endSession(consoleData.PlayStationID);
    setSaving(false);
    if (!result.success) {
      showError(result.message);
      return;
    }
    toast.success('Session ended. Billing record saved to Azure SQL.');
  };

  const handleAddPlayer = async () => {
    if (!consoleData) return;
    const current = Number(consoleData.ActivePlayersNumber || 0);
    if (current >= 4) return;
    const result = await addPlayers(consoleData.PlayStationID, 1);
    if (!result.success) showError(result.message);
    else toast.success('Player added and session amount recalculated.');
  };

  const handleExtend = async (minutes: number) => {
    if (!consoleData) return;
    const result = await extendTime(consoleData.PlayStationID, minutes);
    if (!result.success) showError(result.message);
    else toast.success('Session extended and amount recalculated.');
  };

  const handleSaveRates = async () => {
    if (!consoleData) return;
    setSaving(true);
    const result = await updateRates(consoleData.PlayStationID, draftRates);
    setSaving(false);
    if (!result.success) {
      showError(result.message);
      return;
    }
    setEditingRates(false);
    toast.success('Console rates updated.');
  };

  if (!Number.isInteger(consoleId) || consoleId <= 0) {
    return <div className="flex-1 p-8 text-white">Invalid console. <button onClick={() => navigate('/')} className="text-sky-400">Go home</button></div>;
  }

  if (!consoleData) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center bg-black p-8 text-center text-white">
        <div>
          <p className="text-xl font-semibold">Console not found</p>
          <p className="mt-2 text-sm text-neutral-500">It may have been removed or the database is not connected.</p>
          <button onClick={() => navigate('/')} className="mt-5 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold">Back to home</button>
        </div>
      </main>
    );
  }

  const activePlayers = Number(consoleData.ActivePlayersNumber || 0);
  const activeDuration = Number(consoleData.ActiveDurationMinutes || 0);

  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-black p-2 text-white sm:p-3 sm:pr-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-start gap-2">
            <button
              type="button"
              aria-label="Open menu"
              onClick={openMenu}
              className="mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-neutral-800 p-2 text-white transition hover:bg-neutral-700 md:hidden"
            >
              <HiOutlineMenuAlt2 size={20} />
            </button>
            <div className="min-w-0">
              <button onClick={() => navigate('/')} className="mb-2 text-xs text-neutral-500 transition hover:text-white">← Back to all consoles</button>
              <h1 className="truncate text-xl font-bold sm:text-2xl">{consoleData.PlayStationName}</h1>
              <p className="mt-1 text-xs text-neutral-500 sm:text-sm">{consoleData.PlayStationType} · Console #{consoleData.PlayStationID}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RefreshButton />
            <span className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider sm:px-3 sm:text-xs ${active ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
              {active ? 'In session' : 'Available'}
            </span>
          </div>
        </div>

        {active ? (
          <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <section className="rounded-2xl border border-rose-900/60 bg-gradient-to-br from-rose-950/30 to-neutral-950 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.2em] text-neutral-400">Live session timer</p>
                  <div className="mt-3"><ElapsedTimer startTime={consoleData.StartTime} /></div>
                  <p className="mt-2 text-xs text-neutral-500">Hours : minutes : seconds</p>
                </div>
                <div className="rounded-xl bg-black/30 px-4 py-3 text-right">
                  <p className="text-xs text-neutral-500">Players</p>
                  <p className="mt-1 text-2xl font-bold">{activePlayers}<span className="text-sm text-neutral-500"> / 4</span></p>
                </div>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-3">
                <InfoTile label="Booked duration" value={`${Math.floor(activeDuration / 60)}h ${activeDuration % 60}m`} />
                <InfoTile label="Start time" value={consoleData.StartTime ? new Date(consoleData.StartTime.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} />
                <InfoTile label="Subtotal" value={currency(Number(consoleData.ActiveGrossAmount || 0))} />
                <InfoTile label={`Discount (${Number(consoleData.ActiveDiscountPercent || 0)}%)`} value={`−${currency(Number(consoleData.ActiveDiscountAmount || 0))}`} />
              </div>
              <div className="mt-4 flex items-end justify-between rounded-xl border border-rose-900/50 bg-black/30 p-4">
                <div>
                  <p className="text-sm text-neutral-400">Final session amount</p>
                  <p className="mt-1 text-3xl font-bold text-white">{currency(Number(consoleData.ActiveTotalAmount || 0))}</p>
                  <p className="mt-1 text-xs text-neutral-500">{currency(Number(consoleData.ActivePerPersonAmount || 0))} per person</p>
                </div>
                <span className="text-xs text-neutral-500">INR</span>
              </div>
              <button type="button" disabled={saving} onClick={handleEnd} className="mt-5 w-full rounded-xl bg-rose-600 py-3 font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50">END SESSION</button>
            </section>

            <section className="space-y-4">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
                <h2 className="text-lg font-semibold">Manage session</h2>
                <p className="mt-1 text-sm text-neutral-500">Adjust the player count or add more time. The saved quote is recalculated automatically.</p>
                <button type="button" disabled={activePlayers >= 4} onClick={handleAddPlayer} className="mt-5 w-full rounded-lg border border-emerald-800 bg-emerald-950/40 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-900/50 disabled:cursor-not-allowed disabled:opacity-40">+ Add 1 player</button>
                <div className="mt-5">
                  <p className="mb-2 text-sm text-neutral-400">Extend time</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[30, 60, 90, 120].map((minutes) => <button key={minutes} type="button" onClick={() => handleExtend(minutes)} className="rounded-lg border border-neutral-700 bg-neutral-900 py-2 text-sm text-neutral-200 hover:border-sky-600 hover:text-white">+{minutes < 60 ? `${minutes} min` : `${minutes / 60} hr${minutes > 60 ? 's' : ''}`}</button>)}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
                <h2 className="text-sm font-semibold text-neutral-200">Current rate snapshot</h2>
                <p className="mt-3 text-xs text-neutral-500">1 hour total: <span className="font-semibold text-white">{currency(Number((consoleData.rates || []).find((rate) => rate.PlayersNumber === activePlayers)?.HourlyAmount || 0))}</span></p>
                <p className="mt-1 text-xs text-neutral-500">30 minutes total: <span className="font-semibold text-white">{currency(Number((consoleData.rates || []).find((rate) => rate.PlayersNumber === activePlayers)?.HalfHourAmount || 0))}</span></p>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
              <div className="mb-5">
                <h2 className="text-xl font-semibold">Reserve console</h2>
                <p className="mt-1 text-sm text-neutral-500">Choose the player count and booking duration. Rates are taken from this console's setup.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Number of players</label>
                  <select className={fieldClass} value={players} onChange={(event) => setPlayers(Number(event.target.value))}>
                    {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} {count === 1 ? 'player' : 'players'}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Session duration</label>
                  <select className={fieldClass} value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                    {SESSION_DURATIONS.map((item) => <option key={item.minutes} value={item.minutes}>{item.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-5">
                <label className={labelClass}>Discount (%)</label>
                <div className="relative">
                  <input className={`${fieldClass} pr-10`} type="number" min="0" max="100" step="1" value={discount} onChange={(event) => setDiscount(Math.min(100, Math.max(0, Number(event.target.value))))} />
                  <span className="absolute right-3 top-2.5 text-neutral-500">%</span>
                </div>
                <p className="mt-1 text-xs text-neutral-600">Enter 0 for no discount. Maximum discount is 100%.</p>
              </div>
              <button type="button" disabled={saving || !quote || missingRequiredRate} onClick={handleReserve} className="mt-6 w-full rounded-xl bg-gradient-to-r from-sky-700 to-fuchsia-700 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{saving ? 'Reserving…' : 'RESERVE CONSOLE'}</button>
            </section>

            <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
              <h2 className="text-lg font-semibold">Price estimate</h2>
              <p className="mt-1 text-xs text-neutral-500">{players} {players === 1 ? 'player' : 'players'} · {SESSION_DURATIONS.find((item) => item.minutes === duration)?.label}</p>
              {selectedRate ? (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <InfoTile label="1 hour rate" value={currency(selectedRate.HourlyAmount)} />
                    <InfoTile label="30 minute rate" value={currency(selectedRate.HalfHourAmount)} />
                  </div>
                  <div className="mt-5 space-y-3 border-t border-neutral-800 pt-4 text-sm">
                    <PriceRow label="Subtotal" value={currency(quote?.grossAmount || 0)} />
                    <PriceRow label={`Discount (${discount || 0}%)`} value={`−${currency(quote?.discountAmount || 0)}`} accent="text-emerald-300" />
                    <div className="border-t border-neutral-800 pt-3">
                      <PriceRow label="Total amount" value={currency(quote?.totalAmount || 0)} strong />
                    </div>
                  </div>
                  <p className="mt-4 text-right text-xs text-neutral-500">{currency(quote?.perPersonAmount || 0)} per person</p>
                  {missingRequiredRate && <p className="mt-4 rounded-lg bg-amber-950/40 p-3 text-xs text-amber-300">A required rate is missing for this duration. Edit the rates below before reserving.</p>}
                </>
              ) : <p className="mt-4 text-sm text-neutral-500">No rate exists for this player count. Update the console rates below.</p>}

              <div className="mt-7 border-t border-neutral-800 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Console pricing</p>
                    <p className="mt-1 text-xs text-neutral-500">Set the 1-hour and 30-minute total for each group size.</p>
                  </div>
                  <button type="button" onClick={() => { if (!editingRates) setDraftRates(consoleData.rates.map((rate) => ({ ...rate }))); setEditingRates((value) => !value); }} className="shrink-0 rounded-lg border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-200 hover:border-sky-600">{editingRates ? 'Cancel' : 'Edit rates'}</button>
                </div>
                {editingRates && (
                  <div className="mt-4 space-y-3">
                    <RateEditor rates={draftRates} onChange={setDraftRates} />
                    <button type="button" disabled={saving} onClick={handleSaveRates} className="w-full rounded-lg bg-sky-700 py-2.5 text-sm font-semibold hover:bg-sky-600 disabled:opacity-50">{saving ? 'Saving…' : 'Save rates'}</button>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
};

const InfoTile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-neutral-800 bg-black/20 px-4 py-3">
    <p className="text-xs text-neutral-500">{label}</p>
    <p className="mt-1 font-semibold text-white">{value}</p>
  </div>
);

const PriceRow: React.FC<{ label: string; value: string; accent?: string; strong?: boolean }> = ({ label, value, accent = 'text-white', strong = false }) => (
  <div className="flex items-center justify-between gap-4">
    <span className={strong ? 'font-semibold text-white' : 'text-neutral-400'}>{label}</span>
    <span className={`${strong ? 'text-xl font-bold' : 'font-medium'} ${accent}`}>{value}</span>
  </div>
);

export default ConsolePage;
