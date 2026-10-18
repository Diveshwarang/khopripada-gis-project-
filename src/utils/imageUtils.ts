/**
 * Image compression and Base64 conversion utility
 * Ensures lightweight storage in IndexedDB and prevents Leaflet memory bloat.
 */

export const compressImageToBase64 = (
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.75
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // If not an image, reject
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserved dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        // Use high-quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed JPEG data URL
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };

      img.onerror = (err) => {
        reject(err);
      };

      if (typeof readerEvent.target?.result === 'string') {
        img.src = readerEvent.target.result;
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };

    reader.onerror = (err) => {
      reject(err);
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Modern SVG Placeholder for facilities and issues without an uploaded photo
 */
export const DEFAULT_INSPECTION_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23090d16"/><stop offset="100%" stop-color="%23131c2e"/></linearGradient><linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2306b6d4"/><stop offset="100%" stop-color="%233b82f6"/></linearGradient></defs><rect width="400" height="200" fill="url(%23bg)"/><rect x="12" y="12" width="376" height="176" rx="12" fill="none" stroke="%231e293b" stroke-width="1.5" stroke-dasharray="6 6"/><circle cx="200" cy="85" r="32" fill="%230f172a" stroke="%23334155" stroke-width="1.5"/><g fill="none" stroke="url(%23accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(186, 71)"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="4"/></g><text x="200" y="140" fill="%2394a3b8" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="0.5">INSPECTION THUMBNAIL</text><text x="200" y="158" fill="%23475569" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="10" text-anchor="middle">Field Photo Archive • Khopripada GIS</text></svg>`;
