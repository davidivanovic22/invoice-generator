import { useRef } from 'react';

type Props = {
  x: number;
  y: number;
  width: number;
  height: number;
  selected?: boolean;
  children: React.ReactNode;
  onMove: (x: number, y: number) => void;
  onSelect: () => void;
};

export const DraggableElement = ({
  x,
  y,
  width,
  height,
  selected,
  children,
  onMove,
  onSelect
}: Props) => {
  const dragData = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect();

    dragData.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: x,
      originY: y
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragData.current) return;

    onMove(
      dragData.current.originX + (e.clientX - dragData.current.startX),
      dragData.current.originY + (e.clientY - dragData.current.startY)
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragData.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className={`absolute select-none ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {children}
    </div>
  );
};