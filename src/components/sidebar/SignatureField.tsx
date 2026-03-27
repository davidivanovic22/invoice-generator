import { useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

type Props = {
  value?: string;
  onChange: (value: string) => void;
};

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 120;
const SIGN_LINE_Y = 88;

export const SignatureField = ({ value, onChange }: Props) => {
  const sigRef = useRef<SignatureCanvas | null>(null);

  const handleClear = () => {
    sigRef.current?.clear();
    onChange('');
  };

  const handleSave = () => {
    const signatureCanvas = sigRef.current;

    if (!signatureCanvas || signatureCanvas.isEmpty()) {
      onChange('');
      return;
    }

    const dataUrl = signatureCanvas.getCanvas().toDataURL('image/png');
    onChange(dataUrl);
  };

  useEffect(() => {
    if (!value || !sigRef.current) return;

    const image = new Image();

    image.onload = () => {
      const signatureCanvas = sigRef.current;
      if (!signatureCanvas) return;

      const canvas = signatureCanvas.getCanvas();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const paddingX = 16;
      const targetHeight = 54;
      const ratio = Math.min(
        (canvas.width - paddingX * 2) / image.width,
        targetHeight / image.height
      );

      const drawWidth = image.width * ratio;
      const drawHeight = image.height * ratio;

      const x = (canvas.width - drawWidth) / 2;
      const y = SIGN_LINE_Y - drawHeight + 6;

      ctx.drawImage(image, x, y, drawWidth, drawHeight);
    };

    image.src = value;
  }, [value]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2 text-blue-600">
        <span>✍️</span>
        <h3 className="text-sm font-semibold">Sign here</h3>
      </div>

      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50">
        {!value && (
          <>
            <div
              className="pointer-events-none absolute left-4 text-xs font-medium text-blue-500"
              style={{ top: `${SIGN_LINE_Y - 18}px` }}
            >
              ← sign on the line
            </div>

            <div
              className="pointer-events-none absolute left-4 right-4 border-t border-blue-400"
              style={{ top: `${SIGN_LINE_Y}px` }}
            />
          </>
        )}

        <SignatureCanvas
          ref={sigRef}
          penColor="#2563eb"
          backgroundColor="rgba(0,0,0,0)"
          onEnd={handleSave}
          minWidth={1.2}
          maxWidth={2.2}
          canvasProps={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            className: 'h-[120px] w-full cursor-crosshair touch-none'
          }}
        />
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          Save
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
};