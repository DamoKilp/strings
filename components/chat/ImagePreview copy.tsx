// /components/chat/ImagePreview.tsx
'use client';

import React, { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';

interface ImagePreviewProps {
  /** The file to preview */
  file: File;
  /** Callback to remove this file */
  onRemove: (file: File) => void;
  /** Optional className for container styling */
  className?: string;
}

export function ImagePreview({
  file,
  onRemove,
  className = '',
}: ImagePreviewProps) {
  // Create a blob URL for the image and revoke on unmount or file change
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  return (
    <div className={`relative ${className}`}>
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(file)}
        className="absolute -top-1.5 -right-1.5 bg-muted/80 hover:bg-muted rounded-full p-0.5 cursor-pointer border border-background focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>

      {/* Image preview */}
      <img
        src={objectUrl}
        alt={file.name}
        className="rounded-md w-8 h-8 object-cover border border-border"
      />
    </div>
  );
}