import { t } from '../../i18n';
import { AiError, edenRequest } from './client';

export const parseWithAffinda = async (source: { kind: 'pdf'; base64: string }, signal?: AbortSignal): Promise<unknown> => {
  const file = new Blob([Uint8Array.from(atob(source.base64), char => char.charCodeAt(0))], { type: 'application/pdf' });
  const form = new FormData();
  form.append('file', file, 'resume.pdf');
  form.append('purpose', 'resume_parser');
  const uploaded = await edenRequest<{ file_id?: string }>('/upload', { method: 'POST', body: form, signal });
  if (!uploaded.file_id) throw new AiError('invalid', t('Eden AI returned an unexpected answer. Please try again.'));
  const result = await edenRequest<{ status?: string; output?: { extracted_data?: unknown } }>('/universal-ai', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'ocr/resume_parser/affinda', input: { file: uploaded.file_id } })
  });
  if (result.status !== 'success' || !result.output?.extracted_data) throw new AiError('invalid', t('Affinda could not read this resume. Try another file.'));
  return result.output.extracted_data;
};
