import type { CSSProperties, ReactNode } from 'react';
import { textSafe } from '../../../lib/color';
import type { EntryItem, LanguageItem, PersonalInfo, ResumeDesign, ResumeFont, ResumeLanguage } from '../model';

export type Theme = {
  accent: string;
  /** Accent darkened enough to be legible as text on white. */
  ink: string;
  text: string;
  muted: string;
  body: string;
  heading: string;
  size: number;
  /** Spacing multiplier from the density setting. */
  space: number;
  /** Language of fixed labels printed on the resume. */
  language: ResumeLanguage;
};

const FONT_STACKS: Record<ResumeFont, { body: string; heading: string }> = {
  sans: { body: "'Inter', sans-serif", heading: "'Inter', sans-serif" },
  dm: { body: "'DM Sans', 'Inter', sans-serif", heading: "'DM Sans', 'Inter', sans-serif" },
  grotesk: { body: "'Inter', sans-serif", heading: "'Space Grotesk', 'Inter', sans-serif" },
  serif: { body: "'Source Serif 4', Georgia, serif", heading: "'Source Serif 4', Georgia, serif" },
  elegant: { body: "'Inter', sans-serif", heading: "'Playfair Display', Georgia, serif" }
};

export const FONT_LABELS: Record<ResumeFont, string> = {
  sans: 'Inter',
  dm: 'DM Sans',
  grotesk: 'Space Grotesk',
  serif: 'Source Serif',
  elegant: 'Playfair'
};

export const makeTheme = (design: ResumeDesign): Theme => {
  const fonts = FONT_STACKS[design.font] ?? FONT_STACKS.sans;
  const density = { compact: { size: 11.5, space: 0.8 }, normal: { size: 12.5, space: 1 }, relaxed: { size: 13.25, space: 1.18 } }[design.density];
  return {
    accent: design.accentColor,
    ink: textSafe(design.accentColor),
    text: '#1e293b',
    muted: '#64748b',
    body: fonts.body,
    heading: fonts.heading,
    size: density.size,
    space: density.space,
    language: design.language ?? 'en'
  };
};

/** Renders "- item" / "• item" lines as a bullet list and other lines as paragraphs. */
export const RichText = ({ text, theme, color }: { text: string; theme: Theme; color?: string }) => {
  const groups: { bullets: boolean; lines: string[] }[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const isBullet = /^[-•*–]\s+/.test(line);
    const content = line.replace(/^[-•*–]\s+/, '');
    const last = groups[groups.length - 1];
    if (last && last.bullets === isBullet && isBullet) last.lines.push(content);
    else groups.push({ bullets: isBullet, lines: [content] });
  }
  return (
    <div style={{ color: color ?? theme.text, display: 'flex', flexDirection: 'column', gap: 3 * theme.space }}>
      {groups.map((group, index) =>
        group.bullets ? (
          <ul key={index} style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2.5 * theme.space }}>
            {group.lines.map((line, lineIndex) => (
              <li key={lineIndex} style={{ position: 'relative', paddingLeft: 13 }}>
                <span style={{ position: 'absolute', left: 1, top: '0.62em', width: 4, height: 4, borderRadius: 4, background: theme.accent }} />
                {line}
              </li>
            ))}
          </ul>
        ) : (
          group.lines.map((line, lineIndex) => (
            <p key={`${index}-${lineIndex}`} style={{ margin: 0 }}>
              {line}
            </p>
          ))
        )
      )}
    </div>
  );
};

export type HeadingVariant = 'rule' | 'caps' | 'bar' | 'underline' | 'plain';

export const SectionHeading = ({
  title,
  theme,
  variant = 'rule',
  color,
  style
}: {
  title: string;
  theme: Theme;
  variant?: HeadingVariant;
  color?: string;
  style?: CSSProperties;
}) => {
  const base: CSSProperties = { fontFamily: theme.heading, color: color ?? theme.ink, margin: 0, lineHeight: 1.2 };
  if (variant === 'caps')
    return (
      <h3 style={{ ...base, fontSize: theme.size * 0.86, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', ...style }}>{title}</h3>
    );
  if (variant === 'bar')
    return (
      <h3 style={{ ...base, fontSize: theme.size * 1.12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, ...style }}>
        <span style={{ width: 4, height: '1em', borderRadius: 2, background: theme.accent }} />
        {title}
      </h3>
    );
  if (variant === 'underline')
    return (
      <h3 style={{ ...base, fontSize: theme.size * 1.15, fontWeight: 700, paddingBottom: 5, borderBottom: `2px solid ${theme.accent}`, ...style }}>
        {title}
      </h3>
    );
  if (variant === 'plain') return <h3 style={{ ...base, fontSize: theme.size * 1.2, fontWeight: 700, ...style }}>{title}</h3>;
  return (
    <h3
      style={{
        ...base,
        fontSize: theme.size * 0.9,
        fontWeight: 700,
        // Wider tracking makes PDF text extractors (and ATS parsers) split the word into letters.
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        ...style
      }}
    >
      {title}
      <span style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
    </h3>
  );
};

const dateRange = (item: EntryItem) => [item.start, item.end].filter((part) => part.trim()).join(' – ');

export const Entry = ({
  item,
  theme,
  layout = 'stacked',
  dark = false
}: {
  item: EntryItem;
  theme: Theme;
  /** stacked: dates under the title; split: dates right-aligned; timeline: dates in a left column. */
  layout?: 'stacked' | 'split' | 'timeline';
  dark?: boolean;
}) => {
  const dates = dateRange(item);
  const text = dark ? '#f8fafc' : theme.text;
  const muted = dark ? 'rgba(248,250,252,0.7)' : theme.muted;
  const meta = [item.subtitle, item.location].filter((part) => part.trim());
  const title = <div style={{ fontWeight: 650, color: text, fontFamily: theme.heading, fontSize: theme.size * 1.06 }}>{item.title || item.subtitle}</div>;
  const subtitle = item.title && meta.length > 0 && (
    <div style={{ color: dark ? text : theme.ink, fontWeight: 500 }}>
      {item.subtitle}
      {item.subtitle && item.location ? <span style={{ color: muted, fontWeight: 400 }}> · {item.location}</span> : !item.subtitle ? <span style={{ color: muted }}>{item.location}</span> : null}
    </div>
  );
  const description = item.description.trim() && (
    <div style={{ marginTop: 5 * theme.space }}>
      <RichText text={item.description} theme={theme} color={dark ? text : undefined} />
    </div>
  );

  if (layout === 'timeline')
    return (
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ width: 92, flexShrink: 0, color: muted, fontSize: theme.size * 0.9, paddingTop: 2 }}>{dates}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {title}
          {subtitle}
          {description}
        </div>
      </div>
    );

  if (layout === 'split')
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          {title}
          {dates && <div style={{ color: muted, fontSize: theme.size * 0.9, whiteSpace: 'nowrap' }}>{dates}</div>}
        </div>
        {subtitle}
        {description}
      </div>
    );

  return (
    <div>
      {title}
      {subtitle}
      {dates && <div style={{ color: muted, fontSize: theme.size * 0.9 }}>{dates}</div>}
      {description}
    </div>
  );
};

export const Tags = ({
  items,
  theme,
  variant = 'chips',
  dark = false
}: {
  items: string[];
  theme: Theme;
  variant?: 'chips' | 'inline' | 'list' | 'outline';
  dark?: boolean;
}) => {
  const text = dark ? '#f8fafc' : theme.text;
  if (variant === 'inline') return <div style={{ color: text }}>{items.join(' · ')}</div>;
  if (variant === 'list')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 * theme.space, color: text }}>
        {items.map((item, index) => (
          <div key={index}>{item}</div>
        ))}
      </div>
    );
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((item, index) => (
        <span
          key={index}
          style={{
            padding: '3px 10px',
            borderRadius: 999,
            fontSize: theme.size * 0.9,
            lineHeight: 1.5,
            color: dark ? '#fff' : variant === 'outline' ? theme.ink : theme.text,
            background: dark ? 'rgba(255,255,255,0.14)' : variant === 'outline' ? 'transparent' : '#f1f5f9',
            border: variant === 'outline' ? `1px solid ${theme.accent}` : '1px solid transparent'
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
};

export const Languages = ({ items, theme, dark = false }: { items: LanguageItem[]; theme: Theme; dark?: boolean }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 * theme.space }}>
    {items.map((item) => (
      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: dark ? '#fff' : theme.text }}>{item.name}</span>
        <span style={{ color: dark ? 'rgba(255,255,255,0.72)' : theme.muted }}>{item.level}</span>
      </div>
    ))}
  </div>
);

type ContactEntry = { kind: string; value: string };

export const contactEntries = (personal: PersonalInfo): ContactEntry[] =>
  [
    { kind: 'email', value: personal.email },
    { kind: 'phone', value: personal.phone },
    { kind: 'location', value: personal.location },
    { kind: 'website', value: personal.website },
    { kind: 'linkedin', value: personal.linkedin },
    { kind: 'github', value: personal.github },
    ...personal.extras.map((extra) => ({ kind: 'extra', value: extra.label ? `${extra.label}: ${extra.value}` : extra.value }))
  ].filter((entry) => entry.value.trim());

const CONTACT_ICONS: Record<string, string> = {
  email: 'M3 5h18v14H3zM3 6l9 7 9-7',
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2',
  location: 'M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  website: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z',
  linkedin: 'M4 9h4v11H4zM6 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 9h4v1.6c.6-1 1.9-1.9 3.6-1.9 3 0 3.4 2 3.4 4.6V20h-4v-5.6c0-1.3 0-2.9-1.8-2.9S13 13 13 14.3V20h-3z',
  github: 'M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  extra: 'M12 8v4l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'
};

export const ContactIcon = ({ kind, color, size = 12 }: { kind: string; color: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d={CONTACT_ICONS[kind] ?? CONTACT_ICONS.extra} />
  </svg>
);

export const ContactList = ({
  personal,
  theme,
  variant = 'stack',
  color,
  iconColor
}: {
  personal: PersonalInfo;
  theme: Theme;
  variant?: 'stack' | 'inline' | 'wrap';
  color?: string;
  iconColor?: string;
}) => {
  const entries = contactEntries(personal);
  if (variant === 'inline')
    return (
      <div style={{ color: color ?? theme.muted, display: 'flex', flexWrap: 'wrap', columnGap: 6, rowGap: 2, justifyContent: 'inherit' }}>
        {entries.map((entry, index) => (
          <span key={index}>
            {index > 0 && <span style={{ marginRight: 6, opacity: 0.5 }}>|</span>}
            {entry.value}
          </span>
        ))}
      </div>
    );
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: variant === 'stack' ? 'column' : 'row',
        flexWrap: 'wrap',
        columnGap: 18,
        rowGap: 6 * theme.space,
        color: color ?? theme.text
      }}
    >
      {entries.map((entry, index) => (
        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, wordBreak: 'break-word' }}>
          <ContactIcon kind={entry.kind} color={iconColor ?? theme.accent} />
          <span>{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const Photo = ({ src, size, shape = 'circle', border }: { src: string; size: number; shape?: 'circle' | 'rounded' | 'square'; border?: string }) => (
  <img
    src={src}
    alt=""
    style={{
      width: size,
      height: size,
      objectFit: 'cover',
      borderRadius: shape === 'circle' ? '50%' : shape === 'rounded' ? 16 : 0,
      border,
      display: 'block',
      flexShrink: 0
    }}
  />
);

export const Stack = ({ children, gap }: { children: ReactNode; gap: number }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap }}>{children}</div>
);
