import { z } from 'zod';
import { t } from '../../i18n';
import { AI_MODEL, AiError, edenRequest, toAiError } from './client';
export type Effort = 'low' | 'medium' | 'high';
export const callStructured = async <T extends z.ZodType>(options: {
  schema: T; system: string; content: { type: 'text'; text: string }[];
  effort: Effort; maxTokens?: number; signal?: AbortSignal;
}): Promise<z.infer<T>> => {
  try {
    const response = await edenRequest<{ choices?: { finish_reason?: string; message?: { content?: string; refusal?: string } }[] }>('/chat/completions', {
      method: 'POST', signal: options.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: options.maxTokens ?? 16000,
        messages: [{ role: 'system', content: `${options.system}\nReturn only JSON matching the supplied schema.` },
          { role: 'user', content: options.content.map(block => block.text).join('\n\n') }],
        response_format: { type: 'json_schema', json_schema: { name: 'paperwork_result', strict: true, schema: z.toJSONSchema(options.schema) } }
      })
    });
    const choice = response.choices?.[0];
    if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') throw new AiError('refusal', t('Eden AI declined this request. Try rephrasing the text.'));
    if (choice?.finish_reason === 'length') throw new AiError('invalid', t('The text is too long to process in one go. Try shortening it.'));
    let value: unknown;
    try { value = JSON.parse(choice?.message?.content ?? ''); }
    catch { throw new AiError('invalid', t('Eden AI returned an unexpected answer. Please try again.')); }
    const parsed = options.schema.safeParse(value);
    if (!parsed.success) throw new AiError('invalid', t('Eden AI returned an unexpected answer. Please try again.'));
    return parsed.data;
  } catch (error) { throw toAiError(error); }
};
