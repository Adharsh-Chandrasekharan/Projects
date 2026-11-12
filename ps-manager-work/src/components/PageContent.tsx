import { useEffect, useState } from 'react';
import { usePlaystations } from '../hooks/usePlaystations';
import Card from './Card';

const Content: React.FC = () => {
  const { playstations, getAllPlaystations } = usePlaystations();
  const [databaseError, setDatabaseError] = useState('');

  useEffect(() => {
    const refresh = async () => {
      const result = await getAllPlaystations();
      setDatabaseError(result.success ? '' : (result.message || 'Could not connect to Azure SQL.'));
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [getAllPlaystations]);

  if (databaseError && playstations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-amber-900/60 bg-amber-950/20 p-8 text-center">
        <div className="max-w-xl">
          <p className="text-lg font-semibold text-amber-200">Azure SQL connection required</p>
          <p className="mt-2 break-words text-sm text-neutral-400">{databaseError}</p>
          <p className="mt-3 text-xs text-neutral-500">If this is a login failure: reset the Azure SQL admin password and copy it into .env SQL_PASSWORD, and ensure “Support only Microsoft Entra authentication” is OFF. Also allow your client IP on the SQL firewall and run database/schema-azure.sql. The app retries automatically.</p>
        </div>
      </div>
    );
  }

  if (playstations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/50 p-10 text-center">
        <div>
          <p className="text-lg font-semibold text-white">No PlayStations yet</p>
          <p className="mt-2 text-sm text-neutral-500">Use the + button beside “Your PlayStations” to add your first console and set its rates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 overflow-y-auto pb-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {playstations.map((playstation) => <Card key={playstation.PlayStationID} ps={playstation} />)}
    </div>
  );
};

export default Content;
