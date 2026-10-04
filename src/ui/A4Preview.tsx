import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

/**
 * Scales fixed-width (794px) A4 content down to the available width. A CSS
 * transform never causes horizontal scrolling, unlike a fixed-width box.
 */
export const A4Preview = ({ children, maxScale = 1 }: { children: ReactNode; maxScale?: number }) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(A4_HEIGHT);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const width = outer.clientWidth;
      setScale(width > 0 ? Math.min(maxScale, width / A4_WIDTH) : 1);
      setHeight(inner.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [maxScale]);

  return (
    // items-start matters: with the default stretch, the inner box would take the outer box's height,
    // which is itself derived from the inner box, and the two would collapse to zero.
    <div ref={outerRef} className="flex w-full items-start justify-center" style={{ height: height * scale }}>
      <div ref={innerRef} style={{ width: A4_WIDTH, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        {children}
      </div>
    </div>
  );
};

/** A small, non-interactive rendering of an A4 page at a fixed width in px. */
export const A4Thumbnail = ({ children, width = 150 }: { children: ReactNode; width?: number }) => {
  const scale = width / A4_WIDTH;
  return (
    <div style={{ width, height: A4_HEIGHT * scale, overflow: 'hidden', position: 'relative' }} aria-hidden="true">
      <div
        style={{ width: A4_WIDTH, height: A4_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}
        // Thumbnails must not be picked up by the PDF exporter.
        data-thumbnail
      >
        {children}
      </div>
    </div>
  );
};
