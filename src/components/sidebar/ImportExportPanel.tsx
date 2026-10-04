import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { FileInput } from '../common/FileInput';
import { SectionTitle } from '../common/SectionTitle';

type Props = {
  onExportCurrent: () => void;
  onExportAll: () => void;
  onResetCurrent: () => void;
  onImport: (file: File) => Promise<void>;
};

export const ImportExportPanel = ({
  onExportCurrent,
  onExportAll,
  onResetCurrent,
  onImport
}: Props) => {
  return (
    <Card>
      <SectionTitle
        title="Import / Export"
        subtitle="Back up your invoices as JSON, or bring them back later"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={onExportCurrent}>
          Export current
        </Button>
        <Button variant="secondary" onClick={onExportAll}>
          Export all
        </Button>
        <FileInput
          accept=".json,application/json"
          buttonLabel="Import JSON"
          onFileSelect={onImport}
        />
      </div>

      <button
        type="button"
        onClick={onResetCurrent}
        className="mt-3 w-full rounded-xl border border-red-200 py-2 text-sm font-medium text-red-500 transition hover:bg-red-50"
      >
        Reset this invoice to blank
      </button>
    </Card>
  );
};
