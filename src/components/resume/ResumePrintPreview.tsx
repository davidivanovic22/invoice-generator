import { forwardRef } from 'react';
import type { ResumeData } from '../../types/resume';
import { ResumeTemplateRenderer } from './ResumeTemplateRenderer';

type Props = {
  resume: ResumeData;
};

export const ResumePrintPreview = forwardRef<HTMLDivElement, Props>(({ resume }, ref) => {
  return (
    <div
      ref={ref}
      style={{
        width: '794px',
        margin: '0 auto',
        background: '#ffffff'
      }}
    >
      <ResumeTemplateRenderer resume={resume} isPdf />
    </div>
  );
});

ResumePrintPreview.displayName = 'ResumePrintPreview';