// /components/ui/InlineCode.tsx
import React from 'react';

interface InlineCodeProps {
  children: React.ReactNode;
}

export function InlineCode({ children }: InlineCodeProps) {
  return (
    <code className="font-mono text-xs text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-sm">
      {children}
    </code>
  );
}