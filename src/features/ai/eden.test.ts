import { z } from 'zod';
import { edenRequest, getApiKey, setApiKey, testApiKey } from './client';
import { callStructured } from './structured';
import { parseWithAffinda } from './affinda';

const fetchMock = jest.fn();
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
beforeEach(() => { localStorage.clear(); setApiKey(''); global.fetch = fetchMock; fetchMock.mockReset(); });

test('never treats a legacy Claude key as Eden credentials', async () => {
  localStorage.setItem('studio.ai.key', 'legacy-key');
  expect(getApiKey()).toBe('');
  await expect(edenRequest('/info')).rejects.toMatchObject({ kind: 'no-key' });
  expect(fetchMock).not.toHaveBeenCalled();
});
test('verifies a manually entered Eden key without running inference', async () => {
  fetchMock.mockResolvedValue(reply({ models: [] }));
  await testApiKey(' test-eden-key ');
  const [url, request] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.edenai.run/v3/info/ocr/resume_parser');
  expect(request.headers.get('Authorization')).toBe('Bearer test-eden-key');
  expect(getApiKey()).toBe('');
});
test('uploads PDF and invokes exactly the Affinda resume parser', async () => {
  setApiKey('test-eden-key');
  const controller = new AbortController();
  fetchMock.mockResolvedValueOnce(reply({ file_id: 'uploaded-resume' }))
    .mockResolvedValueOnce(reply({ status: 'success', output: { extracted_data: { name: 'Example' } } }));
  await expect(parseWithAffinda({ kind: 'pdf', base64: btoa('%PDF test') }, controller.signal)).resolves.toEqual({ name: 'Example' });
  const [uploadUrl, upload] = fetchMock.mock.calls[0];
  expect(uploadUrl).toBe('https://api.edenai.run/v3/upload');
  expect(upload.body.get('purpose')).toBe('resume_parser');
  expect(upload.body.get('file').type).toBe('application/pdf');
  expect(upload.headers.has('Content-Type')).toBe(false);
  const [parseUrl, request] = fetchMock.mock.calls[1];
  expect(parseUrl).toBe('https://api.edenai.run/v3/universal-ai');
  expect(JSON.parse(request.body)).toEqual({ model: 'ocr/resume_parser/affinda', input: { file: 'uploaded-resume' } });
  expect(request.signal).toBe(controller.signal);
});
test('validates chat JSON instead of accepting malformed provider output', async () => {
  setApiKey('test-eden-key');
  const options = { schema: z.object({ title: z.string() }), system: 'Extract title.', content: [{ type: 'text' as const, text: 'Example' }], effort: 'low' as const };
  fetchMock.mockResolvedValueOnce(reply({ choices: [{ message: { content: '{"title":"Example"}' } }] }));
  await expect(callStructured(options)).resolves.toEqual({ title: 'Example' });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).response_format.type).toBe('json_schema');
  fetchMock.mockResolvedValueOnce(reply({ choices: [{ message: { content: '{"title":42}' } }] }));
  await expect(callStructured(options)).rejects.toMatchObject({ kind: 'invalid' });
});
test('reports rejected credentials without exposing response or key', async () => {
  setApiKey('test-eden-key');
  fetchMock.mockResolvedValue(reply({ error: 'secret provider details' }, 401));
  await expect(edenRequest('/info')).rejects.toMatchObject({ kind: 'auth' });
});
test('stops import when upload fails and maps cancellation', async () => {
  setApiKey('test-eden-key');
  fetchMock.mockResolvedValueOnce(reply({}));
  await expect(parseWithAffinda({ kind: 'pdf', base64: btoa('%PDF test') })).rejects.toMatchObject({ kind: 'invalid' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
  await expect(edenRequest('/info')).rejects.toMatchObject({ kind: 'other' });
});
