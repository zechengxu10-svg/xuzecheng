import React, { useState } from 'react';
import { motion, useAnimation, MotionValue, useTransform } from 'motion/react';

interface PullRopeProps {
  dragY: MotionValue<number>;
  onTrigger: () => void;
}

export const PullRope: React.FC<PullRopeProps> = ({ dragY, onTrigger }) => {
  const controls = useAnimation();
  const [pulled, setPulled] = useState(false);

  const handleDragEnd = (event: any, info: any) => {
    if (info.offset.y > 40) {
      onTrigger();
      setPulled(true);
      if (navigator.vibrate) navigator.vibrate(50);
    }
    controls.start({ y: 0, transition: { type: 'spring', stiffness: 400, damping: 15 } });
  };

  const cordHeight = useTransform(dragY, (y: number) => y + 20);

  return (
    <div className="flex flex-col items-center z-50">
      {/* Cord */}
      <motion.div 
        style={{ height: cordHeight }} 
        className="w-1.5 bg-bg-surface/10 shadow-inner rounded-b-full" 
      />
      
      {/* Handle */}
      <motion.div
        style={{ y: dragY }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 80 }}
        dragElastic={0.3}
        onDragEnd={handleDragEnd}
        animate={controls}
        className="w-10 h-10 bg-bg-base shadow-lg rounded-full flex flex-col items-center justify-center border border-white/10 cursor-grab active:cursor-grabbing -mt-2 relative z-10"
      >
        <div className="w-4 h-0.5 rounded-full bg-bg-surface/30 mb-1" />
        <div className="w-4 h-0.5 rounded-full bg-bg-surface/30 mb-1" />
        <div className="w-4 h-0.5 rounded-full bg-bg-surface/30" />
      </motion.div>

      {/* Tooltip */}
      {!pulled && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="absolute top-14 whitespace-nowrap bg-bg-surface backdrop-blur-sm px-3 py-1.5 rounded-xl text-xs font-bold text-primary shadow-sm border border-white/50 pointer-events-none"
        >
          <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-bg-surface rotate-45 border-l border-t border-white/50" />
          拉一下试试！
        </motion.div>
      )}
    </div>
  );
};
