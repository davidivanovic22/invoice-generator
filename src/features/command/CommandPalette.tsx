import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t, useLanguage } from '../../i18n';
import { formatMinor } from '../../lib/money';
import { Icon, type IconName } from '../../ui/Icon';
import { useAi } from '../ai/AiSettings';
import { invoiceTotals } from '../invoices/model';
import { useInvoiceStore } from '../invoices/store';
import { useResumeStore } from '../resumes/store';

type Command = { id: string; label: string; hint?: string; icon: IconName; group: string; run: () => void; keywords?: string };

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'dj');

/** Ctrl/⌘+K: jump anywhere, create anything, find any document. */
export const CommandPalette = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const { store: invoices } = useInvoiceStore();
  const { store: resumes } = useResumeStore();
  const { openSettings } = useAi();
  const { lang, setLang } = useLanguage();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => navigate(path);
    const actions: Command[] = [
      { id: 'new-invoice', group: t('Create'), icon: 'plus', label: t('New invoice'), run: go('/invoices?new=1'), keywords: 'faktura invoice racun' },
      { id: 'new-resume', group: t('Create'), icon: 'plus', label: t('New resume'), run: go('/resumes?new=1'), keywords: 'cv biografija resume' },
      { id: 'import-cv', group: t('Create'), icon: 'upload', label: t('Import and improve my CV'), run: go('/resumes?import=1'), keywords: 'ats ai uvoz import' },
      { id: 'home', group: t('Go to'), icon: 'home', label: t('Home'), run: go('/') },
      { id: 'invoices', group: t('Go to'), icon: 'file', label: t('Invoices'), run: go('/invoices') },
      { id: 'resumes', group: t('Go to'), icon: 'user', label: t('Resumes'), run: go('/resumes') },
      { id: 'profile', group: t('Go to'), icon: 'building', label: t('Business profile'), run: go('/profile'), keywords: 'firma pib iban logo potpis' },
      { id: 'overview', group: t('Go to'), icon: 'cash', label: t('Overview'), run: go('/overview'), keywords: 'pregled zarada prihod limit pdv 6 miliona 8 miliona grafikon' },
      { id: 'kpo', group: t('Go to'), icon: 'list', label: t('KPO book'), run: go('/kpo'), keywords: 'kpo knjiga promet pausal pausalni porez' },
      { id: 'account', group: t('Go to'), icon: 'shield', label: t('Account & backup'), run: go('/account'), keywords: 'nalog lozinka sifra backup rezervna kopija vrati restore password lock' },
      { id: 'ai', group: t('Settings'), icon: 'sparkle', label: t('Connect Claude AI'), run: openSettings, keywords: 'api key kljuc' },
      {
        id: 'language',
        group: t('Settings'),
        icon: 'languages',
        label: lang === 'sr' ? 'Switch to English' : 'Prebaci na srpski',
        run: () => setLang(lang === 'sr' ? 'en' : 'sr'),
        keywords: 'jezik language srpski english'
      }
    ];
    const invoiceItems: Command[] = invoices.invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      group: t('Invoices'),
      icon: 'file',
      label: `${invoice.client.name || t('No client yet')} · #${invoice.number}`,
      hint: formatMinor(invoiceTotals(invoice).totalMinor, invoice.currency),
      run: go(`/invoices/${invoice.id}`)
    }));
    const resumeItems: Command[] = resumes.resumes.map((resume) => ({
      id: `resume-${resume.id}`,
      group: t('Resumes'),
      icon: 'user',
      label: resume.name,
      hint: resume.personal.fullName,
      run: go(`/resumes/${resume.id}`)
    }));
    return [...actions, ...invoiceItems, ...resumeItems];
  }, [navigate, invoices.invoices, resumes.resumes, openSettings, lang, setLang]);

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return commands.filter((command) => !command.id.startsWith('invoice-') && !command.id.startsWith('resume-')).concat(commands.filter((command) => command.id.startsWith('invoice-')).slice(0, 3));
    return commands.filter((command) => normalize(`${command.label} ${command.hint ?? ''} ${command.keywords ?? ''}`).includes(needle)).slice(0, 30);
  }, [commands, query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const run = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('Search and commands')} className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Icon name="search" className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => Math.min(results.length - 1, value + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => Math.max(0, value - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                run(results[active]);
              } else if (event.key === 'Escape') {
                onClose();
              }
            }}
            placeholder={t('Search invoices, resumes or type a command…')}
            aria-label={t('Search')}
            className="h-14 flex-1 border-0 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />
          <kbd className="hidden rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 sm:block">Esc</kbd>
        </div>
        <ul ref={listRef} role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-500">{t('Nothing found.')}</li>}
          {results.map((command, index) => {
            const header = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            return (
              <li key={command.id} role="option" aria-selected={index === active}>
                {header && <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{header}</div>}
                <button
                  type="button"
                  data-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(command)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${index === active ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700'}`}
                >
                  <Icon name={command.icon} className={`h-4 w-4 ${index === active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  {command.hint && <span className="shrink-0 truncate text-xs text-slate-400">{command.hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

/** Global Ctrl/⌘+K listener. */
export const useCommandShortcut = (onOpen: () => void) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpen]);
};
