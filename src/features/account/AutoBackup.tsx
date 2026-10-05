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

  useEffect(() => {
    const check = async () => {
      await runDailyBackup();
      const folder = await folderState().catch(() => null);
      setFolderName(folder && folder.permission === 'prompt' ? folder.name : null);
    };
    void check();
    const timer = window.setInterval(check, HOUR);
    return () => window.clearInterval(timer);
  }, []);

  if (!folderName) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden">
      <Icon name="folder" className="h-4 w-4" />
      <span>{t('Today\'s backup to "{name}" is waiting for your permission.', { name: folderName })}</span>
      <button
        type="button"
        className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-500"
        onClick={async () => {
          if ((await allowFolder()) === 'granted') {
            await writeFolderBackup().catch(() => false);
            setFolderName(null);
          }
        }}
      >
        {t('Allow')}
      </button>
      <Link to="/account#backup" className="text-xs font-medium underline">
        {t('Settings')}
      </Link>
      <button type="button" aria-label={t('Dismiss')} className="text-amber-700 hover:text-amber-900" onClick={() => setFolderName(null)}>
        <Icon name="x" className="h-4 w-4" />
      </button>
    </div>
  );
};
