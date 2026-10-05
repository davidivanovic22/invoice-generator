import { useCallback, useEffect, useState } from 'react';
import { t } from '../../i18n';
import { cancelInvite, changeRole, currentUserId, invitePerson, listPeople, removePerson, type Invite, type Member } from '../../lib/cloud';
import type { Firm, FirmRole } from '../../lib/firms';
import { Button, IconButton } from '../../ui/Button';
import { useFeedback } from '../../ui/Feedback';
import { inputClass, TextField } from '../../ui/Field';

const ROLES: { value: FirmRole; label: string; hint: string }[] = [
  { value: 'accountant', label: 'Accountant', hint: 'Can add and change invoices and the KPO book' },
  { value: 'viewer', label: 'Viewer', hint: 'Can only look and export' },
  { value: 'owner', label: 'Owner', hint: 'Everything, including inviting people' }
];

const roleLabel = (role: FirmRole) => t(ROLES.find((item) => item.value === role)?.label ?? role);

/** Who works on a firm: members, roles and invitations by email. */
export const ShareDialog = ({ firm, name, onClose }: { firm: Firm; name: string; onClose: () => void }) => {
  const { toast, confirm } = useFeedback();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FirmRole>('accountant');
  const [busy, setBusy] = useState(false);
  const isOwner = firm.role === 'owner';

  const load = useCallback(async () => {
    if (!firm.cloudId) return;
    try {
      const people = await listPeople(firm.cloudId);
      setMembers(people.members);
      setInvites(people.invites);
      setMe(await currentUserId());
    } catch (error) {
      toast((error as Error).message, 'error');
    }
  }, [firm.cloudId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const invite = async () => {
    if (!firm.cloudId || !/^\S+@\S+\.\S+$/.test(email.trim())) return;
    setBusy(true);
    try {
      await invitePerson(firm.cloudId, email, role);
      toast(t('Invitation saved. When {email} signs in with that address, the firm appears in their list.', { email: email.trim() }));
      setEmail('');
      await load();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 id="share-title" className="text-lg font-semibold text-slate-900">
            {t('People in "{name}"', { name })}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t('Invite your accountant or a client. They sign in with their own account and see only this firm.')}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
            {members.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-800">
                  {member.email || member.userId.slice(0, 8)}
                  {member.userId === me && <span className="ml-1 text-xs text-slate-400">({t('you')})</span>}
                </span>
                {isOwner && member.userId !== me ? (
                  <>
                    <select
                      value={member.role}
                      aria-label={t('Role')}
                      onChange={async (event) => {
                        await changeRole(firm.cloudId!, member.userId, event.target.value as FirmRole).catch((error) => toast(error.message, 'error'));
                        await load();
                      }}
                      className={`${inputClass} !w-auto !py-1 text-xs`}
                    >
                      {ROLES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {t(item.label)}
                        </option>
                      ))}
                    </select>
                    <IconButton
                      icon="trash"
                      tone="danger"
                      label={t('Remove')}
                      onClick={async () => {
                        if (!(await confirm({ title: t('Remove {email}?', { email: member.email }), confirmLabel: t('Remove'), tone: 'danger' }))) return;
                        await removePerson(firm.cloudId!, member.userId).catch((error) => toast(error.message, 'error'));
                        await load();
                      }}
                    />
                  </>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{roleLabel(member.role)}</span>
                )}
              </li>
            ))}
            {invites.map((item) => (
              <li key={item.email} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-500">{item.email}</span>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {t('Invited')} · {roleLabel(item.role)}
                </span>
                {isOwner && (
                  <IconButton
                    icon="x"
                    label={t('Cancel invitation')}
                    onClick={async () => {
                      await cancelInvite(firm.cloudId!, item.email).catch((error) => toast(error.message, 'error'));
                      await load();
                    }}
                  />
                )}
              </li>
            ))}
          </ul>

          {isOwner ? (
            <div className="mt-5 space-y-3">
              <TextField label={t('Invite by email')} type="email" value={email} onChange={setEmail} placeholder="knjigovodja@primer.rs" onKeyDown={(event) => event.key === 'Enter' && void invite()} />
              <div className="grid gap-2 sm:grid-cols-3">
                {ROLES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setRole(item.value)}
                    className={`rounded-xl p-3 text-left text-xs ring-1 transition ${role === item.value ? 'bg-indigo-50 ring-2 ring-indigo-500' : 'ring-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="text-sm font-semibold text-slate-900">{t(item.label)}</div>
                    <div className="mt-0.5 text-slate-500">{t(item.hint)}</div>
                  </button>
                ))}
              </div>
              <Button variant="accent" icon="mail" onClick={invite} disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())}>
                {t('Invite')}
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">{t('Only the owner can invite people. Your role: {role}.', { role: firm.role ? roleLabel(firm.role) : '—' })}</p>
          )}
        </div>
        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <Button onClick={onClose}>{t('Close')}</Button>
        </div>
      </div>
    </div>
  );
};
