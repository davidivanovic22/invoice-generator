type SectionTitleProps = {
  children: React.ReactNode;
  accent: string;
  light?: boolean;
};

export const ResumeSectionTitleBlock = ({
  children,
  accent,
  light = false
}: SectionTitleProps) => (
  <h2
    className="mb-3 text-[11px] font-bold uppercase tracking-[0.28em]"
    style={{ color: light ? 'rgba(255,255,255,0.75)' : accent }}
  >
    {children}
  </h2>
);