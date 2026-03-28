type Props = {
  label: string;
  onClick: () => void;
};

export const ResumeAddChip = ({ label, onClick }: Props) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500"
    >
      + {label}
    </button>
  );
};