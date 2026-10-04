import { useEffect, useRef, useState } from 'react';
import { t } from '../../../i18n';
import { Icon, type IconName } from '../../../ui/Icon';
import { Menu } from '../../../ui/Menu';
import { docTitle, type ResumeLanguage, type ResumeSection, type SectionKind } from '../model';
import { EntriesEditor, LanguagesEditor, TagsEditor, TextEditor } from './SectionEditors';

const ICONS: Partial<Record<SectionKind, IconName>> = {
  summary: 'user',
  experience: 'briefcase',
  education: 'cap',
  skills: 'sparkle',
  languages: 'globe',
  references: 'users',
  interests: 'sparkle'
};

type Props = {
  section: ResumeSection;
  language: ResumeLanguage;
  onChange: (section: ResumeSection) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Changes when the preview or ATS panel asks to show this section (and optionally one entry). */
  focus?: { itemId?: string; token: number };
};

const countLabel = (section: ResumeSection) => {
  if (section.type === 'text') {
    const words = section.text.trim() ? section.text.trim().split(/\s+/).length : 0;
    return words ? t('{count} word|{count} words', { count: words }) : t('Empty');
  }
  const count = section.items.length;
  return count === 0 ? t('Empty') : t('{count} item|{count} items', { count });
};

export const SectionCard = ({ section, language, onChange, onRemove, onMove, canMoveUp, canMoveDown, focus }: Props) => {
  const [open, setOpen] = useState(section.kind === 'summary' || section.kind === 'experience');
  const [renaming, setRenaming] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (renaming) titleRef.current?.select();
  }, [renaming]);

  useEffect(() => {
    if (!focus?.token) return;
    setOpen(true);
    if (!focus.itemId) requestAnimationFrame(() => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [focus?.token, focus?.itemId]);

  return (
    <section
      ref={rootRef}
      id={`section-${section.id}`}
      className={`scroll-mt-32 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 transition ${section.hidden ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2 py-3 pl-5 pr-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon name={ICONS[section.kind] ?? 'file'} />
        </span>
        {renaming ? (
          <input
            ref={titleRef}
            aria-label={t('Section title')}
            value={section.title}
            onChange={(event) => onChange({ ...section, title: event.target.value })}
            onBlur={() => {
              if (!section.title.trim()) onChange({ ...section, title: docTitle(section.kind, language) });
              setRenaming(false);
            }}
            onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
            className="min-w-0 flex-1 rounded-md border-0 px-2 py-1 text-[15px] font-semibold ring-2 ring-indigo-500 focus:outline-none"
          />
        ) : (
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-slate-900">{section.title}</span>
              <span className="block truncate text-[13px] text-slate-500">{section.hidden ? t('Hidden from the resume') : countLabel(section)}</span>
            </span>
            <Icon name="chevronDown" className={`ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
        <Menu
          label={t('Section options')}
          items={[
            { label: t('Rename'), icon: 'pen', onSelect: () => setRenaming(true) },
            { label: section.hidden ? t('Show on resume') : t('Hide from resume'), icon: section.hidden ? 'eye' : 'eyeOff', onSelect: () => onChange({ ...section, hidden: !section.hidden }) },
            { label: t('Move up'), icon: 'arrowUp', onSelect: () => onMove(-1), disabled: !canMoveUp },
            { label: t('Move down'), icon: 'arrowDown', onSelect: () => onMove(1), disabled: !canMoveDown },
            'divider',
            { label: t('Delete section'), icon: 'trash', onSelect: onRemove, danger: true }
          ]}
        />
      </div>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4">
          {section.type === 'text' && <TextEditor section={section} onChange={onChange} />}
          {section.type === 'tags' && <TagsEditor section={section} onChange={onChange} />}
          {section.type === 'languages' && <LanguagesEditor section={section} language={language} onChange={onChange} />}
          {section.type === 'entries' && <EntriesEditor section={section} onChange={onChange} focus={focus} />}
        </div>
      )}
    </section>
  );
};
