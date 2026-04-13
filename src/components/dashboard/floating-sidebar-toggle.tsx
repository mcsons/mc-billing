'use client';
import React, { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function FloatingSidebarToggle() {
  const { toggleSidebar } = useSidebar();
  const [isVisible, setIsVisible] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show button only when scrolling UP AND scrolled down at least 200px
      if (currentScrollY > 200 && currentScrollY < lastScrollY) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <div 
      className={cn(
        "fixed bottom-6 right-6 z-50 transition-all duration-300 transform",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none",
        "hidden md:block" // Only show on desktop as mobile has its own bottom footer in some pages
      )}
    >
      <Button
        size="icon"
        variant="default"
        className="h-12 w-12 rounded-full shadow-lg border-2 border-primary-foreground/20"
        onClick={toggleSidebar}
      >
        <Menu className="h-6 w-6" />
      </Button>
    </div>
  );
}
