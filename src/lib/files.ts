export const createId = (): string => crypto.randomUUID();

/** Makes a string safe to use as a download filename on every OS. */
export const safeFileName = (name: string, fallback = 'document'): string => {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'Dj')
    .replace(/[^a-zA-Z0-9._ -]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return cleaned || fallback;
};

export const downloadJson = (data: unknown, fileName: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Reads an image and downsizes it so logos and photos don't exhaust localStorage. */
export const readImageAsDataUrl = (file: File, maxSize = 600): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.onload = () => {
      const source = String(reader.result);
      if (file.type === 'image/svg+xml') {
        resolve(source);
        return;
      }
      const image = new Image();
      image.onerror = () => reject(new Error('The image could not be read.'));
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(source);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const keepsTransparency = file.type === 'image/png' || file.type === 'image/webp';
        resolve(canvas.toDataURL(keepsTransparency ? 'image/png' : 'image/jpeg', 0.88));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
