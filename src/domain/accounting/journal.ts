/** Exact money transport for the ledger. These are RSD minor units, never JS floats. */
export type MinorUnits = string & { readonly __minorUnits: unique symbol };
export const minorUnits = (value: string): MinorUnits => {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value) || value.length > 24) throw new Error('Invalid nonnegative minor-unit amount.');
  return value as MinorUnits;
};

export type JournalLine = {
  id: string;
  accountId: string;
  debit: MinorUnits;
  credit: MinorUnits;
  partnerId?: string;
  description: string;
};
export type JournalDraft = {
  id: string;
  firmId: string;
  fiscalYearId: string;
  periodId: string;
  postingDate: string;
  description: string;
  lines: JournalLine[];
};
export type PostingContext = {
  firmId: string;
  fiscalYearId: string;
  periodId: string;
  periodStart: string;
  periodEnd: string;
  periodStatus: 'open' | 'closed';
  canPost: boolean;
  accounts: ReadonlyArray<{ id: string; firmId: string; active: boolean; allowsPosting: boolean; requiresPartner: boolean }>;
  partners: ReadonlyArray<{ id: string; firmId: string }>;
};
export type JournalIssue = { code: 'permission' | 'scope' | 'period' | 'date' | 'lines' | 'amount' | 'balance' | 'account' | 'partner'; lineId?: string };

const isoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Preflight only. PostgreSQL must repeat these checks inside the posting transaction. */
export const validateJournal = (draft: JournalDraft, context: PostingContext): JournalIssue[] => {
  const issues: JournalIssue[] = [];
  if (!context.canPost) issues.push({ code: 'permission' });
  if (draft.firmId !== context.firmId || draft.fiscalYearId !== context.fiscalYearId || draft.periodId !== context.periodId) issues.push({ code: 'scope' });
  if (context.periodStatus !== 'open') issues.push({ code: 'period' });
  if (!isoDate(draft.postingDate) || !isoDate(context.periodStart) || !isoDate(context.periodEnd)
    || context.periodStart > context.periodEnd || draft.postingDate < context.periodStart || draft.postingDate > context.periodEnd) issues.push({ code: 'date' });
  if (draft.lines.length < 2 || draft.lines.some(line => !line.id) || new Set(draft.lines.map(line => line.id)).size !== draft.lines.length) issues.push({ code: 'lines' });
  let debit = BigInt(0);
  let credit = BigInt(0);
  for (const line of draft.lines) {
    try {
      const d = BigInt(minorUnits(line.debit));
      const c = BigInt(minorUnits(line.credit));
      if ((d === BigInt(0)) === (c === BigInt(0))) issues.push({ code: 'amount', lineId: line.id });
      debit += d;
      credit += c;
    } catch { issues.push({ code: 'amount', lineId: line.id }); }
    const account = context.accounts.find(account => account.id === line.accountId && account.firmId === draft.firmId);
    if (!account?.active || !account.allowsPosting) issues.push({ code: 'account', lineId: line.id });
    if ((account?.requiresPartner && !line.partnerId) || (line.partnerId && !context.partners.some(partner => partner.id === line.partnerId && partner.firmId === draft.firmId))) issues.push({ code: 'partner', lineId: line.id });
  }
  if (debit !== credit) issues.push({ code: 'balance' });
  return issues;
};

export type PostJournalCommand = {
  kind: 'postJournal';
  idempotencyKey: string;
  expectedRevision: string;
  draft: JournalDraft;
};
export type PostingReceipt = {
  journalId: string;
  firmId: string;
  revision: string;
  number: string;
  postedAt: string;
  postedBy: string;
};
export type PostingFailure = 'forbidden' | 'stale_revision' | 'closed_period' | 'invalid_journal' | 'duplicate_source' | 'idempotency_reuse' | 'unavailable';
export type PostingResult = { ok: true; receipt: PostingReceipt } | { ok: false; code: PostingFailure; issues?: JournalIssue[] };

/** Implementations return a receipt only after server commit, including when retrying a committed request. */
export interface JournalRepository {
  post(command: PostJournalCommand): Promise<PostingResult>;
}
