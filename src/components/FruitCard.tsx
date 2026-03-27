import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart } from 'lucide-react';
import { FruitImage } from './FruitImage';

interface FruitCardProps {
  fruit: any;
  onClick: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFavoriteToggle?: (e: React.MouseEvent) => void;
  isActive: boolean;
  isHovered: boolean;
  isFavorite?: boolean;
}

export const FruitCard: React.FC<FruitCardProps> = ({ 
  fruit, 
  onClick, 
  onMouseEnter, 
  onMouseLeave, 
  onFavoriteToggle,
  isActive, 
  isHovered,
  isFavorite = false
}) => {
  return (
    <motion.button 
      whileHover={{ scale: 1.05, zIndex: 10 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className={`relative inline-flex flex-col w-96 rounded-2xl shadow-lg ${fruit.color} backdrop-blur-xl bg-bg-surface/50 border border-white/10 overflow-hidden group/card cursor-pointer transition-all duration-300 fruit-card text-left ${(isActive || isHovered) ? 'ring-4 ring-primary ring-offset-4 ring-offset-bg-base active-card' : ''}`}
    >
      <div className="relative h-56 overflow-hidden bg-bg-surface/5">
        <FruitImage 
          name={fruit.name} 
          fallbackImage={fruit.image} 
          className="w-full h-full"
        />
        
        {/* Heart Button */}
        <motion.div
          role="button"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            console.log('Favorite button clicked');
            e.stopPropagation();
            onFavoriteToggle?.(e);
          }}
          className={`absolute top-4 right-4 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 z-20 cursor-pointer ${
            isFavorite 
              ? 'bg-red-500 shadow-[0_4px_12px_rgba(239,68,68,0.4),inset_0_-2px_4px_rgba(0,0,0,0.2)] border-red-400' 
              : 'bg-bg-surface/30 backdrop-blur-md border border-white/30 shadow-lg'
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isFavorite ? 'favorite' : 'not-favorite'}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Heart 
                size={24} 
                className={isFavorite ? 'fill-white text-white' : 'text-white'} 
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
      
      <div className="p-6 pl-9">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{fruit.icon}</span>
            <span className="text-2xl font-display font-extrabold text-text-main">{fruit.name}</span>
          </div>
          <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wider">
            {fruit.family}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest leading-none mb-1">热量</span>
            <span className="text-xs font-bold text-text-main">{fruit.kcal} kcal</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest leading-none mb-1">最佳赏味</span>
            <span className="text-xs font-bold text-text-main">{fruit.season}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
};
