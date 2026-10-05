import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { z } from 'zod';
import { t } from '../../i18n';
import { AI_MODEL, AiError, getClient, toAiError } from './client';

export type Effort = 'low' | 'medium' | 'high';

/**
 * One schema-validated Claude call. `fallbacks: "default"` lets the API retry
 * on another model if a safety classifier declines, instead of failing.
 */
export const callStructured = async <T extends z.ZodType>(options: {
  schema: T;
  system: string;
  content: BetaContentBlockParam[];
  effort: Effort;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<z.infer<T>> => {
  const client = await getClient();
  try {
    const response = await client.beta.messages.parse(
      {
        model: AI_MODEL,
        max_tokens: options.maxTokens ?? 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: options.system,
        output_config: { effort: options.effort, format: betaZodOutputFormat(options.schema) },
        messages: [{ role: 'user', content: options.content }]
      },
      { signal: options.signal }
    );
    if (response.stop_reason === 'refusal') throw new AiError('refusal', t('Claude declined this request. Try rephrasing the text.'));
    if (response.stop_reason === 'max_tokens') throw new AiError('invalid', t('The text is too long to process in one go. Try shortening it.'));
    if (!response.parsed_output) throw new AiError('invalid', t('Claude returned an unexpected answer. Please try again.'));
    return response.parsed_output as z.infer<T>;
  } catch (error) {
    throw toAiError(error);
  }
};
