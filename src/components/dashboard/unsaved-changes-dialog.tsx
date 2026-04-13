'use client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

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
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes on this bill. What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 py-4">
          <Button onClick={onSaveAndContinue} className="w-full justify-start" variant="default">
            1. Save and Continue
          </Button>
          <Button onClick={onContinueWithoutSaving} className="w-full justify-start" variant="outline">
            2. Continue Without Saving
          </Button>
          <Button onClick={onCancel} className="w-full justify-start" variant="ghost">
            3. Cancel
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
