import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiBookOpen, FiCalendar, FiEdit2, FiTrash2, FiClock, FiX } from 'react-icons/fi';
import { HiOutlineMenuAlt2 } from 'react-icons/hi';
import { useMobileSidebar } from '../context/MobileSidebarContext';
import RefreshButton from '../components/RefreshButton';
import { IPC } from '../../common/constants';

type Entry = {
  BillingID: number; SessionID: number; PlayStationID: number; PlayStationName: string;
  StartTime: string; EndTime: string; PlayersNumber: number; DurationMinutes: number;
  GrossAmount: number; DiscountPercent: number; DiscountAmount: number;
  TotalAmount: number; PerPersonAmount: number; CreatedAt: string;
};
type BillingEdit = Pick<Entry, 'PlayersNumber'|'DurationMinutes'|'GrossAmount'|'DiscountPercent'|'DiscountAmount'|'TotalAmount'|'PerPersonAmount'> & { EditReason: string };

const money = (v: number) => `₹${Number(v || 0).toFixed(2)}`;
const dateOnly = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const shift = (d: Date, days: number) => { const x = new Date(d); x.setDate(x.getDate()+days); return x; };

export default function Ledger() {
  const { open } = useMobileSidebar();
  const today = new Date();
  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState(dateOnly(today));
  const [to, setTo] = useState(dateOnly(today));
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState<BillingEdit | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const result = await window.ipcRenderer.invoke(IPC.GetLedger, { from, to });
    if (result.code === 1) setRows(result.msg || []);
    else setError(String(result.msg || 'Unable to load ledger.'));
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const refreshLedger = () => { void load(); };
    window.addEventListener('app:refresh-ledger', refreshLedger);
    return () => window.removeEventListener('app:refresh-ledger', refreshLedger);
  }, [load]);

  const choosePreset = (value: string) => {
    const now = new Date();
    setPreset(value);
    if (value === 'today') { setFrom(dateOnly(now)); setTo(dateOnly(now)); }
    if (value === 'yesterday') { const d = shift(now,-1); setFrom(dateOnly(d)); setTo(dateOnly(d)); }
    if (value === 'week') { const day = (now.getDay()+6)%7; setFrom(dateOnly(shift(now,-day))); setTo(dateOnly(now)); }
    if (value === 'month') { setFrom(dateOnly(new Date(now.getFullYear(),now.getMonth(),1))); setTo(dateOnly(now)); }
  };

  const totals = useMemo(() => rows.reduce((a,r) => ({
    gross:a.gross+Number(r.GrossAmount), discount:a.discount+Number(r.DiscountAmount),
    net:a.net+Number(r.TotalAmount), count:a.count+1
  }), {gross:0,discount:0,net:0,count:0}), [rows]);

  const startEdit = (r: Entry) => {
    setEditing(r);
    setForm({
      PlayersNumber:r.PlayersNumber, DurationMinutes:r.DurationMinutes,
      GrossAmount:Number(r.GrossAmount), DiscountPercent:Number(r.DiscountPercent),
      DiscountAmount:Number(r.DiscountAmount), TotalAmount:Number(r.TotalAmount),
      PerPersonAmount:Number(r.PerPersonAmount), EditReason:''
    });
  };
  const setNumber = (key: keyof BillingEdit, value: string) => {
    if (!form) return;
    const next = {...form, [key]: Number(value)};
    if (key === 'GrossAmount' || key === 'DiscountPercent') {
      next.DiscountAmount = Math.round(next.GrossAmount * next.DiscountPercent) / 100;
      next.TotalAmount = Math.round((next.GrossAmount-next.DiscountAmount)*100)/100;
      next.PerPersonAmount = Math.round((next.TotalAmount/Math.max(1,next.PlayersNumber))*100)/100;
    }
    if (key === 'PlayersNumber') next.PerPersonAmount = Math.round((next.TotalAmount/Math.max(1,next.PlayersNumber))*100)/100;
    setForm(next);
  };

  const saveEdit = async () => {
    if (!editing || !form) return;
    setSaving(true);
    const result = await window.ipcRenderer.invoke(IPC.EditBilling, { BillingID:editing.BillingID, ...form });
    setSaving(false);
    if (result.code !== 1) { setError(String(result.msg)); return; }
    setEditing(null); setForm(null); await load();
  };

  const deleteEntry = async (r: Entry) => {
    if (!window.confirm(`Delete billing entry #${r.BillingID}? This action cannot be undone.`)) return;
    const result = await window.ipcRenderer.invoke(IPC.DeleteBilling, { BillingID:r.BillingID, reason:'Deleted from ledger' });
    if (result.code !== 1) { setError(String(result.msg)); return; }
    await load();
  };

  const showHistory = async (r: Entry) => {
    const result = await window.ipcRenderer.invoke(IPC.GetBillingHistory, { SessionID:r.SessionID });
    if (result.code === 1) setHistory(result.msg || []);
    else setError(String(result.msg));
  };

  return <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden bg-black p-3 sm:p-4">
    <header className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-950 p-3 sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open menu"
          onClick={open}
          className="flex shrink-0 items-center justify-center rounded-lg bg-neutral-800 p-2 text-white transition hover:bg-neutral-700 md:hidden"
        >
          <HiOutlineMenuAlt2 size={22} />
        </button>
        <FiBookOpen className="shrink-0 text-2xl text-violet-400" />
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white sm:text-xl">Ledger</h1>
          <p className="hidden text-xs text-neutral-500 sm:block">Session billing and historical corrections</p>
        </div>
      </div>
      <div className="shrink-0"><RefreshButton /></div>
    </header>

    <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
      <div className="mb-3 flex flex-wrap gap-2">
        {[['today','Today'],['yesterday','Yesterday'],['week','This Week'],['month','This Month'],['custom','Custom']].map(([v,label])=>
          <button key={v} onClick={()=> v==='custom'?setPreset('custom'):choosePreset(v)} className={`rounded-lg px-3 py-2 text-sm ${preset===v?'bg-violet-600 text-white':'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'}`}>{label}</button>)}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-neutral-400">From date<input type="date" value={from} onChange={e=>{setFrom(e.target.value);setPreset('custom')}} className="mt-1 block rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white"/></label>
        <label className="text-xs text-neutral-400">To date<input type="date" value={to} min={from} onChange={e=>{setTo(e.target.value);setPreset('custom')}} className="mt-1 block rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white"/></label>
        <button onClick={load} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"><FiCalendar className="mr-2 inline"/>Apply filter</button>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {[['Entries',String(totals.count)],['Gross',money(totals.gross)],['Discounts',money(totals.discount)],['Net revenue',money(totals.net)]].map(([k,v])=><div key={k} className="rounded-xl border border-neutral-800 bg-neutral-950 p-3"><p className="text-xs text-neutral-500">{k}</p><p className="mt-1 text-lg font-bold text-white">{v}</p></div>)}
    </section>

    {error && <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</div>}
    <section className="min-h-0 flex-1 overflow-auto rounded-2xl border border-neutral-800 bg-neutral-950">
      {loading ? <p className="p-6 text-center text-neutral-400">Loading ledger…</p> : rows.length===0 ? <p className="p-8 text-center text-neutral-500">No billing entries for this date range.</p> :
      <table className="w-full min-w-[1050px] text-left text-sm">
        <thead className="sticky top-0 bg-neutral-900 text-xs uppercase text-neutral-400"><tr>{['Session date','Console','Session','Players','Duration','Gross','Discount','Net amount','Actions'].map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead>
        <tbody>{rows.map(r=><tr key={r.BillingID} className="border-t border-neutral-800 text-neutral-300 hover:bg-neutral-900/60">
          <td className="whitespace-nowrap px-3 py-3">{new Date(r.EndTime).toLocaleString()}</td><td className="px-3 py-3 font-semibold text-white">{r.PlayStationName}</td>
          <td className="px-3 py-3">#{r.SessionID}</td><td className="px-3 py-3">{r.PlayersNumber}</td><td className="px-3 py-3">{r.DurationMinutes} min</td>
          <td className="px-3 py-3">{money(r.GrossAmount)}</td><td className="px-3 py-3">{money(r.DiscountAmount)} ({r.DiscountPercent}%)</td><td className="px-3 py-3 font-bold text-emerald-400">{money(r.TotalAmount)}</td>
          <td className="px-3 py-3"><div className="flex gap-2"><button onClick={()=>startEdit(r)} title="Edit" className="rounded-md border border-neutral-700 p-2 hover:bg-neutral-800"><FiEdit2/></button><button onClick={()=>showHistory(r)} title="History" className="rounded-md border border-neutral-700 p-2 hover:bg-neutral-800"><FiClock/></button><button onClick={()=>deleteEntry(r)} title="Delete" className="rounded-md border border-red-900 p-2 text-red-400 hover:bg-red-950"><FiTrash2/></button></div></td>
        </tr>)}</tbody>
      </table>}
    </section>

    {editing && form && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3"><div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl border border-neutral-700 bg-neutral-950 p-5">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-white">Edit billing · Session #{editing.SessionID}</h2><p className="text-xs text-neutral-500">A new billing version will be created.</p></div><button onClick={()=>setEditing(null)}><FiX className="text-xl text-neutral-400"/></button></div>
      <div className="grid grid-cols-2 gap-3">
        {([['PlayersNumber','Players'],['DurationMinutes','Duration (minutes)'],['GrossAmount','Gross amount'],['DiscountPercent','Discount %'],['DiscountAmount','Discount amount'],['TotalAmount','Net amount'],['PerPersonAmount','Per person']] as [keyof BillingEdit,string][]).map(([key,label])=><label key={key} className="text-xs text-neutral-400">{label}<input type="number" min="0" step="0.01" value={form[key] as number} onChange={e=>setNumber(key,e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white"/></label>)}
      </div>
      <label className="mt-3 block text-xs text-neutral-400">Reason for edit<input value={form.EditReason} onChange={e=>setForm({...form,EditReason:e.target.value})} placeholder="Optional reason" className="mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2 text-sm text-white"/></label>
      <div className="mt-5 flex justify-end gap-2"><button onClick={()=>setEditing(null)} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300">Cancel</button><button disabled={saving} onClick={saveEdit} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'Saving…':'Save new version'}</button></div>
    </div></div>}

    {history && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3"><div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl border border-neutral-700 bg-neutral-950 p-5"><div className="mb-4 flex justify-between"><h2 className="font-bold text-white">Billing history</h2><button onClick={()=>setHistory(null)}><FiX className="text-xl text-neutral-400"/></button></div><div className="space-y-2">{history.map(h=><div key={h.BillingID} className="rounded-lg border border-neutral-800 p-3"><div className="flex justify-between"><span className="font-semibold text-white">Billing #{h.BillingID}</span><span className={h.IsDeleted?'text-red-400':'text-emerald-400'}>{h.IsDeleted?'Superseded / deleted':'Current'}</span></div><p className="mt-1 text-sm text-neutral-300">{money(h.TotalAmount)} · {h.PlayersNumber} players · {h.DurationMinutes} min</p><p className="text-xs text-neutral-500">{new Date(h.CreatedAt).toLocaleString()} {h.EditReason?`· ${h.EditReason}`:''}</p></div>)}</div></div></div>}
  </main>;
}
