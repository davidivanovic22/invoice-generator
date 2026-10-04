import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { t } from '../i18n';
import { readImageAsDataUrl } from '../lib/files';
import { Button } from './Button';
import { useFeedback } from './Feedback';
import { Icon } from './Icon';

type ImagePickerProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
  shape?: 'wide' | 'round';
  maxSize?: number;
};

export const ImagePicker = ({ value, onChange, label, hint, shape = 'wide', maxSize = 600 }: ImagePickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useFeedback();
  const [dragging, setDragging] = useState(false);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    try {
      onChange(await readImageAsDataUrl(file, maxSize));
    } catch (error) {
      toast(error instanceof Error ? error.message : t('The image could not be used.'), 'error');
    }
  };

  const frame = shape === 'round' ? 'h-24 w-24 rounded-full' : 'h-24 w-44 rounded-xl';

  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium text-slate-700">{label}</div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            accept(event.dataTransfer.files[0]);
          }}
          className={`flex ${frame} shrink-0 items-center justify-center overflow-hidden border-2 border-dashed transition ${
            dragging ? 'border-indigo-400 bg-indigo-50' : value ? 'border-transparent bg-slate-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }`}
          aria-label={value ? t('Change {label}', { label: label.toLowerCase() }) : t('Upload {label}', { label: label.toLowerCase() })}
        >
          {value ? (
            <img src={value} alt="" className={`h-full w-full ${shape === 'round' ? 'object-cover' : 'object-contain p-2'}`} />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs text-slate-500">
              <Icon name="upload" className="h-5 w-5" />
              {t('Upload')}
            </span>
          )}
        </button>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => inputRef.current?.click()}>
              {value ? t('Change') : t('Choose image')}
            </Button>
            {value && (
              <Button size="sm" variant="danger" onClick={() => onChange('')}>
                {t('Remove')}
              </Button>
            )}
          </div>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
};

/** Crops a canvas to its drawn pixels (the library's own getTrimmedCanvas is broken in this version). */
const trimCanvas = (source: HTMLCanvasElement): string => {
  const context = source.getContext('2d');
  if (!context) return source.toDataURL('image/png');
  const { width, height } = source;
  const pixels = context.getImageData(0, 0, width, height).data;
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return source.toDataURL('image/png');
  const pad = 4;
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  const cropWidth = Math.min(width, right + pad) - left;
  const cropHeight = Math.min(height, bottom + pad) - top;
  const target = document.createElement('canvas');
  target.width = cropWidth;
  target.height = cropHeight;
  target.getContext('2d')?.drawImage(source, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  return target.toDataURL('image/png');
};

type SignaturePadProps = { value: string; onChange: (value: string) => void };

export const SignaturePad = ({ value, onChange }: SignaturePadProps) => {
  const padRef = useRef<SignatureCanvas | null>(null);
  const [drawing, setDrawing] = useState(!value);
  const uploadRef = useRef<HTMLInputElement>(null);
  const { toast } = useFeedback();

  const save = () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    onChange(trimCanvas(pad.getCanvas()));
    setDrawing(false);
  };

  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium text-slate-700">{t('Signature')}</div>
      {drawing ? (
        <div>
          <div className="relative overflow-hidden rounded-xl bg-slate-50 ring-1 ring-inset ring-slate-200">
            <div className="pointer-events-none absolute bottom-7 left-6 right-6 border-t border-dashed border-slate-300" />
            <span className="pointer-events-none absolute bottom-2 left-6 text-[11px] text-slate-400">{t('Sign above the line with your mouse or finger')}</span>
            <SignatureCanvas
              ref={padRef}
              penColor="#1e293b"
              minWidth={1}
              maxWidth={2.4}
              canvasProps={{ width: 520, height: 150, className: 'h-[150px] w-full cursor-crosshair touch-none' }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={save}>
              {t('Use this signature')}
            </Button>
            <Button size="sm" onClick={() => padRef.current?.clear()}>
              {t('Clear')}
            </Button>
            <Button size="sm" variant="ghost" icon="upload" onClick={() => uploadRef.current?.click()}>
              {t('Upload image instead')}
            </Button>
            {value && (
              <Button size="sm" variant="ghost" onClick={() => setDrawing(false)}>
                {t('Cancel')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-56 items-center justify-center rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
            <img src={value} alt={t('Your signature')} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" icon="pen" onClick={() => setDrawing(true)}>
              {t('Redraw')}
            </Button>
            <Button size="sm" variant="danger" onClick={() => { onChange(''); setDrawing(true); }}>
              {t('Remove')}
            </Button>
          </div>
        </div>
      )}
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            onChange(await readImageAsDataUrl(file, 500));
            setDrawing(false);
          } catch (error) {
            toast(error instanceof Error ? error.message : t('The image could not be used.'), 'error');
          }
        }}
      />
    </div>
  );
};
