import { useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/Button';
import { TextArea } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { Segmented } from '../../ui/Layout';
import { useAi } from '../ai/AiSettings';
import type { Resume } from '../resumes/model';

type Props = { onClose: () => void; onImported: (resume: Resume) => void };

const MAX_BYTES = 20 * 1024 * 1024;

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });

const readDocx = async (file: File) => {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
};

/** Upload an existing CV; Claude converts it, then the ATS wizard takes over. */
export const ImportDialog = ({ onClose, onImported }: Props) => {
  const { hasKey, openSettings } = useAi();
  const [mode, setMode] = useState<'file' | 'paste'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !working && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, working]);

  // Abort an in-flight import only when the dialog goes away.
  useEffect(() => () => abortRef.current?.abort(), []);

  const pick = (candidate: File | undefined) => {
    setError('');
    if (!candidate) return;
    if (candidate.size > MAX_BYTES) {
      setError('That file is larger than 20 MB.');
      return;
    }
    if (!/\.(pdf|docx|txt|md)$/i.test(candidate.name)) {
      setError('Please choose a PDF, Word (.docx) or text file.');
      return;
    }
    setFile(candidate);
  };

  const run = async () => {
    if (!hasKey) {
      openSettings();
      return;
    }
    setWorking(true);
    setError('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { importResume } = await import('./ai');
      let resume: Resume;
      if (mode === 'paste') resume = await importResume({ kind: 'text', text }, controller.signal);
      else if (file && /\.pdf$/i.test(file.name)) resume = await importResume({ kind: 'pdf', base64: await readBase64(file) }, controller.signal);
      else if (file && /\.docx$/i.test(file.name)) resume = await importResume({ kind: 'text', text: await readDocx(file) }, controller.signal);
      else if (file) resume = await importResume({ kind: 'text', text: await file.text() }, controller.signal);
      else return;
      onImported(resume);
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === 'AbortError') return;
      setError(failure instanceof Error ? failure.message : 'The resume could not be imported.');
    } finally {
      setWorking(false);
    }
  };

  const ready = mode === 'paste' ? text.trim().length > 50 : Boolean(file);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]" onMouseDown={() => !working && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="import-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="import-title" className="text-lg font-semibold text-slate-900">
          Import your existing resume
        </h2>
        <p className="mt-1 text-sm text-slate-500">Claude reads it, rebuilds it in an ATS-friendly template, and then guides you step by step through every improvement.</p>

        <div className="mt-5">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'file', label: 'Upload file' },
              { value: 'paste', label: 'Paste text' }
            ]}
          />
        </div>

        <div className="mt-4">
          {mode === 'file' ? (
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
                pick(event.dataTransfer.files[0]);
              }}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                dragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-slate-400'
              }`}
            >
              <Icon name={file ? 'file' : 'upload'} className="h-7 w-7 text-slate-400" />
              {file ? (
                <>
                  <span className="text-sm font-medium text-slate-900">{file.name}</span>
                  <span className="text-xs text-slate-500">Click to choose another file</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-slate-900">Drop your CV here, or click to choose</span>
                  <span className="text-xs text-slate-500">PDF, Word (.docx) or text</span>
                </>
              )}
            </button>
          ) : (
            <TextArea rows={9} value={text} onChange={setText} placeholder="Paste the full text of your resume here (for example from LinkedIn or a Word document)." />
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(event) => {
              pick(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
        </div>

        {error && (
          <p className="mt-3 flex items-start gap-2 text-sm text-red-600" role="alert">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        {!hasKey && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
            Importing uses Claude AI.{' '}
            <button type="button" onClick={openSettings} className="font-semibold underline">
              Connect Claude
            </button>{' '}
            first; it takes a minute.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button
            onClick={() => {
              abortRef.current?.abort();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button variant="accent" icon="sparkle" onClick={run} disabled={!ready || working}>
            {working ? 'Claude is reading your resume…' : 'Import & analyse'}
          </Button>
        </div>
      </div>
    </div>
  );
};
