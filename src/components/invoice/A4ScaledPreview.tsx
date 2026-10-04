import { useLayoutEffect, useRef, useState, type PropsWithChildren } from 'react';

const NATIVE_WIDTH = 794;

// Wraps a fixed-size 794px-wide A4 page (InvoiceEditorPreview) and scales it
// down with a CSS transform whenever the available column is narrower than
// that — e.g. the app sidebar being open, or a smaller window. A scaled-down
// transform never triggers a horizontal scrollbar in any browser (unlike a
// fixed-width box in a narrower container), so the page can never grow a
// horizontal scrollbar because of this preview, regardless of layout state.
export const A4ScaledPreview = ({ children }: PropsWithChildren) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const recompute = () => {
      const availableWidth = outer.clientWidth;
      setScale(availableWidth > 0 ? Math.min(1, availableWidth / NATIVE_WIDTH) : 1);
      setContentHeight(inner.offsetHeight);
    };

    recompute();

    const resizeObserver = new ResizeObserver(recompute);
    resizeObserver.observe(outer);
    resizeObserver.observe(inner);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      style={{
        display: 'flex',
        justifyContent: 'center',
        // Without this, the default `align-items: stretch` makes `inner`
        // stretch to match `outer`'s own height — and since that height is
        // itself derived from measuring `inner`, the two feed back into each
        // other through the ResizeObserver below and collapse toward 0.
        // flex-start keeps `inner`'s measured height purely intrinsic.
        alignItems: 'flex-start',
        width: '100%',
        height: contentHeight ? contentHeight * scale : undefined
      }}
    >
      <div
        ref={innerRef}
        style={{
          width: `${NATIVE_WIDTH}px`,
          flexShrink: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top center'
        }}
      >
        {children}
      </div>
    </div>
  );
};
