type Props = {
  images: string[];
  labels?: string[];
  activeIndex: number;
  accentColor: string;
  onSelect: (index: number) => void;
};

// Show one close-up of the motifs; the full invoice is already visible above.
export const InvoiceVariantPicker = ({ images, labels, activeIndex, accentColor, onSelect }: Props) => {
  if (images.length <= 1) return null;

  return (
    <div className="mx-auto mt-4 w-[794px] max-w-full px-2 pb-4 print:hidden">
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        Theme design
      </div>
      <div className="grid grid-cols-[repeat(5,minmax(126px,1fr))] gap-3 overflow-x-auto p-1 pb-3">
        {images.map((src, index) => {
          const isActive = index === activeIndex;
          const label = labels?.[index] ?? `Design ${index + 1}`;
          return (
            <button
              key={src}
              type="button"
              onClick={() => onSelect(index)}
              title={label}
              aria-label={label}
              aria-pressed={isActive}
              className="group min-w-0 overflow-hidden rounded-xl bg-white text-left transition-[box-shadow,transform] duration-200 hover:shadow-md motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                border: `2px solid ${isActive ? accentColor : '#e2e8f0'}`,
                boxShadow: isActive ? `0 2px 12px ${accentColor}20` : 'none'
              }}
            >
              <div className="relative aspect-[794/280] overflow-hidden bg-white">
                <img src={src} alt="" className="absolute bottom-0 block w-full transition-transform duration-200 motion-safe:group-hover:scale-[1.025]" loading="lazy" />
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold text-white shadow-sm"
                    style={{ background: accentColor }}
                  >
                    ✓
                  </span>
                )}
              </div>
              <div className="min-h-[48px] px-2 py-2 text-[10px] font-medium leading-snug text-slate-600 sm:text-xs">
                <span className="mr-1 font-bold" style={{ color: accentColor }}>{index + 1}.</span>
                {label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
