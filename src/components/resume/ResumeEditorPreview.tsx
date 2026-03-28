import { forwardRef } from 'react';
import type { ResumeData } from '../../types/resume';
import { ResumeTemplateRenderer } from './ResumeTemplateRenderer';

type Props = {
  resume: ResumeData;
};

export const ResumeEditorPreview = forwardRef<HTMLDivElement, Props>(
  ({ resume }, ref) => {
    return (
      <div ref={ref} className="w-full">
        <div className="mx-auto flex w-full justify-center">
          <ResumeTemplateRenderer resume={resume} />
        </div>
      </div>
    );
  }
);

ResumeEditorPreview.displayName = 'ResumeEditorPreview';