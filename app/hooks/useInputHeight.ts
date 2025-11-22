// /hooks/useInputHeight.ts
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface HeightOptions {
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  fullscreen?: boolean;
}

// Debounce function utility
function debounce<T extends (...args: unknown[]) => unknown>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

export function useInputHeight(options: HeightOptions = {}) {
  const {
    defaultHeight = 70,
    minHeight = 50,
    maxHeight = 400,
    fullscreen = false,
  } = options;

  // State for user-defined height (set via dragging)
  const [userHeight, setUserHeight] = useState<number | null>(null);

  // Refs for DOM elements and state tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isDragging = useRef<boolean>(false);

  // Track the last calculated/set height to avoid unnecessary updates
  const lastSetHeightRef = useRef<number>(defaultHeight);

  // Performance optimization refs for dragging
  const startHeightRef = useRef<number>(defaultHeight);
  const startYRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Update height based on content (AUTO-RESIZE logic)
  // This should only run when input changes, not during dragging.
  const updateHeight = useCallback(() => {
    const textarea = textareaRef.current;
    const container = containerRef.current;

    // Prevent auto-resizing during drag or if refs are not available
    if (!textarea || !container || isDragging.current) {
      return;
    }

    // Use userHeight if set (manual resize), otherwise calculate based on content
    if (userHeight !== null) {
      // If user manually set a height, respect it unless it needs constraining again
      const constrainedUserHeight = Math.max(minHeight, Math.min(userHeight, maxHeight));
      if (constrainedUserHeight !== lastSetHeightRef.current) {
        textarea.style.height = `${constrainedUserHeight}px`;
        container.style.height = `${constrainedUserHeight + 12}px`; // +12 for padding/border
        lastSetHeightRef.current = constrainedUserHeight;
      }
      return; // Don't auto-adjust if user has set a height
    }

    // --- Auto-resize based on content ---
    const scrollPos = textarea.scrollTop; // Store scroll position

    // Reset height temporarily to calculate natural scrollHeight
    textarea.style.height = 'auto';
    const contentHeight = textarea.scrollHeight;

    // Determine the target height: content or minHeight, capped by maxHeight
    const targetHeight = Math.max(contentHeight, minHeight);
    const constrainedHeight = Math.min(targetHeight, fullscreen ? window.innerHeight * 0.5 : maxHeight);

    // Only apply if the height change is significant enough (e.g., > 2px)
    // or if the current height isn't already the constrained height.
    // Use lastSetHeightRef to avoid small fluctuations causing DOM writes.
    if (Math.abs(constrainedHeight - lastSetHeightRef.current) > 2) {
      textarea.style.height = `${constrainedHeight}px`;
      container.style.height = `${constrainedHeight + 12}px`; // +12 accounts for container padding/border
      lastSetHeightRef.current = constrainedHeight; // Update the last set height
    } else {
      // If the change is insignificant, ensure the style reflects the last *set* height
      // This prevents tiny scrollHeight changes from triggering DOM updates constantly.
      textarea.style.height = `${lastSetHeightRef.current}px`;
      // Container height might also need resetting if it depends on textarea height + padding
      container.style.height = `${lastSetHeightRef.current + 12}px`;
    }

    textarea.scrollTop = scrollPos; // Restore scroll position
  }, [userHeight, minHeight, maxHeight, fullscreen]);

  // Set height explicitly (used for manual resize operations)
  const setHeight = useCallback((height: number) => {
    const constrainedHeight = Math.max(minHeight, Math.min(height, maxHeight));
    setUserHeight(constrainedHeight); // Store user preference
    lastSetHeightRef.current = constrainedHeight; // Update last known height

    // Apply the height immediately to the elements
    if (textareaRef.current) {
      textareaRef.current.style.height = `${constrainedHeight}px`;
    }
    if (containerRef.current) {
      // Adjust container height based on textarea + padding/border etc.
      containerRef.current.style.height = `${constrainedHeight + 12}px`;
    }

    // Save to localStorage for persistence
    try {
      localStorage.setItem('chatInputHeight', constrainedHeight.toString());
    } catch (e) {

    }
  }, [minHeight, maxHeight]);

  // Reset height to minimum (e.g., after submitting)
  const resetHeight = useCallback(() => {
    const textarea = textareaRef.current;
    const container = containerRef.current;

    if (!container || !textarea || isDragging.current) return;

    // Reset user preference and apply minimum height
    setUserHeight(null); // Allow auto-resizing again
    textarea.value = ''; // Clear textarea content as well, usually happens on reset
    textarea.style.height = `${minHeight}px`;
    container.style.height = `${minHeight + 12}px`;
    lastSetHeightRef.current = minHeight; // Update last known height

    // Optionally clear saved height
    // try { localStorage.removeItem('chatInputHeight'); } catch (e) {}
  }, [minHeight]);

  // Initialize resizable handling using a drag handle ref
  // *** CHANGE THE TYPE HERE *** Accepts a RefObject<HTMLDivElement | null>
  const initResizable = useCallback((dragHandleRef: React.RefObject<HTMLDivElement | null>) => {
    // *** ADD NULL CHECK HERE ***
    const handleElement = dragHandleRef.current;
    if (!handleElement) {

      return () => {}; // Return empty cleanup function if ref is null
    }

    // The rest of the onDragStart, onDragMove, onDragEnd functions remain the same...
    const onDragStart = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      document.body.classList.add('resize-drag-active');

      isDragging.current = true;

      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      startYRef.current = clientY;
      // Use handleElement here which is guaranteed non-null now
      startHeightRef.current = textareaRef.current?.offsetHeight || lastSetHeightRef.current;

      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('touchmove', onDragMove, { passive: false });
      window.addEventListener('mouseup', onDragEnd);
      window.addEventListener('touchend', onDragEnd);
    };

    const onDragMove = (e: MouseEvent | TouchEvent) => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaY = startYRef.current - clientY; // Dragging up increases height
        const newHeight = startHeightRef.current + deltaY;

        // Apply constraints in real-time during drag
        const constrainedHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

        // Directly update styles for responsiveness during drag
        if (textareaRef.current) {
          textareaRef.current.style.height = `${constrainedHeight}px`;
        }
        if (containerRef.current) {
          containerRef.current.style.height = `${constrainedHeight + 12}px`;
        }
        // Don't update lastSetHeightRef or userHeight state until drag ends
      });
    };

    const onDragEnd = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resize-drag-active');

      isDragging.current = false;

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Remove window listeners
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchend', onDragEnd);

      // Final height is the current element height after dragging
      const finalHeight = textareaRef.current?.offsetHeight || lastSetHeightRef.current;
      // Persist the manually set height
      setHeight(finalHeight);

      // Optional: Focus textarea after resize
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    };

    // Attach listeners using the non-null handleElement
    handleElement.addEventListener('mousedown', onDragStart);
    handleElement.addEventListener('touchstart', onDragStart, { passive: false });

    // Return cleanup function
    return () => {
      handleElement.removeEventListener('mousedown', onDragStart);
      handleElement.removeEventListener('touchstart', onDragStart);

      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchend', onDragEnd);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (isDragging.current) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.body.classList.remove('resize-drag-active');
      }
    };
  }, [minHeight, maxHeight, setHeight]);

  // Effect to load saved height and initialize
  useEffect(() => {
    let initialHeight = defaultHeight;
    try {
      const savedHeightStr = localStorage.getItem('chatInputHeight');
      if (savedHeightStr) {
        const savedHeight = parseInt(savedHeightStr, 10);
        if (!isNaN(savedHeight) && savedHeight >= minHeight && savedHeight <= maxHeight) {
          initialHeight = savedHeight;
          setUserHeight(initialHeight); // Set state if loaded
        }
      }
    } catch (e) {

    }

    // Set initial height on mount
    lastSetHeightRef.current = initialHeight;
    if (textareaRef.current) {
      textareaRef.current.style.height = `${initialHeight}px`;
    }
    if (containerRef.current) {
      containerRef.current.style.height = `${initialHeight + 12}px`;
    }
  }, [defaultHeight, minHeight, maxHeight]);

  // Debounced version of updateHeight for input changes
  const debouncedUpdateHeight = useCallback(
    debounce(() => {
      if (!isDragging.current && userHeight === null) {
        updateHeight();
      }
    }, 150),
    [updateHeight, userHeight]
  );

  return {
    containerRef,
    textareaRef,
    // Provide the current height (user set or last calculated)
    currentHeight: userHeight ?? lastSetHeightRef.current,
    setHeight, // Manually set height
    resetHeight, // Reset to default/min
    updateHeight: debouncedUpdateHeight, // Provide the debounced updater for input changes
    initResizable, // Function to setup drag handle
    isDragging, // Expose dragging state (ref.current)
  };
}

export default useInputHeight;