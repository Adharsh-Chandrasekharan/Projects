import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../Redux/store';
import { Playstation } from '../types';

interface AlarmItem {
  key: string;
  consoleName: string;
}

function getExpiryTime(startTime: string, duration: number): number {
  const normalized = startTime.includes('T')
    ? startTime
    : startTime.replace(' ', 'T');

  return new Date(normalized).getTime() + duration * 60 * 1000;
}

const SessionAlarm: React.FC = () => {
  const playstations = useSelector((state: RootState) => state.playstation.playstations);
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const audioContext = useRef<AudioContext | null>(null);
  const activeAlarmKeys = useRef<Set<string>>(new Set());

  // Timer/alarm checks use the already-loaded Redux data. This local
  // one-second check never calls the API or Azure SQL.
  useEffect(() => {
    const activeSessions = playstations.filter(
      (item): item is Playstation & { StartTime: string; ActiveDurationMinutes: number } =>
        !item.IsAvailable &&
        Boolean(item.StartTime) &&
        item.ActiveDurationMinutes != null
    );

    const currentSessionKeys = new Set(
      activeSessions.map(item => String(
        item.ActiveSessionID ?? `${item.PlayStationID}-${item.StartTime}`
      ))
    );

    activeAlarmKeys.current.forEach(key => {
      if (!currentSessionKeys.has(key)) activeAlarmKeys.current.delete(key);
    });

    const checkExpiredSessions = () => {
      const now = Date.now();
      const expired = activeSessions.filter(item => {
        const expiry = getExpiryTime(item.StartTime, item.ActiveDurationMinutes);
        return Number.isFinite(expiry) && now >= expiry;
      });

      const newAlarms = expired
        .map(item => ({
          key: String(item.ActiveSessionID ?? `${item.PlayStationID}-${item.StartTime}`),
          consoleName: item.PlayStationName,
        }))
        .filter(item => {
          if (activeAlarmKeys.current.has(item.key)) return false;
          activeAlarmKeys.current.add(item.key);
          return true;
        });

      if (newAlarms.length) {
        setAlarms(previous => {
          const existing = new Set(previous.map(item => item.key));
          return [...previous, ...newAlarms.filter(item => !existing.has(item.key))];
        });
      }
    };

    checkExpiredSessions();
    const timer = window.setInterval(checkExpiredSessions, 1000);
    return () => window.clearInterval(timer);
  }, [playstations]);

  // Play a repeating alarm while any expired session is active.
  useEffect(() => {
    if (!alarms.length || !soundEnabled) return;

    let stopped = false;
    let oscillator: OscillatorNode | null = null;
    let gain: GainNode | null = null;
    let beepInterval: number | undefined;

    const playBeep = () => {
      if (stopped || !audioContext.current) return;

      const context = audioContext.current;

      oscillator = context.createOscillator();
      gain = context.createGain();

      oscillator.type = 'square';
      oscillator.frequency.value = 880;

      gain.gain.setValueAtTime(0.12, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime + 0.35
      );

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start();
      oscillator.stop(context.currentTime + 0.35);
    };

    playBeep();
    beepInterval = window.setInterval(playBeep, 900);

    return () => {
      stopped = true;
      if (beepInterval) window.clearInterval(beepInterval);
    };
  }, [alarms.length, soundEnabled]);

  const enableSound = async () => {
    try {
      if (!audioContext.current) {
        audioContext.current = new AudioContext();
      }

      await audioContext.current.resume();
      setSoundEnabled(true);
    } catch (error) {
      console.error('[Session Alarm] Audio unavailable:', error);
    }
  };

  const stopAlarm = (key: string) => {
    setAlarms(previous =>
      previous.filter(item => item.key !== key)
    );
  };

  useEffect(() => {
    return () => {
      audioContext.current?.close();
    };
  }, []);

  if (!alarms.length) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-4 text-center">
          <div className="mb-3 text-6xl animate-pulse">
            🔔
          </div>

          <h2 className="text-3xl font-bold text-red-500">
            TIME UP!
          </h2>

          <p className="mt-2 text-gray-300">
            The reserved gaming time has expired.
          </p>
        </div>

        <div className="mb-5 space-y-2">
          {alarms.map(item => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg bg-zinc-900 p-3"
            >
              <span className="font-semibold text-white">
                {item.consoleName}
              </span>

              <button
                onClick={() => stopAlarm(item.key)}
                className="rounded bg-red-600 px-3 py-2 text-sm font-bold text-white hover:bg-red-700"
              >
                STOP
              </button>
            </div>
          ))}
        </div>

        {!soundEnabled ? (
          <button
            onClick={enableSound}
            className="w-full rounded-lg bg-yellow-500 p-3 font-bold text-black hover:bg-yellow-400"
          >
            ENABLE ALARM SOUND
          </button>
        ) : (
          <p className="text-center text-sm text-green-400">
            Alarm sound enabled
          </p>
        )}

        <p className="mt-3 text-center text-xs text-gray-500">
          Stop the alarm after attending to the console.
          Stopping the alarm does not end the session.
        </p>
      </div>
    </div>
  );
};

export default SessionAlarm;
