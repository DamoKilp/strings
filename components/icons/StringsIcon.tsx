// /components/icons/StringsIcon.tsx
'use client';

import React from 'react';

interface StringsIconProps {
  size?: number;
  className?: string;
  fill?: string;
}

export function StringsIcon({ size = 24, className = '', fill = 'currentColor' }: StringsIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Strings icon"
      className={className}
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Strings icon</title>
      {/* Lightning strings design: Connected lightning bolts forming string-like patterns */}
      
      {/* Main lightning string (flowing from top-left to bottom-right) */}
      <path 
        d="M4 2L7 6L5 6L8.5 10.5L6.5 10.5L10.5 15L8 15L12.5 20" 
        stroke={fill} 
        strokeWidth="2.5" 
        fill="none" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        opacity="1"
      />
      
      {/* Secondary lightning string (flowing from top-center down) */}
      <path 
        d="M12 1L10 5.5L13 5.5L11 10L14 10L12 14.5L15 14.5L13 19L16 19" 
        stroke={fill} 
        strokeWidth="2.5" 
        fill="none" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        opacity="0.9"
      />
      
      {/* Third lightning string (flowing from top-right to bottom-left) */}
      <path 
        d="M20 2L17.5 6.5L20.5 6.5L18 11L21 11L18.5 15.5L21.5 15.5L19 20" 
        stroke={fill} 
        strokeWidth="2.5" 
        fill="none" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        opacity="0.85"
      />
      
      {/* Energy nodes/connection points (glowing) */}
      <circle cx="7" cy="6" r="1.8" fill={fill} opacity="1"/>
      <circle cx="8.5" cy="10.5" r="1.8" fill={fill} opacity="1"/>
      <circle cx="10.5" cy="15" r="1.8" fill={fill} opacity="1"/>
      
      <circle cx="10" cy="5.5" r="1.5" fill={fill} opacity="0.95"/>
      <circle cx="11" cy="10" r="1.5" fill={fill} opacity="0.95"/>
      <circle cx="12" cy="14.5" r="1.5" fill={fill} opacity="0.95"/>
      <circle cx="13" cy="19" r="1.5" fill={fill} opacity="0.95"/>
      
      <circle cx="17.5" cy="6.5" r="1.6" fill={fill} opacity="0.9"/>
      <circle cx="18" cy="11" r="1.6" fill={fill} opacity="0.9"/>
      <circle cx="18.5" cy="15.5" r="1.6" fill={fill} opacity="0.9"/>
      <circle cx="19" cy="20" r="1.6" fill={fill} opacity="0.9"/>
      
      {/* Electric spark accents (small energy bursts) */}
      <path 
        d="M5.5 4L6 3.5M9 8.5L9.5 8M11.5 12L12 11.5M13.5 16L14 15.5M16.5 5L17 4.5M19 9.5L19.5 9M20.5 13.5L21 13" 
        stroke={fill} 
        strokeWidth="2" 
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

