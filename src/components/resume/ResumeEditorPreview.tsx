import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ResumeData } from '../../types/resume';
import {
  ResumeTemplateRenderer,
  getResumeTemplatePageCount
} from './ResumeTemplateRenderer';

type Props = {
  resume: ResumeData;
};

export const ResumeEditorPreview = forwardRef<HTMLDivElement, Props>(
  ({ resume }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pageIndex, setPageIndex] = useState(0);

    const pageCount = Math.max(getResumeTemplatePageCount(resume, false), 1);

    useEffect(() => {
      if (pageIndex > pageCount - 1) {
        setPageIndex(0);
      }
    }, [pageCount, pageIndex]);

    useImperativeHandle(ref, () => containerRef.current as HTMLDivElement, []);

    return (
      <div ref={containerRef} className="w-full">
        <div className="mb-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPageIndex((prev) => Math.max(prev - 1, 0))}
            disabled={pageIndex === 0}
            className="rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ←
          </button>

          <div className="text-sm font-medium text-slate-600">
            Page {pageIndex + 1} / {pageCount}
          </div>

          <button
            type="button"
            onClick={() => setPageIndex((prev) => Math.min(prev + 1, pageCount - 1))}
            disabled={pageIndex === pageCount - 1}
            className="rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            →
          </button>
        </div>

        <div className="mx-auto flex w-full justify-center">
          <ResumeTemplateRenderer resume={resume} pageIndex={pageIndex} />
        </div>
      </div>
    );
  }
);

ResumeEditorPreview.displayName = 'ResumeEditorPreview';