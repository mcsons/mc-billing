'use client';
import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';

interface BillingGuardState {
  /** Whether the billing page currently has unsaved work */
  hasUnsavedChanges: boolean;
  /** Register that the billing page has unsaved changes */
  setHasUnsavedChanges: (value: boolean) => void;
  /** Save callback provided by the billing page; returns true on success */
  saveBillRef: React.MutableRefObject<(() => Promise<boolean>) | null>;
}

const BillingGuardContext = createContext<BillingGuardState | undefined>(undefined);

export const BillingGuardProvider = ({ children }: { children: ReactNode }) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveBillRef = useRef<(() => Promise<boolean>) | null>(null);

  return (
    <BillingGuardContext.Provider value={{ hasUnsavedChanges, setHasUnsavedChanges, saveBillRef }}>
      {children}
    </BillingGuardContext.Provider>
  );
};

export const useBillingGuard = () => {
  const context = useContext(BillingGuardContext);
  if (context === undefined) {
    throw new Error('useBillingGuard must be used within a BillingGuardProvider');
  }
  return context;
};
