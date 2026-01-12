'use client';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type AlertDialogOptions = {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
};

interface AlertDialogContextType {
  isOpen: boolean;
  showAlertDialog: (options: AlertDialogOptions) => void;
  hideAlertDialog: () => void;
  options: AlertDialogOptions | null;
}
const AlertDialogContext = createContext<AlertDialogContextType | undefined>(undefined);

export const AlertDialogProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AlertDialogOptions | null>(null);

  const showAlertDialog = useCallback((opts: AlertDialogOptions) => {
    setOptions(opts);
    setIsOpen(true);
  }, []);

  const hideAlertDialog = useCallback(() => {
    setIsOpen(false);
    // We delay clearing options to allow for fade-out animations
    setTimeout(() => setOptions(null), 300);
  }, []);

  return (
    <AlertDialogContext.Provider value={{ isOpen, showAlertDialog, hideAlertDialog, options }}>
      {children}
    </AlertDialogContext.Provider>
  );
};

export const useAlertDialog = () => {
  const context = useContext(AlertDialogContext);
  if (context === undefined) {
    throw new Error('useAlertDialog must be used within an AlertDialogProvider');
  }
  return context.showAlertDialog;
};

export const useAlertDialogContext = () => {
    const context = useContext(AlertDialogContext);
    if (context === undefined) {
        throw new Error('useAlertDialogContext must be used within an AlertDialogProvider');
    }
    return context;
}
