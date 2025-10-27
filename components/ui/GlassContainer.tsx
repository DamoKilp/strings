import React, { ElementType } from 'react';
import { useGlassStyles } from '@/app/hooks/useGlass';

interface GlassContainerProps {
  children: React.ReactNode;
  intensity?: 'minimal' | 'medium' | 'enhanced';
  context?: 'dialog' | 'sidebar' | 'card' | 'button' | 'input';
  adaptToBackground?: boolean;
  className?: string;
  as?: ElementType;
  [key: string]: unknown;
}

export const GlassContainer: React.FC<GlassContainerProps> = ({
  children,
  intensity = 'medium',
  context = 'card',
  adaptToBackground = true,
  className,
  as: Component = 'div',
  ...props
}) => {
  const glassStyles = useGlassStyles({ intensity, context, adaptToBackground, className });
  
  return (
    <Component
      className={glassStyles.className}
      style={glassStyles.style}
      {...props}
    >
      {children}
    </Component>
  );
};
