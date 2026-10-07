import { type FirmRegistry } from './firms';

/** Legacy backups have one business dataset and no firm registry. */
export const legacyRestoreTarget = (registry: FirmRegistry, members: { firm_id: string; role: string }[]) => {
  const target = registry.firms.find(firm => firm.id === registry.activeId);
  if (!target?.cloudId || !members.some(member => member.firm_id === target.cloudId && member.role !== 'viewer')) {
    throw new Error('First open an existing database firm with permission to edit, then import this backup.');
  }
  return target.cloudId;
};
