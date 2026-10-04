import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { t } from '../i18n';
import { IconButton } from './Button';
import { Icon } from './Icon';
import { Menu, type MenuItem } from './Menu';
import { Segmented } from './Layout';

const isTextInput = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Ctrl/⌘+Z and Ctrl/⌘+Shift+Z / Ctrl+Y outside text fields (fields keep their native undo). */
export const useUndoShortcuts = (undo: () => void, redo: () => void) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || isTextInput(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);
};

/** Briefly highlights an element so the eye finds what was just opened. */
export const flash = (element: Element | null) => {
  if (!element) return;
  element.classList.remove('flash-highlight');
  // Restart the animation if it is already running.
  void (element as HTMLElement).offsetWidth;
  element.classList.add('flash-highlight');
  setTimeout(() => element.classList.remove('flash-highlight'), 1600);
};

/** Reads which part of a document was clicked (elements carry data-edit / data-item). */
export const editTargetFrom = (event: React.MouseEvent) => {
  const element = (event.target as HTMLElement).closest<HTMLElement>('[data-edit]');
  if (!element) return null;
  return { target: element.dataset.edit ?? '', item: element.dataset.item };
};

type ToolbarProps = {
  backTo: string;
  backLabel: string;
  title: ReactNode;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  menu: MenuItem[];
  children?: ReactNode;
};

export const EditorToolbar = ({ backTo, backLabel, title, onUndo, onRedo, canUndo, canRedo, menu, children }: ToolbarProps) => (
  <div className="sticky top-14 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
    <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-6">
      <Link to={backTo} className="flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900">
        <Icon name="chevronLeft" />
        <span className="hidden sm:inline">{backLabel}</span>
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-2">{title}</div>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton icon="undo" label={`${t('Undo')} (Ctrl+Z)`} onClick={onUndo} disabled={!canUndo} />
        <IconButton icon="redo" label={`${t('Redo')} (Ctrl+Y)`} onClick={onRedo} disabled={!canRedo} />
        <Menu label={t('More actions')} items={menu} />
        {children}
      </div>
    </div>
  </div>
);

export const MobileViewSwitch = ({ value, onChange }: { value: 'edit' | 'preview'; onChange: (value: 'edit' | 'preview') => void }) => (
  <div className="mx-auto w-full max-w-[1600px] px-4 pt-4 sm:px-6 lg:hidden">
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: 'edit', label: t('Edit') },
        { value: 'preview', label: t('Preview') }
      ]}
    />
  </div>
);

export const PreviewHint = () => (
  <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
    <Icon name="pointer" className="h-3.5 w-3.5" />
    {t('Click anything in the preview to edit it')}
  </p>
);
