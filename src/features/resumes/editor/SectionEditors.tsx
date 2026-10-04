import { useEffect, useRef, useState } from 'react';
import { t } from '../../../i18n';
import { createId } from '../../../lib/files';
import { Button, IconButton } from '../../../ui/Button';
import { inputClass, TextArea, TextField } from '../../../ui/Field';
import { Icon } from '../../../ui/Icon';
import {
  createEntry,
  LANGUAGE_LEVELS,
  SECTION_KINDS,
  type EntriesSection,
  type EntryItem,
  type LanguagesSection,
  type ResumeLanguage,
  type TagsSection,
  type TextSection
} from '../model';

const moveItem = <T,>(items: T[], index: number, delta: number) => {
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item);
  return next;
};

export const bulletHint = () => t('Start a line with "-" to make it a bullet point.');

/* ------------------------------ Text ------------------------------ */

export const TextEditor = ({ section, onChange }: { section: TextSection; onChange: (section: TextSection) => void }) => (
  <TextArea
    rows={section.kind === 'summary' ? 4 : 5}
    value={section.text}
    onChange={(text) => onChange({ ...section, text })}
    placeholder={
      section.kind === 'summary'
        ? t('Two or three sentences: your role, years of experience, what you are great at and what you want next.')
        : t('Write anything here.')
    }
    hint={bulletHint()}
  />
);

/* ------------------------------ Tags ------------------------------ */

export const TagsEditor = ({ section, onChange }: { section: TagsSection; onChange: (section: TagsSection) => void }) => {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const values = raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value && !section.items.includes(value));
    if (values.length) onChange({ ...section, items: [...section.items, ...values] });
    setDraft('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 rounded-lg bg-white p-2 ring-1 ring-inset ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-500">
        {section.items.map((item, index) => (
          <span key={`${item}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-[13px] text-slate-700">
            {item}
            <button
              type="button"
              aria-label={t('Remove {item}', { item })}
              onClick={() => onChange({ ...section, items: section.items.filter((_, other) => other !== index) })}
              className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            >
              <Icon name="x" className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => {
            if (event.target.value.endsWith(',')) add(event.target.value);
            else setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add(draft);
            } else if (event.key === 'Backspace' && !draft && section.items.length) {
              onChange({ ...section, items: section.items.slice(0, -1) });
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={section.items.length ? t('Add more…') : section.kind === 'interests' ? t('e.g. Photography, then Enter') : t('e.g. React, then Enter')}
          aria-label={t('Add to {section}', { section: section.title })}
          className="min-w-[140px] flex-1 border-0 bg-transparent px-1 py-1 text-sm focus:outline-none focus:ring-0"
        />
      </div>
      <p className="mt-1 text-xs text-slate-500">{t('Press Enter or type a comma after each one.')}</p>
    </div>
  );
};

/* ------------------------------ Languages ------------------------------ */

export const LanguagesEditor = ({
  section,
  language,
  onChange
}: {
  section: LanguagesSection;
  language: ResumeLanguage;
  onChange: (section: LanguagesSection) => void;
}) => {
  const update = (id: string, patch: Partial<LanguagesSection['items'][number]>) =>
    onChange({ ...section, items: section.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  const listId = `language-levels-${section.id}`;
  return (
    <div className="space-y-2">
      {section.items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <input
            aria-label={t('Language')}
            value={item.name}
            onChange={(event) => update(item.id, { name: event.target.value })}
            placeholder={language === 'sr' ? 'Engleski' : 'English'}
            className={`${inputClass} flex-1`}
          />
          <input
            aria-label={t('Level')}
            list={listId}
            value={item.level}
            onChange={(event) => update(item.id, { level: event.target.value })}
            placeholder={t('Level')}
            className={`${inputClass} flex-1`}
          />
          <IconButton icon="trash" tone="danger" label={t('Remove language')} onClick={() => onChange({ ...section, items: section.items.filter((other) => other.id !== item.id) })} />
        </div>
      ))}
      <datalist id={listId}>
        {LANGUAGE_LEVELS[language].map((level) => (
          <option key={level} value={level} />
        ))}
      </datalist>
      <Button size="sm" variant="ghost" icon="plus" onClick={() => onChange({ ...section, items: [...section.items, { id: createId(), name: '', level: '' }] })}>
        {t('Add language')}
      </Button>
    </div>
  );
};

/* ------------------------------ Entries ------------------------------ */

type Labels = NonNullable<(typeof SECTION_KINDS)[keyof typeof SECTION_KINDS]['labels']>;

const EntryCard = ({
  item,
  labels,
  open,
  onToggle,
  onChange,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown
}: {
  item: EntryItem;
  labels: Labels;
  open: boolean;
  onToggle: () => void;
  onChange: (item: EntryItem) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) => {
  const set = (field: keyof EntryItem) => (value: string) => onChange({ ...item, [field]: value });
  const summary = [item.subtitle, [item.start, item.end].filter(Boolean).join(' – ')].filter(Boolean).join(' · ');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [open]);
  return (
    <div ref={ref} className="scroll-mt-32 rounded-xl bg-slate-50/70 ring-1 ring-slate-200/70">
      <div className="flex items-center gap-1 py-1.5 pl-3 pr-1.5">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left">
          <Icon name="chevronDown" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          <span className="min-w-0">
            <span className={`block truncate text-sm font-medium ${item.title ? 'text-slate-900' : 'text-slate-400'}`}>
              {item.title || t('New: {what}', { what: t(labels.title).toLowerCase() })}
            </span>
            {summary && <span className="block truncate text-xs text-slate-500">{summary}</span>}
          </span>
        </button>
        <IconButton icon="arrowUp" label={t('Move up')} disabled={!canMoveUp} onClick={() => onMove(-1)} />
        <IconButton icon="arrowDown" label={t('Move down')} disabled={!canMoveDown} onClick={() => onMove(1)} />
        <IconButton icon="trash" tone="danger" label={t('Remove')} onClick={onRemove} />
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-3 border-t border-slate-200/70 p-3">
          <TextField label={t(labels.title)} value={item.title} onChange={set('title')} placeholder={labels.titlePlaceholder} autoFocus={!item.title} />
          <TextField label={t(labels.subtitle)} value={item.subtitle} onChange={set('subtitle')} placeholder={labels.subtitlePlaceholder} />
          {labels.dates && (
            <>
              <TextField label={t('Start')} value={item.start} onChange={set('start')} placeholder={t('Mar 2022')} />
              <TextField label={t('End')} value={item.end} onChange={set('end')} placeholder={t('Present')} />
            </>
          )}
          {labels.location && <TextField wrapperClassName="col-span-2" label={t('Location')} value={item.location} onChange={set('location')} placeholder={t('Belgrade, or Remote')} />}
          <TextArea
            wrapperClassName="col-span-2"
            label={t('Description')}
            rows={4}
            value={item.description}
            onChange={set('description')}
            placeholder={t('- What you did and the result, with numbers if you can\n- Another achievement')}
            hint={bulletHint()}
          />
        </div>
      )}
    </div>
  );
};

export const EntriesEditor = ({
  section,
  onChange,
  focus
}: {
  section: EntriesSection;
  onChange: (section: EntriesSection) => void;
  /** Opens this entry when the user clicks it in the preview. */
  focus?: { itemId?: string; token: number };
}) => {
  const labels = SECTION_KINDS[section.kind].labels ?? SECTION_KINDS.projects.labels!;
  const [openId, setOpenId] = useState<string | null>(null);
  const setItems = (items: EntryItem[]) => onChange({ ...section, items });

  useEffect(() => {
    if (focus?.itemId) setOpenId(focus.itemId);
  }, [focus?.itemId, focus?.token]);

  return (
    <div className="space-y-2">
      {section.items.map((item, index) => (
        <EntryCard
          key={item.id}
          item={item}
          labels={labels}
          open={openId === item.id}
          onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
          onChange={(next) => setItems(section.items.map((other) => (other.id === item.id ? next : other)))}
          onRemove={() => setItems(section.items.filter((other) => other.id !== item.id))}
          onMove={(delta) => setItems(moveItem(section.items, index, delta))}
          canMoveUp={index > 0}
          canMoveDown={index < section.items.length - 1}
        />
      ))}
      <Button
        size="sm"
        variant="ghost"
        icon="plus"
        onClick={() => {
          const item = createEntry();
          // Newest first is the convention for experience and education.
          setItems([item, ...section.items]);
          setOpenId(item.id);
        }}
      >
        {t('Add')} {t(labels.title).toLowerCase()}
      </Button>
    </div>
  );
};
