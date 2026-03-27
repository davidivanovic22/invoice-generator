import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { SectionTitle } from '../common/SectionTitle';

type Props = {
  onCreate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPreviewPdf: () => void;
  onDownloadPdf: () => void;
};

export const ActionPanel = ({
  onCreate,
  onDuplicate,
  onDelete,
  onPreviewPdf,
  onDownloadPdf
}: Props) => {
  return (
    <Card>
      <SectionTitle title="Actions" subtitle="Manage invoices quickly" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button onClick={onCreate}>+ New invoice</Button>

        <Button variant="secondary" onClick={onDuplicate}>
          Duplicate
        </Button>

        <Button variant="secondary" onClick={onPreviewPdf}>
          Preview PDF
        </Button>

        <Button variant="secondary" onClick={onDownloadPdf}>
          Download PDF
        </Button>

        <Button variant="danger" onClick={onDelete} className="sm:col-span-2">
          Delete
        </Button>
      </div>
    </Card>
  );
};