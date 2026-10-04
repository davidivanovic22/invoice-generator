import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Icon } from '../common/Icon';
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
      <SectionTitle title="Actions" subtitle="Manage this invoice" />

      <Button onClick={onCreate} fullWidth className="mb-2 flex items-center justify-center gap-2">
        <Icon name="plus" className="h-4 w-4" />
        New invoice
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          onClick={onDuplicate}
          className="flex items-center justify-center gap-2"
        >
          <Icon name="copy" className="h-4 w-4" />
          Duplicate
        </Button>
        <Button
          variant="secondary"
          onClick={onPreviewPdf}
          className="flex items-center justify-center gap-2"
        >
          <Icon name="eye" className="h-4 w-4" />
          Preview PDF
        </Button>
      </div>

      <Button
        variant="secondary"
        onClick={onDownloadPdf}
        fullWidth
        className="mt-2 flex items-center justify-center gap-2"
      >
        <Icon name="download" className="h-4 w-4" />
        Download PDF
      </Button>

      <button
        type="button"
        onClick={onDelete}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-red-500 transition hover:bg-red-50 hover:text-red-600"
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
        Delete this invoice
      </button>
    </Card>
  );
};
