import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { printToPdf } from '../lib/pdf';
import { A4Preview } from './A4Preview';
import { Button } from './Button';
import { useFeedback } from './Feedback';

type Props = {
  title: string;
  /** Suggested name of the saved file, without ".pdf". */
  fileName: string;
  onClose: () => void;
  /** The pages to print: elements marked with `data-pdf-page`. */
  children: ReactNode;
};

/** Shows a document exactly as it will be saved, with the download button underneath. */
export const PdfPreviewDialog = ({ title, fileName, onClose, children }: Props) => {
  const { toast } = useFeedback();
  const pagesRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = async () => {
    if (!pagesRef.current) return;
    setSaving(true);
    toast(t('In the window that opens, choose "Save as PDF".'), 'info');
    try {
      await printToPdf(pagesRef.current, fileName);
    } catch (error) {
      toast((error as Error).message || t('The PDF could not be created. Please try again.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-preview-title"
        className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl sm:h-auto sm:max-h-[94vh] sm:rounded-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 id="pdf-preview-title" className="min-w-0 truncate text-base font-semibold text-slate-900">
            {title}
          </h2>
          <span className="shrink-0 text-xs text-slate-400">{t('Preview')}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-3 sm:p-6">
          <div className="mx-auto max-w-[794px] overflow-hidden rounded-lg shadow-[0_1px_3px_rgba(15,23,42,0.1),0_12px_32px_-12px_rgba(15,23,42,0.3)] ring-1 ring-slate-200">
            <A4Preview>
              <div ref={pagesRef}>{children}</div>
            </A4Preview>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <Button onClick={onClose}>{t('Close')}</Button>
          <Button variant="primary" icon="download" onClick={download} disabled={saving}>
            {t('Download PDF')}
          </Button>
        </div>
      </div>
    </div>
  );
};
