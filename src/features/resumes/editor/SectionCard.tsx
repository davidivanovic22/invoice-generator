import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../../ui/Button';
import { Icon, type IconName } from '../../../ui/Icon';
import { SECTION_KINDS, type ResumeSection, type SectionKind } from '../model';
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
  onChange: (section: ResumeSection) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

const countLabel = (section: ResumeSection) => {
  if (section.type === 'text') return section.text.trim() ? `${section.text.trim().split(/\s+/).length} words` : 'Empty';
  const count = section.items.length;
  return count === 0 ? 'Empty' : `${count} item${count === 1 ? '' : 's'}`;
};

export const SectionCard = ({ section, onChange, onRemove, onMove, canMoveUp, canMoveDown }: Props) => {
  const [open, setOpen] = useState(section.kind === 'summary' || section.kind === 'experience');
  const [renaming, setRenaming] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) titleRef.current?.select();
  }, [renaming]);

  return (
    <section className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 transition ${section.hidden ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2 py-3 pl-5 pr-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon name={ICONS[section.kind] ?? 'file'} />
        </span>
        {renaming ? (
          <input
            ref={titleRef}
            aria-label="Section title"
            value={section.title}
            onChange={(event) => onChange({ ...section, title: event.target.value })}
            onBlur={() => {
              if (!section.title.trim()) onChange({ ...section, title: SECTION_KINDS[section.kind].title });
              setRenaming(false);
            }}
            onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
            className="min-w-0 flex-1 rounded-md border-0 px-2 py-1 text-[15px] font-semibold ring-2 ring-indigo-500 focus:outline-none"
          />
        ) : (
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-slate-900">{section.title}</span>
              <span className="block truncate text-[13px] text-slate-500">
                {section.hidden ? 'Hidden from the resume' : countLabel(section)}
              </span>
            </span>
            <Icon name="chevronDown" className={`ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
        <div className="flex shrink-0 items-center">
          <IconButton icon="pen" label="Rename section" onClick={() => setRenaming(true)} />
          <IconButton icon={section.hidden ? 'eyeOff' : 'eye'} label={section.hidden ? 'Show on resume' : 'Hide from resume'} onClick={() => onChange({ ...section, hidden: !section.hidden })} className={section.hidden ? '!text-indigo-600' : ''} />
          <IconButton icon="arrowUp" label="Move section up" disabled={!canMoveUp} onClick={() => onMove(-1)} />
          <IconButton icon="arrowDown" label="Move section down" disabled={!canMoveDown} onClick={() => onMove(1)} />
          <IconButton icon="trash" tone="danger" label="Delete section" onClick={onRemove} />
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100 px-5 py-4">
          {section.type === 'text' && <TextEditor section={section} onChange={onChange} />}
          {section.type === 'tags' && <TagsEditor section={section} onChange={onChange} />}
          {section.type === 'languages' && <LanguagesEditor section={section} onChange={onChange} />}
          {section.type === 'entries' && <EntriesEditor section={section} onChange={onChange} />}
        </div>
      )}
    </section>
  );
};
