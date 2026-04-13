'use client';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { UnsavedChangesDialog } from '@/components/dashboard/unsaved-changes-dialog';

interface NavigationGuardContextType {
  isDirty: boolean;
  setIsDirty: (dirty: boolean, saveFn?: () => Promise<any>) => void;
  confirmNavigation: (targetUrl: string | (() => void)) => void;
}

const NavigationGuardContext = createContext<NavigationGuardContextType | undefined>(undefined);

export const NavigationGuardProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const [isDirty, setIsDirtyInternal] = useState(false);
  const [saveFunction, setSaveFunction] = useState<(() => Promise<any>) | undefined>();
  const [showDialog, setShowDialog] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | (() => void) | null>(null);

  const setIsDirty = useCallback((dirty: boolean, saveFn?: () => Promise<any>) => {
    setIsDirtyInternal(dirty);
    if (saveFn) setSaveFunction(() => saveFn);
  }, []);

  const confirmNavigation = useCallback((target: string | (() => void)) => {
    if (isDirty) {
      setPendingTarget(target);
      setShowDialog(true);
    } else {
      if (typeof target === 'string') {
        router.push(target);
      } else {
        target();
      }
    }
  }, [isDirty, router]);

  const handleSaveAndContinue = async () => {
    if (saveFunction) {
      try {
        await saveFunction();
      } catch (e) {
        console.error("Auto-save failed during navigation", e);
        return; // Don't navigate if save fails
      }
    }
    handleContinueWithoutSaving();
  };

  const handleContinueWithoutSaving = () => {
    setIsDirtyInternal(false);
    setShowDialog(false);
    if (pendingTarget) {
      if (typeof pendingTarget === 'string') {
        router.push(pendingTarget);
      } else {
        pendingTarget();
      }
    }
    setPendingTarget(null);
  };

  const handleCancel = () => {
    setShowDialog(false);
    setPendingTarget(null);
  };

  return (
    <NavigationGuardContext.Provider value={{ isDirty, setIsDirty, confirmNavigation }}>
      {children}
      <UnsavedChangesDialog 
        isOpen={showDialog}
        onSaveAndContinue={handleSaveAndContinue}
        onContinueWithoutSaving={handleContinueWithoutSaving}
        onCancel={handleCancel}
      />
    </NavigationGuardContext.Provider>
  );
};

export const useNavigationGuard = () => {
  const context = useContext(NavigationGuardContext);
  if (!context) throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
  return context;
};
