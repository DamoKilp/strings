// /hooks/useWindowHeight.ts
import { useState, useEffect } from 'react';

/**
 * A reusable hook that returns the current window height.
 * It listens to window resize events and updates the height accordingly.
 */
function useWindowHeight(): number {
  // Initialize state with current window height, or 0 if window is undefined (e.g. during SSR)
  const [height, setHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );

  useEffect(() => {
    // Handler to update height state on window resize
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    // Cleanup event listener on unmount
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return height;
}

export default useWindowHeight;
