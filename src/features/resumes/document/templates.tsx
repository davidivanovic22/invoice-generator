import type { ReactElement, ReactNode } from 'react';
import { alpha, readableOn, shade, tint } from '../../../lib/color';
import { SECTION_KINDS, type Resume, type ResumeFont, type ResumeSection, type ResumeTemplateId } from '../model';
import { ContactList, Entry, Languages, Photo, RichText, SectionHeading, Tags, type HeadingVariant, type Theme } from './blocks';
import { PAGE_WIDTH, Paginator, type Block } from './Paginator';

type Renderers = {
  heading: (title: string) => ReactNode;
  entry: Parameters<typeof Entry>[0]['layout'];
  tags: Parameters<typeof Tags>[0]['variant'];
  dark?: boolean;
  /** Extra space above each section heading, on top of the column gap. */
  sectionSpace: number;
  headingSpace: number;
};

const isEmpty = (section: ResumeSection) => {
  if (section.type === 'text') return !section.text.trim();
  if (section.type === 'tags') return section.items.every((item) => !item.trim());
  if (section.type === 'languages') return section.items.every((item) => !item.name.trim());
  return section.items.every((item) => !item.title.trim() && !item.subtitle.trim() && !item.description.trim());
};

export const visibleSections = (resume: Resume, column?: 'main' | 'side') =>
  resume.sections.filter((section) => !section.hidden && !isEmpty(section) && (!column || SECTION_KINDS[section.kind].column === column));

/** Turns sections into paginator blocks: a heading glued to the first entry, then one block per entry. */
const sectionBlocks = (sections: ResumeSection[], theme: Theme, r: Renderers, isFirstColumnBlock = true): Block[] =>
  sections.flatMap((section, sectionIndex) => {
    const top = sectionIndex === 0 && isFirstColumnBlock ? 0 : r.sectionSpace;
    const heading = (
      <div style={{ paddingTop: top, paddingBottom: r.headingSpace }}>{r.heading(section.title || SECTION_KINDS[section.kind].title)}</div>
    );
    if (section.type === 'entries') {
      const items = section.items.filter((item) => item.title.trim() || item.subtitle.trim() || item.description.trim());
      return [
        { key: `${section.id}-heading`, node: heading, keepWithNext: true },
        ...items.map((item) => ({ key: item.id, node: <Entry item={item} theme={theme} layout={r.entry} dark={r.dark} /> }))
      ];
    }
    let content: ReactNode;
    if (section.type === 'tags') content = <Tags items={section.items.filter((item) => item.trim())} theme={theme} variant={r.tags} dark={r.dark} />;
    else if (section.type === 'languages') content = <Languages items={section.items.filter((item) => item.name.trim())} theme={theme} dark={r.dark} />;
    else content = <RichText text={section.text} theme={theme} color={r.dark ? '#f8fafc' : undefined} />;
    return [
      {
        key: section.id,
        node: (
          <div>
            {heading}
            {content}
          </div>
        )
      }
    ];
  });

const bodyStyle = (theme: Theme, color = theme.text) => ({ fontFamily: theme.body, fontSize: theme.size, lineHeight: 1.5, color });

const Name = ({ resume, theme, size, color, align }: { resume: Resume; theme: Theme; size: number; color?: string; align?: 'left' | 'center' }) => (
  <div style={{ textAlign: align }}>
    <div style={{ fontFamily: theme.heading, fontSize: size, fontWeight: 750, lineHeight: 1.08, letterSpacing: '-0.02em', color: color ?? theme.text }}>
      {resume.personal.fullName || 'Your name'}
    </div>
    {resume.personal.headline && (
      <div style={{ marginTop: 6, fontSize: theme.size * 1.18, fontWeight: 500, color: color ? alpha(color, 0.78) : theme.ink }}>
        {resume.personal.headline}
      </div>
    )}
  </div>
);

const heading = (theme: Theme, variant: HeadingVariant, color?: string) => (title: string) => (
  <SectionHeading title={title} theme={theme} variant={variant} color={color} />
);

const showPhoto = (resume: Resume) => resume.design.showPhoto && Boolean(resume.personal.photo);

/* ------------------------------ Modern: tinted sidebar ------------------------------ */

const Modern = (resume: Resume, theme: Theme) => {
  const s = theme.space;
  const sideWidth = 262;
  const side: Block[] = [
    ...(showPhoto(resume) ? [{ key: 'photo', node: <Photo src={resume.personal.photo} size={132} border={`4px solid #fff`} /> }] : []),
    {
      key: 'contact',
      node: (
        <div style={{ paddingTop: showPhoto(resume) ? 8 : 0 }}>
          <div style={{ paddingBottom: 10 * s }}>
            <SectionHeading title="Contact" theme={theme} variant="caps" />
          </div>
          <ContactList personal={resume.personal} theme={theme} />
        </div>
      )
    },
    ...sectionBlocks(visibleSections(resume, 'side'), theme, { heading: heading(theme, 'caps'), entry: 'stacked', tags: 'chips', sectionSpace: 18 * s, headingSpace: 10 * s }, false)
  ];
  const main: Block[] = [
    { key: 'name', node: <div style={{ paddingBottom: 10 * s }}><Name resume={resume} theme={theme} size={34} /></div> },
    ...sectionBlocks(visibleSections(resume, 'main'), theme, { heading: heading(theme, 'rule'), entry: 'split', tags: 'chips', sectionSpace: 16 * s, headingSpace: 10 * s }, false)
  ];
  return (
    <Paginator
      pageStyle={bodyStyle(theme)}
      columns={[
        { key: 'side', width: sideWidth, padding: { top: 44, bottom: 40, x: 26 }, gap: 12 * s, blocks: side, style: { background: tint(theme.accent, 0.92) } },
        { key: 'main', width: PAGE_WIDTH - sideWidth, padding: { top: 48, bottom: 40, x: 38 }, gap: 12 * s, blocks: main }
      ]}
    />
  );
};

/* ------------------------------ Classic: single column, ATS-friendly ------------------------------ */

const Classic = (resume: Resume, theme: Theme) => {
  const s = theme.space;
  const header = (
    <div style={{ padding: '52px 64px 0', textAlign: 'center' }}>
      <Name resume={resume} theme={theme} size={32} align="center" />
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}>
        <ContactList personal={resume.personal} theme={theme} variant="inline" />
      </div>
      <div style={{ marginTop: 18, height: 2, background: theme.ink }} />
    </div>
  );
  const blocks = sectionBlocks(visibleSections(resume), theme, {
    heading: heading(theme, 'underline'),
    entry: 'split',
    tags: 'inline',
    sectionSpace: 14 * s,
    headingSpace: 8 * s
  });
  return (
    <Paginator
      pageStyle={bodyStyle(theme)}
      header={header}
      columns={[{ key: 'main', width: PAGE_WIDTH, padding: { top: 22, bottom: 44, x: 64 }, gap: 10 * s, blocks }]}
    />
  );
};

/* ------------------------------ Minimal: timeline, lots of air ------------------------------ */

const Minimal = (resume: Resume, theme: Theme) => {
  const s = theme.space;
  const header = (
    <div style={{ padding: '60px 68px 0', display: 'flex', alignItems: 'center', gap: 24 }}>
      {showPhoto(resume) && <Photo src={resume.personal.photo} size={84} shape="circle" />}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: theme.heading, fontSize: 36, fontWeight: 300, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{resume.personal.fullName || 'Your name'}</div>
        {resume.personal.headline && <div style={{ marginTop: 6, fontSize: theme.size * 1.15, color: theme.ink, fontWeight: 500 }}>{resume.personal.headline}</div>}
        <div style={{ marginTop: 10, fontSize: theme.size * 0.92 }}>
          <ContactList personal={resume.personal} theme={theme} variant="inline" />
        </div>
      </div>
    </div>
  );
  const blocks = sectionBlocks(visibleSections(resume), theme, {
    heading: heading(theme, 'caps'),
    entry: 'timeline',
    tags: 'inline',
    sectionSpace: 20 * s,
    headingSpace: 10 * s
  });
  return (
    <Paginator
      pageStyle={bodyStyle(theme)}
      header={header}
      columns={[{ key: 'main', width: PAGE_WIDTH, padding: { top: 34, bottom: 48, x: 68 }, gap: 12 * s, blocks }]}
    />
  );
};

/* ------------------------------ Executive: dark band, right rail ------------------------------ */

const Executive = (resume: Resume, theme: Theme) => {
  const s = theme.space;
  const band = shade(theme.accent, 0.62);
  const onBand = readableOn(band);
  const header = (
    <div style={{ background: band, color: onBand, padding: '44px 48px 36px', display: 'flex', alignItems: 'center', gap: 28 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Name resume={resume} theme={theme} size={34} color={onBand} />
        <div style={{ marginTop: 14, fontSize: theme.size * 0.95 }}>
          <ContactList personal={resume.personal} theme={theme} variant="wrap" color={alpha(onBand, 0.9)} iconColor={tint(theme.accent, 0.45)} />
        </div>
      </div>
      {showPhoto(resume) && <Photo src={resume.personal.photo} size={118} shape="rounded" border={`3px solid ${alpha('#ffffff', 0.25)}`} />}
    </div>
  );
  const sideWidth = 268;
  const main = sectionBlocks(visibleSections(resume, 'main'), theme, { heading: heading(theme, 'bar', theme.text), entry: 'split', tags: 'chips', sectionSpace: 16 * s, headingSpace: 10 * s });
  const side = sectionBlocks(visibleSections(resume, 'side'), theme, { heading: heading(theme, 'caps'), entry: 'stacked', tags: 'list', sectionSpace: 20 * s, headingSpace: 10 * s });
  return (
    <Paginator
      pageStyle={bodyStyle(theme)}
      header={header}
      columns={[
        { key: 'main', width: PAGE_WIDTH - sideWidth, padding: { top: 32, bottom: 40, x: 44 }, gap: 12 * s, blocks: main },
        { key: 'side', width: sideWidth, padding: { top: 32, bottom: 40, x: 28 }, gap: 12 * s, blocks: side, style: { background: '#f8fafc', borderLeft: '1px solid #eef2f7' } }
      ]}
      background={(page) => (page > 0 ? <div style={{ height: 8, background: band }} /> : null)}
    />
  );
};

/* ------------------------------ Creative: bold colour sidebar ------------------------------ */

const Creative = (resume: Resume, theme: Theme) => {
  const s = theme.space;
  const sideWidth = 276;
  const panel = shade(theme.accent, 0.35);
  const onPanel = readableOn(panel);
  const dark = onPanel === '#ffffff';
  const side: Block[] = [
    {
      key: 'identity',
      node: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
          {showPhoto(resume) && <Photo src={resume.personal.photo} size={136} border={`5px solid ${alpha('#ffffff', 0.3)}`} />}
          <div>
            <div style={{ fontFamily: theme.heading, fontSize: 30, fontWeight: 700, lineHeight: 1.05, color: onPanel, letterSpacing: '-0.02em' }}>
              {resume.personal.fullName || 'Your name'}
            </div>
            {resume.personal.headline && <div style={{ marginTop: 8, color: alpha(onPanel, 0.8), fontWeight: 500 }}>{resume.personal.headline}</div>}
          </div>
        </div>
      )
    },
    {
      key: 'contact',
      node: (
        <div style={{ paddingTop: 10 * s }}>
          <ContactList personal={resume.personal} theme={theme} color={onPanel} iconColor={alpha(onPanel, 0.75)} />
        </div>
      )
    },
    ...sectionBlocks(
      visibleSections(resume, 'side'),
      theme,
      { heading: heading(theme, 'caps', alpha(onPanel, 0.75)), entry: 'stacked', tags: 'chips', dark, sectionSpace: 20 * s, headingSpace: 10 * s },
      false
    )
  ];
  const main = sectionBlocks(visibleSections(resume, 'main'), theme, { heading: heading(theme, 'plain'), entry: 'split', tags: 'outline', sectionSpace: 18 * s, headingSpace: 10 * s });
  return (
    <Paginator
      pageStyle={bodyStyle(theme)}
      columns={[
        { key: 'side', width: sideWidth, padding: { top: 48, bottom: 40, x: 30 }, gap: 12 * s, blocks: side, style: { background: panel, color: onPanel } },
        { key: 'main', width: PAGE_WIDTH - sideWidth, padding: { top: 52, bottom: 40, x: 40 }, gap: 12 * s, blocks: main }
      ]}
    />
  );
};

/* ------------------------------ Compact: dense two columns ------------------------------ */

const Compact = (resume: Resume, theme: Theme) => {
  const s = theme.space;
  const header = (
    <div style={{ padding: '40px 44px 18px', display: 'flex', alignItems: 'flex-end', gap: 20, borderBottom: `3px solid ${theme.accent}`, margin: '0 0 0 0' }}>
      {showPhoto(resume) && <Photo src={resume.personal.photo} size={76} shape="rounded" />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Name resume={resume} theme={theme} size={28} />
      </div>
      <div style={{ width: 280, fontSize: theme.size * 0.9 }}>
        <ContactList personal={resume.personal} theme={theme} />
      </div>
    </div>
  );
  const sideWidth = 250;
  const main = sectionBlocks(visibleSections(resume, 'main'), theme, { heading: heading(theme, 'caps'), entry: 'split', tags: 'chips', sectionSpace: 12 * s, headingSpace: 8 * s });
  const side = sectionBlocks(visibleSections(resume, 'side'), theme, { heading: heading(theme, 'caps'), entry: 'stacked', tags: 'chips', sectionSpace: 14 * s, headingSpace: 8 * s });
  return (
    <Paginator
      pageStyle={bodyStyle(theme)}
      header={header}
      columns={[
        { key: 'main', width: PAGE_WIDTH - sideWidth, padding: { top: 22, bottom: 36, x: 44 }, gap: 9 * s, blocks: main },
        { key: 'side', width: sideWidth, padding: { top: 22, bottom: 36, x: 24 }, gap: 9 * s, blocks: side }
      ]}
    />
  );
};

export const RESUME_TEMPLATES: Record<
  ResumeTemplateId,
  { name: string; description: string; font: ResumeFont; render: (resume: Resume, theme: Theme) => ReactElement }
> = {
  modern: { name: 'Modern', description: 'Tinted sidebar, clean and friendly', font: 'sans', render: Modern },
  classic: { name: 'Classic', description: 'Single column, best for ATS systems', font: 'serif', render: Classic },
  minimal: { name: 'Minimal', description: 'Timeline layout with lots of air', font: 'dm', render: Minimal },
  executive: { name: 'Executive', description: 'Dark header band and side rail', font: 'sans', render: Executive },
  creative: { name: 'Creative', description: 'Bold colour sidebar', font: 'grotesk', render: Creative },
  compact: { name: 'Compact', description: 'Dense two columns, fits more on a page', font: 'sans', render: Compact }
};
