import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export const PAGE_WIDTH = 794;
export const PAGE_HEIGHT = 1123;

export type Block = {
  key: string;
  node: ReactNode;
  /** Never leave this block alone at the bottom of a page (section headings). */
  keepWithNext?: boolean;
};

export type ColumnSpec = {
  key: string;
  width: number;
  padding: { top: number; bottom: number; x: number };
  gap: number;
  blocks: Block[];
  style?: CSSProperties;
};

type Props = {
  /** Full-width content at the top of the first page. */
  header?: ReactNode;
  columns: ColumnSpec[];
  pageStyle?: CSSProperties;
  /** Decorations drawn behind every page (absolute positioned). */
  background?: (pageIndex: number) => ReactNode;
};

type Layout = { headerHeight: number; pages: string[][][] };

const distribute = (heights: number[], keep: boolean[], gap: number, available: (page: number) => number): number[][] => {
  const pages: number[][] = [[]];
  let used = 0;
  for (let index = 0; index < heights.length; index++) {
    const page = pages.length - 1;
    const current = pages[page];
    const spacing = current.length ? gap : 0;
    let needed = used + spacing + heights[index];
    if (keep[index] && index + 1 < heights.length) needed += gap + heights[index + 1];
    if (needed > available(page) && current.length > 0) {
      pages.push([index]);
      used = heights[index];
    } else {
      current.push(index);
      used += spacing + heights[index];
    }
  }
  return pages;
};

/**
 * Lays blocks out into A4 pages by measuring them in a hidden copy first.
 * Each column fills independently; the document has as many pages as its
 * longest column needs.
 */
export const Paginator = ({ header, columns, pageStyle, background }: Props) => {
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [fontsTick, setFontsTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const bump = () => !cancelled && setFontsTick((value) => value + 1);
    document.fonts?.ready.then(bump).catch(() => undefined);
    document.fonts?.addEventListener?.('loadingdone', bump);
    return () => {
      cancelled = true;
      document.fonts?.removeEventListener?.('loadingdone', bump);
    };
  }, []);

  // Runs after every render on purpose: any content change can move a page break. It only sets
  // state when the layout actually changed, so it settles after one extra render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const headerNode = root.querySelector<HTMLElement>('[data-measure-header]');
    const headerHeight = headerNode ? headerNode.offsetHeight : 0;
    const pages = columns.map((column) => {
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(`[data-measure-column="${column.key}"] > [data-block]`));
      const heights = nodes.map((node) => node.offsetHeight);
      const keep = column.blocks.map((block) => Boolean(block.keepWithNext));
      const available = (page: number) => PAGE_HEIGHT - (page === 0 ? headerHeight : 0) - column.padding.top - column.padding.bottom;
      return distribute(heights, keep, column.gap, available).map((indexes) => indexes.map((index) => column.blocks[index]?.key).filter(Boolean));
    });
    const next: Layout = { headerHeight, pages };
    setLayout((previous) => (previous && JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
  });

  const pageCount = Math.max(1, ...(layout?.pages.map((column) => column.length) ?? [1]));
  const headerHeight = layout?.headerHeight ?? 0;

  const renderColumn = (column: ColumnSpec, blocks: Block[], height: number | undefined) => (
    <div
      key={column.key}
      style={{
        width: column.width,
        flexShrink: 0,
        boxSizing: 'border-box',
        padding: `${column.padding.top}px ${column.padding.x}px ${column.padding.bottom}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: column.gap,
        height,
        ...column.style
      }}
    >
      {blocks.map((block) => (
        <div key={block.key} style={{ display: 'flow-root' }}>
          {block.node}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {Array.from({ length: pageCount }, (_, pageIndex) => {
        const bodyHeight = PAGE_HEIGHT - (pageIndex === 0 ? headerHeight : 0);
        return (
          <div
            key={pageIndex}
            data-pdf-page
            style={{
              width: PAGE_WIDTH,
              height: PAGE_HEIGHT,
              position: 'relative',
              overflow: 'hidden',
              background: '#fff',
              boxSizing: 'border-box',
              ...pageStyle
            }}
          >
            {background?.(pageIndex)}
            <div style={{ position: 'relative' }}>
              {pageIndex === 0 && header}
              <div style={{ display: 'flex' }}>
                {columns.map((column, columnIndex) => {
                  const keys = layout?.pages[columnIndex]?.[pageIndex];
                  const blocks = keys
                    ? keys.map((key) => column.blocks.find((block) => block.key === key)).filter((block): block is Block => Boolean(block))
                    : pageIndex === 0 && !layout
                      ? column.blocks
                      : [];
                  return renderColumn(column, blocks, bodyHeight);
                })}
              </div>
            </div>
          </div>
        );
      })}

      <div
        ref={measureRef}
        aria-hidden="true"
        data-fonts={fontsTick}
        style={{ position: 'absolute', left: -20000, top: 0, visibility: 'hidden', pointerEvents: 'none', width: PAGE_WIDTH, ...pageStyle, height: 'auto' }}
      >
        {header && <div data-measure-header>{header}</div>}
        {columns.map((column) => (
          <div
            key={column.key}
            data-measure-column={column.key}
            style={{ width: column.width, boxSizing: 'border-box', padding: `0 ${column.padding.x}px`, ...column.style, height: 'auto', minHeight: 0 }}
          >
            {column.blocks.map((block) => (
              <div key={block.key} data-block style={{ display: 'flow-root' }}>
                {block.node}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
