import { forwardRef } from 'react';
import type { ResumeData } from '../../types/resume';
import { ResumeTemplateRenderer } from './ResumeTemplateRenderer';

type Props = {
  resume: ResumeData;
};

export const ResumePrintPreview = forwardRef<HTMLDivElement, Props>(
  ({ resume }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: '794px',
          minHeight: '1123px',
          background: '#ffffff',
          margin: 0,
          padding: 0,
          overflow: 'hidden'
        }}
      >
        <ResumeTemplateRenderer resume={resume} isPdf={true} />
      </div>
    );
  }
);

ResumePrintPreview.displayName = 'ResumePrintPreview';