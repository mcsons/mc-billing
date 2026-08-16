'use client';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Save, Printer, Share, FilePlus, Trash2, MoreVertical, X, Plus, Pencil, Trash, ChevronDown, ChevronRight } from 'lucide-react';
import { format, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { useData } from '@/context/DataContext';
import { useToast } from '@/hooks/use-toast';
import { useLoading } from '@/context/LoadingContext';
import ReactSelect from 'react-select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Timestamp } from 'firebase/firestore';
import { useAlertDialog } from '@/context/AlertDialogProvider';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { useBillingGuard } from '@/context/BillingGuardContext';

export default function BoxBillingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const showAlertDialog = useAlertDialog();
  const billingGuard = useBillingGuard();
  const { setLoading } = useLoading();

  const {
    customers,
    boxBills,
    openingBoxBalances,
    addOrUpdateBoxBill,
    deleteBoxBills,
    findBoxBillForCustomerOnDate,
    getBoxBill,
    users,
    currentUser,
    boxBillEntries,
    addBoxBillEntry,
    updateBoxBillEntry,
    deleteBoxBillEntry,
    recalculateFutureBoxBalances,
  } = useData();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [activeBillId, setActiveBillId] = useState<string | null>(null);

  // Form Fields
  const [prevBalanceBox, setPrevBalanceBox] = useState('');
  const [manualEmptyBox, setManualEmptyBox] = useState('');
  const [description, setDescription] = useState('');
  const [driverMobile, setDriverMobile] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  // UI only: used to portal dropdown menus to <body> so they are never clipped
  // by the scrollable panels. Avoids an SSR/hydration mismatch.
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  const [localEntries, setLocalEntries] = useState<any[]>([]);
  const lastInitializedBillId = useRef<string | null>(null);

  const hasUnsavedChanges = useMemo(() => {
    return selectedCustomerId !== '' ||
      localEntries.length > 0 ||
      manualEmptyBox !== '' ||
      description !== '' ||
      driverMobile !== '' ||
      driverName !== '' ||
      vehicleNo !== '' ||
      activeBillId !== null;
  }, [selectedCustomerId, localEntries, manualEmptyBox, description, driverMobile, driverName, vehicleNo, activeBillId]);

  useEffect(() => {
    billingGuard.setHasUnsavedChanges(hasUnsavedChanges);
    return () => billingGuard.setHasUnsavedChanges(false);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (activeBillId && activeBillId !== lastInitializedBillId.current) {
      const currentEntries = boxBillEntries.filter(e => e.boxBillId === activeBillId);
      if (boxBills.length > 0) {
        setLocalEntries(currentEntries);
        lastInitializedBillId.current = activeBillId;
      }
    } else if (!activeBillId && lastInitializedBillId.current !== null) {
      setLocalEntries([]);
      lastInitializedBillId.current = null;
    }
  }, [activeBillId, boxBillEntries, boxBills]);

  // History State
  const [historyDate, setHistoryDate] = useState<Date | undefined>();
  const [historySelectedCustomer, setHistorySelectedCustomer] = useState<string>('');
  const [filteredHistoryBills, setFilteredHistoryBills] = useState<any[]>([]);
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());

  // Entry Modal & Panel State
  const [isEntryDialogOpen, setIsEntryDialogOpen] = useState(false);
  const saveBtnInPopupRef = useRef<HTMLButtonElement>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryBoxes, setEntryBoxes] = useState('');
  const [entryEmptyBoxes, setEntryEmptyBoxes] = useState('');
  const [localTfText, setLocalTfText] = useState('');
  const [isEntriesPanelOpen, setIsEntriesPanelOpen] = useState(false);
  const [manageEntriesBillId, setManageEntriesBillId] = useState<string | null>(null);
  const printBtnRef = useRef<HTMLButtonElement>(null);
  const shareBtnRef = useRef<HTMLButtonElement>(null);

  // Print Modal State
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [printPaperType, setPrintPaperType] = useState<'thermal' | 'thermal3' | 'a4'>('thermal');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSavingAndPrinting, setIsSavingAndPrinting] = useState(false);

  // Nav Dialog State
  const [navDialog, setNavDialog] = useState<{ open: boolean; targetId: string }>({ open: false, targetId: '' });

  // Refs
  const customerSelectRef = useRef<any>(null);
  const todaysFishBoxRef = useRef<HTMLInputElement>(null);
  const emptyBoxRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const driverMobileRef = useRef<HTMLInputElement>(null);
  const driverNameRef = useRef<HTMLInputElement>(null);
  const vehicleNoRef = useRef<HTMLInputElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  // React Select Styles
  const reactSelectStyles = {
    container: (baseStyles: any) => ({ ...baseStyles, width: '100%' }),
    control: (baseStyles: any, state: any) => ({
      ...baseStyles,
      backgroundColor: 'hsl(var(--background))',
      borderColor: state.isFocused ? 'hsl(var(--ring))' : 'hsl(var(--input))',
      boxShadow: state.isFocused ? `0 0 0 1px hsl(var(--ring))` : 'none',
      minHeight: '44px',
      '&:hover': { borderColor: 'hsl(var(--ring))' },
    }),
    menu: (baseStyles: any) => ({ ...baseStyles, backgroundColor: 'hsl(var(--card))', zIndex: 50 }),
    menuList: (baseStyles: any) => ({ ...baseStyles, maxHeight: '40vh', WebkitOverflowScrolling: 'touch' }),
    menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
    option: (baseStyles: any, state: any) => ({
      ...baseStyles,
      backgroundColor: state.isSelected ? 'hsl(var(--accent))' : state.isFocused ? 'hsl(var(--muted))' : 'transparent',
      color: state.isSelected ? 'hsl(var(--accent-foreground))' : 'hsl(var(--foreground))',
      '&:active': { backgroundColor: 'hsl(var(--accent))' },
    }),
    singleValue: (baseStyles: any) => ({ ...baseStyles, color: 'hsl(var(--foreground))' }),
    input: (baseStyles: any) => ({ ...baseStyles, color: 'hsl(var(--foreground))' }),
    placeholder: (baseStyles: any) => ({ ...baseStyles, color: 'hsl(var(--muted-foreground))' }),
  };

  const customerOptions = useMemo(() =>
    customers.map((c) => ({ value: c.id, label: `${c.name_en} (${c.name_ta})` })),
  [customers]);

  const handleDateKeyDown = (e: React.KeyboardEvent, currentDate: Date | undefined, setDateFn: (d: Date) => void) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation();
      const current = currentDate ? new Date(currentDate) : new Date();
      if (e.key === 'ArrowUp') current.setDate(current.getDate() + 1);
      else current.setDate(current.getDate() - 1);
      setDateFn(new Date(current));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLElement | null>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  const computeBoxBalanceUpToDate = useCallback((customerId: string, targetDate: Date) => {
    const initial = openingBoxBalances[customerId] || 0;
    const priorBills = boxBills.filter(b => {
      if (b.customerId !== customerId) return false;
      const bDate = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
      const bDay = new Date(bDate); bDay.setHours(0,0,0,0);
      const tDay = new Date(targetDate); tDay.setHours(0,0,0,0);
      return bDay.getTime() < tDay.getTime();
    });
    if (priorBills.length === 0) return initial;
    priorBills.sort((a,b) => {
      const aD = a.billDate?.toDate ? a.billDate.toDate() : new Date(a.billDate);
      const bD = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
      return bD.getTime() - aD.getTime();
    });
    return priorBills[0].balanceBox;
  }, [boxBills, openingBoxBalances]);

  // Handle URL Param Loading
  const billIdParam = searchParams.get('billId');
  useEffect(() => {
    if (billIdParam) {
      const bill = getBoxBill(billIdParam);
      if (bill) {
        setSelectedCustomerId(bill.customerId);
        setDate(bill.billDate?.toDate ? bill.billDate.toDate() : new Date(bill.billDate));
        setActiveBillId(bill.id);
        setPrevBalanceBox(bill.prevBalanceBox.toString());
        setManualEmptyBox(bill.manualEmptyBox?.toString() || '');
        setDescription(bill.description || '');
        setDriverMobile(bill.driverMobile || '');
        setDriverName(bill.driverName || '');
        setVehicleNo(bill.vehicleNo || '');
      }
      setTimeout(() => {
        setLoading(false);
        if (todaysFishBoxRef.current) {
          todaysFishBoxRef.current.focus();
          todaysFishBoxRef.current.select();
        }
      }, 100);
    } else {
      setLoading(false);
    }
  }, [billIdParam, getBoxBill, setLoading]);

  // Auto-fetch on customer/date change
  useEffect(() => {
    if (billIdParam) return; // Managed by param effect
    if (selectedCustomerId && date) {
      const existingBill = findBoxBillForCustomerOnDate(selectedCustomerId, date);
      if (existingBill) {
        setActiveBillId(existingBill.id);
        setPrevBalanceBox(existingBill.prevBalanceBox.toString());
        setManualEmptyBox(existingBill.manualEmptyBox?.toString() || '');
        setDescription(existingBill.description || '');
        setDriverMobile(existingBill.driverMobile || '');
        setDriverName(existingBill.driverName || '');
        setVehicleNo(existingBill.vehicleNo || '');
      } else {
        setActiveBillId(null);
        const prevBal = computeBoxBalanceUpToDate(selectedCustomerId, date);
        setPrevBalanceBox(prevBal.toString());
        setManualEmptyBox('');
        setDescription('');
        setDriverMobile('');
        setDriverName('');
        setVehicleNo('');
      }
    } else {
      setActiveBillId(null);
      setPrevBalanceBox('');
      setManualEmptyBox('');
      setDescription('');
      setDriverMobile('');
      setDriverName('');
      setVehicleNo('');
    }
  }, [selectedCustomerId, date, billIdParam, findBoxBillForCustomerOnDate, computeBoxBalanceUpToDate]);

  const sortBills = useCallback((bills: any[]) => {
    return [...bills].sort((a, b) => {
      const dateA = a.billDate?.toDate ? a.billDate.toDate() : new Date(a.billDate);
      const dateB = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
      return dateB.getTime() - dateA.getTime();
    });
  }, []);

  const sortedBills = useMemo(() => sortBills(boxBills), [boxBills, sortBills]);

  const currentBillIndex = useMemo(() => {
    if (!activeBillId) return -1;
    return sortedBills.findIndex(b => b.id === activeBillId);
  }, [activeBillId, sortedBills]);

  const goToBill = (targetId: string) => {
    if (hasUnsavedChanges) {
      setNavDialog({ open: true, targetId });
    } else {
      setLoading(true, 'Opening box bill...');
      router.push(`/dashboard/box-billing?billId=${targetId}`);
      setTimeout(() => setLoading(false), 500);
    }
  };

  // Navigation buttons always load immediately — no unsaved dialog for browsing.
  const goToBillImmediate = (targetId: string) => {
    if (isSaving) return; // Block navigation while a save is in progress
    setLoading(true, 'Opening box bill...');
    router.push(`/dashboard/box-billing?billId=${targetId}`);
    setTimeout(() => setLoading(false), 500);
  };

  const handlePrevBill = () => {
    if (currentBillIndex < sortedBills.length - 1 && currentBillIndex !== -1) {
      goToBillImmediate(sortedBills[currentBillIndex + 1].id);
    } else if (currentBillIndex === -1 && sortedBills.length > 0) {
      goToBillImmediate(sortedBills[0].id);
    }
  };

  const handleNextBill = () => {
    if (currentBillIndex > 0) {
      goToBillImmediate(sortedBills[currentBillIndex - 1].id);
    } else if (currentBillIndex === 0) {
      // At the newest bill — pressing > goes to New Bill without a dialog
      if (!isSaving) router.push(`/dashboard/box-billing`);
    }
  };

  const goToFirstBillOfDay = () => {
    if (!date) return;
    const billsOfDay = sortedBills.filter(b => {
      const bDate = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
      return isSameDay(bDate, date);
    });
    if (billsOfDay.length > 0) {
      goToBillImmediate(billsOfDay[billsOfDay.length - 1].id);
    }
  };

  const goToLastBillOfDay = () => {
    if (!date) return;
    const billsOfDay = sortedBills.filter(b => {
      const bDate = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
      return isSameDay(bDate, date);
    });
    if (billsOfDay.length > 0) {
      goToBillImmediate(billsOfDay[0].id);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't intercept when typing in inputs
      }
      
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevBill();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextBill();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToFirstBillOfDay();
      } else if (e.key === 'End') {
        e.preventDefault();
        goToLastBillOfDay();
      }
    };
    
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handlePrevBill, handleNextBill, goToFirstBillOfDay, goToLastBillOfDay]);



  // History filtering
  useEffect(() => {
    let results = boxBills;
    if (historySelectedCustomer) {
      results = results.filter(b => b.customerId === historySelectedCustomer);
    }
    if (historyDate) {
      results = results.filter(bill => {
        if (!bill.billDate) return false;
        const billDate = (bill.billDate as Timestamp).toDate ? (bill.billDate as Timestamp).toDate() : new Date(bill.billDate);
        return isSameDay(billDate, historyDate);
      });
    }

    if (!historySelectedCustomer && !historyDate) {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = endOfWeek(new Date(), { weekStartsOn: 1 });
      results = results.filter(bill => {
        if (!bill.billDate) return false;
        const d = (bill.billDate as Timestamp).toDate ? (bill.billDate as Timestamp).toDate() : new Date(bill.billDate);
        return d >= start && d <= end;
      });
    }

    results.sort((a, b) => {
      const dateA = a.billDate?.toDate ? a.billDate.toDate() : new Date(a.billDate);
      const dateB = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
      return dateB.getTime() - dateA.getTime();
    });

    setFilteredHistoryBills(results);
  }, [boxBills, historySelectedCustomer, historyDate]);

  const handleNewBillConfirmed = () => {
    router.replace('/dashboard/box-billing');
    setSelectedCustomerId('');
    setDate(new Date());
    setPrevBalanceBox('');
    setManualEmptyBox('');
    setDescription('');
    setDriverMobile('');
    setDriverName('');
    setVehicleNo('');
    setActiveBillId(null);
    setLocalEntries([]);
    lastInitializedBillId.current = null;
    setTimeout(() => customerSelectRef.current?.focus(), 100);
  };

  const handleNewBill = () => {
    const hasContent = selectedCustomerId || localEntries.length > 0 || manualEmptyBox || description || driverMobile || driverName || vehicleNo;

    if (hasContent) {
      showAlertDialog({
        title: 'Unsaved Changes',
        description: 'You have unsaved changes. Are you sure you want to create a new bill?',
        confirmText: 'Yes, Discard and Start New',
        cancelText: 'Cancel',
        onConfirm: handleNewBillConfirmed
      });
    } else {
      handleNewBillConfirmed();
    }
  };

  const activeBillEntries = useMemo(() => {
    return [...localEntries].sort((a, b) => {
      const dateA = a.entryDate?.toDate ? a.entryDate.toDate() : new Date(a.entryDate);
      const dateB = b.entryDate?.toDate ? b.entryDate.toDate() : new Date(b.entryDate);
      return dateA.getTime() - dateB.getTime();
    });
  }, [localEntries]);

  const manageEntries = useMemo(() => {
    if (!manageEntriesBillId) return [];
    // Guard: if the bill itself no longer exists (e.g. was deleted), return nothing
    // to prevent orphaned entries from a deleted bill appearing in the dialog.
    const billExists = boxBills.some(b => b.id === manageEntriesBillId);
    if (!billExists) return [];
    return boxBillEntries
      .filter(e => e.boxBillId === manageEntriesBillId)
      .sort((a, b) => {
        const dateA = a.entryDate?.toDate ? a.entryDate.toDate() : new Date(a.entryDate);
        const dateB = b.entryDate?.toDate ? b.entryDate.toDate() : new Date(b.entryDate);
        return dateA.getTime() - dateB.getTime();
      });
  }, [boxBillEntries, manageEntriesBillId, boxBills]);

  const activeTotalAdded = activeBillEntries.reduce((sum, e) => e.boxesAdded > 0 ? sum + e.boxesAdded : sum, 0);
  const activeTotalEmptyAdded = activeBillEntries.reduce((sum, e) => sum + (e.emptyBoxesAdded || 0), 0);
  const activeTotalRemoved = activeBillEntries.reduce((sum, e) => e.boxesAdded < 0 ? sum + Math.abs(e.boxesAdded) : sum, 0);

  const manageTotalAdded = manageEntries.reduce((sum, e) => e.boxesAdded > 0 ? sum + e.boxesAdded : sum, 0);
  const manageTotalEmptyAdded = manageEntries.reduce((sum, e) => sum + (e.emptyBoxesAdded || 0), 0);
  const manageTotalRemoved = manageEntries.reduce((sum, e) => e.boxesAdded < 0 ? sum + Math.abs(e.boxesAdded) : sum, 0);

  const computedTodaysFishBox = useMemo(() => {
    return activeBillEntries.reduce((sum, e) => sum + (e.boxesAdded || 0), 0);
  }, [activeBillEntries]);

  const computedEmptyBoxes = useMemo(() => {
    // Exclude isManualEmpty entries — their value is tracked via the manualEmptyBox
    // state input to avoid double-counting in: eb = entryEmptyBoxTotal + manualEmpty.
    return activeBillEntries
      .filter(e => !e.isManualEmpty)
      .reduce((sum, e) => sum + (e.emptyBoxesAdded || 0), 0);
  }, [activeBillEntries]);

  const pb = parseInt(prevBalanceBox) || 0;
  const tf = computedTodaysFishBox;
  const entryEmptyBoxTotal = computedEmptyBoxes;
  const manualEmpty = parseInt(manualEmptyBox) || 0;
  const eb = entryEmptyBoxTotal + manualEmpty; // This is the final empty box
  const tb = pb + tf;
  const bb = tb - eb;

  // Keep localTfText in sync with computed tf (only when tf changes from external source)
  useEffect(() => {
    setLocalTfText(tf.toString());
  }, [tf]);

  // manualEmptyBox is bound to the input, entryEmptyBoxTotal is computed. No need to keep an emptyBox state.

  const commitBillData = async () => {
    if (!selectedCustomerId || !date) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a customer and date.' });
      return null;
    }
    const customer = customers.find(c => c.id === selectedCustomerId);
    
    const currentTb = pb + tf;
    const currentBb = currentTb - eb;

    const payload = {
      customerId: selectedCustomerId,
      customerName: customer ? `${customer.name_en} (${customer.name_ta})` : 'Unknown',
      billDate: Timestamp.fromDate(date),
      prevBalanceBox: pb,
      todaysFishBox: tf,
      totalBox: currentTb,
      emptyBox: eb,
      manualEmptyBox: manualEmpty,
      entryEmptyBoxTotal: entryEmptyBoxTotal,
      finalEmptyBox: eb,
      balanceBox: currentBb,
      description,
      driverMobile,
      driverName,
      vehicleNo
    };

    const savedBill = await addOrUpdateBoxBill(payload, activeBillId);
    if (savedBill) {
      setActiveBillId(savedBill.id);
      
      const firestoreEntries = boxBillEntries.filter(e => e.boxBillId === savedBill.id);
      
      for (const fe of firestoreEntries) {
        if (fe.isManualEmpty) continue;
         if (!localEntries.find(le => le.id === fe.id)) {
            await deleteBoxBillEntry(fe.id);
         }
      }
      
      for (const le of localEntries) {
        if (le.isManualEmpty) continue;
         if (le.id?.startsWith('temp-')) {
            await addBoxBillEntry({
               boxBillId: savedBill.id,
               customerId: selectedCustomerId,
               entryDate: le.entryDate,
               boxesAdded: le.boxesAdded,
               emptyBoxesAdded: le.emptyBoxesAdded || 0,
            });
         } else {
            const original = firestoreEntries.find(fe => fe.id === le.id);
            if (original && (original.boxesAdded !== le.boxesAdded || (original.emptyBoxesAdded || 0) !== (le.emptyBoxesAdded || 0))) {
               await updateBoxBillEntry(le.id, le.boxesAdded, le.emptyBoxesAdded || 0);
            }
         }
      }

      // Manual Empty Box → persist as a visible entry so it appears in Today's Box Entries.
      // Always delete the old manual entry then recreate, so editing the bill stays in sync.
      const existingManualEntry = firestoreEntries.find(e => e.isManualEmpty);
      if (existingManualEntry) {
        await deleteBoxBillEntry(existingManualEntry.id);
      }
      if (manualEmpty > 0) {
        await addBoxBillEntry({
          boxBillId: savedBill.id,
          customerId: selectedCustomerId,
          entryDate: Timestamp.now(),
          boxesAdded: 0,
          emptyBoxesAdded: manualEmpty,
          isManualEmpty: true,
        });
      }


      // Cascade balance to all subsequent bills for this customer
      await recalculateFutureBoxBalances(selectedCustomerId);
      
      return savedBill;
    }
    return null;
  };

  useEffect(() => {
    billingGuard.saveBillRef.current = async (): Promise<boolean> => {
      if (isSaving) return false;
      if (!selectedCustomerId || !date) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please select a customer and date.' });
        return false;
      }
      try {
        setIsSaving(true);
        setLoading(true, 'Saving bill...');
        const savedData = await commitBillData();
        if (savedData) {
          handleNewBillConfirmed();
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        setIsSaving(false);
        setLoading(false);
      }
    };
    return () => { billingGuard.saveBillRef.current = null; };
  });

  const handleSaveBill = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setLoading(true, 'Saving Box Bill...');
    let success = false;
    try {
      const savedBill = await commitBillData();
      if (!savedBill) return; // finally will setLoading(false)
      success = true;
      // Form reset + navigation — loader stays visible throughout
      handleNewBillConfirmed();
      toast({ title: 'Box Bill Saved Successfully' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save bill.' });
    } finally {
      setIsSaving(false);
      if (!success) {
        // Only hide loader immediately on failure/no-bill; on success wait for nav
        setLoading(false);
      } else {
        // Give the router navigation and form reset enough time to render
        // before dismissing the loader so the user never sees a flash of stale form
        setTimeout(() => setLoading(false), 600);
      }
    }
  };

  const handleSaveEntry = async () => {
    const boxes = parseInt(entryBoxes) || 0;
    const emptyBoxes = parseInt(entryEmptyBoxes) || 0;
    // Allow save when at least one of: boxes > 0 OR emptyBoxes > 0
    if (boxes === 0 && emptyBoxes === 0) return;

    const currentEditingEntryId = editingEntryId;
    
    setIsEntryDialogOpen(false);
    setEntryBoxes('');
    setEntryEmptyBoxes('');
    setEditingEntryId(null);
    
    if (currentEditingEntryId) {
      setLocalEntries(prev => prev.map(e => {
        if (e.id === currentEditingEntryId) {
          if (e.isManualEmpty) {
            setManualEmptyBox(emptyBoxes.toString());
          }
          return { ...e, boxesAdded: boxes, emptyBoxesAdded: emptyBoxes };
        }
        return e;
      }));
    } else {
      const newEntry = {
        id: `temp-${Date.now()}`,
        entryDate: Timestamp.now(),
        boxesAdded: boxes,
        emptyBoxesAdded: emptyBoxes,
        createdBy: currentUser?.id || 'Unknown',
      };
      setLocalEntries(prev => [...prev, newEntry]);
      setIsEntriesPanelOpen(true);
    }

    setTimeout(() => {
      if (emptyBoxRef.current) {
        emptyBoxRef.current.focus();
        emptyBoxRef.current.select();
      }
    }, 100);
  };

  // TF direct edit: only adds a local entry — no DB write until Save Bill
  const handleTfDirectEdit = () => {
    const parsed = parseInt(localTfText);
    if (isNaN(parsed) || parsed === tf) {
      setLocalTfText(tf.toString());
      return;
    }
    const diff = parsed - tf;
    const newEntry = {
      id: `temp-${Date.now()}`,
      entryDate: Timestamp.now(),
      boxesAdded: diff,
      createdBy: currentUser?.id || 'Unknown',
    };
    setLocalEntries(prev => [...prev, newEntry]);
  };

  const handleDeleteEntry = (entryId: string, boxes: number, emptyBoxes: number, isHistorical: boolean = false) => {
    showAlertDialog({
      title: 'Delete Entry?',
      description: 'Are you sure you want to delete this box entry?',
      onConfirm: async () => {
        if (!isHistorical) {
          setLocalEntries(prev => {
            const entry = prev.find(e => e.id === entryId);
            if (entry?.isManualEmpty) setManualEmptyBox('');
            return prev.filter(e => e.id !== entryId);
          });
        } else if (manageEntriesBillId) {
          await deleteBoxBillEntry(entryId);
          const bill = boxBills.find(b => b.id === manageEntriesBillId);
          if (bill) {
             const remainingEntries = boxBillEntries.filter(e => e.boxBillId === manageEntriesBillId && e.id !== entryId);
             const newTf = remainingEntries.reduce((sum, e) => sum + (e.boxesAdded || 0), 0);
            // Preserve manualEmptyBox — only recalculate todaysFishBox from entries.
             // Exclude isManualEmpty entries: their value is already in bill.manualEmptyBox.
             const entryEmptyTotal = remainingEntries.filter(e => !e.isManualEmpty).reduce((sum, e) => sum + (e.emptyBoxesAdded || 0), 0);
             const savedManualEmpty = bill.manualEmptyBox || 0;
             const newEmpty = entryEmptyTotal + savedManualEmpty;
             const newTb = bill.prevBalanceBox + newTf;
             const newBb = newTb - newEmpty;
             const payload = { ...bill, todaysFishBox: newTf, emptyBox: newEmpty, totalBox: newTb, balanceBox: newBb };
             const { id, ...rest } = payload as any;
             await addOrUpdateBoxBill(rest, manageEntriesBillId);
             await recalculateFutureBoxBalances(bill.customerId);
          }
          toast({ title: 'Success', description: 'Entry deleted successfully.' });
        }
      }
    });
  };

  const handleDeleteAllEntries = () => {
    if (!manageEntriesBillId) return;
    const bill = boxBills.find(b => b.id === manageEntriesBillId);
    if (!bill) return;

    showAlertDialog({
      title: 'Delete All Entries',
      description: `This will permanently delete ALL box entries for this customer on this date.\n\nCustomer: ${bill.customerName}\nDate: ${bill.billDate ? format((bill.billDate as any).toDate ? (bill.billDate as any).toDate() : new Date(bill.billDate), 'dd MMM yyyy') : 'N/A'}\nTotal Entries: ${manageEntries.length}\n\nThis action cannot be undone.`,
      confirmText: 'Delete All',
      cancelText: 'Cancel',
      onConfirm: async () => {
        for (const entry of manageEntries) {
          await deleteBoxBillEntry(entry.id);
        }
        const billToUpdate = boxBills.find(b => b.id === manageEntriesBillId);
        if (billToUpdate) {
            const payload = { ...billToUpdate, todaysFishBox: 0, emptyBox: 0, totalBox: billToUpdate.prevBalanceBox, balanceBox: billToUpdate.prevBalanceBox };
            const { id, ...rest } = payload as any;
            await addOrUpdateBoxBill(rest, manageEntriesBillId);
            await recalculateFutureBoxBalances(billToUpdate.customerId);
        }
        setManageEntriesBillId(null);
        toast({ title: 'Success', description: 'All entries deleted successfully. Bill reset to 0.' });
      }
    });
  };

  const getBillPrintData = () => {
    if (!selectedCustomerId || !date) return null;
    const customer = customers.find(c => c.id === selectedCustomerId);
    return {
      id: activeBillId || 'New',
      customerId: selectedCustomerId,
      customerName: customer?.name_en || '',
      billDate: date,
      prevBalanceBox: parseInt(prevBalanceBox) || 0,
      todaysFishBox: tf,
      totalBox: tb,
      emptyBox: eb,
      manualEmptyBox: manualEmpty,
      entryEmptyBoxTotal: entryEmptyBoxTotal,
      finalEmptyBox: eb,
      balanceBox: bb,
      description,
      driverMobile,
      driverName,
      vehicleNo
    };
  };

  const handlePrintAction = (paper: 'thermal' | 'thermal3' | 'a4') => {
    setPrintPaperType(paper);
    if (!hasUnsavedChanges && activeBillId) {
      const d = getBillPrintData();
      if (d) {
        sessionStorage.setItem('boxBillPrintData', JSON.stringify(d));
        window.open(`/print/box-bill?paper=${paper}`, '_blank');
      }
    } else {
      setShowPrintConfirm(true);
    }
  };

  const handleSharePDF = async () => {
    if (isSavingAndPrinting) return;
    if (hasUnsavedChanges && selectedCustomerId && date) {
      // Auto-save silently, then open PDF
      setIsSavingAndPrinting(true);
      setLoading(true, 'Saving & Preparing PDF...');
      try {
        const savedBill = await commitBillData();
        if (savedBill) {
          sessionStorage.setItem('boxBillPrintData', JSON.stringify(savedBill));
          window.open('/print/box-bill?paper=a4&share=pdf', '_blank');
        }
      } finally {
        setLoading(false);
        setIsSavingAndPrinting(false);
      }
    } else {
      // Already saved — generate PDF straight away
      const d = getBillPrintData();
      if (d) {
        setLoading(true, 'Preparing PDF...');
        sessionStorage.setItem('boxBillPrintData', JSON.stringify(d));
        window.open('/print/box-bill?paper=a4&share=pdf', '_blank');
        setTimeout(() => setLoading(false), 800);
      }
    }
  };

  const handlePrintModalAction = async (action: string) => {
    if (action === "save") {
      if (isSavingAndPrinting) return;
      setIsSavingAndPrinting(true);
      setLoading(true, "Saving & Printing...");
      try {
        const savedBill = await commitBillData();
        if (savedBill) {
          sessionStorage.setItem('boxBillPrintData', JSON.stringify(savedBill));
          window.open(`/print/box-bill?paper=${printPaperType}`, '_blank');
          setShowPrintConfirm(false);
        }
      } finally {
        setLoading(false);
        setIsSavingAndPrinting(false);
      }
    } else if (action === "printWithoutSave") {
      const d = getBillPrintData();
      if (d) {
        sessionStorage.setItem('boxBillPrintData', JSON.stringify(d));
        window.open(`/print/box-bill?paper=${printPaperType}`, '_blank');
      }
      setShowPrintConfirm(false);
    } else if (action === "cancel") {
      setShowPrintConfirm(false);
    }
  };

  const handlePrintModalActionRef = useRef(handlePrintModalAction);
  handlePrintModalActionRef.current = handlePrintModalAction;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showPrintConfirm || isSavingAndPrinting) return;

      const options = ["save", "printWithoutSave", "cancel"];

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handlePrintModalActionRef.current(options[selectedIndex]);
      } else if (e.key === "Escape") {
        setShowPrintConfirm(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, showPrintConfirm, isSavingAndPrinting]);

  useEffect(() => {
    if (showPrintConfirm) {
      setSelectedIndex(0);
    }
  }, [showPrintConfirm]);

  const handleShareWhatsApp = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setLoading(true, 'Saving Box Bill...');
    try {
      const savedBill = await commitBillData();
      if (savedBill) {
        const customer = customers.find((c) => c.id === selectedCustomerId);
        const phone = customer?.phone || '';
        const billDate = savedBill.billDate?.toDate ? savedBill.billDate.toDate() : new Date(savedBill.billDate);
        let message = `*M.C & SONS FISH COMPANY*\n*BOX BILL SUMMARY*\n\nBill No: ${savedBill.id}\nDate: ${format(billDate, 'dd-MM-yyyy')}\nCustomer: ${savedBill.customerName}\n\n`;
        message += `Prev Balance Box: ${savedBill.prevBalanceBox}\n`;
        message += `Today's Fish Box: ${savedBill.todaysFishBox}\n`;
        message += `Total Box: ${savedBill.totalBox}\n`;
        message += `Empty Box: ${savedBill.emptyBox}\n`;
        message += `Balance Box: ${savedBill.balanceBox}\n`;
        if (savedBill.description) message += `\nNote: ${savedBill.description}\n`;
        message += `\nThank you!`;
        window.open(phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        handleNewBillConfirmed();
      }
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedBills.size === 0) return;
    showAlertDialog({
      title: 'Delete Box Bills?',
      description: `Are you sure you want to delete ${selectedBills.size} bill(s)?`,
      onConfirm: async () => {
        await deleteBoxBills(Array.from(selectedBills));
        setSelectedBills(new Set());
        toast({ title: 'Deleted', description: 'Box bills deleted successfully.' });
      }
    });
  };

  const handleEditBill = async (billId: string) => {
    setLoading(true, 'Loading Box Bill...');
    if (searchParams.get('billId') === billId) {
        setTimeout(() => setLoading(false), 300);
        return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
    router.push(`/dashboard/box-billing?billId=${billId}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  return (
    <div className="flex flex-col gap-4 pb-2 w-full max-w-full overflow-x-hidden lg:h-[calc(100vh-80px)] lg:overflow-hidden">
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-8 lg:h-full lg:overflow-hidden">
        {/* Left Side: Operations */}
        <div className="flex flex-col section-box w-full min-w-0 lg:h-full lg:overflow-y-auto custom-scrollbar">
          <Card className="flex flex-col border-none shadow-none bg-transparent lg:h-full">
            <CardHeader className="flex flex-col items-start gap-4 sm:flex-row sm:items-start sm:justify-between pb-2">
              <div className="min-w-0">
                <CardTitle className="font-headline break-words text-lg sm:text-xl">{activeBillId ? `Editing Box Bill ${activeBillId}` : 'Box Billing'}</CardTitle>
                <CardDescription>Manage customer box transactions.</CardDescription>
              </div>
              <div className="flex flex-col items-stretch gap-3 w-full sm:w-auto sm:items-end">
                <div className="grid gap-2 w-full sm:w-[200px]">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn('w-full justify-start text-left font-normal h-[44px]', !date && 'text-muted-foreground')}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, 'dd-MM-yyyy') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={date} onSelect={setDate} />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button variant="outline" size="sm" onClick={handleNewBill} className="w-full h-[44px] sm:w-[200px]">
                  <FilePlus className="mr-2 h-4 w-4" /> New Bill
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 grid gap-4 flex-1">
              <div className="grid gap-2">
                <Label>Customer</Label>
                <ReactSelect
                  ref={customerSelectRef}
                  instanceId="box-billing-customer-select"
                  placeholder="Search customer..."
                  isClearable
                  autoFocus
                  tabSelectsValue={true}
                  options={customerOptions}
                  value={customerOptions.find((o) => o.value === selectedCustomerId) || null}
                  onChange={(option) => {
                    setSelectedCustomerId(option ? option.value : '');
                    if (option) setTimeout(() => document.getElementById('todays-fish-box-input')?.focus(), 100);
                  }}
                  styles={reactSelectStyles}
                  menuPortalTarget={isMounted ? document.body : null}
                  menuPosition="fixed"
                />
              </div>

              <div className="italic text-sm text-muted-foreground font-semibold mt-1">
                Opening Balance: {selectedCustomerId ? (openingBoxBalances[selectedCustomerId] || 0) : 0}
              </div>

              <Separator className="my-2" />

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:gap-3">
                  <div className="grid gap-1.5 min-w-0 lg:flex-1 lg:min-w-[110px] lg:max-w-[160px]">
                    <Label className="text-xs sm:text-sm truncate" title="Prev Balance Box">Prev Balance</Label>
                    <Input type="number" value={prevBalanceBox} onChange={e => setPrevBalanceBox(e.target.value)} tabIndex={-1} className="h-11 font-medium lg:h-10" />
                  </div>
                  <div className="grid gap-1.5 min-w-0 lg:flex-1 lg:min-w-[110px] lg:max-w-[160px]">
                    <Label className="text-xs sm:text-sm truncate" title="Today's Fish Box">Today's Box</Label>
                    <Input
                      id="todays-fish-box-input"
                      ref={todaysFishBoxRef}
                      type="number"
                      value={localTfText}
                      onChange={(e) => setLocalTfText(e.target.value)}
                      onBlur={handleTfDirectEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          // Just open the Add Entry popup; do NOT auto-save
                          setEntryBoxes('');
                          setEntryEmptyBoxes('');
                          setEditingEntryId(null);
                          setIsEntryDialogOpen(true);
                        } else if (e.key === 'Tab') {
                          e.preventDefault();
                          handleTfDirectEdit();
                          emptyBoxRef.current?.focus();
                        }
                      }}
                      className="font-bold h-11 px-3 lg:h-10"
                      disabled={!selectedCustomerId || !date}
                    />
                    {selectedCustomerId && localTfText !== '' && (
                      <span className="text-[10px] text-muted-foreground italic pl-1 leading-none mt-1">Press Enter to Add an Entry</span>
                    )}
                  </div>
                  <div className="grid gap-1.5 min-w-0 lg:flex-1 lg:min-w-[110px] lg:max-w-[160px]">
                    <Label className="text-xs sm:text-sm truncate" title="Total Box">Total Box</Label>
                    <Input readOnly value={tb} className="bg-muted font-bold h-11 lg:h-10" tabIndex={-1} />
                  </div>
                  <div className="grid gap-1.5 min-w-0 lg:flex-1 lg:min-w-[110px] lg:max-w-[160px]">
                  <Label className="text-xs sm:text-sm truncate" title="Empty Box">Empty Box</Label>
                    <Input 
                      type="number" 
                      ref={emptyBoxRef} 
                      value={manualEmptyBox} 
                      onChange={e => setManualEmptyBox(e.target.value)}
                      onKeyDown={e => handleKeyDown(e, descriptionRef)}
                      className="h-11 lg:h-10"
                    />
                    {entryEmptyBoxTotal > 0 && (
                      <span className="text-[13px] font-bold italic text-muted-foreground pl-1 leading-none mt-1">
                        +{entryEmptyBoxTotal} from entries
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 grid gap-1.5 min-w-0 sm:col-span-1 lg:flex-1 lg:min-w-[110px] lg:max-w-[160px]">
                    <Label className="text-xs sm:text-sm truncate" title="Balance Box">Balance Box</Label>
                    <Input readOnly value={bb} className="bg-muted font-bold text-primary h-11 text-base lg:h-10 lg:text-sm" tabIndex={-1} />
                  </div>
                </div>
                <div className="flex justify-center sm:justify-start w-full mt-1">
                <Button variant="outline" onClick={handleSharePDF} disabled={!selectedCustomerId || isSavingAndPrinting} className="w-full min-h-[44px] border-green-500 text-green-700 hover:bg-green-50 px-6 sm:w-auto">
                <Share className="mr-2 h-4 w-4" /> {isSavingAndPrinting ? 'Preparing PDF...' : 'Share (PDF)'}
                  </Button>
                </div>
              </div>

              <Separator className="my-2" />

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Description</Label>
                  <textarea
                    ref={descriptionRef}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        driverMobileRef.current?.focus();
                      }
                    }}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Driver Mobile No</Label>
                    <Input ref={driverMobileRef} value={driverMobile} onChange={e => setDriverMobile(e.target.value)} onKeyDown={e => handleKeyDown(e, driverNameRef)} className="h-11 sm:h-10" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Driver Name</Label>
                    <Input ref={driverNameRef} value={driverName} onChange={e => setDriverName(e.target.value)} onKeyDown={e => handleKeyDown(e, vehicleNoRef)} className="h-11 sm:h-10" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Vehicle No</Label>
                    <Input ref={vehicleNoRef} value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} onKeyDown={e => handleKeyDown(e, saveBtnRef)} className="h-11 sm:h-10" />
                  </div>
                </div>
              </div>

              {/* Entries Panel - visible even before save (shows local entries) */}
              {(activeBillId || localEntries.length > 0) && (
                <div className="mt-4 border rounded-md overflow-hidden">
                  <div 
                    className="flex justify-between items-center p-3 bg-muted/50 cursor-pointer hover:bg-muted"
                    onClick={() => setIsEntriesPanelOpen(!isEntriesPanelOpen)}
                    tabIndex={-1}
                  >
                    <span className="font-semibold text-sm">Today's Box Entries</span>
                    {isEntriesPanelOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                  {isEntriesPanelOpen && (
                    <>
                    {/* Mobile: entries as cards (no horizontal scrolling) */}
                    <div className="border-t p-3 space-y-2 md:hidden">
                      {activeBillEntries.length > 0 ? activeBillEntries.map((entry) => {
                        const eDate = entry.entryDate?.toDate ? entry.entryDate.toDate() : new Date(entry.entryDate);
                        const creator = users.find(u => u.id === entry.createdBy);
                        return (
                          <div key={entry.id} className="rounded-lg border bg-card p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-sm">{format(eDate, 'hh:mm a')}</p>
                                <p className="truncate text-xs text-muted-foreground">{creator?.username || entry.createdBy}</p>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <Button tabIndex={-1} variant="ghost" size="icon" className="h-11 w-11" onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEntryId(entry.id);
                                  setEntryBoxes((entry.boxesAdded || 0).toString());
                                  setEntryEmptyBoxes(entry.emptyBoxesAdded ? entry.emptyBoxesAdded.toString() : '');
                                  setIsEntryDialogOpen(true);
                                }}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button tabIndex={-1} variant="ghost" size="icon" className="h-11 w-11 text-red-500" onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEntry(entry.id, entry.boxesAdded || 0, entry.emptyBoxesAdded || 0);
                                }}>
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 text-sm">
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Box Added</span>
                                <span className="font-bold text-green-600">{(entry.boxesAdded && entry.boxesAdded !== 0) ? entry.boxesAdded : '-'}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-muted-foreground">Empty Boxes</span>
                                <span className="font-bold text-orange-500">{entry.emptyBoxesAdded ? entry.emptyBoxesAdded : '-'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <p className="py-4 text-center text-sm text-muted-foreground">No entries yet.</p>
                      )}
                      {manualEmpty > 0 && !localEntries.some(e => e.isManualEmpty) && (
                        <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 dark:bg-amber-950/20">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs italic text-amber-600">Pending — Not saved</span>
                            <span className="font-bold text-orange-500">{manualEmpty}</span>
                          </div>
                        </div>
                      )}
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-bold">Total Added</span>
                          <span className="text-base font-bold text-green-600">{activeTotalAdded}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                          <span className="font-bold">Total Empty</span>
                          <span className="text-base font-bold text-orange-500">
                            {activeTotalEmptyAdded + ((!localEntries.some(e => e.isManualEmpty) && manualEmpty > 0) ? manualEmpty : 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden p-0 border-t overflow-x-auto md:block">
                      <Table className="text-sm w-full">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 py-1 px-2">Time</TableHead>
                            <TableHead className="h-8 py-1 px-2">User</TableHead>
                            <TableHead className="h-8 py-1 px-2 text-right">Box Added</TableHead>
                            <TableHead className="h-8 py-1 px-2 text-right">Empty Boxes</TableHead>
                            <TableHead className="h-8 py-1 px-2 w-[80px] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeBillEntries.length > 0 ? activeBillEntries.map((entry) => {
                            const eDate = entry.entryDate?.toDate ? entry.entryDate.toDate() : new Date(entry.entryDate);
                            const creator = users.find(u => u.id === entry.createdBy);
                            return (
                              <TableRow key={entry.id}>
                                <TableCell className="py-2 px-2">{format(eDate, 'hh:mm a')}</TableCell>
                                <TableCell className="py-2 px-2">{creator?.username || entry.createdBy}</TableCell>
                                <TableCell className="py-2 px-2 text-right font-bold text-green-600">
                                  {(entry.boxesAdded && entry.boxesAdded !== 0) ? entry.boxesAdded : '-'}
                                </TableCell>
                                <TableCell className="py-2 px-2 text-right font-bold text-orange-500">
                                  {entry.emptyBoxesAdded ? entry.emptyBoxesAdded : '-'}
                                </TableCell>
                                <TableCell className="py-2 px-2 text-right">
                                  <div className="flex justify-end gap-1">
                                     {/* Creator/Admin can edit any entry regardless of who created it. */}
                                    <Button tabIndex={-1} variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingEntryId(entry.id);
                                      setEntryBoxes((entry.boxesAdded || 0).toString());
                                      setEntryEmptyBoxes(entry.emptyBoxesAdded ? entry.emptyBoxesAdded.toString() : '');
                                      setIsEntryDialogOpen(true);
                                    }}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button tabIndex={-1} variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteEntry(entry.id, entry.boxesAdded || 0, entry.emptyBoxesAdded || 0);
                                    }}>
                                      <Trash className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          }) : (
                            <TableRow><TableCell colSpan={5} className="h-12 text-center text-muted-foreground">No entries yet.</TableCell></TableRow>
                          )}
                          {/* Virtual pending row for the manual empty box — shown before Save */}
                          {manualEmpty > 0 && !localEntries.some(e => e.isManualEmpty) && (
                            <TableRow className="bg-amber-50 dark:bg-amber-950/20">
                              <TableCell className="py-2 px-2 text-xs text-amber-600 italic">Pending</TableCell>
                              <TableCell className="py-2 px-2 text-xs text-amber-600 italic">—</TableCell>
                              <TableCell className="py-2 px-2 text-right text-amber-600 italic">—</TableCell>
                              <TableCell className="py-2 px-2 text-right font-bold text-orange-500">
                                {manualEmpty}
                              </TableCell>
                              <TableCell className="py-2 px-2 text-right text-xs text-amber-600 italic">Not saved</TableCell>
                            </TableRow>
                          )}
                          <TableRow className="bg-muted/50 border-t-2">
                            <TableCell colSpan={2} className="py-2 px-2 font-bold text-right">Total Added</TableCell>
                            <TableCell className="py-2 px-2 font-bold text-right text-green-600 text-base">{activeTotalAdded}</TableCell>
                            <TableCell className="py-2 px-2 font-bold text-right text-orange-500 text-base">
                              {activeTotalEmptyAdded + ((!localEntries.some(e => e.isManualEmpty) && manualEmpty > 0) ? manualEmpty : 0)}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
            
            <CardFooter className="flex flex-col items-stretch gap-2 border-t pt-4 sm:items-end">
            <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:justify-end">
                {/* Navigation arrows: own row on mobile, inline from sm up */}
                <div className="flex items-center justify-between gap-2 sm:contents">
                  <Button variant="outline" className="nav-btn nav-btn-mobile" onClick={goToFirstBillOfDay} disabled={sortedBills.length === 0 || isSaving} tabIndex={-1}>{"<<"}</Button>

                  <Button variant="outline" className="nav-btn nav-btn-mobile" onClick={handlePrevBill} disabled={sortedBills.length === 0 || currentBillIndex >= sortedBills.length - 1 || isSaving} tabIndex={-1}>{"<"}</Button>

                  <Button variant="outline" className="nav-btn nav-btn-mobile order-last" onClick={handleNextBill} disabled={currentBillIndex === -1 || isSaving} tabIndex={-1}>{">"}</Button>

                  <Button variant="outline" className="nav-btn nav-btn-mobile order-last" onClick={goToLastBillOfDay} disabled={sortedBills.length === 0 || isSaving} tabIndex={-1}>{">>"}</Button>
                </div>

                <Button ref={saveBtnRef} size="lg" className="btn-save w-full min-h-[44px] sm:w-auto sm:flex-none" onClick={handleSaveBill} disabled={!selectedCustomerId || isSaving}>
                  <Save className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Save Bill"}
                </Button>

                <Button ref={shareBtnRef} variant="outline" onClick={handleSharePDF} disabled={!selectedCustomerId || isSavingAndPrinting || isSaving} className="w-full min-h-[44px] border-green-500 text-green-700 hover:bg-green-50 sm:w-auto sm:order-3">
                  <Share className="mr-2 h-4 w-4" /> {isSavingAndPrinting ? 'Preparing PDF...' : 'Share (PDF)'}
                </Button>

                <Button ref={printBtnRef} onClick={() => handlePrintAction('thermal')} disabled={!selectedCustomerId || isSaving} className="w-full min-h-[44px] sm:w-auto sm:order-2">Print Receipt</Button>
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* Right Side: History Section */}
        <div className="flex flex-col w-full min-w-0 lg:h-full lg:overflow-hidden">
          <Card className="section-box flex flex-col lg:h-full lg:overflow-hidden">
            <CardHeader className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between pb-2">
              <div>
                <CardTitle className="font-headline text-lg sm:text-xl">Box Bill History</CardTitle>
                <CardDescription>View past bills. Double-click to load.</CardDescription>
              </div>
              {selectedBills.size > 0 && (currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN') && (
                <Button variant="destructive" onClick={handleDeleteSelected} className="w-full min-h-[44px] sm:w-auto">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedBills.size})
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 md:p-6 flex-1 lg:overflow-y-auto custom-scrollbar">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
                <div className="grid flex-1 gap-1.5 w-full">
                  <Label>Customer</Label>
                  <ReactSelect
                    instanceId="history-customer-select"
                    options={customerOptions}
                    value={customerOptions.find(o => o.value === historySelectedCustomer) || null}
                    onChange={(option) => setHistorySelectedCustomer(option ? option.value : '')}
                    isClearable
                    placeholder="Filter by customer..."
                    styles={reactSelectStyles}
                    menuPortalTarget={isMounted ? document.body : null}
                    menuPosition="fixed"
                  />
                </div>
                <div className="grid gap-1.5 w-full md:w-auto">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full md:w-[180px] justify-start h-[44px]">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {historyDate ? format(historyDate, 'dd-MM-yyyy') : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={historyDate} onSelect={setHistoryDate} />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button variant="ghost" className="h-[44px] w-full md:w-auto" onClick={() => { setHistoryDate(undefined); setHistorySelectedCustomer(''); }}>
                  <X className="mr-2 h-4 w-4" /> Clear
                </Button>
              </div>

              {/* Mobile Card List */}
              <div className="block md:hidden space-y-3">
                {filteredHistoryBills.length > 0 ? (
                  filteredHistoryBills.map((bill) => {
                    const bDate = bill.billDate?.toDate ? bill.billDate.toDate() : new Date(bill.billDate);
                    return (
                      <Card key={bill.id} className={cn("p-4 flex flex-col gap-2 relative cursor-pointer active:bg-muted/70", activeBillId === bill.id && "bg-muted")} onDoubleClick={() => { handleEditBill(bill.id); setIsEntriesPanelOpen(true); }}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-lg">{bill.id}</span>
                          {(currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN') && (
                            <Checkbox tabIndex={-1} checked={selectedBills.has(bill.id)} onCheckedChange={(checked) => {
                              const newSet = new Set(selectedBills);
                              if (checked) newSet.add(bill.id); else newSet.delete(bill.id);
                              setSelectedBills(newSet);
                            }} />
                          )}
                        </div>
                        <div className="text-sm space-y-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground text-xs">Customer</span>
                            <span className="font-medium whitespace-normal break-words">{bill.customerName}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="flex justify-between items-center"><span className="text-muted-foreground text-xs">Date</span><span className="font-medium">{format(bDate, 'dd-MM-yyyy')}</span></div>
                          <div className="flex justify-between items-center"><span className="text-muted-foreground text-xs">Prev Balance</span><span className="font-mono">{bill.prevBalanceBox}</span></div>
                          <div className="flex justify-between items-center"><span className="text-muted-foreground text-xs">Today's Box</span><span className="font-mono">{bill.todaysFishBox}</span></div>
                          <div className="flex justify-between items-center"><span className="text-muted-foreground text-xs">Empty Box</span><span className="font-mono">{bill.emptyBox}</span></div>
                          <div className="flex justify-between items-center"><span className="text-muted-foreground text-xs font-semibold">Balance Box</span><span className="font-mono font-bold text-primary text-base">{bill.balanceBox}</span></div>
                          <div className="flex justify-between items-center"><span className="text-muted-foreground text-xs">Entries</span>
                            <span className="font-mono">{boxBillEntries.filter(e => e.boxBillId === bill.id).length}</span>
                          </div>
                        </div>
                        <div className="flex justify-end mt-3 border-t pt-3">
                          <Button tabIndex={-1} variant="outline" size="sm" className="min-h-[44px] px-6 hover:bg-primary/10 text-primary" onClick={(e) => {
                            e.stopPropagation();
                            setManageEntriesBillId(bill.id);
                          }}>Manage</Button>
                        </div>
                      </Card>
                    );
                  })
                ) : <div className="p-8 text-center text-muted-foreground border rounded-lg bg-muted/20">No results found.</div>}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto rounded-md border">
                <Table className="w-full text-sm">
                  <TableHeader>
                    <TableRow>
                      {(currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN') && <TableHead className="w-10 px-2"></TableHead>}
                      <TableHead className="px-2">Bill No</TableHead>
                      <TableHead className="px-2">Date</TableHead>
                      <TableHead className="px-2">Customer</TableHead>
                      <TableHead className="px-2 text-right">Prev Bal</TableHead>
                      <TableHead className="px-2 text-right">Today's Box</TableHead>
                      <TableHead className="px-2 text-right">Empty</TableHead>
                      <TableHead className="px-2 text-right">Bal Box</TableHead>
                      <TableHead className="px-2 text-center">Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistoryBills.length > 0 ? (
                      filteredHistoryBills.map((bill) => {
                        const bDate = bill.billDate?.toDate ? bill.billDate.toDate() : new Date(bill.billDate);
                        return (
                          <TableRow key={bill.id} className={cn("cursor-pointer hover:bg-muted/50", activeBillId === bill.id && "bg-muted")} onDoubleClick={() => { handleEditBill(bill.id); setIsEntriesPanelOpen(true); }}>
                            {(currentUser?.role === 'CREATOR' || currentUser?.role === 'ADMIN') && (
                              <TableCell className="px-2"><Checkbox tabIndex={-1} checked={selectedBills.has(bill.id)} onCheckedChange={(checked) => {
                                const newSet = new Set(selectedBills);
                                if (checked) newSet.add(bill.id); else newSet.delete(bill.id);
                                setSelectedBills(newSet);
                              }} /></TableCell>
                            )}
                            <TableCell className="font-medium px-2">{bill.id}</TableCell>
                            <TableCell className="px-2 whitespace-nowrap">{format(bDate, 'dd-MM-yyyy')}</TableCell>
                            <TableCell className="px-2 truncate max-w-[120px]">{bill.customerName}</TableCell>
                            <TableCell className="px-2 text-right font-mono">{bill.prevBalanceBox}</TableCell>
                            <TableCell className="px-2 text-right font-mono">{bill.todaysFishBox}</TableCell>
                            <TableCell className="px-2 text-right font-mono">{bill.emptyBox}</TableCell>
                            <TableCell className="px-2 text-right font-mono font-bold text-primary">{bill.balanceBox}</TableCell>
                            <TableCell className="px-2 text-center">
                              <Button tabIndex={-1} variant="ghost" size="sm" className="h-8 text-xs font-semibold hover:bg-primary/10 text-primary" onClick={(e) => {
                                e.stopPropagation();
                                setManageEntriesBillId(bill.id);
                              }}>
                                Manage
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : <TableRow><TableCell colSpan={9} className="h-24 text-center">No results found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEntryDialogOpen} onOpenChange={(open) => {
        if (!open) { setEntryBoxes(''); setEntryEmptyBoxes(''); setEditingEntryId(null); }
        setIsEntryDialogOpen(open);
      }}>
        <DialogContent className="w-[95vw] max-w-[425px] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingEntryId ? 'Edit Box Entry' : 'Add Box Entry'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-4 sm:gap-4">
              <Label htmlFor="entry-boxes" className="sm:text-right">Box Added</Label>
              <Input
                id="entry-boxes"
                type="number"
                value={entryBoxes}
                onChange={(e) => setEntryBoxes(e.target.value)}
                className="h-11 font-bold sm:col-span-3 sm:h-10"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveEntry(); } }}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-4 sm:gap-4">
              <Label htmlFor="entry-empty" className="sm:text-right">Empty Boxes</Label>
              <Input
                id="entry-empty"
                type="number"
                placeholder="0"
                value={entryEmptyBoxes}
                onChange={(e) => setEntryEmptyBoxes(e.target.value)}
                className="h-11 sm:col-span-3 sm:h-10"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveEntry(); } }}
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setIsEntryDialogOpen(false)} className="w-full min-h-[44px] sm:w-auto">Cancel</Button>
            <Button ref={saveBtnInPopupRef} onClick={handleSaveEntry} className="w-full min-h-[44px] sm:w-auto">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!manageEntriesBillId} onOpenChange={(open) => !open && setManageEntriesBillId(null)}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Box Entries</DialogTitle>
            <DialogDescription>Review and delete individual entries.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="border rounded-md max-h-[60vh] overflow-y-auto overflow-x-auto sm:max-h-[400px]">
              <Table className="text-sm w-full relative min-w-[480px]">
                <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="py-2 px-3">Time</TableHead>
                    <TableHead className="py-2 px-3">User</TableHead>
                    <TableHead className="py-2 px-3 text-right">Box Added</TableHead>
                    <TableHead className="py-2 px-3 text-right">Empty Boxes</TableHead>
                    <TableHead className="py-2 px-3 w-[80px] text-right">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manageEntries.length > 0 ? manageEntries.map((entry) => {
                    const eDate = entry.entryDate?.toDate ? entry.entryDate.toDate() : new Date(entry.entryDate);
                    const creator = users.find(u => u.id === entry.createdBy);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="py-2 px-3">{format(eDate, 'hh:mm a')}</TableCell>
                        <TableCell className="py-2 px-3">{creator?.username || entry.createdBy}</TableCell>
                        <TableCell className="py-2 px-3 text-right font-bold text-green-600">{(entry.boxesAdded && entry.boxesAdded !== 0) ? entry.boxesAdded : '-'}</TableCell>
                        <TableCell className="py-2 px-3 text-right font-bold text-orange-500">{entry.emptyBoxesAdded ? entry.emptyBoxesAdded : '-'}</TableCell>
                        <TableCell className="py-2 px-3 text-right">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => handleDeleteEntry(entry.id, entry.boxesAdded || 0, entry.emptyBoxesAdded || 0, true)}>
                            <Trash className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={5} className="h-12 text-center text-muted-foreground">No entries found.</TableCell></TableRow>
                  )}
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={2} className="py-2 px-3 font-semibold text-right">Total Added</TableCell>
                    <TableCell className="py-2 px-3 font-bold text-right text-green-600">{manageTotalAdded > 0 ? manageTotalAdded : '-'}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/30 border-t-0">
                    <TableCell colSpan={2} className="py-2 px-3 font-semibold text-right">Total Empty Boxes</TableCell>
                    <TableCell className="py-2 px-3"></TableCell>
                    <TableCell className="py-2 px-3 font-bold text-right text-orange-500">{manageTotalEmptyAdded > 0 ? manageTotalEmptyAdded : '-'}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 w-full sm:flex-row sm:justify-between sm:items-center">
            <Button variant="destructive" onClick={handleDeleteAllEntries} className="w-full min-h-[44px] sm:w-auto">Delete All Entries</Button>
            <Button variant="outline" onClick={() => setManageEntriesBillId(null)} className="w-full min-h-[44px] sm:w-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showPrintConfirm} onOpenChange={setShowPrintConfirm}>
        <AlertDialogContent className="modal-overlay pointer-events-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Printing</AlertDialogTitle>
            <AlertDialogDescription>Do you want to save this bill before printing?</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              className={selectedIndex === 0 ? "ring-2 ring-primary ring-offset-2" : ""}
              onClick={() => handlePrintModalAction('save')}
              disabled={!selectedCustomerId || isSavingAndPrinting}
            >
              {isSavingAndPrinting ? "Saving & Printing..." : "Save & Print"}
            </Button>
            <Button
              variant="outline"
              className={selectedIndex === 1 ? "ring-2 ring-primary ring-offset-2" : ""}
              onClick={() => handlePrintModalAction('printWithoutSave')}
              disabled={isSavingAndPrinting}
            >
              Print Without Saving
            </Button>
            <Button
              variant="ghost"
              className={selectedIndex === 2 ? "ring-2 ring-primary ring-offset-2" : ""}
              onClick={() => handlePrintModalAction('cancel')}
              disabled={isSavingAndPrinting}
            >
              Cancel
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={navDialog.open} onOpenChange={(open) => { if (!open) setNavDialog({ open: false, targetId: '' }); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Bill</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unsaved bill in progress. What would you like to do?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={async () => {
              const success = await billingGuard.saveBillRef.current?.();
              if (success) {
                setNavDialog({ open: false, targetId: '' });
                if (navDialog.targetId === 'new') router.push('/dashboard/box-billing');
                else router.push(`/dashboard/box-billing?billId=${navDialog.targetId}`);
              }
            }} className="w-full">
              Save Bill & Continue
            </Button>
            <Button variant="secondary" onClick={() => {
              setNavDialog({ open: false, targetId: '' });
              if (navDialog.targetId === 'new') router.push('/dashboard/box-billing');
              else router.push(`/dashboard/box-billing?billId=${navDialog.targetId}`);
            }} className="w-full">
              Continue Without Saving
            </Button>
            <Button variant="outline" onClick={() => setNavDialog({ open: false, targetId: '' })} className="w-full">
              Cancel
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <style jsx global>{`
        .nav-btn {
          width: 40px;
          padding: 0;
          background-color: hsl(var(--foreground)) !important;
          color: hsl(var(--background)) !important;
          border: none !important;
        }
        .nav-btn:hover:not(:disabled) {
          background-color: var(--btn-save-bg) !important;
          color: white !important;
          opacity: 1;
        }
        .nav-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        /* Mobile: navigation arrows share one full-width row with 44px targets */
        .nav-btn-mobile {
          flex: 1 1 0%;
          height: 44px;
        }
        @media (min-width: 640px) {
          .nav-btn-mobile {
            flex: 0 0 auto;
            height: 2.5rem;
          }
        }
        .section-box {
          border: 2px solid hsl(var(--border));
          border-radius: 12px;
          padding: 16px;
          background-color: hsl(var(--card));
          box-shadow: 0 2px 4px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05);
          transition: border-color 0.2s ease-in-out;
        }
        .section-box:hover {
          border-color: hsl(var(--primary) / 0.5);
        }
      `}</style>
    </div>
  );
}
