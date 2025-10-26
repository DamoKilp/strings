export async function compressImageFile(
  file: File,
  maxDimension: number = 1280,
  outputMime: string = 'image/jpeg',
  quality: number = 0.8
): Promise<File> {
  try {
    if (!file.type.startsWith('image/')) return file;
    // Skip very small images
    if (file.size <= 512 * 1024) return file;

    const imageBitmap = await createImageBitmap(file).catch(() => null as ImageBitmap | null);
    let imgWidth: number;
    let imgHeight: number;
    if (imageBitmap) {
      imgWidth = imageBitmap.width;
      imgHeight = imageBitmap.height;
    } else {
      const objectUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);
      imgWidth = img.width;
      imgHeight = img.height;
    }

    // Compute scale
    const scale = Math.min(1, maxDimension / Math.max(imgWidth, imgHeight));
    if (scale >= 1) return file; // no need to resize

    const targetW = Math.max(1, Math.round(imgWidth * scale));
    const targetH = Math.max(1, Math.round(imgHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (imageBitmap) {
      ctx.drawImage(imageBitmap, 0, 0, targetW, targetH);
    } else {
      const objectUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = objectUrl;
      });
      URL.revokeObjectURL(objectUrl);
      ctx.drawImage(img, 0, 0, targetW, targetH);
    }

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, outputMime, quality));
    if (!blob) return file;
    const ext = outputMime === 'image/png' ? 'png' : 'jpg';
    const newName = file.name.replace(/\.(png|jpg|jpeg|webp|gif)$/i, `.${ext}`);
    return new File([blob], newName, { type: outputMime, lastModified: Date.now() });
  } catch {
    return file; // Fallback: return original on any failure
  }
}

export async function compressImagesBatch(
  files: File[],
  maxDimension: number = 1280,
  outputMime: string = 'image/jpeg',
  quality: number = 0.8
): Promise<File[]> {
  const results: File[] = [];
  for (const f of files) {
    results.push(await compressImageFile(f, maxDimension, outputMime, quality));
  }
  return results;
}


