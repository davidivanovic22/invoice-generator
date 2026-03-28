import { AccordionSection } from '../../common/AcordionSection';

type Props = {
  id: string;
  title: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  isOpen: boolean;
  onToggle: (id: string) => void;
};

export const ResumeTextAreaSection = ({
  id,
  title,
  value,
  placeholder,
  onChange,
  isOpen,
  onToggle
}: Props) => {
  return (
    <AccordionSection
      id={id}
      title={title}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2"
      />
    </AccordionSection>
  );
};