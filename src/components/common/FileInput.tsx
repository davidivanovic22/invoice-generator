import { useRef } from 'react';
import { Button } from './Button';

type Props = {
  accept?: string;
  buttonLabel: string;
  onFileSelect: (file: File) => void;
};

export const FileInput = ({ accept, buttonLabel, onFileSelect }: Props) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <Button variant="secondary" onClick={() => inputRef.current?.click()}>
        {buttonLabel}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFileSelect(file);
          }
          event.target.value = '';
        }}
      />
    </>
  );
};