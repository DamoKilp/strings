// /components/chat/DragHandle.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface DragHandleProps {
  isDragging: boolean;
  dragHandleRef: React.RefObject<HTMLDivElement | null>;
}

export const DragHandle: React.FC<DragHandleProps> = ({
  isDragging,
  dragHandleRef,
}) => {
  // Define your two RGBA endpoints
  const idleBg = 'rgba(128, 128, 128, 0)';   // completely transparent grey
  const dragBg = 'rgba(128, 128, 128, 0.2)'; // 20% grey

  return (
    <motion.div
      ref={dragHandleRef}
      className="absolute h-3 w-full top-0 left-0 cursor-ns-resize z-10 flex items-center justify-center group"
      title="Drag to resize input area"
      // Starting point of the animation — must match the idleBg
      initial={{ backgroundColor: idleBg }}
      // Animate between two explicit RGBA strings
      animate={{
        backgroundColor: isDragging ? dragBg : idleBg,
      }}
      transition={{ duration: 0.15 }}
      whileHover={{ opacity: isDragging ? 1 : 0.9 }}
    >
      <div
        className={`w-10 h-[3px] rounded-full bg-border group-hover:bg-muted-foreground transition-colors duration-150 ${
          isDragging ? 'bg-primary' : ''
        }`}
      />
      {isDragging && (
        <motion.div
          className="absolute -top-7 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg whitespace-nowrap"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          transition={{ duration: 0.1 }}
        >
          Release to set height
        </motion.div>
      )}
    </motion.div>
  );
};

export default DragHandle;