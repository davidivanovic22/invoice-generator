import { forwardRef, memo } from 'react';
import type { Resume } from '../model';
import { makeTheme } from './blocks';
import { RESUME_TEMPLATES } from './templates';

type Props = { resume: Resume };

const Document = forwardRef<HTMLDivElement, Props>(({ resume }, ref) => {
  const template = RESUME_TEMPLATES[resume.design.template] ?? RESUME_TEMPLATES.modern;
  return <div ref={ref}>{template.render(resume, makeTheme(resume.design))}</div>;
});
Document.displayName = 'ResumeDocument';

export const ResumeDocument = memo(Document);
