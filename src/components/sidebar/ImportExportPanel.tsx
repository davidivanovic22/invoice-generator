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
      <SectionTitle title="Import / Export" />
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
        <Button variant="secondary" onClick={onResetCurrent}>
          Reset current
        </Button>
      </div>
    </Card>
  );
};