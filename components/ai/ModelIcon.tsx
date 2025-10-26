// /src/components/ai/ModelIcon.tsx
import React from 'react';
import { HelpCircle } from 'lucide-react'; // Default/Fallback icon

// --- SVG Imports ---
// Import your actual SVG logos as React components.
// Adjust paths based on where you save the SVGs.
// Make sure SVGR is configured in next.config.js!

// Example imports (replace with your actual files):
import OpenAIIcon from '@/components/icons/openai.svg';
import AnthropicIcon from '@/components/icons/anthropic.svg';
import GoogleIcon from '@/components/icons/google.svg';
import DefaultIcon from '@/components/icons/default.svg';
// Add imports for other providers (Groq, Fireworks, etc.)
// If you don't have a specific logo, you can map them to the DefaultIcon below

// Placeholder for missing specific logos (using Lucide's HelpCircle)
const DefaultIconComponent: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <HelpCircle {...props} />
);

// Define the props interface for ModelIcon.
interface ModelIconProps {
  providerId: string | null | undefined; // Allow null/undefined
  size?: number;
  className?: string;
}

// Map provider IDs (lowercase) to their corresponding icon components.
// Add entries for all your supported providers.
const providerIconMap: Record<string, React.ElementType> = {
  openai: OpenAIIcon,
  anthropic: AnthropicIcon,
  google: GoogleIcon,
  gemini: GoogleIcon, // Map alias if needed
  mistral: DefaultIcon,
  // --- Add other providers below ---
  groq: DefaultIcon, // Using default until specific icon is added
  togetherai: DefaultIcon,
  ollama: DefaultIcon,
  fireworks: DefaultIcon,
  vertex: DefaultIcon, // Google Vertex might use the Google icon too
  xai: DefaultIcon,
  deepseek: DefaultIcon,
  // Add any other providerId from your models.json or models.ts
};

export function ModelIcon({ providerId, size = 16, className = '' }: ModelIconProps) {
  // Handle null/undefined providerId gracefully
  const normalizedProviderId = providerId?.toLowerCase() || 'default';

  // Select the icon component, falling back to the DefaultIconComponent
  const IconComponent = providerIconMap[normalizedProviderId] || DefaultIconComponent;

  // Basic validation in case the import failed or component is invalid
  if (typeof IconComponent !== 'function' && typeof IconComponent !== 'object') {

     const FallbackIcon = DefaultIconComponent;
     // Ensure FallbackIcon is also a valid component before rendering
     if (typeof FallbackIcon === 'function' || typeof FallbackIcon === 'object') {
       return <FallbackIcon width={size} height={size} className={className} />;
     }
     return null; // Return null if even the fallback is invalid
   }

  // Render the selected icon component
  return <IconComponent width={size} height={size} className={className} />;
}