import { appendAudit, type AuditEntry } from './audit';

const entry = (at: string, action: AuditEntry['action'] = 'invoice.edited', target = '2026-01'): AuditEntry => ({ at, who: 'David', action, target });

describe('appendAudit', () => {
  it('folds repeated edits of the same invoice within 10 minutes', () => {
    let log = appendAudit([], entry('2026-10-05T10:00:00Z'));
    log = appendAudit(log, entry('2026-10-05T10:05:00Z'));
    expect(log).toHaveLength(1);
    expect(log[0].at).toBe('2026-10-05T10:05:00Z');
    log = appendAudit(log, entry('2026-10-05T10:30:00Z'));
    expect(log).toHaveLength(2);
  });

  it('keeps every status change and every other invoice', () => {
    let log = appendAudit([], entry('2026-10-05T10:00:00Z', 'invoice.status'));
    log = appendAudit(log, entry('2026-10-05T10:00:10Z', 'invoice.status'));
    log = appendAudit(log, entry('2026-10-05T10:00:20Z', 'invoice.edited', '2026-02'));
    expect(log).toHaveLength(3);
  });
});
