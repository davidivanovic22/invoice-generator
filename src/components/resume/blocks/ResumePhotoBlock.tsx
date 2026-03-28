
/* =========================
   PHOTO
========================= */

type PhotoProps = {
  photo?: string;
  alt: string;
  rounded?: string;
  light?: boolean;
  sizeClassName?: string;
};

export const ResumePhotoBlock = ({
  photo,
  alt,
  rounded = 'rounded-2xl',
  light = false,
  sizeClassName = 'h-24 w-24'
}: PhotoProps) => {
  if (photo) {
    return (
      <img
        src={photo}
        alt={alt}
        className={`${sizeClassName} ${rounded} border object-cover ${light ? 'border-white/20' : 'border-slate-200'
          }`}
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClassName} items-center justify-center ${rounded} border border-dashed text-xs ${light ? 'border-white/30 text-white/70' : 'border-slate-300 text-slate-400'
        }`}
    >
      PHOTO
    </div>
  );
};
