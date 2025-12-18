import React, { useState, useEffect, useRef } from 'react';

interface DraggableFabProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}

export const DraggableFab: React.FC<DraggableFabProps> = ({ children, onClick, className }) => {
  const [pos, setPos] = useState<{ x: number, y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const offset = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  const handleStart = (clientX: number, clientY: number) => {
    isDragging.current = true;
    hasMoved.current = false;
    
    if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        // Calculate offset from top-left of the button
        offset.current = {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
        
        // Lock initial position if not already set (switching from CSS positioning to JS positioning)
        if (!pos) {
             setPos({ x: rect.left, y: rect.top });
        }
    }
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      
      // Prevent default scrolling behavior on touch devices
      if (e.cancelable) e.preventDefault();
      
      let clientX, clientY;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }

      const x = clientX - offset.current.x;
      const y = clientY - offset.current.y;
      
      // Constrain to window
      const maxX = window.innerWidth - (buttonRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (buttonRef.current?.offsetHeight || 0);
      
      const boundedX = Math.min(Math.max(0, x), maxX);
      const boundedY = Math.min(Math.max(0, y), maxY);

      setPos({ x: boundedX, y: boundedY });
      hasMoved.current = true;
    };

    const handleEnd = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
      if (!hasMoved.current) {
          onClick();
      }
  };

  // When pos is active, we override standard positioning
  const style: React.CSSProperties = pos ? {
      position: 'fixed',
      left: `${pos.x}px`,
      top: `${pos.y}px`,
      bottom: 'auto',
      right: 'auto',
      zIndex: 50, // Ensure it stays on top
      touchAction: 'none' // Prevent browser gestures
  } : {
      zIndex: 50,
      touchAction: 'none'
  };

  return (
    <button
      ref={buttonRef}
      className={className}
      style={style}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};