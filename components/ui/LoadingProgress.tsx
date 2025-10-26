'use client';

import React from 'react';

interface LoadingProgressProps {
  message: string;
  progress?: number; // 0-100
  showProgress?: boolean;
  className?: string;
}

export function LoadingProgress({ 
  message, 
  progress = 0, 
  showProgress = true, 
  className = '' 
}: LoadingProgressProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="text-gray-700 dark:text-gray-300 font-medium">{message}</span>
      </div>
      
      {showProgress && (
        <div className="w-full max-w-xs">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
            {progress.toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
}

interface AuthLoadingProps {
  stage: 'authenticating' | 'loading-preferences' | 'loading-conversations' | 'complete';
  progress?: number;
}

export function AuthLoadingProgress({ stage, progress = 0 }: AuthLoadingProps) {
  const messages = {
    'authenticating': 'Verifying authentication...',
    'loading-preferences': 'Loading your preferences...',
    'loading-conversations': 'Loading conversations...',
    'complete': 'Ready!'
  };

  const stageProgress = {
    'authenticating': 25,
    'loading-preferences': 50,
    'loading-conversations': 75,
    'complete': 100
  };

  const currentProgress = stage === 'complete' ? 100 : Math.max(progress, stageProgress[stage]);

  return (
    <LoadingProgress
      message={messages[stage]}
      progress={currentProgress}
      showProgress={stage !== 'complete'}
    />
  );
}
