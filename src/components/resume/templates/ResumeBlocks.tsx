import { ResumeData, PercentageItem } from '../../../types/resume';
import { ResumeSectionTitleBlock } from '../blocks/ResumeSectionTitleBlock';

/* =========================
   HELPERS
========================= */

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeSkillPercent = (percent: number) =>
  clamp(Number.isFinite(percent) ? percent : 0, 0, 100);

const getSkillLabel = (skill: string | PercentageItem) =>
  typeof skill === 'string' ? skill : skill.name;

const getSkillPercent = (skill: string | PercentageItem) =>
  typeof skill === 'string' ? 0 : normalizeSkillPercent(skill.percent);

/* =========================
   SKILLS
========================= */

type ResumeSkillGridProps = {
  skills: PercentageItem[];
  accent: string;
  light?: boolean;
  isPdf?: boolean;
  showPercent?: boolean;
};

export const ResumeSkillGrid = ({
  skills,
  accent,
  light = false,
  isPdf = false,
  showPercent = false
}: ResumeSkillGridProps) => {
  if (!skills.length) return null;

  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
      {skills.map((skill, index) => {
        const label = getSkillLabel(skill);
        const percent = getSkillPercent(skill);

        return (
          <div
            key={skill.id || `grid-skill-${index}`}
            className="flex min-h-[40px] flex-col items-center justify-center rounded-2xl px-3 py-2 text-center"
            style={{
              paddingBottom: isPdf ? '14px' : undefined,
              border: `1px solid ${light ? 'rgba(255,255,255,0.22)' : `${accent}55`}`,
              color: light ? '#fff' : accent
            }}
          >
            <span className="text-[11px] font-semibold leading-[1.2]">{label}</span>
            {showPercent ? (
              <span className={`mt-1 text-[10px] ${light ? 'text-white/80' : 'text-slate-500'}`}>
                {percent}%
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

type ResumeSkillBarsProps = {
  skills: PercentageItem[];
  accent: string;
  light?: boolean;
};

export const ResumeSkillBars = ({
  skills,
  accent,
  light = false
}: ResumeSkillBarsProps) => {
  if (!skills.length) return null;

  return (
    <div className="space-y-3">
      {skills.map((skill, index) => {
        const percent = normalizeSkillPercent(skill.percent);

        return (
          <div key={skill.id || `bar-skill-${index}`}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className={`text-[13px] font-medium ${light ? 'text-white' : 'text-slate-800'}`}>
                {skill.name}
              </span>
              <span className={`text-[11px] ${light ? 'text-white/75' : 'text-slate-500'}`}>
                {percent}%
              </span>
            </div>

            <div
              className={`h-2 overflow-hidden rounded-full ${light ? 'bg-white/20' : 'bg-slate-200'
                }`}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${percent}%`,
                  backgroundColor: accent
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* =========================
   SUMMARY
========================= */

export const ResumeSummary = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => (
  <section>
    <ResumeSectionTitleBlock accent={accent} light={light}>
      Professional Summary
    </ResumeSectionTitleBlock>

    <p className={`text-[14px] leading-7 ${light ? 'text-white/90' : 'text-slate-700'}`}>
      {resume.professionalSummary}
    </p>
  </section>
);

/* =========================
   EXPERIENCE
========================= */

export const ResumeExperienceList = ({
  resume,
  accent,
  light = false,
  compact = false,
  isPdf = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
  compact?: boolean;
  isPdf?: boolean;
}) => {
  const textPrimary = light ? 'text-white' : 'text-slate-900';
  const textSecondary = light ? 'text-white/70' : 'text-slate-500';
  const textBody = light ? 'text-white/85' : 'text-slate-700';

  return (
    <section>
      <ResumeSectionTitleBlock accent={accent} light={light}>
        Experience
      </ResumeSectionTitleBlock>

      <div className={compact ? 'space-y-6' : 'space-y-8'}>
        {resume.experience.map((exp) => (
          <article key={exp.id}>
            <div className="grid grid-cols-[1fr_auto] items-start gap-4">
              <div className="min-w-0">
                <div
                  className={`font-semibold leading-tight ${compact ? 'text-[15px]' : 'text-[18px]'
                    } ${textPrimary}`}
                >
                  {exp.role}
                </div>

                <div className={`mt-1 ${compact ? 'text-[13px]' : 'text-sm'} ${textSecondary}`}>
                  {[exp.company, exp.project, exp.location].filter(Boolean).join(' • ')}
                </div>
              </div>

              <div
                className={`shrink-0 text-right ${compact ? 'text-[13px]' : 'text-sm'
                  } ${textSecondary}`}
              >
                {exp.start} - {exp.end}
              </div>
            </div>

            <div className="mt-3 space-y-2 text-[13px]">
              {exp.bullets.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="block h-[4px] w-[4px] min-w-[4px] rounded-full"
                    style={{
                      marginTop: isPdf ? '16px' : undefined,
                      backgroundColor: accent
                    }}
                  />
                  <span className={`${textBody} leading-[1.5]`}>{b}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   EDUCATION
========================= */

export const ResumeEducationList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  const textPrimary = light ? 'text-white' : 'text-slate-900';
  const textSecondary = light ? 'text-white/70' : 'text-slate-500';

  return (
    <section>
      <ResumeSectionTitleBlock accent={accent} light={light}>
        Education
      </ResumeSectionTitleBlock>

      <div className="space-y-4">
        {resume.education.map((edu) => (
          <article key={edu.id}>
            <div className={`text-[15px] font-semibold ${textPrimary}`}>{edu.degree}</div>
            <div className={`mt-1 text-[13px] ${textSecondary}`}>{edu.school}</div>
            <div className={`mt-1 text-[13px] ${textSecondary}`}>
              {edu.start} - {edu.end}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   GENERIC STRING SECTION
========================= */

export const ResumeStringSection = ({
  title,
  items,
  accent,
  light = false
}: {
  title: string;
  items: string[];
  accent: string;
  light?: boolean;
}) => {
  if (!items.length) return null;

  return (
    <section>
      <ResumeSectionTitleBlock accent={accent} light={light}>
        {title}
      </ResumeSectionTitleBlock>

      <div className={`space-y-2 text-[13px] ${light ? 'text-white/85' : 'text-slate-700'}`}>
        {items.map((item, index) => (
          <div key={index}>• {item}</div>
        ))}
      </div>
    </section>
  );
};

/* =========================
   COURSES
========================= */

export const ResumeCoursesList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  if (!resume.enabledSections.courses || !resume.courses.length) return null;

  const textPrimary = light ? 'text-white' : 'text-slate-900';
  const textSecondary = light ? 'text-white/70' : 'text-slate-500';

  return (
    <section>
      <ResumeSectionTitleBlock accent={accent} light={light}>
        Courses
      </ResumeSectionTitleBlock>

      <div className="space-y-4">
        {resume.courses.map((item) => (
          <article key={item.id}>
            <div className={`text-[14px] font-semibold ${textPrimary}`}>{item.title}</div>
            {(item.provider || item.year) && (
              <div className={`mt-1 text-[13px] ${textSecondary}`}>
                {[item.provider, item.year].filter(Boolean).join(' • ')}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   INTERNSHIPS
========================= */

export const ResumeInternshipsList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  if (!resume.enabledSections.internships || !resume.internships.length) return null;

  const textPrimary = light ? 'text-white' : 'text-slate-900';
  const textSecondary = light ? 'text-white/70' : 'text-slate-500';
  const textBody = light ? 'text-white/85' : 'text-slate-700';

  return (
    <section>
      <ResumeSectionTitleBlock accent={accent} light={light}>
        Internships
      </ResumeSectionTitleBlock>

      <div className="space-y-4">
        {resume.internships.map((item) => (
          <article key={item.id}>
            <div className={`text-[14px] font-semibold ${textPrimary}`}>
              {[item.role, item.company].filter(Boolean).join(' - ')}
            </div>
            {(item.start || item.end) && (
              <div className={`mt-1 text-[13px] ${textSecondary}`}>
                {[item.start, item.end].filter(Boolean).join(' - ')}
              </div>
            )}
            {item.description ? (
              <div className={`mt-2 text-[13px] ${textBody}`}>{item.description}</div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   REFERENCES
========================= */

export const ResumeReferencesList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  if (!resume.enabledSections.references || !resume.references.length) return null;

  const textPrimary = light ? 'text-white' : 'text-slate-900';
  const textSecondary = light ? 'text-white/70' : 'text-slate-500';

  return (
    <section>
      <ResumeSectionTitleBlock accent={accent} light={light}>
        References
      </ResumeSectionTitleBlock>

      <div className="space-y-4">
        {resume.references.map((item) => (
          <article key={item.id}>
            <div className={`text-[14px] font-semibold ${textPrimary}`}>{item.name}</div>
            <div className={`mt-1 text-[13px] ${textSecondary}`}>
              {[item.role, item.company].filter(Boolean).join(' • ')}
            </div>
            <div className={`mt-1 text-[13px] ${textSecondary}`}>
              {[item.email, item.phone].filter(Boolean).join(' • ')}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   CERTIFICATES
========================= */

export const ResumeCertificatesList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  if (!resume.enabledSections.certificates || !resume.certificates.length) return null;

  const textPrimary = light ? 'text-white' : 'text-slate-900';
  const textSecondary = light ? 'text-white/70' : 'text-slate-500';

  return (
    <section>
      <ResumeSectionTitleBlock accent={accent} light={light}>
        Certificates
      </ResumeSectionTitleBlock>

      <div className="space-y-4">
        {resume.certificates.map((item) => (
          <article key={item.id}>
            <div className={`text-[14px] font-semibold ${textPrimary}`}>{item.name}</div>
            <div className={`mt-1 text-[13px] ${textSecondary}`}>
              {[item.issuer, item.year].filter(Boolean).join(' • ')}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   ACHIEVEMENTS
========================= */

export const ResumeAchievementsList = ({
  resume,
  accent,
  light = false
}: {
  resume: ResumeData;
  accent: string;
  light?: boolean;
}) => {
  if (!resume.enabledSections.achievements || !resume.achievements.length) return null;

  const textPrimary = light ? 'text-white' : 'text-slate-900';
  const textBody = light ? 'text-white/85' : 'text-slate-700';

  return (
    <section>
      <ResumeSectionTitleBlock accent={accent} light={light}>
        Achievements
      </ResumeSectionTitleBlock>

      <div className="space-y-4">
        {resume.achievements.map((item) => (
          <article key={item.id}>
            <div className={`text-[14px] font-semibold ${textPrimary}`}>{item.title}</div>
            {item.description ? (
              <div className={`mt-1 text-[13px] ${textBody}`}>{item.description}</div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
};

/* =========================
   FOOTER / SIGNATURE
========================= */

export const ResumeFooterText = ({
  title,
  value,
  accent,
  light = false
}: {
  title: string;
  value?: string;
  accent: string;
  light?: boolean;
}) => {
  if (!value) return null;

  return (
    <section>
      <ResumeSectionTitleBlock accent={accent} light={light}>
        {title}
      </ResumeSectionTitleBlock>

      <div className={`text-[13px] leading-6 ${light ? 'text-white/85' : 'text-slate-700'}`}>
        {value}
      </div>
    </section>
  );
};

/* =========================
   INFOGRAPHIC BUBBLES + DOTS
========================= */

/* =========================
   INFOGRAPHIC BUBBLES + DOTS
========================= */

type CleanPercentageItem = {
  id: string;
  name: string;
  percent: number;
};

const normalizePercent = (value: number) =>
  clamp(Number.isFinite(value) ? value : 0, 0, 100);

const getRenderablePercentageItems = (
  items: PercentageItem[]
): CleanPercentageItem[] =>
  items
    .map((item, index) => ({
      id:
        typeof item.id === 'string' && item.id.trim()
          ? item.id
          : `percentage-item-${index}`,
      name: (item.name ?? '').trim(),
      percent: normalizePercent(item.percent)
    }))
    .filter((item) => item.name.length > 0 && item.percent > 0)
    .sort((a, b) => b.percent - a.percent);

const bubblePalette = [
  '#17324d',
  '#6fa0d1',
  '#2f6ea5',
  '#ff4949',
  '#7ea9d6',
  '#4b86c7',
  '#264d73',
  '#84b3df'
];

const getBubbleDiameter = (percent: number, index: number) => {
  const safe = normalizePercent(percent);

  if (index === 0) return 132;
  return 54 + (safe / 100) * 42;
};

const getBubbleName = (name: string, size: number) => {
  const trimmed = name.trim();

  if (size < 56 && trimmed.length > 4) return `${trimmed.slice(0, 3)}...`;
  if (size < 72 && trimmed.length > 6) return `${trimmed.slice(0, 5)}...`;
  if (size < 90 && trimmed.length > 9) return `${trimmed.slice(0, 8)}...`;
  if (size < 108 && trimmed.length > 12) return `${trimmed.slice(0, 11)}...`;

  return trimmed;
};

const getBubbleFontSize = (size: number) => {
  if (size >= 120) return 16;
  if (size >= 96) return 13;
  if (size >= 72) return 11;
  if (size >= 58) return 10;
  return 9;
};

const getBubblePercentFontSize = (size: number) => {
  if (size >= 120) return 14;
  if (size >= 96) return 12;
  if (size >= 72) return 11;
  if (size >= 58) return 10;
  return 9;
};

type BubbleNode = {
  item: CleanPercentageItem;
  diameter: number;
  radius: number;
  x: number;
  y: number;
  color: string;
};

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const circlesOverlap = (
  x: number,
  y: number,
  radius: number,
  placed: BubbleNode[],
  gap: number
) => {
  return placed.some((node) => {
    const minDistance = radius + node.radius + gap;
    return distance({ x, y }, node) < minDistance;
  });
};

const buildDynamicBubbleLayout = (
  items: CleanPercentageItem[],
  accent: string
): BubbleNode[] => {
  if (!items.length) return [];

  const placed: BubbleNode[] = [];
  const diameters = items.map((item, index) => getBubbleDiameter(item.percent, index));

  const centerX = 260;
  const centerY = 220;
  const gap = -10;

  items.forEach((item, index) => {
    const diameter = diameters[index];
    const radius = diameter / 2;
    const color = index === 3 ? accent : bubblePalette[index % bubblePalette.length];

    if (index === 0) {
      placed.push({
        item,
        diameter,
        radius,
        x: centerX,
        y: centerY,
        color
      });
      return;
    }

    let angle = -Math.PI / 2;
    let ring = 1;
    let found = false;

    while (!found && ring < 40) {
      const orbitRadius =
        placed[0].radius +
        radius +
        12 +
        (ring - 1) * Math.max(34, radius * 0.85);

      const steps = Math.max(18, Math.floor((2 * Math.PI * orbitRadius) / 18));

      for (let step = 0; step < steps; step += 1) {
        const theta = angle + (step / steps) * Math.PI * 2;
        const x = centerX + Math.cos(theta) * orbitRadius;
        const y = centerY + Math.sin(theta) * orbitRadius;

        if (!circlesOverlap(x, y, radius, placed, gap)) {
          placed.push({
            item,
            diameter,
            radius,
            x,
            y,
            color
          });
          found = true;
          break;
        }
      }

      ring += 1;
      angle += 0.45;
    }

    if (!found) {
      placed.push({
        item,
        diameter,
        radius,
        x: centerX,
        y: centerY + ring * 40,
        color
      });
    }
  });

  return placed;
};

const getBubbleBounds = (nodes: BubbleNode[]) => {
  const minX = Math.min(...nodes.map((node) => node.x - node.radius));
  const maxX = Math.max(...nodes.map((node) => node.x + node.radius));
  const minY = Math.min(...nodes.map((node) => node.y - node.radius));
  const maxY = Math.max(...nodes.map((node) => node.y + node.radius));

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
};

export const ResumeProfessionalSkillsBubbles = ({
  skills,
  accent,
  isPdf = false
}: {
  skills: PercentageItem[];
  accent: string;
  isPdf?: boolean;
}) => {
  const visibleSkills = getRenderablePercentageItems(skills);

  if (!visibleSkills.length) return null;

  const rawNodes = buildDynamicBubbleLayout(visibleSkills, accent);
  const bounds = getBubbleBounds(rawNodes);

  const basePadding = isPdf ? 24 : 16;
  const rawWidth = bounds.width + basePadding * 2;
  const rawHeight = bounds.height + basePadding * 2;

  const maxWidth = isPdf ? 340 : 420;
  const maxHeight = isPdf ? 280 : 340;

  const scale = Math.min(
    1,
    maxWidth / rawWidth,
    maxHeight / rawHeight
  );

  const containerWidth = rawWidth * scale;
  const containerHeight = rawHeight * scale;

  const nodes = rawNodes.map((node) => ({
    ...node,
    left: node.x - node.radius - bounds.minX + basePadding,
    top: node.y - node.radius - bounds.minY + basePadding
  }));

  return (
    <section>
      <div className="mb-3 flex items-center gap-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-900">
          Professional Skill
        </div>
        <div
          className="h-px flex-1"
          style={{ backgroundColor: `${accent}66` }}
        />
      </div>

      <div className="flex justify-center">
        <div
          className="relative"
          style={{
            width: `${containerWidth}px`,
            height: `${containerHeight}px`,
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              width: `${rawWidth}px`,
              height: `${rawHeight}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left'
            }}
          >
            <div
              className="relative"
              style={{
                width: `${rawWidth}px`,
                height: `${rawHeight}px`
              }}
            >
              {nodes.map((node, index) => {
                const displayName = getBubbleName(node.item.name, node.diameter);

                return (
                  <div
                    key={node.item.id || `bubble-${index}`}
                    className="absolute flex items-center justify-center rounded-full text-center text-white shadow-sm"
                    style={{
                      width: `${node.diameter}px`,
                      height: `${node.diameter}px`,
                      left: `${node.left}px`,
                      top: `${node.top}px`,
                      backgroundColor: node.color,
                      zIndex: index === 0 ? 3 : 2,
                      padding: '10px'
                    }}
                    title={`${node.item.name} - ${node.item.percent}%`}
                  >
                    <div className="max-w-[82%] leading-tight">
                      <div
                        className="font-bold"
                        style={{
                          fontSize: `${getBubbleFontSize(node.diameter)}px`,
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {displayName}
                      </div>

                      <div
                        className="mt-1 font-semibold opacity-95"
                        style={{ fontSize: `${getBubblePercentFontSize(node.diameter)}px` }}
                      >
                        {node.item.percent}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const ResumeDotPercentageRatings = ({
  items,
  accent,
  darkAccent = '#17324d',
  light = false,
  variant = 'filled'
}: {
  items: PercentageItem[];
  accent: string;
  darkAccent?: string;
  light?: boolean;
  variant?: 'filled' | 'outline';
}) => {
  const visibleItems = getRenderablePercentageItems(items);

  if (!visibleItems.length) return null;

  const filledColor = light ? '#ffffff' : accent;

  const emptyColor = light
    ? 'rgba(255,255,255,0.3)'
    : 'rgba(0,0,0,0.2)';

  const borderColor = light ? '#ffffff' : accent;

  return (
    <div className="space-y-3">
      {visibleItems.map((item, index) => {
        const filledDots = clamp(Math.round(item.percent / 10), 0, 10);

        return (
          <div
            key={item.id || `dot-rating-${index}`}
            className="grid grid-cols-[1fr_auto] items-center gap-4"
          >
            {/* TEXT */}
            <div>
              <div
                className="text-[13px] font-medium"
                style={{ color: light ? '#fff' : accent }}
              >
                {item.name}
              </div>

              <div
                className="text-[11px]"
                style={{ color: light ? '#fff' : accent }}
              >
                {item.percent}%
              </div>
            </div>

            {/* DOTS */}
            <div className="flex gap-[6px]">
              {Array.from({ length: 10 }).map((_, dotIndex) => {
                const isFilled = dotIndex < filledDots;

                let style: React.CSSProperties;

                if (variant === 'outline') {
                  if (isFilled) {
                    // ✅ FILLED → always has background + border
                    style = {
                      backgroundColor: filledColor,
                      border: `1.5px solid ${borderColor}`
                    };
                  } else {
                    // ❌ EMPTY → only border
                    style = {
                      backgroundColor: 'transparent',
                      border: `1.5px solid ${emptyColor}`
                    };
                  }
                } else {
                  // default filled mode
                  style = {
                    backgroundColor: isFilled
                      ? filledColor
                      : emptyColor
                  };
                }

                return (
                  <span
                    key={`${item.id || index}-dot-${dotIndex}`}
                    className="h-[8px] w-[8px] rounded-full"
                    style={style}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ResumeCompactReferences = ({
  resume,
  accent
}: {
  resume: ResumeData;
  accent: string;
}) => {
  if (!resume.references.length) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-900">
          Reference
        </div>
        <div className="h-px flex-1" style={{ backgroundColor: `${accent}66` }} />
      </div>

      <div className="space-y-4">
        {resume.references.slice(0, 3).map((reference) => (
          <div key={reference.id} className="border-b border-slate-200 pb-3 last:border-b-0">
            <div className="text-[13px] font-bold" style={{ color: accent }}>
              {reference.name}
            </div>
            {reference.role ? (
              <div className="text-[12px] text-slate-700">{reference.role}</div>
            ) : null}
            {reference.company ? (
              <div className="text-[12px] text-slate-600">{reference.company}</div>
            ) : null}
            {reference.email ? (
              <div className="text-[11px] text-slate-500">{reference.email}</div>
            ) : null}
            {reference.phone ? (
              <div className="text-[11px] text-slate-500">{reference.phone}</div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
};