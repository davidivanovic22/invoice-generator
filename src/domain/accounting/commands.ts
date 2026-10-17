import { accountingUuid } from './identifiers';
import { z } from 'zod';
import { minorUnits } from './journal';

const uuid = accountingUuid;
const date = z.iso.date();
const revision = z.string().regex(/^(0|[1-9]\d*)$/);
const key = z.string().min(1).max(100);
const amount = z.string().transform((value, ctx) => {
  try { return minorUnits(value); } catch { ctx.addIssue({ code: 'custom', message: 'Invalid minor-unit amount' }); return z.NEVER; }
});
const line = z.object({ id: z.string().min(1).max(100), accountId: uuid, partnerId: uuid.optional(), debit: amount, credit: amount, description: z.string() }).strict();
export const journalDraftSchema = z.object({ id: uuid, firmId: uuid, fiscalYearId: uuid, periodId: uuid, postingDate: date, description: z.string(), lines: z.array(line).min(2) }).strict();
export const postJournalSchema = z.object({ kind: z.literal('postJournal'), idempotencyKey: key, expectedRevision: revision, draft: journalDraftSchema }).strict();
export const receiptSchema = z.object({ journalId: uuid, firmId: uuid, revision: z.string().regex(/^[1-9]\d*$/), number: z.string().min(1), postedAt: z.iso.datetime({ offset: true }), postedBy: uuid }).strict();
export const reverseJournalSchema = z.object({ kind: z.literal('reverseJournal'), firmId: uuid, journalId: uuid, periodId: uuid, postingDate: date, reason: z.string().trim().min(1).max(1000), expectedRevision: revision, idempotencyKey: key }).strict();
export const periodStatusSchema = z.object({ kind: z.literal('setPeriodStatus'), firmId: uuid, periodId: uuid, status: z.enum(['open','closed']), expectedRevision: revision, reason: z.string().trim().min(1).max(1000) }).strict();
export const capabilitySchema = z.enum(['manage_chart','post_journal','reverse_journal','manage_periods']);
export const permissionSchema = z.object({ firmId: uuid, userId: uuid, capability: capabilitySchema, enabled: z.boolean() }).strict();
export const readJournalSchema = z.object({ receipt: receiptSchema, draft: journalDraftSchema.extend({ lines: z.array(line.extend({ partnerId: uuid.nullable().optional() })) }), reversalOf: uuid.nullable(), reason: z.string().nullable() });
export type ReverseJournalCommand = z.infer<typeof reverseJournalSchema>;
export type PeriodStatusCommand = z.infer<typeof periodStatusSchema>;
export type AccountingCapability = z.infer<typeof capabilitySchema>;
export type PermissionCommand = z.infer<typeof permissionSchema>;
export type PostedJournal = z.infer<typeof readJournalSchema>;

export const accountingEntitySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('year'), data: z.object({ id: uuid, label: z.number().int().min(1900).max(9999), startsOn: date, endsOn: date }).strict() }),
  z.object({ kind: z.literal('period'), data: z.object({ id: uuid, fiscalYearId: uuid, startsOn: date, endsOn: date }).strict() }),
  z.object({ kind: z.literal('account'), data: z.object({ id: uuid, code: z.string().regex(/^[A-Za-z0-9._-]{1,20}$/), name: z.string().trim().min(1).max(200), parentId: uuid.optional(), active: z.boolean().optional(), allowsPosting: z.boolean().optional(), requiresPartner: z.boolean().optional(), validFrom: date, validTo: date.optional(), templateVersion: z.string().optional() }).strict() }),
  z.object({ kind: z.literal('partner'), data: z.object({ id: uuid, name: z.string().trim().min(1).max(200) }).strict() })
]);
export type AccountingEntityCommand = z.infer<typeof accountingEntitySchema>;

export const editableDraftSchema = journalDraftSchema.extend({ lines: z.array(line).max(1000) });
export const saveDraftSchema = z.object({ draft: editableDraftSchema, expectedRevision: revision, idempotencyKey: key }).strict();
export const draftReceiptSchema = z.object({ firmId: uuid, draftId: uuid, revision: z.string().regex(/^[1-9]\d*$/), savedBy: uuid, savedAt: z.iso.datetime({ offset: true }) }).strict();
export const savedDraftSchema = z.object({ draft: editableDraftSchema, revision: z.string().regex(/^[1-9]\d*$/), status: z.enum(['draft','posted']), savedBy: uuid, savedAt: z.iso.datetime({ offset: true }) }).strict();
export const agencyCapabilitySchema = z.enum(['read','manage_chart','post_journal','reverse_journal','manage_periods']);
export const agencyConsentSchema = z.object({ firmId: uuid, agencyId: uuid, capability: agencyCapabilitySchema, enabled: z.boolean() }).strict();
export const agencyAssignmentSchema = agencyConsentSchema.extend({ userId: uuid });
export const agencyMemberSchema = z.object({ agencyId: uuid, userId: uuid, enabled: z.boolean() }).strict();
export const createAgencySchema = z.object({ id: uuid, name: z.string().trim().min(1).max(200) }).strict();
export type SaveDraftCommand = z.infer<typeof saveDraftSchema>;
export type AgencyConsentCommand = z.infer<typeof agencyConsentSchema>;
export type AgencyAssignmentCommand = z.infer<typeof agencyAssignmentSchema>;

export const accountingFirmsSchema = z.array(z.object({ id: uuid, name: z.string(), taxId: z.string().nullable() }).strict());
export const workspaceSchema = z.object({
  firmId: uuid, yearId: uuid.nullable(), capabilities: z.array(capabilitySchema),
  years: z.array(z.object({ id: uuid, label: z.number().int(), startsOn: date, endsOn: date })),
  periods: z.array(z.object({ id: uuid, startsOn: date, endsOn: date, status: z.enum(['open','closed']), revision })),
  accounts: z.array(z.object({ id: uuid, code: z.string(), name: z.string(), active: z.boolean(), allowsPosting: z.boolean(), requiresPartner: z.boolean(), validFrom: date, validTo: date.nullable() })),
  partners: z.array(z.object({ id: uuid, name: z.string() })),
  drafts: z.array(z.object({ id: uuid, postingDate: date, description: z.string(), revision })),
  journals: z.array(z.object({ id: uuid, number: z.string(), postingDate: date, description: z.string() }))
}).strict();
export type AccountingWorkspace = z.infer<typeof workspaceSchema>;

// Server permissions repeat this matrix; legacy accountant membership grants read only.
export const canAccount = (role: 'owner' | 'accountant' | 'viewer' | null, assigned: readonly AccountingCapability[], capability: AccountingCapability) =>
  role === 'owner' || (role === 'accountant' && assigned.includes(capability));
