type Props = {
  backgroundImage: string;
  backgroundPosition?: string;
};

// The seasonal SVG is an original A4 composition with a clear content area.
// Keep it as an img so the PDF exporter waits for decoding before html2canvas.
export const InvoiceWatermark = ({ backgroundImage, backgroundPosition = 'center center' }: Props) => (
  <img
    src={backgroundImage}
    alt=""
    aria-hidden="true"
    draggable={false}
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: backgroundPosition,
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: 0
    }}
  />
);
