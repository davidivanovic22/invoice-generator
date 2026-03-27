type Props = {
  note: string;
};

export const InvoiceNote = ({ note }: Props) => {
  return (
    <section className="border-t border-slate-200 pt-3">
      <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">
        Note
      </div>
      <p className="mt-1.5 text-sm text-slate-700">{note}</p>
    </section>
  );
};