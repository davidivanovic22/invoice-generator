import { z } from 'zod';
import { callStructured } from '../ai/structured';
import { UNITS } from './model';

const RequestSchema = z.object({
  clientName: z.string().describe('The client exactly as written in the known clients list if it matches one, otherwise as the user wrote it; "" if not mentioned'),
  items: z.array(
    z.object({
      title: z.string().describe('Short service name, in the language the user wrote in'),
      description: z.string().describe('Extra detail if given, otherwise ""'),
      quantity: z.number().describe('Number of units; 1 if not stated'),
      unit: z.enum(UNITS as [string, ...string[]]).describe('h = hours, day, pcs = pieces, month, project, km'),
      unitPrice: z.number().describe('Price per unit; if only a total was given, the total with quantity 1. 0 if unknown')
    })
  ),
  currency: z.string().describe('ISO 4217 code such as EUR, RSD, USD; "" if not mentioned'),
  dueDays: z.number().describe('Payment term in days if mentioned, otherwise -1'),
  vatPercent: z.number().describe('VAT percent if mentioned, otherwise -1')
});

export type InvoiceRequest = z.infer<typeof RequestSchema>;

/** Turns "Acme, 40h of development at 25 €, due in 15 days" into invoice fields. */
export const parseInvoiceRequest = (text: string, knownClients: string[], signal?: AbortSignal) =>
  callStructured({
    schema: RequestSchema,
    effort: 'low',
    maxTokens: 4000,
    signal,
    system:
      'You turn a short request for an invoice into structured fields. Use only what the user wrote: never invent prices, quantities or clients. "€" means EUR, "din"/"dinara" means RSD, "$" means USD. "sati"/"h"/"hours" are hours.',
    content: [
      { type: 'text', text: `<known_clients>\n${knownClients.join('\n')}\n</known_clients>` },
      { type: 'text', text: `<request>\n${text}\n</request>` }
    ]
  });
