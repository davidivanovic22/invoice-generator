import { Card } from '../common/Card';
import { SectionTitle } from '../common/SectionTitle';
import { Button } from '../common/Button';
import { FileInput } from '../common/FileInput';

type Props = {
  hasLogo: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
};

export const LogoPanel = ({ hasLogo, onUpload, onRemove }: Props) => {
  return (
    <Card>
      <SectionTitle title="Logo" />
      <div className="flex flex-wrap gap-2">
        <FileInput accept="image/*" buttonLabel="Upload logo" onFileSelect={onUpload} />
        {hasLogo ? (
          <Button variant="secondary" onClick={onRemove}>
            Remove logo
          </Button>
        ) : null}
      </div>
    </Card>
  );
};