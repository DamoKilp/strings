// hooks/useComponentPerformance.ts
'use client';

// No-op performance hooks for this app
export function useComponentPerformance(_componentName: string) {
  const trackOperation = <T>(_: string, fn: () => T): T => fn();
  return { trackOperation, isTracking: false } as const;
}

export function withPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  _componentName?: string
): React.ComponentType<P> {
  const Component: React.FC<P> = (props: P) => WrappedComponent(props);
  Component.displayName = `withPerformanceTracking(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return Component;
}
