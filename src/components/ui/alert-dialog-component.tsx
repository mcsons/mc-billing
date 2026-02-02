'use client';

import { useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAlertDialogContext } from '@/context/AlertDialogProvider';

export function AlertDialogComponent() {
  const { isOpen, options, hideAlertDialog } = useAlertDialogContext();
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const handleCancel = () => {
    options?.onCancel?.();
    hideAlertDialog();
  };

  const handleConfirm = () => {
    options?.onConfirm?.();
    hideAlertDialog();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (document.activeElement === confirmButtonRef.current) {
        cancelButtonRef.current?.focus();
      } else {
        confirmButtonRef.current?.focus();
      }
    }
  };

  if (!options) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={hideAlertDialog}>
      <AlertDialogContent onKeyDown={handleKeyDown}>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {options.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancelButtonRef} onClick={handleCancel}>{options.cancelText || 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction ref={confirmButtonRef} onClick={handleConfirm}>
            {options.confirmText || 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
