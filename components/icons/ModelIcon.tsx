// /src/components/ai/ModelIcon.tsx
import React from 'react';

// Import your custom icons as React components using SVGR.
// Adjust the paths according to your project folder structure.
// The following syntax works when your project is configured with @svgr/webpack.
import OpenAIIcon from '@/components/icons/openai.svg';
import AnthropicIcon from '@/components/icons/anthropic.svg';
import GoogleIcon from '@/components/icons/google.svg';

// For providers that do not yet have a custom icon, import a default icon.
import DefaultIcon from '@/components/icons/default.svg';

// Define the props interface for ModelIcon.
interface ModelIconProps {
  providerId: string;
  size?: number;
  className?: string;
}

// Map provider IDs to their corresponding custom icon components.
const providerIconMap: Record<string, React.ElementType> = {
  openai: OpenAIIcon,
  anthropic: AnthropicIcon,
  google: GoogleIcon,
  gemini: GoogleIcon, 
  // Map other providers to the default icon if custom icons aren't available.
  mistral: DefaultIcon,
  groq: DefaultIcon,
  togetherai: DefaultIcon,
  ollama: DefaultIcon,
  fireworks: DefaultIcon,
  vertex: DefaultIcon,
  xai: DefaultIcon,
  deepseek: DefaultIcon,
};

export function ModelIcon({ providerId, size = 20, className = '' }: ModelIconProps) {
  // Use the custom icon for the provider if available; otherwise, fall back to DefaultIcon.
  const IconComponent = providerIconMap[providerId] || DefaultIcon;
  return <IconComponent width={size} height={size} className={className} />;
}