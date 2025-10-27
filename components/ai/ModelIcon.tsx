// Lightweight provider icon without relying on SVGR/Turbopack SVG transformers
import React from 'react';

interface ModelIconProps {
  providerId: string | null | undefined;
  size?: number;
  className?: string;
}

const providerBgClass: Record<string, string> = {
  openai: 'bg-emerald-600',
  anthropic: 'bg-amber-600',
  google: 'bg-blue-600',
  gemini: 'bg-indigo-600',
  mistral: 'bg-sky-600',
  groq: 'bg-fuchsia-600',
  togetherai: 'bg-purple-600',
  ollama: 'bg-zinc-600',
  fireworks: 'bg-rose-600',
  vertex: 'bg-green-700',
  xai: 'bg-neutral-700',
  deepseek: 'bg-cyan-600',
  default: 'bg-gray-500',
};

export function ModelIcon({ providerId, size = 16, className = '' }: ModelIconProps) {
  const key = (providerId || 'default').toString().toLowerCase();
  const bg = providerBgClass[key] || providerBgClass.default;
  const letter = (key[0] || 'A').toUpperCase();
  const fontSizePx = Math.max(8, Math.floor(size * 0.55));

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full ${bg} ${className}`}
      style={{ width: size, height: size }}
      aria-label={`${providerId || 'model'} icon`}
    >
      <span
        className="text-white leading-none font-bold select-none"
        style={{ fontSize: fontSizePx }}
      >
        {letter}
      </span>
    </div>
  );
}