type Props = {
  title: string;
  subtitle?: string;
};

export const SectionTitle = ({ title, subtitle }: Props) => {
  return (
    <div className="mb-3">
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
};