import { useEffect, useState } from 'react';

function formatElapsed(startTime?: string | null, now = Date.now()): string {
  if (!startTime) return '00:00:00';
  const start = new Date(startTime.replace(' ', 'T')).getTime();
  if (!Number.isFinite(start)) return '00:00:00';
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
}

interface ElapsedTimerProps {
  startTime?: string | null;
  compact?: boolean;
}

const ElapsedTimer: React.FC<ElapsedTimerProps> = ({ startTime, compact = false }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return <span className={compact ? 'font-mono text-xs tabular-nums text-emerald-300' : 'font-mono text-3xl font-semibold tabular-nums text-emerald-300'}>{formatElapsed(startTime, now)}</span>;
};

export default ElapsedTimer;
