'use client';

import { useEffect } from 'react';

/**
 * Client-side component that initializes the logging bridge
 * This component should be included in the root layout to capture all client-side logs
 */
export function ClientLoggingBridge() {
  useEffect(() => {
    // Initialize the logging bridge when the component mounts
    console.log('[CLIENT-LOGGING-BRIDGE] Initialized - client logs will now be sent to server');
    
    // Log a test message to verify the bridge is working
    setTimeout(() => {
      console.log('[CLIENT-LOGGING-BRIDGE] Test message - bridge is active');
    }, 1000);

    // Cleanup function (though we don't need to restore console methods in most cases)
    return () => {
      // Optionally disable the bridge on unmount
      // clientLoggingBridge.disable();
    };
  }, []);

  // This component doesn't render anything
  return null;
}
