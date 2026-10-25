'use client';
import { useState, useEffect, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onSaveAndContinue: () => void;
  onContinueWithoutSaving: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  isOpen,
  onSaveAndContinue,
  onContinueWithoutSaving,
  onCancel,
}: UnsavedChangesDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset selection and focus modal when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      // Small delay to ensure Radix has finished mounting the dialog content
      const timer = setTimeout(() => {
        modalRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleAction = (index: number) => {
    if (index === 0) onSaveAndContinue();
    else if (index === 1) onContinueWithoutSaving();
    else if (index === 2) onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % 3);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + 3) % 3);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleAction(selectedIndex);
    }
  };

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent 
        className="sm:max-w-[425px] outline-none"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        ref={modalRef}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes on this bill. What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 py-4">
          <Button 
            onClick={() => handleAction(0)} 
            className={cn(
              "w-full justify-start transition-colors", 
              selectedIndex === 0 && "bg-blue-600 text-white hover:bg-blue-700"
            )} 
            variant="default"
          >
            1. Save and Continue
          </Button>
          <Button 
            onClick={() => handleAction(1)} 
            className={cn(
              "w-full justify-start transition-colors", 
              selectedIndex === 1 && "bg-blue-600 text-white hover:bg-blue-700"
            )} 
            variant="outline"
          >
            2. Continue Without Saving
          </Button>
          <Button 
            onClick={() => handleAction(2)} 
            className={cn(
              "w-full justify-start transition-colors", 
              selectedIndex === 2 && "bg-blue-600 text-white hover:bg-blue-700"
            )} 
            variant="ghost"
          >
            3. Cancel
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
