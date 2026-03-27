type Props = {
  signature?: string;
  width?: number;
  height?: number;
};

export const InvoiceSignature = ({
  signature,
  width = 180,
  height = 56
}: Props) => {
  return (
    <div className="flex h-full w-full flex-col justify-end">
      <div
        className="-mb-1 flex items-end justify-center"
        style={{ height: `${height}px` }}
      >
        {signature ? (
          <img
            src={signature}
            alt="Issuer signature"
            className="block object-contain"
            style={{
              maxWidth: `${width}px`,
              maxHeight: `${height}px`,
              width: 'auto',
              height: '100%'
            }}
          />
        ) : null}
      </div>

      <div className="border-t border-slate-900 pt-1 text-center text-sm text-slate-500">
        Issuer signature
      </div>
    </div>
  );
};