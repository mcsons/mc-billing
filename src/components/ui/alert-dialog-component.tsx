'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
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

  const handleConfirm = async () => {
    try {
      await options?.onConfirm?.();
    } catch (e) {
      console.error(e);
    } finally {
      hideAlertDialog();
    }
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
        <AlertDialogHeader className={options.showClose ? 'pr-8' : undefined}>
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
        {/* After the footer in DOM order so the dialog still opens with focus on its buttons. */}
        {options.showClose && (
          <button
            type="button"
            onClick={hideAlertDialog}
            aria-label="Close"
            title="Close (Esc)"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
