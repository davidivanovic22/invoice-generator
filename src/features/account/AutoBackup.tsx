import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../../i18n';
import { allowFolder, folderState, runDailyBackup, writeFolderBackup } from '../../lib/backup';
import { Icon } from '../../ui/Icon';

const HOUR = 3_600_000;

/**
 * Takes the daily backup while the app is open, and asks for the backup folder
 * again when the browser forgot the permission (it does after a restart).
 */
export const AutoBackup = () => {
  const [folderName, setFolderName] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const check = async () => {
      const result = await runDailyBackup();
      setError(result.snapshotError || result.folderError);
      const folder = await folderState().catch(() => null);
      setFolderName(folder && folder.permission === 'prompt' ? folder.name : null);
    };
    void check();
    const timer = window.setInterval(check, HOUR);
    return () => window.clearInterval(timer);
  }, []);

  if (!folderName && !error) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden">
      <Icon name="folder" className="h-4 w-4" />
      <span role={error ? 'alert' : undefined}>{error
        ? t('Automatic backup failed. Your latest changes may not have a backup. Try again or export a backup in Settings.')
        : t('Today\'s backup to "{name}" is waiting for your permission.', { name: folderName ?? '' })}</span>
      <button
        type="button"
        className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-500"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            if (folderName && (await allowFolder()) !== 'granted') return;
            if (error) {
              const result = await runDailyBackup();
              setError(result.snapshotError || result.folderError);
              if (result.folderWritten) setFolderName(null);
            } else if (await writeFolderBackup()) {
              setFolderName(null);
            } else {
              setError(true);
            }
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t(error ? 'Try again' : 'Allow')}
      </button>
      <Link to="/account#backup" className="text-xs font-medium underline">
        {t('Settings')}
      </Link>
      {!error && <button type="button" aria-label={t('Dismiss')} className="text-amber-700 hover:text-amber-900" onClick={() => setFolderName(null)}>
        <Icon name="x" className="h-4 w-4" />
      </button>}
    </div>
  );
};
