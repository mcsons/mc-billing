'use client';

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

  const handleCancel = () => {
    options?.onCancel?.();
    hideAlertDialog();
  };

  const handleConfirm = () => {
    options?.onConfirm?.();
    hideAlertDialog();
  };

  if (!options) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={hideAlertDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {options.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{options.cancelText || 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {options.confirmText || 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
