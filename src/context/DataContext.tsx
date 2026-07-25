'use client';
import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Customer,
  Product,
  BillItem,
  LiveBillSummary,
  Payment,
  PartyPayment,
  User,
  Transaction,
  Uom,
  Vehicle,
  Driver,
  VehicleBill,
  CustomerBalance,
  Party,
  PartyBill,
  PartyBalance,
  SalesReportData,
  StatementPrintHistory,
  BoxBill,
  BoxBillEntry,
  PartyBoxBill,
  PartyBoxBillEntry,
  Role,
  Page,
  initialPermissions,
} from '@/lib/data';
import { isWithinInterval, startOfDay, endOfDay, startOfYesterday, endOfYesterday, format, isSameDay, parseISO } from 'date-fns';
import { useAuth, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch, getDoc, getDocs, query, where, Timestamp, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { FirestorePermissionError, errorEmitter } from '@/firebase';


type ProductPrices = Record<string, Record<string, number>>;
type CustomerBalances = Record<string, number>;
type LiveBillItems = Record<string, BillItem[]>; // Keyed by billNo

export interface DashboardStats {
  todaySales: number;
  salesChange: number;
  todayBills: number;
  billsChange: number;
  totalPendingBalance: number;
  todayPaymentsTotal: number;
  recentBills: LiveBillSummary[];
  topProducts: {
    productId: string;
    productName: string;
    totalQty: number;
    uom: string;
    percentage: number;
  }[];
  allProductsToday: {
    productId: string;
    productName: string;
    totalQty: number;
    uom: string;
  }[];
}

interface DataContextType {
  customers: Customer[];
  products: Product[];
  users: User[];
  uoms: Uom[];
  vehicles: Vehicle[];
  drivers: Driver[];
  parties: Party[];
  partyBills: PartyBill[];
  partyBalances: Record<string, number>;
  vehicleBills: VehicleBill[];
  liveBillSummaries: LiveBillSummary[];
  productPrices: ProductPrices;
  openingBalances: CustomerBalances;
  customerBalances: CustomerBalances;
  payments: Payment[];
  partyPayments: PartyPayment[];
  currentUser: User | null;
  isCurrentUserAdmin: boolean;
  liveBillItems: LiveBillItems;
  dashboardStats: DashboardStats;
  logout: () => void;
  addCustomer: (customer: Omit<Customer, 'id'> & { id?: string, openingBalance?: number }) => void;
  editCustomer: (oldId: string, newData: Omit<Customer, 'id'> & { id: string }) => Promise<void>;
  deleteCustomer: (customerId: string) => Promise<void>;
  addProduct: (product: Omit<Product, 'id'> & { id?: string }) => void;
  editProduct: (oldId: string, newData: Omit<Product, 'id' | 'uom_allowed'> & { id: string; uom_allowed: string[] }) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  addUser: (user: Omit<User, 'id' | 'status'> & { password?: string }) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  promoteUser: (userId: string, username: string, role: 'ADMIN' | 'CREATOR' | 'MANAGER' | 'BOX') => void;
  updateUserProfile: (userId: string, data: Partial<Omit<User, 'id'>>) => Promise<void>;
  addUom: (uom: Uom) => void;
  addVehicle: (vehicle: Omit<Vehicle, 'active'|'createdAt'|'updatedAt'>) => void;
  editVehicle: (vehicleId: string, data: Partial<Omit<Vehicle, 'id'>>) => void;
  deleteVehicle: (vehicleId: string) => Promise<void>;
  addParty: (party: Omit<Party, 'id' | 'active'|'createdAt'|'updatedAt'> & { id?: string }) => void;
  editParty: (partyId: string, data: Partial<Omit<Party, 'id'>>) => void;
  deleteParty: (partyId: string) => Promise<void>;
  addOrUpdateVehicleBill: (bill: Omit<VehicleBill, 'id' | 'createdBy'|'createdAt'|'updatedAt'>, existingBillId?: string) => Promise<VehicleBill | null>;
  deleteVehicleBill: (billId: string) => Promise<void>;
  addOrUpdatePartyBill: (bill: Omit<PartyBill, 'id' | 'createdBy'|'createdAt'|'updatedAt'>, existingBillId?: string | null) => Promise<PartyBill | null>;
  deletePartyBill: (bill: PartyBill) => Promise<void>;
  setOpeningBalance: (customerId: string, balance: number) => void;
  setPartyBalance: (partyId: string, balance: number) => void;
  createOrUpdateLiveBill: (
    summary: Omit<LiveBillSummary, 'billNo' | 'amount' | 'deliveryCharge' | 'paidAmount' | 'date' | 'createdBy' | 'stall' | 'finalBalance' | 'prevBalance'> & { prevBalance?: number },
    items: BillItem[],
    paidAmount: number,
    deliveryCharge: number,
    date: Date,
    existingBillNo?: string | null,
    finalBalance?: number
  ) => { billNo: string; commitPromise: Promise<void> };
  deleteBills: (billNos: string[]) => Promise<void>;
  updateProductPrice: (productId: string, uom: string, price: number) => void;
  // Customer-specific pricing
  // customerProductPrices[customerId][productId][uom] = price
  customerProductPrices: Record<string, Record<string, Record<string, number>>>;
  setCustomerProductPrice: (customerId: string, productId: string, uom: string, price: number) => Promise<void>;
  getCustomerProductPrice: (customerId: string, productId: string, uom: string) => number | undefined;
  addPayment: (payment: Omit<Payment, 'id' | 'date'> & { date?: Date }) => void;
  updatePayment: (paymentId: string, data: { amount: number; notes?: string; paymentMode?: string; date?: Date }) => Promise<void>;
  softDeletePayment: (paymentId: string) => Promise<void>;
  updateBillPayment: (billNo: string, amountToAdd: number, notes?: string) => Promise<void>;
  addPartyPayment: (payment: Omit<PartyPayment, 'id' | 'date'> & { date?: Date }) => void;
  updatePartyPayment: (paymentId: string, data: { amount: number; notes?: string; paymentMode?: "Cash" | "ACC" | "UPI" | "Bill Payment", date?: Date }) => Promise<void>;
  softDeletePartyPayment: (paymentId: string) => Promise<void>;
  findBillForCustomerToday: (customerId: string) => LiveBillSummary | undefined;
  findBillForCustomerOnDate: (customerId: string, date: Date) => LiveBillSummary | undefined;
  getBill: (billNo: string) => LiveBillSummary | undefined;
  getCustomerLedger: (
    customerId: string, 
    dateRange: { from: Date, to: Date }
  ) => { transactions: Transaction[], openingBalance: number };
  getSalesReport: (
    customerId: string,
    dateRange: { from: Date; to: Date }
  ) => Promise<SalesReportData | null>;
  addDriver: (driver: Omit<Driver, 'id' | 'active'|'createdAt'|'updatedAt'>) => void;
  editDriver: (driverId: string, data: Partial<Driver>) => void;
  deleteDriver: (driverId: string) => Promise<void>;
  statementPrintHistory: StatementPrintHistory[];
  addStatementPrintHistory: (record: Omit<StatementPrintHistory, 'id' | 'printedAt'>) => Promise<void>;
  getStatementPrintHistoryForCustomer: (customerId: string) => StatementPrintHistory[];
  deleteStatementPrintHistory: (recordId: string) => Promise<void>;
  // Box Billing
  boxBills: BoxBill[];
  openingBoxBalances: Record<string, number>; // keyed by customerId
  customerBoxBalances: Record<string, number>; // keyed by customerId, running total
  setOpeningBoxBalance: (customerId: string, balance: number) => Promise<void>;
  addOrUpdateBoxBill: (bill: Omit<BoxBill, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>, existingBillId?: string | null) => Promise<BoxBill | null>;
  deleteBoxBills: (billIds: string[]) => Promise<void>;
  recalculateFutureBoxBalances: (customerId: string, skipBillIds?: string[]) => Promise<void>;
  findBoxBillForCustomerOnDate: (customerId: string, date: Date) => BoxBill | undefined;
  getBoxBill: (billId: string) => BoxBill | undefined;

  boxBillEntries: BoxBillEntry[];
  partyBoxBills: PartyBoxBill[];
  partyOpeningBoxBalances: Record<string, number>; 
  partyBoxBalances: Record<string, number>; 

  setPartyOpeningBoxBalance: (partyId: string, balance: number) => Promise<void>;
  addOrUpdatePartyBoxBill: (bill: Omit<PartyBoxBill, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>, existingBillId?: string | null) => Promise<PartyBoxBill | null>;
  deletePartyBoxBills: (billIds: string[]) => Promise<void>;
  recalculateFuturePartyBoxBalances: (partyId: string, skipBillIds?: string[]) => Promise<void>;
  findPartyBoxBillForPartyOnDate: (partyId: string, date: Date) => PartyBoxBill | undefined;
  getPartyBoxBill: (billId: string) => PartyBoxBill | undefined;

  partyBoxBillEntries: PartyBoxBillEntry[];
  addPartyBoxBillEntry: (entry: Omit<PartyBoxBillEntry, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<PartyBoxBillEntry | null>;
  updatePartyBoxBillEntry: (entryId: string, boxesAdded: number) => Promise<void>;
  deletePartyBoxBillEntry: (entryId: string) => Promise<void>;

  addBoxBillEntry: (entry: Omit<BoxBillEntry, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<BoxBillEntry | null>;
  updateBoxBillEntry: (entryId: string, boxesAdded: number) => Promise<void>;
  deleteBoxBillEntry: (entryId: string) => Promise<void>;
  rolePermissions: Record<Role, Page[]>;
  updateRolePermissions: (permissions: Record<Role, Page[]>) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user: firebaseUser, isUserLoading } = useUser();

  const customersCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'customers') : null, [firestore, firebaseUser]);
  const { data: customersData } = useCollection<Customer>(customersCollection);
  const customers = useMemo(() => customersData || [], [customersData]);

  const productsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'products') : null, [firestore, firebaseUser]);
  const { data: productsData } = useCollection<Product>(productsCollection);
  const products = useMemo(() => productsData || [], [productsData]);
  
  const usersCollection = useMemoFirebase(() => {
    if (!firestore || !firebaseUser) return null;
    return collection(firestore, 'users');
  }, [firestore, firebaseUser]);
  const { data: usersData, isLoading: isUsersLoading } = useCollection<User>(usersCollection);
  const users = useMemo(() => usersData || [], [usersData]);

  const uomsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'uoms') : null, [firestore, firebaseUser]);
  const { data: uomsData } = useCollection<{name: string}>(uomsCollection);
  const uoms = useMemo(() => uomsData ? uomsData.map(u => u.name) : [], [uomsData]);
  
  const vehiclesCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'vehicles') : null, [firestore, firebaseUser]);
  const { data: vehiclesData } = useCollection<Vehicle>(vehiclesCollection);
  const vehicles = useMemo(() => vehiclesData || [], [vehiclesData]);

  const driversCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'drivers') : null, [firestore, firebaseUser]);
  const { data: driversData } = useCollection<Driver>(driversCollection);
  const drivers = useMemo(() => driversData || [], [driversData]);

  const partiesCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'parties') : null, [firestore, firebaseUser]);
  const { data: partiesData } = useCollection<Party>(partiesCollection);
  const parties = useMemo(() => partiesData || [], [partiesData]);

  const vehicleBillsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'vehicleBills') : null, [firestore, firebaseUser]);
  const { data: vehicleBillsData } = useCollection<VehicleBill>(vehicleBillsCollection);
  const vehicleBills = useMemo(() => vehicleBillsData || [], [vehicleBillsData]);

  const partyBillsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'partyBills') : null, [firestore, firebaseUser]);
  const { data: partyBillsData } = useCollection<PartyBill>(partyBillsCollection);
  const partyBills = useMemo(() => partyBillsData || [], [partyBillsData]);


  const billsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'bills') : null, [firestore, firebaseUser]);
  const { data: liveBillSummariesData } = useCollection<LiveBillSummary>(billsCollection);
  const liveBillSummaries = useMemo(() => liveBillSummariesData || [], [liveBillSummariesData]);


  const paymentsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'payments') : null, [firestore, firebaseUser]);
  const { data: paymentsData } = useCollection<Payment>(paymentsCollection);
  const payments = useMemo(() => paymentsData || [], [paymentsData]);

  const partyPaymentsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'partyPayments') : null, [firestore, firebaseUser]);
  const { data: partyPaymentsData } = useCollection<PartyPayment>(partyPaymentsCollection);
  const partyPayments = useMemo(() => partyPaymentsData || [], [partyPaymentsData]);

  const statementPrintHistoryCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'statementPrintHistory') : null, [firestore, firebaseUser]);
  const { data: statementPrintHistoryData } = useCollection<StatementPrintHistory>(statementPrintHistoryCollection);
  const statementPrintHistory = useMemo(() => statementPrintHistoryData || [], [statementPrintHistoryData]);

  const boxBillsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'box_bills') : null, [firestore, firebaseUser]);
  const { data: boxBillsData } = useCollection<BoxBill>(boxBillsCollection);
  const boxBills = useMemo(() => boxBillsData || [], [boxBillsData]);

  const boxBillEntriesCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'box_bill_entries') : null, [firestore, firebaseUser]);
  const { data: boxBillEntriesData } = useCollection<BoxBillEntry>(boxBillEntriesCollection);
  const boxBillEntries = useMemo(() => boxBillEntriesData || [], [boxBillEntriesData]);

   // ── Party Box Bills ──────────────────────────────────────────────────────
   const partyBoxBillsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'party_box_bills') : null, [firestore, firebaseUser]);
   const { data: partyBoxBillsData } = useCollection<PartyBoxBill>(partyBoxBillsCollection);
   const partyBoxBills = useMemo(() => partyBoxBillsData || [], [partyBoxBillsData]);
 
   const partyBoxBillEntriesCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'party_box_bill_entries') : null, [firestore, firebaseUser]);
   const { data: partyBoxBillEntriesData } = useCollection<PartyBoxBillEntry>(partyBoxBillEntriesCollection);
   const partyBoxBillEntries = useMemo(() => partyBoxBillEntriesData || [], [partyBoxBillEntriesData]);
 
   const { data: partyBoxBalancesData } = useCollection<{ partyId: string; balanceAmount: number }>(useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'partyBoxBalances') : null, [firestore, firebaseUser]));
   const partyOpeningBoxBalances = useMemo(() => {
     if (!partyBoxBalancesData) return {};
     return partyBoxBalancesData.reduce((acc, cb) => {
       acc[cb.partyId] = cb.balanceAmount;
       return acc;
     }, {} as Record<string, number>);
   }, [partyBoxBalancesData]);
 
   const partyBoxBalances = useMemo(() => {
     const balances: Record<string, number> = {};
     parties.forEach(p => { balances[p.id] = partyOpeningBoxBalances[p.id] || 0; });
     const billsByParty: Record<string, PartyBoxBill[]> = {};
     partyBoxBills.forEach(b => {
       if (!billsByParty[b.partyId]) billsByParty[b.partyId] = [];
       billsByParty[b.partyId].push(b);
     });
     Object.keys(billsByParty).forEach(partyId => {
       const bills = billsByParty[partyId];
       bills.sort((a, b) => {
         const dateA = a.billDate?.toDate ? a.billDate.toDate() : new Date(a.billDate);
         const dateB = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
         return dateB.getTime() - dateA.getTime();
       });
       if (bills.length > 0) balances[partyId] = bills[0].balanceBox;
     });
     return balances;
   }, [parties, partyOpeningBoxBalances, partyBoxBills]);
 

  // Opening box balances: keyed by customerId, stored in `customerBoxBalances` collection
  const { data: boxBalancesData } = useCollection<{ customerId: string; balanceAmount: number }>(useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'customerBoxBalances') : null, [firestore, firebaseUser]));
  const openingBoxBalances = useMemo(() => {
    if (!boxBalancesData) return {};
    return boxBalancesData.reduce((acc, cb) => {
      acc[cb.customerId] = cb.balanceAmount;
      return acc;
    }, {} as Record<string, number>);
  }, [boxBalancesData]);

  const customerBoxBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    customers.forEach(c => {
      balances[c.id] = openingBoxBalances[c.id] || 0;
    });

    const billsByCustomer: Record<string, BoxBill[]> = {};
    boxBills.forEach(b => {
      if (!billsByCustomer[b.customerId]) billsByCustomer[b.customerId] = [];
      billsByCustomer[b.customerId].push(b);
    });

    Object.keys(billsByCustomer).forEach(customerId => {
      const bills = billsByCustomer[customerId];
      bills.sort((a, b) => {
        const dateA = a.billDate?.toDate ? a.billDate.toDate() : new Date(a.billDate);
        const dateB = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
        return dateB.getTime() - dateA.getTime();
      });
      if (bills.length > 0) {
        balances[customerId] = bills[0].balanceBox;
      }
    });

    return balances;
  }, [customers, openingBoxBalances, boxBills]);

  const [rolePermissions, setRolePermissions] = useState<Record<Role, Page[]>>(initialPermissions);

  useEffect(() => {
    if (!firestore || !firebaseUser) return;
    const unsub = onSnapshot(doc(firestore, 'settings', 'permissions'), (docSnap) => {
        if (docSnap.exists()) {
            setRolePermissions(docSnap.data() as Record<Role, Page[]>);
        } else {
            setRolePermissions(initialPermissions);
        }
    });
    return () => unsub();
  }, [firestore, firebaseUser]);
  
  const [liveBillItems, setLiveBillItems] = useState<LiveBillItems>({});
  
  const { data: pricesData } = useCollection<any>(useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'productPrices') : null, [firestore, firebaseUser]));
  const productPrices = useMemo(() => {
    if (!pricesData) return {};
    return pricesData.reduce((acc, price) => {
        if (!acc[price.productId]) {
            acc[price.productId] = {};
        }
        acc[price.productId][price.uom] = price.pricePerUom;
        return acc;
    }, {} as ProductPrices);
  }, [pricesData]);

  // ── Customer-specific product prices ─────────────────────────────────────
  const { data: custPricesData } = useCollection<any>(
    useMemoFirebase(
      () => firestore && firebaseUser ? collection(firestore, 'customer_product_prices') : null,
      [firestore, firebaseUser]
    )
  );
  // Nested map: customerId → productId → uom → price
  const customerProductPrices = useMemo(() => {
    if (!custPricesData) return {};
    return custPricesData.reduce((acc, rec) => {
      const { customerId, productId, uom, pricePerUom } = rec;
      if (!acc[customerId]) acc[customerId] = {};
      if (!acc[customerId][productId]) acc[customerId][productId] = {};
      acc[customerId][productId][uom] = pricePerUom;
      return acc;
    }, {} as Record<string, Record<string, Record<string, number>>>);
  }, [custPricesData]);

  const setCustomerProductPrice = useCallback(async (
    customerId: string,
    productId: string,
    uom: string,
    price: number
  ) => {
    if (!firestore) return;
    // Doc ID is deterministic so upsert is idempotent
    const priceId = `${customerId}_${productId}_${uom}`;
    const priceRef = doc(firestore, 'customer_product_prices', priceId);
    const payload = {
      customerId,
      productId,
      uom,
      pricePerUom: price,
      updatedAt: serverTimestamp(),
    };
    await setDoc(priceRef, payload, { merge: true }).catch((e) => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({ operation: 'write', path: priceRef.path, requestResourceData: payload })
      );
      throw e;
    });
  }, [firestore]);

  const getCustomerProductPrice = useCallback((
    customerId: string,
    productId: string,
    uom: string
  ): number | undefined => {
    return customerProductPrices[customerId]?.[productId]?.[uom];
  }, [customerProductPrices]);

  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    todaySales: 0,
    salesChange: 0,
    todayBills: 0,
    billsChange: 0,
    totalPendingBalance: 0,
    todayPaymentsTotal: 0,
    recentBills: [],
    topProducts: [],
    allProductsToday: [],
  });

  const currentUser = useMemo(() => {
    if (isUserLoading || !firebaseUser || isUsersLoading) return null;
    return users.find(u => u.id === firebaseUser.uid) || null;
  }, [firebaseUser, isUserLoading, users, isUsersLoading]);
  
  const isCurrentUserAdmin = useMemo(() => {
      if (!currentUser) return false;
      return currentUser.role === 'ADMIN' || currentUser.role === 'CREATOR';
  }, [currentUser]);


  useEffect(() => {
    const handleFirstSignIn = async () => {
      if (!firestore || !firebaseUser || isUserLoading || isUsersLoading) return;
      
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        const username = firebaseUser.email?.split('@')[0] || 'new-user';
        
        const newUser: User = {
          id: firebaseUser.uid,
          username,
          role: 'MANAGER',
          status: 'Active',
        };

        try {
            await setDoc(userDocRef, newUser);
        } catch (error) {
            console.error("Failed to create initial user profile:", error);
        }
      }
    };

    if (!isUserLoading && firebaseUser && !isUsersLoading) {
      handleFirstSignIn();
    }
  }, [firebaseUser, isUserLoading, isUsersLoading, firestore]);

  const { data: customerBalancesData } = useCollection<CustomerBalance>(useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'customerBalances') : null, [firestore, firebaseUser]));

  const openingBalances = useMemo(() => {
    if (!customerBalancesData) return {};
    return customerBalancesData.reduce((acc, cb) => {
        acc[cb.customerId] = cb.balanceAmount;
        return acc;
    }, {} as CustomerBalances);
  }, [customerBalancesData]);

  const customerBalances = useMemo(() => {
    const balances: CustomerBalances = {};
    
    customers.forEach(c => {
        balances[c.id] = Number((openingBalances[c.id] || 0).toFixed(2));
    });

    const allTransactions: {customerId: string, amount: number, type: 'bill' | 'payment', date: Date | Timestamp}[] = [
        ...(liveBillSummaries || []).filter(b => b.amount > 0).map(bill => ({
            customerId: bill.customerId,
            amount: bill.amount,
            type: 'bill' as const,
            date: bill.date || new Date(0)
        })),
        ...(payments || []).filter(payment => !payment.isDeleted).map(payment => ({
            customerId: payment.customerId,
            amount: payment.amount,
            type: 'payment' as const,
            date: payment.date
        }))
    ].sort((a, b) => {
        const dateA = a.date instanceof Timestamp ? a.date.toMillis() : new Date(a.date).getTime();
        const dateB = b.date instanceof Timestamp ? b.date.toMillis() : new Date(b.date).getTime();
        return dateA - dateB;
    });

    allTransactions.forEach(tx => {
        if (tx.customerId && typeof balances[tx.customerId] !== 'undefined') {
            if (tx.type === 'bill') {
                balances[tx.customerId] += tx.amount;
            } else {
                balances[tx.customerId] -= tx.amount;
            }
            // Normalize after each transaction to fix floating point errors
            balances[tx.customerId] = Number(balances[tx.customerId].toFixed(2));
        }
    });
    
    return balances;
  }, [customers, liveBillSummaries, payments, openingBalances]);

  const { data: partyBalancesData } = useCollection<PartyBalance>(useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'partyBalances') : null, [firestore, firebaseUser]));
  
  const partyBalances = useMemo(() => {
    if (!partyBalancesData) return {};
    return partyBalancesData.reduce((acc, cb) => {
        acc[cb.partyId] = cb.balanceAmount;
        return acc;
    }, {} as Record<string, number>);
  }, [partyBalancesData]);
  
  useEffect(() => {
    if (isUserLoading || !firestore || !products.length) return;

    const calculateStats = async () => {
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      const yesterdayStart = startOfYesterday();
      const yesterdayEnd = endOfYesterday();

      const todayBillsList = (liveBillSummaries || []).filter(bill => {
          const billDate = bill.date ? (bill.date as Timestamp).toDate() : null;
          return billDate && billDate >= todayStart && billDate <= todayEnd && bill.amount > 0;
      });

      const yesterdayBillsList = (liveBillSummaries || []).filter(bill => {
          const billDate = bill.date ? (bill.date as Timestamp).toDate() : null;
          return billDate && billDate >= yesterdayStart && billDate <= yesterdayEnd && bill.amount > 0;
      });

      // Sales and Bills stats
      const todaySales = todayBillsList.reduce((sum, bill) => sum + bill.amount, 0);
      const yesterdaySales = yesterdayBillsList.reduce((sum, bill) => sum + bill.amount, 0);
      const salesChange = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : todaySales > 0 ? 100 : 0;
      
      const todayBillsCount = todayBillsList.length;
      const yesterdayBillsCount = yesterdayBillsList.length;
      const billsChange = yesterdayBillsCount > 0 ? todayBillsCount - yesterdayBillsCount : todayBillsCount;
      
      // Balance stats
      const totalPendingBalance = Object.values(customerBalances).reduce((sum, bal) => sum + bal, 0);

      // Today's Payments total from payments collection
      const todayPaymentsList = (payments || []).filter(payment => {
        if (payment.isDeleted) return false;
        const paymentDate = payment.date instanceof Timestamp ? payment.date.toDate() : new Date(payment.date);
        return paymentDate >= todayStart && paymentDate <= todayEnd;
      });
      const todayPaymentsTotal = todayPaymentsList.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      // Recent Bills
      const recentBills = todayBillsList.sort((a,b) => (b.date as Timestamp).toMillis() - (a.date as Timestamp).toMillis()).slice(0, 5);

      // Top Products
      let topProducts: DashboardStats['topProducts'] = [];
      let allProductsToday: DashboardStats['allProductsToday'] = [];
      if (todayBillsList.length > 0) {
          const billItemsPromises = todayBillsList.map(bill => 
              getDocs(collection(firestore, 'bills', bill.billNo, 'billItems'))
          );
          const billItemsSnapshots = await Promise.all(billItemsPromises);
          
          const todaysItems: BillItem[] = [];
          billItemsSnapshots.forEach(snapshot => {
              snapshot.forEach(doc => {
                  todaysItems.push(doc.data() as BillItem);
              });
          });

          const productSales = new Map<string, { totalQty: number, uom: string, name: string }>();
          todaysItems.forEach(item => {
              const existing = productSales.get(item.productId);
              const productInfo = products.find(p => p.id === item.productId);
              if (productInfo) {
                  productSales.set(item.productId, {
                      totalQty: (existing?.totalQty || 0) + item.qty,
                      uom: item.uom,
                      name: productInfo.name_ta,
                  });
              }
          });

          const allSortedProducts = [...productSales.entries()]
              .sort(([, a], [, b]) => b.totalQty - a.totalQty);

          const top5Products = allSortedProducts.slice(0, 5);
          const maxQty = top5Products[0]?.[1].totalQty || 1;

          topProducts = top5Products.map(([productId, data]) => ({
              productId,
              productName: data.name,
              totalQty: data.totalQty,
              uom: data.uom,
              percentage: (data.totalQty / maxQty) * 100,
          }));

          allProductsToday = allSortedProducts.map(([productId, data]) => ({
            productId,
            productName: data.name,
            totalQty: data.totalQty,
            uom: data.uom,
        }));
      }

      setDashboardStats({
          todaySales,
          salesChange,
          todayBills: todayBillsCount,
          billsChange,
          totalPendingBalance,
          todayPaymentsTotal,
          recentBills,
          topProducts,
          allProductsToday
      });
    };

    calculateStats();

  }, [liveBillSummaries, customerBalances, payments, firestore, products, isUserLoading]);
  
  
  const logout = () => {
    if (auth) {
      signOut(auth);
    }
  };

  const addCustomer = async (customer: Omit<Customer, 'id'|'createdAt'|'updatedAt'|'active'> & { id?: string, openingBalance?: number }) => {
    if (!firestore) return;
    let newId = customer.id;
    if (!newId) {
      const maxId = customers
        .map(c => parseInt(c.id.replace('C', ''), 10))
        .filter(num => !isNaN(num))
        .reduce((max, num) => Math.max(max, num), 0);
      newId = `C${(maxId + 1).toString().padStart(3, '0')}`;
    }
    
    const customerRef = doc(firestore, 'customers', newId);
    const balanceRef = doc(firestore, 'customerBalances', newId);
    const newCustomerData = {
      id: newId,
      name_en: customer.name_en,
      name_ta: customer.name_ta,
      phone: customer.phone,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      active: true,
    };
    const balanceData = {
        customerId: newId,
        balanceAmount: Number((customer.openingBalance || 0).toFixed(2)),
        updatedAt: serverTimestamp(),
    };

    const batch = writeBatch(firestore);
    batch.set(customerRef, newCustomerData);
    batch.set(balanceRef, balanceData);

    batch.commit().then(() => {
        toast({ title: "Customer Added", description: `Customer ${newCustomerData.name_en} added.` });
    }).catch(error => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'write', path: customerRef.path, requestResourceData: newCustomerData }));
    });
  };

  const editCustomer = async (oldId: string, newData: Omit<Customer, 'id'> & { id: string }) => {
    if (!firestore) return;

    const newId = newData.id;

    if (oldId === newId) {
        const customerRef = doc(firestore, 'customers', oldId);
        const updateData = { ...newData, updatedAt: serverTimestamp() };
        updateDoc(customerRef, updateData).catch(e => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: customerRef.path, requestResourceData: updateData }));
        });
        return;
    }

    const newCustomerRef = doc(firestore, 'customers', newId);
    const oldCustomerRef = doc(firestore, 'customers', oldId);
    const oldBalanceRef = doc(firestore, 'customerBalances', oldId);
    const newBalanceRef = doc(firestore, 'customerBalances', newId);

    const batch = writeBatch(firestore);
    const newCustomerData = { ...newData, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), active: true };
    batch.set(newCustomerRef, newCustomerData);
    
    const oldBalanceSnap = await getDoc(oldBalanceRef);
    if (oldBalanceSnap.exists()) {
        batch.set(newBalanceRef, { ...oldBalanceSnap.data(), customerId: newId });
        batch.delete(oldBalanceRef);
    }
    
    const billsQuery = query(collection(firestore, 'bills'), where('customerId', '==', oldId));
    const billsSnap = await getDocs(billsQuery);
    billsSnap.forEach(billDoc => {
        batch.update(billDoc.ref, { customerId: newId });
    });

    const paymentsQuery = query(collection(firestore, 'payments'), where('customerId', '==', oldId));
    const paymentsSnap = await getDocs(paymentsQuery);
    paymentsSnap.forEach(paymentDoc => {
        batch.update(paymentDoc.ref, { customerId: newId });
    });

    batch.delete(oldCustomerRef);

    batch.commit().then(() => {
        toast({ title: 'Customer Updated', description: `Customer ID changed from ${oldId} to ${newId}.`});
    }).catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'write', path: newCustomerRef.path, requestResourceData: newCustomerData }));
    });
  };
  
  const deleteCustomer = async (customerId: string) => {
    if (!firestore) return;
    const customerRef = doc(firestore, 'customers', customerId);
    deleteDoc(customerRef).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: customerRef.path }));
    });
  };

  const addProduct = async (product: Omit<Product, 'id'|'createdAt'|'updatedAt'|'active'> & { id?: string }) => {
     if (!firestore) return;
      let newId = product.id;
      if (!newId) {
        const maxId = products
          .map(p => parseInt(p.id.replace('P', ''), 10))
          .filter(num => !isNaN(num))
          .reduce((max, num) => Math.max(max, num), 0);
        newId = `P${(maxId + 1).toString().padStart(2, '0')}`;
      }

      const productRef = doc(firestore, 'products', newId);
      const newProductData = {
        ...product,
        id: newId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        active: true,
      };
      setDoc(productRef, newProductData).then(() => {
        toast({ title: 'Product Added' });
      }).catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'create', path: productRef.path, requestResourceData: newProductData }));
      });
  };
  
  const editProduct = async (oldId: string, newData: Omit<Product, 'id' | 'uom_allowed'> & { id: string; uom_allowed: string[] }) => {
    if (!firestore) return;

    const newId = newData.id;

    if (oldId === newId) {
        const productRef = doc(firestore, 'products', oldId);
        const updatedData = { ...newData, updatedAt: serverTimestamp() };
        updateDoc(productRef, updatedData).catch(e => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: productRef.path, requestResourceData: updatedData }));
        });
        return;
    }
    
    const newProductRef = doc(firestore, 'products', newId);
    const oldProductRef = doc(firestore, 'products', oldId);

    const batch = writeBatch(firestore);
    const newProductData = { ...newData, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), active: true };
    batch.set(newProductRef, newProductData);
    batch.delete(oldProductRef);

    batch.commit().then(() => {
        toast({ title: 'Product Updated', description: `Product ID changed from ${oldId} to ${newId}.`});
    }).catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'write', path: newProductRef.path, requestResourceData: newProductData }));
    });
  };
  
  const deleteProduct = async (productId: string) => {
    if (!firestore) return;
    const productRef = doc(firestore, 'products', productId);
    deleteDoc(productRef).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: productRef.path }));
    });
  };

  const addUser = async (user: Omit<User, 'id' | 'status'> & { password?: string }) => {
    if (!auth || !firestore || !currentUser) {
      toast({ variant: 'destructive', title: 'Action not allowed', description: 'Services not available or you are not logged in.' });
      return;
    }
  
    if (!isCurrentUserAdmin) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to add new users.' });
      return;
    }
  
    if (!user.password) {
      toast({ variant: 'destructive', title: 'Password Required', description: 'A password must be provided.' });
      return;
    }
  
    if (user.role !== 'MANAGER' && user.role !== 'BOX') {
      toast({
          variant: 'destructive',
          title: 'Invalid Role',
          description: 'New users can only be created with the MANAGER or BOX role. Promote them to Admin/Creator after creation.',
      });
      return;
  }

    try {
      const email = `${user.username.toLowerCase()}@mcandsons.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, user.password);
      
      const newUser: User = {
        id: userCredential.user.uid,
        username: user.username,
        role: user.role,
        status: 'Active'
      };
  
      const userRef = doc(firestore, 'users', newUser.id);
      await setDoc(userRef, newUser);

      toast({ title: 'User Created', description: `User ${user.username} created. You have been logged out and need to sign in again.`, duration: 10000 });
      await signOut(auth);

    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast({ variant: 'destructive', title: 'User Exists', description: 'A user with this username already exists.' });
      } else {
        toast({ variant: 'destructive', title: 'Failed to create user', description: error.message });
      }
    }
  };

  const deleteUser = async (userId: string) => {
    if (!firestore || !currentUser) return;
    if (!isCurrentUserAdmin) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to delete users.'});
      return;
    }
    if (currentUser.id === userId) {
      toast({ variant: 'destructive', title: 'Action Not Allowed', description: 'You cannot delete your own account.'});
      return;
    }

    const batch = writeBatch(firestore);
    const userRef = doc(firestore, 'users', userId);
    batch.delete(userRef);
    const adminRoleRef = doc(firestore, 'roles_admin', userId);
    batch.delete(adminRoleRef);

    try {
      await batch.commit();
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: `users/${userId}` }));
      throw error;
    }
  };
  
  const promoteUser = async (userId: string, username: string, role: 'ADMIN' | 'CREATOR' | 'MANAGER' | 'BOX') => {
    if (!firestore || !currentUser) return;
    if (!isCurrentUserAdmin) {
      toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to promote users.'});
      return;
    }

    const batch = writeBatch(firestore);
    const userRef = doc(firestore, 'users', userId);
    batch.update(userRef, { role });

    if (role === 'ADMIN' || role === 'CREATOR') {
      const adminRoleRef = doc(firestore, 'roles_admin', userId);
      batch.set(adminRoleRef, { uid: userId });
    }

    batch.commit().then(() => {
      toast({ title: 'User Promoted', description: `${username} has been promoted to ${role}.`});
    }).catch(error => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'write', path: `users/${userId}`, requestResourceData: { role } }));
    });
  };
  
  const updateUserProfile = async (userId: string, data: Partial<Omit<User, 'id'>>) => {
    if (!firestore) {
      throw new Error("Firestore not available");
    }
    const userRef = doc(firestore, 'users', userId);
    const updatedData = { ...data, updatedAt: serverTimestamp() };
    try {
      await updateDoc(userRef, updatedData);
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: userRef.path, requestResourceData: updatedData }));
      throw e;
    }
  };

  const updateRolePermissions = async (permissions: Record<Role, Page[]>) => {
    if (!firestore) return;
    const permissionsRef = doc(firestore, 'settings', 'permissions');
    try {
        await setDoc(permissionsRef, permissions);
        toast({ title: 'Permissions Saved', description: 'User role permissions have been updated.' });
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'write', path: permissionsRef.path, requestResourceData: permissions }));
    }
  };

  const addUom = async (uom: Uom) => {
    if (!firestore) return;
    const uomRef = doc(firestore, 'uoms', uom.toUpperCase());
    setDoc(uomRef, { name: uom.toUpperCase() }).then(() => {
      toast({ title: 'UOM Added' });
    }).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'create', path: uomRef.path, requestResourceData: { name: uom.toUpperCase() } }));
    });
  };
  
  const findBillForCustomerToday = useCallback((customerId: string) => {
    const today = startOfDay(new Date());
    return (liveBillSummaries || []).find(bill => {
        const billDate = bill.date ? (bill.date as Timestamp).toDate() : null;
        if (!billDate || bill.customerId !== customerId) return false;
        return startOfDay(billDate).getTime() === today.getTime();
    });
  }, [liveBillSummaries]);

  const findBillForCustomerOnDate = useCallback((customerId: string, date: Date) => {
    const targetDate = startOfDay(date);
    return (liveBillSummaries || []).find(bill => {
        const billDate = bill.date ? (bill.date as Timestamp).toDate() : null;
        if (!billDate || bill.customerId !== customerId) return false;
        return startOfDay(billDate).getTime() === targetDate.getTime();
    });
  }, [liveBillSummaries]);

  const getBill = useCallback((billNo: string) => {
    return (liveBillSummaries || []).find(b => b.billNo === billNo);
  }, [liveBillSummaries]);


  const createOrUpdateLiveBill = useCallback((
    summary: Omit<LiveBillSummary, 'billNo' | 'amount' | 'deliveryCharge' | 'paidAmount' | 'date' | 'createdBy' | 'stall' | 'finalBalance' | 'prevBalance'> & { prevBalance?: number },
    items: BillItem[],
    paidAmount: number,
    deliveryCharge: number,
    date: Date,
    existingBillNo?: string | null,
    finalBalance?: number
  ): { billNo: string; commitPromise: Promise<void> } => {
    if (!firestore || !currentUser) {
        return { billNo: "error", commitPromise: Promise.reject(new Error("Firestore not available")) };
    }

    const itemsTotal = items.reduce((sum, item) => sum + item.amount, 0);
    const totalAmount = Number((itemsTotal + deliveryCharge).toFixed(2));

    const billNo = existingBillNo || (() => {
        const maxBillNo = (liveBillSummaries || [])
            .map(b => parseInt(b.billNo.replace('B', ''), 10))
            .filter(num => !isNaN(num))
            .reduce((max, num) => Math.max(max, num), 1237);
        return `B${maxBillNo + 1}`;
    })();
    
    const billRef = doc(firestore, 'bills', billNo);
    const batch = writeBatch(firestore);

    // Strip internal fields that shouldn't be written back to Firestore
    const { id, ...sanitizedSummary } = summary as any;

    let summaryPayload: any = { 
        ...sanitizedSummary, 
        billNo, 
        amount: totalAmount, 
        deliveryCharge: Number((deliveryCharge || 0).toFixed(2)),
        paidAmount: Number((paidAmount || 0).toFixed(2)),
        finalBalance: Number((finalBalance || 0).toFixed(2)),
        date: Timestamp.fromDate(date),
        updatedAt: serverTimestamp(),
    };

    const paymentsCol = collection(firestore, 'payments');

    if (existingBillNo) {
      // Explicitly preserve original createdBy for both update and restore (undo) scenarios.
      const originalBill = (liveBillSummaries || []).find(b => b.billNo === existingBillNo);
      if (originalBill?.createdBy && !summaryPayload.createdBy) {
        summaryPayload.createdBy = originalBill.createdBy;
      }
      // If editing existing, use the snapshot balance already on document (unless today)
      if (!summaryPayload.prevBalance && originalBill?.prevBalance !== undefined) {
        summaryPayload.prevBalance = originalBill.prevBalance;
      }
      batch.set(billRef, summaryPayload, { merge: true }); 

      // Handle linked payment for edit — find existing via linkedBillId
      const existingLinkedPayment = (payments || []).find(
        p => p.linkedBillId === existingBillNo && !p.isDeleted
      );

      if (paidAmount > 0) {
        if (existingLinkedPayment) {
          // Case A: paidAmount changed — update existing linked payment
          const payRef = doc(firestore, 'payments', existingLinkedPayment.id);
          batch.update(payRef, {
            amount: paidAmount,
            notes: `Received during Bill ${billNo}`,
            date: Timestamp.fromDate(date),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Case C: paidAmount changed from 0 → value — create new linked payment
          const newPayRef = doc(paymentsCol);
          batch.set(newPayRef, {
            customerId: summary.customerId,
            amount: paidAmount,
            paymentMode: 'Bill Payment',
            notes: `Received during Bill ${billNo}`,
            date: Timestamp.fromDate(date),
            linkedBillId: billNo,
            autoGenerated: true,
            createdAt: serverTimestamp(),
          });
        }
      } else {
        // Case B: paidAmount changed to 0 — delete existing linked payment if present
        if (existingLinkedPayment) {
          const payRef = doc(firestore, 'payments', existingLinkedPayment.id);
          batch.delete(payRef);
        }
      }
    } else {
       // ── NEW BILL ──────────────────────────────────────────────────────────
       summaryPayload.createdBy = currentUser.id;
       summaryPayload.createdAt = serverTimestamp();
       // For new bills today, ensure snapshot is current customer balance
       if (isSameDay(date, new Date()) && !summaryPayload.prevBalance) {
         summaryPayload.prevBalance = customerBalances[summary.customerId] || 0;
       }
       batch.set(billRef, summaryPayload);
      
      if (paidAmount > 0) {
        const newPayRef = doc(paymentsCol);
        batch.set(newPayRef, {
          customerId: summary.customerId,
          amount: paidAmount,
          paymentMode: 'Bill Payment',
          notes: `Received during Bill ${billNo}`,
          date: Timestamp.fromDate(date),
          linkedBillId: billNo,
          autoGenerated: true,
          createdAt: serverTimestamp(),
        });
      }
    }

    const itemsCollectionRef = collection(firestore, 'bills', billNo, 'billItems');
    items.forEach(item => {
      const itemData: BillItem = { ...item, billId: billNo, amount: Number(item.amount.toFixed(2)) }; 
      const itemRef = doc(itemsCollectionRef, item.id);
      batch.set(itemRef, itemData, { merge: true });
    });

    const commitPromise = batch.commit().catch(error => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `bills/${billNo}`,
          operation: existingBillNo ? 'update' : 'create',
          requestResourceData: summaryPayload,
        }));
      throw error;
    });

    return { billNo, commitPromise };
  }, [firestore, currentUser, liveBillSummaries, customerBalances, payments]);

    const deleteBills = async (billNos: string[]) => {
      if (!firestore) return;
      if (!isCurrentUserAdmin) {
          toast({ variant: "destructive", title: "Permission Denied" });
          return;
      }
  
      const batch = writeBatch(firestore);
      for (const billNo of billNos) {
          const billRef = doc(firestore, 'bills', billNo);
          const itemsQuery = query(collection(firestore, 'bills', billNo, 'billItems'));
          
          try {
              const itemsSnapshot = await getDocs(itemsQuery);
              itemsSnapshot.forEach(itemDoc => {
                  batch.delete(itemDoc.ref);
              });
              batch.delete(billRef);

              // ✅ FIX: Also delete linked payment entry to prevent orphaned records
              const linkedPaymentsQuery = query(
                collection(firestore, 'payments'),
                where('linkedBillId', '==', billNo)
              );
              const linkedPaymentsSnap = await getDocs(linkedPaymentsQuery);
              linkedPaymentsSnap.forEach(payDoc => {
                  batch.delete(payDoc.ref);
              });
          } catch(e) {
              errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'list', path: `bills/${billNo}/billItems` }));
              return; 
          }
      }
  
      try {
        await batch.commit();
    } catch (error) {
          const pathForError = billNos.length > 0 ? `bills/${billNos[0]}` : 'bills';
          errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: pathForError }));
          return;
      }

      // ── Step 2: Soft-delete any linked payment entries (non-fatal, separate batch) ──
      // Uses update (isDeleted: true) instead of delete to match existing Firestore rules.
      // Kept separate so payment rule issues never block bill deletion.
      try {
          const paymentBatch = writeBatch(firestore);
          let hasPaymentOps = false;
          for (const billNo of billNos) {
              const linkedPaymentsQuery = query(
                  collection(firestore, 'payments'),
                  where('linkedBillId', '==', billNo)
              );
              const linkedPaymentsSnap = await getDocs(linkedPaymentsQuery);
              linkedPaymentsSnap.forEach(payDoc => {
                  paymentBatch.update(payDoc.ref, { isDeleted: true, updatedAt: serverTimestamp() });
                  hasPaymentOps = true;
              });
          // Fallback: legacy bills (saved before fix) had no linkedBillId.
              // Their payments were created with notes like "Payment for new bill B1785".
              // Use in-memory payments array to find and soft-delete them.
              if (linkedPaymentsSnap.empty) {
                const billSummary = (liveBillSummaries || []).find(b => b.billNo === billNo);
                const paidAmt = billSummary?.paidAmount || 0;
                if (paidAmt > 0) {
                    const legacyPayment = (payments || []).find(p =>
                        !p.isDeleted &&
                        !p.linkedBillId &&
                        p.customerId === billSummary?.customerId &&
                        p.amount === paidAmt &&
                        (p.notes?.includes(billNo) || p.notes?.includes('Bill Payment'))
                    );
                    if (legacyPayment) {
                        const legacyPayRef = doc(firestore, 'payments', legacyPayment.id);
                        paymentBatch.update(legacyPayRef, { isDeleted: true, updatedAt: serverTimestamp() });
                        hasPaymentOps = true;
                    }
                }
            }
        }
          if (hasPaymentOps) {
              await paymentBatch.commit();
          }
      } catch (e) {
          // Non-fatal: bill is already deleted. Payment will remain but isDeleted handles filtering.
          console.error('Failed to soft-delete linked payments after bill deletion:', e);
      }
    };

  const addPayment = async (payment: Omit<Payment, 'id' | 'date'> & { date?: Date }) => {
      if (!firestore) return;
      const paymentsCol = collection(firestore, 'payments');
      const paymentDate = payment.date ? Timestamp.fromDate(payment.date) : serverTimestamp();
      const normalizedPayment = { 
        customerId: payment.customerId,
        amount: Number(payment.amount.toFixed(2)),
        notes: payment.notes || '',
        paymentMode: payment.paymentMode || 'Cash',
        date: paymentDate,
        createdAt: serverTimestamp()
      };
      addDoc(paymentsCol, normalizedPayment).catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'create', path: paymentsCol.path, requestResourceData: normalizedPayment }));
      });
  }

  const updatePayment = async (paymentId: string, data: { amount: number; notes?: string; paymentMode?: string; date?: Date }) => {
    if (!firestore) return;
    const paymentRef = doc(firestore, 'payments', paymentId);
    try {
      const updatePayload: any = { amount: data.amount, notes: data.notes || '', updatedAt: serverTimestamp() };
      if (data.paymentMode) updatePayload.paymentMode = data.paymentMode;
      if (data.date) updatePayload.date = Timestamp.fromDate(data.date);
      await updateDoc(paymentRef, updatePayload);
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: paymentRef.path, requestResourceData: data }));
      throw e;
    }
  };

  const softDeletePayment = async (paymentId: string) => {
    if (!firestore) return;
    const paymentRef = doc(firestore, 'payments', paymentId);
    try {
      await updateDoc(paymentRef, { isDeleted: true, updatedAt: serverTimestamp() });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: paymentRef.path }));
      throw e;
    }
  };

  const addPartyPayment = async (payment: Omit<PartyPayment, 'id' | 'date'> & { date?: Date }) => {
    if (!firestore) return;
    const paymentsCol = collection(firestore, 'partyPayments');
    const { date, ...rest } = payment;
    const payloadDate = date ? Timestamp.fromDate(date) : serverTimestamp();
    
    const batch = writeBatch(firestore);
    const newPaymentRef = doc(paymentsCol);
    batch.set(newPaymentRef, { ...rest, date: payloadDate });
    
    const partyBalanceRef = doc(firestore, 'partyBalances', payment.partyId);
    const partyBalanceSnap = await getDoc(partyBalanceRef);
    const currentBalance = partyBalanceSnap.exists() ? partyBalanceSnap.data().balanceAmount : 0;
    
    // We pay the party -> our balance (what we owe) decreases.
    batch.set(partyBalanceRef, { partyId: payment.partyId, balanceAmount: currentBalance - payment.amount, updatedAt: serverTimestamp() });
    
    batch.commit().catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'create', path: paymentsCol.path, requestResourceData: payment }));
    });
};

const updatePartyPayment = async (paymentId: string, data: { amount: number; notes?: string; paymentMode?: "Cash" | "ACC" | "UPI" | "Bill Payment"; date?: Date }) => {
  if (!firestore) return;
  const paymentRef = doc(firestore, 'partyPayments', paymentId);
  try {
    const paymentSnap = await getDoc(paymentRef);
    if (!paymentSnap.exists()) return;
    const oldPayment = paymentSnap.data() as PartyPayment;
    const diff = data.amount - oldPayment.amount; // e.g. 500 -> 600, diff = 100. We paid 100 MORE, so balance decreases by 100 more.
    
    const updatePayload: any = { amount: data.amount, notes: data.notes || '', updatedAt: serverTimestamp() };
    if (data.paymentMode) updatePayload.paymentMode = data.paymentMode;
    if (data.date) updatePayload.date = Timestamp.fromDate(data.date);

    const batch = writeBatch(firestore);
      batch.update(paymentRef, updatePayload);
      
      if (diff !== 0) {
          const partyBalanceRef = doc(firestore, 'partyBalances', oldPayment.partyId);
          const partyBalanceSnap = await getDoc(partyBalanceRef);
          const currentBalance = partyBalanceSnap.exists() ? partyBalanceSnap.data().balanceAmount : 0;
          batch.set(partyBalanceRef, { partyId: oldPayment.partyId, balanceAmount: currentBalance - diff, updatedAt: serverTimestamp() });
      }
      
      await batch.commit();
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: paymentRef.path, requestResourceData: data }));
      throw e;
    }
  };

  const softDeletePartyPayment = async (paymentId: string) => {
    if (!firestore) return;
    const paymentRef = doc(firestore, 'partyPayments', paymentId);
    try {
      const paymentSnap = await getDoc(paymentRef);
      if (!paymentSnap.exists()) return;
      const oldPayment = paymentSnap.data() as PartyPayment;
      if (oldPayment.isDeleted) return; // already deleted
      
      const batch = writeBatch(firestore);
      batch.update(paymentRef, { isDeleted: true, updatedAt: serverTimestamp() });
      
      // Deleting payment means we didn't pay them, so our balance (what we owe) INCREASES by the amount.
      const partyBalanceRef = doc(firestore, 'partyBalances', oldPayment.partyId);
      const partyBalanceSnap = await getDoc(partyBalanceRef);
      const currentBalance = partyBalanceSnap.exists() ? partyBalanceSnap.data().balanceAmount : 0;
      batch.set(partyBalanceRef, { partyId: oldPayment.partyId, balanceAmount: currentBalance + oldPayment.amount, updatedAt: serverTimestamp() });
      
      await batch.commit();
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: paymentRef.path }));
      throw e;
    }
  };

  const updateBillPayment = async (billNo: string, amountToAdd: number, notes?: string) => {
    if (!firestore) return;
    const billRef = doc(firestore, 'bills', billNo);
    const billDoc = await getDoc(billRef);
    if (!billDoc.exists()) return;
    
    const billData = billDoc.data() as LiveBillSummary;
    const currentPaid = billData.paidAmount || 0;
    const newPaid = currentPaid + amountToAdd;
    
    const prevBal = billData.prevBalance || 0;
    const amount = billData.amount || 0;
    const delivery = billData.deliveryCharge || 0;
    const newFinalBalance = prevBal + amount + delivery - newPaid;

    const batch = writeBatch(firestore);
    batch.update(billRef, { 
      paidAmount: newPaid, 
      finalBalance: newFinalBalance,
      updatedAt: serverTimestamp() 
    });

    if (amountToAdd > 0) {
      const paymentsCol = collection(firestore, 'payments');
      const paymentRef = doc(paymentsCol);
      batch.set(paymentRef, {
        customerId: billData.customerId,
        amount: amountToAdd,
        date: billData.date || serverTimestamp(),
        notes: notes || `Payment recorded for bill ${billNo}`
      });
    }

    try {
      await batch.commit();
    } catch(e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update payment.' });
    }
  };

  const setOpeningBalance = async (customerId: string, balance: number) => {
    if (!firestore) return;
    const balanceRef = doc(firestore, 'customerBalances', customerId);
    const balanceData = { customerId: customerId, balanceAmount: Number(balance.toFixed(2)), updatedAt: serverTimestamp() };
    setDoc(balanceRef, balanceData, { merge: true }).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'write', path: balanceRef.path, requestResourceData: balanceData }));
    });
  };

  const setOpeningBoxBalance = async (customerId: string, balance: number) => {
    if (!firestore) return;
    const balanceRef = doc(firestore, 'customerBoxBalances', customerId);
    const balanceData = { customerId: customerId, balanceAmount: balance, updatedAt: serverTimestamp() };
    setDoc(balanceRef, balanceData, { merge: true }).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'write', path: balanceRef.path, requestResourceData: balanceData }));
    });
  };

  const setPartyBalance = async (partyId: string, balance: number) => {
    if (!firestore) return;
    const balanceRef = doc(firestore, 'partyBalances', partyId);
    const balanceData = { partyId, balanceAmount: Number(balance.toFixed(2)), updatedAt: serverTimestamp() };
    setDoc(balanceRef, balanceData, { merge: true }).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'write', path: balanceRef.path, requestResourceData: balanceData }));
    });
  };

  const updateProductPrice = async (productId: string, uom: string, price: number) => {
    if (!firestore) return;
    const priceId = `${productId}_${uom}_${new Date().toISOString().split('T')[0]}`;
    const priceRef = doc(firestore, 'productPrices', priceId);
    const priceData = { productId, uom, pricePerUom: Number(price.toFixed(2)), priceDate: new Date().toISOString().split('T')[0] };
    setDoc(priceRef, priceData, {merge: true}).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'write', path: priceRef.path, requestResourceData: priceData }));
    });
  };

  const getSafeDate = (dateField: any): Date => {
    if (!dateField) return new Date(0);
    return dateField.toDate ? dateField.toDate() : new Date(dateField);
};

  const getCustomerLedger = useCallback((
    customerId: string, 
    dateRange: { from: Date, to: Date }
  ): { transactions: Transaction[], openingBalance: number } => {
    
    const fromDateStart = startOfDay(dateRange.from);
    const toDateEnd = endOfDay(dateRange.to);

    const initialOpeningBalance = openingBalances[customerId] || 0;

    const allBills = (liveBillSummaries || []).filter(b => b.customerId === customerId && b.date && b.amount > 0);
    const allPayments = (payments || []).filter(p => p.customerId === customerId && !p.isDeleted);

    const priorBills = allBills.filter(b => getSafeDate(b.date) < fromDateStart);
    const priorPayments = allPayments.filter(p => getSafeDate(p.date) < fromDateStart);

    const totalPriorBilled = priorBills.reduce((sum, b) => sum + b.amount, 0);
    const totalPriorPaid = priorPayments.reduce((sum, p) => sum + p.amount, 0);
    const openingBalanceForPeriod = Number((initialOpeningBalance + totalPriorBilled - totalPriorPaid).toFixed(2));
    
    const interval = { start: fromDateStart, end: toDateEnd };
    
    const billsInRange = allBills.filter(b => isWithinInterval(getSafeDate(b.date), interval));
    const paymentsInRange = allPayments.filter(p => isWithinInterval(getSafeDate(p.date), interval));

    const rawTransactions: any[] = [];

    billsInRange.forEach(b => {
      const txDate = getSafeDate(b.date);
      const createdAtDate = b.createdAt ? getSafeDate(b.createdAt) : txDate;
      rawTransactions.push({
        date: txDate,
        createdAt: createdAtDate,
        description: `Bill No: ${b.billNo}`,
        billedAmount: b.amount,
        balance: 0,
        type: 'bill',
        sortKey: 1,
      });
    });

    paymentsInRange.forEach(p => {
      const txDate = getSafeDate(p.date);
      const createdAtDate = (p as any).createdAt ? getSafeDate((p as any).createdAt) : txDate;
      rawTransactions.push({
        date: txDate,
        createdAt: createdAtDate,
        description: p.notes || `${p.paymentMode || 'Cash'} Payment`,
        receivedAmount: p.amount,
        paymentMode: p.paymentMode || 'Cash',
        paymentId: p.id,
        balance: 0,
        type: 'payment',
        sortKey: 2,
      });
    });

    rawTransactions.sort((a, b) => {
      const dayA = startOfDay(a.date).getTime();
      const dayB = startOfDay(b.date).getTime();
      if (dayA !== dayB) return dayA - dayB;
      
      const timeA = a.createdAt.getTime();
      const timeB = b.createdAt.getTime();
      if (timeA !== timeB) return timeA - timeB;
      
      return a.sortKey - b.sortKey;
    });

    const groupedByDay = new Map<number, any[]>();
    for (const t of rawTransactions) {
      const dayTime = startOfDay(t.date).getTime();
      if (!groupedByDay.has(dayTime)) groupedByDay.set(dayTime, []);
      groupedByDay.get(dayTime)!.push(t);
    }

    const mergedTransactions: any[] = [];
    const sortedDays = Array.from(groupedByDay.keys()).sort((a, b) => a - b);
    
    for (const day of sortedDays) {
      const dailyTx = groupedByDay.get(day)!;
      const bills = dailyTx.filter(t => t.type === 'bill');
      const payments = dailyTx.filter(t => t.type === 'payment');

      if (bills.length > 0 && payments.length > 0) {
        const totalBilled = bills.reduce((sum, b) => sum + b.billedAmount, 0);
        const billDescriptions = bills.map(b => b.description).join(' & ');
        
        const firstPayment = payments[0];
        const mergedPayment = {
          ...firstPayment,
          description: `${firstPayment.description} | ${billDescriptions}`,
          billedAmount: totalBilled,
          type: 'both'
        };

        mergedTransactions.push(mergedPayment);
        for (let i = 1; i < payments.length; i++) {
          mergedTransactions.push(payments[i]);
        }
      } else {
        mergedTransactions.push(...dailyTx);
      }
    }

    const combinedTransactions: Transaction[] = mergedTransactions.map(t => ({
      date: t.date,
      description: t.description,
      billedAmount: t.billedAmount,
      receivedAmount: t.receivedAmount,
      paymentMode: t.paymentMode,
      paymentId: t.paymentId,
      balance: 0,
      type: t.type
    }));

    let currentBalance = openingBalanceForPeriod;
    const finalTransactions = combinedTransactions.map(t => {
  
        currentBalance += t.billedAmount || 0;
        currentBalance -= t.receivedAmount || 0;
        currentBalance = Number(currentBalance.toFixed(2));
      return { ...t, balance: currentBalance };
    });

    return { transactions: finalTransactions, openingBalance: openingBalanceForPeriod };
  }, [liveBillSummaries, payments, openingBalances]);

  const getSalesReport = useCallback(async (
    customerId: string,
    dateRange: { from: Date; to: Date }
  ): Promise<SalesReportData | null> => {
    if (!firestore) return null;

    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return null;

    const fromDateStart = startOfDay(dateRange.from);
    const toDateEnd = endOfDay(dateRange.to);

    const initialOpeningBalance = openingBalances[customerId] || 0;
    const allBills = (liveBillSummaries || []).filter(
      (b) => b.customerId === customerId && b.date && b.amount > 0
    );
    const allPayments = (payments || []).filter(
      (p) => p.customerId === customerId && !p.isDeleted
    );

    const priorBills = allBills.filter(
      (b) => getSafeDate(b.date) < fromDateStart
    );
    const priorPayments = allPayments.filter(
      (p) => getSafeDate(p.date) < fromDateStart
    );
    const totalPriorBilled = priorBills.reduce((sum, b) => sum + b.amount, 0);
    const totalPriorPaid = priorPayments.reduce((sum, p) => sum + p.amount, 0);
    const previousBalance = Number((initialOpeningBalance + totalPriorBilled - totalPriorPaid).toFixed(2));

    const billsInRange = allBills.filter((b) =>
      isWithinInterval(getSafeDate(b.date), {
        start: fromDateStart,
        end: toDateEnd,
      })
    );

    if (billsInRange.length === 0) {
      return {
        customer,
        itemsByDate: [],
        totalQty: {},
        totalAmount: 0,
        previousBalance,
        netAmount: previousBalance,
        dateRange,
      };
    }

    const billItemsPromises = billsInRange.map((bill) =>
      getDocs(collection(firestore, 'bills', bill.billNo, 'billItems'))
    );
    const billItemsSnapshots = await Promise.all(billItemsPromises);

    const allItemsInRange: (BillItem & { billDate: Date })[] = [];
    billItemsSnapshots.forEach((snapshot, index) => {
      const bill = billsInRange[index];
      const billDate = (bill.date as Timestamp).toDate();
      snapshot.forEach((doc) => {
        allItemsInRange.push({ ...(doc.data() as BillItem), billDate });
      });
      if (bill.deliveryCharge && bill.deliveryCharge > 0) {
        allItemsInRange.push({
          id: `delivery-${bill.billNo}`,
          product: "Delivery",
          productId: "delivery",
          uom: "-",
          qty: 0,
          rate: 0,
          amount: bill.deliveryCharge,
          addedBy: "system",
          stall: "1",
          billId: bill.billNo,
          billDate: billDate
        });
      }
    });

    const itemsGroupedByDate = allItemsInRange.reduce((acc, item) => {
      const dateStr = format(item.billDate, 'dd/MM/yyyy');
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(item);
      return acc;
    }, {} as Record<string, BillItem[]>);

    const itemsByDate = Object.entries(itemsGroupedByDate)
      .sort((a, b) => {
        const keyA = a[0].split('/').reverse().join(''); // yyyyMMdd
        const keyB = b[0].split('/').reverse().join('');
        return keyA.localeCompare(keyB);
      })
      .map(([dateStr, items]) => {
        const parts = dateStr.split('/');
        const shortDate = `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
        return { date: shortDate, items };
      });

    const totalQty: Record<string, number> = {};
    let totalAmount = 0;

    allItemsInRange.forEach((item) => {
      if (item.product !== "Delivery") {
        if (!totalQty[item.uom]) {
          totalQty[item.uom] = 0;
        }
        totalQty[item.uom] += item.qty;
      }
      const amt = parseFloat(item.amount as any);
      totalAmount += isNaN(amt) ? 0 : amt;
    });
    
    totalAmount = Number(totalAmount.toFixed(2));
    const netAmount = Number((previousBalance + totalAmount).toFixed(2));

    return {
      customer,
      itemsByDate,
      totalQty,
      totalAmount,
      previousBalance,
      netAmount,
      dateRange,
    };
  }, [firestore, customers, openingBalances, liveBillSummaries, payments]);

  // Vehicle and Driver Management
  const addVehicle = async (vehicle: Omit<Vehicle, 'active'|'createdAt'|'updatedAt'>) => {
    if (!firestore) return;
    const vehicleRef = doc(firestore, 'vehicles', vehicle.id);
    const vehicleData = { ...vehicle, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    setDoc(vehicleRef, vehicleData).then(() => {
      toast({ title: 'Vehicle Added' });
    }).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'create', path: vehicleRef.path, requestResourceData: vehicleData }));
    });
  };

  const editVehicle = async (vehicleId: string, data: Partial<Vehicle>) => {
    if (!firestore) return;
    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    const updatedData = { ...data, updatedAt: serverTimestamp() };
    updateDoc(vehicleRef, updatedData).then(() => {
      toast({ title: 'Vehicle Updated' });
    }).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: vehicleRef.path, requestResourceData: updatedData }));
    });
  };

  const deleteVehicle = async (vehicleId: string) => {
    if (!firestore) return;
    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    deleteDoc(vehicleRef).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: vehicleRef.path }));
    });
  };

  const addDriver = async (driver: Omit<Driver, 'id' | 'active'|'createdAt'|'updatedAt'>) => {
    if (!firestore) return;
    const driversCol = collection(firestore, 'drivers');
    const driverData = { ...driver, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    addDoc(driversCol, driverData).then(() => {
      toast({ title: 'Driver Added' });
    }).catch(e => {
       errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'create', path: driversCol.path, requestResourceData: driverData }));
    });
  };

  const editDriver = async (driverId: string, data: Partial<Driver>) => {
    if (!firestore) return;
    const driverRef = doc(firestore, 'drivers', driverId);
    const updatedData = { ...data, updatedAt: serverTimestamp() };
    updateDoc(driverRef, updatedData).then(() => {
      toast({ title: 'Driver Updated' });
    }).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: driverRef.path, requestResourceData: updatedData }));
    });
  };

  const deleteDriver = async (driverId: string) => {
    if (!firestore) return;
    const driverRef = doc(firestore, 'drivers', driverId);
    deleteDoc(driverRef).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: driverRef.path }));
    });
  };

    const addParty = async (party: Omit<Party, 'id' | 'active'|'createdAt'|'updatedAt'> & { id?: string }) => {
        if (!firestore) return;
        let newId = party.id;
        if (!newId) {
            const maxId = (parties || [])
                .map(p => parseInt(p.id.replace('PT', ''), 10))
                .filter(num => !isNaN(num))
                .reduce((max, num) => Math.max(max, num), 0);
            newId = `PT${(maxId + 1).toString().padStart(2, '0')}`;
        }
        const partyRef = doc(firestore, 'parties', newId);
        const newPartyData = {
            id: newId,
            name: party.name,
            location: party.location,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        setDoc(partyRef, newPartyData).then(() => {
          toast({ title: 'Party Added', description: `"${party.name}" has been added.` });
        }).catch(e => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'create', path: partyRef.path, requestResourceData: newPartyData }));
        });
    };

    const editParty = async (partyId: string, data: Partial<Omit<Party, 'id'>>) => {
        if (!firestore) return;
        const partyRef = doc(firestore, 'parties', partyId);
        const updatedData = { ...data, updatedAt: serverTimestamp() };
        updateDoc(partyRef, updatedData).then(() => {
          toast({ title: 'Party Updated' });
        }).catch(e => {
           errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: partyRef.path, requestResourceData: updatedData }));
        } );
    };

    const deleteParty = async (partyId: string) => {
        if (!firestore) return;
        const partyRef = doc(firestore, 'parties', partyId);
        deleteDoc(partyRef).catch(e => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: partyRef.path }));
        });
    };

  const addOrUpdateVehicleBill = async (bill: Omit<VehicleBill, 'id' | 'createdBy'|'createdAt'|'updatedAt'>, existingBillId?: string): Promise<VehicleBill | null> => {
    if (!firestore || !currentUser) return null;
    
    let billPayload: any;
    let billRef;
    
    try {
      if (existingBillId) {
          billRef = doc(firestore, 'vehicleBills', existingBillId);
          const { id, ...sanitizedBill } = bill as any;
          billPayload = {
            ...sanitizedBill,
            advance: Number(bill.advance.toFixed(2)),
            expenses: Number(bill.expenses.toFixed(2)),
            updatedAt: serverTimestamp(),
          };
          await setDoc(billRef, billPayload, { merge: true });
          const originalBill = vehicleBills.find(b => b.id === existingBillId);
          return { ...originalBill, ...billPayload, id: existingBillId } as VehicleBill;

      } else {
          billPayload = {
            ...bill,
            advance: Number(bill.advance.toFixed(2)),
            expenses: Number(bill.expenses.toFixed(2)),
            createdBy: currentUser.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          const docRef = await addDoc(collection(firestore, 'vehicleBills'), billPayload);
          return { ...billPayload, id: docRef.id } as VehicleBill;
      }
    } catch(e) {
        const path = existingBillId ? `vehicleBills/${existingBillId}` : 'vehicleBills';
        const operation = existingBillId ? 'update' : 'create';
        errorEmitter.emit('permission-error', new FirestorePermissionError({ operation, path, requestResourceData: billPayload }));
        return null;
    }
  };

  const deleteVehicleBill = async (billId: string) => {
    if (!firestore) return;
    const billRef = doc(firestore, 'vehicleBills', billId);
    deleteDoc(billRef).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: billRef.path }));
    });
  };
  
  const addOrUpdatePartyBill = useCallback(async (billData: Omit<PartyBill, 'id' | 'createdBy'|'createdAt'|'updatedAt'>, existingBillId?: string | null): Promise<PartyBill | null> => {
    if (!firestore || !currentUser) {
        return null;
    }

    const batch = writeBatch(firestore);
    
    let billId = existingBillId;
    let billRef;
    let originalBillState: PartyBill | undefined;
    
    const { id, ...sanitizedBillData } = billData as any;
    let billPayload: any;

    if (billId) { // UPDATE
      billRef = doc(firestore, 'partyBills', billId);
      originalBillState = (partyBills || []).find(b => b.id === billId);
      billPayload = {
        ...sanitizedBillData,
        totalAmount: Number(billData.totalAmount.toFixed(2)),
        netAmount: Number(billData.netAmount.toFixed(2)),
        totalReceived: Number(billData.totalReceived.toFixed(2)),
        updatedAt: serverTimestamp(),
      };
    } else { // CREATE
      billPayload = {
        ...sanitizedBillData,
        totalAmount: Number(billData.totalAmount.toFixed(2)),
        netAmount: Number(billData.netAmount.toFixed(2)),
        totalReceived: Number(billData.totalReceived.toFixed(2)),
        createdBy: currentUser.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      billRef = doc(collection(firestore, 'partyBills'));
      billId = billRef.id;
    }
    
    batch.set(billRef, billPayload, { merge: true });
    
    const balanceRef = doc(firestore, 'partyBalances', billData.partyId);
    
    let currentBalance = 0;
    try {
        const balanceDoc = await getDoc(balanceRef);
        if (balanceDoc.exists()) {
            currentBalance = balanceDoc.data().balanceAmount || 0;
        }
    } catch (e) {
        console.warn("Could not fetch existing party balance, assuming 0.", e);
    }
    
    let newBalance = currentBalance;
    const balanceChange = billData.netAmount - billData.totalReceived;

    if (originalBillState) {
        const originalBalanceChange = originalBillState.netAmount - originalBillState.totalReceived;
        newBalance = newBalance - originalBalanceChange + balanceChange;
    } else {
        newBalance += balanceChange;
    }

    batch.set(balanceRef, { partyId: billData.partyId, balanceAmount: Number(newBalance.toFixed(2)), updatedAt: serverTimestamp() }, { merge: true });
    
    try {
        await batch.commit();
        toast({ title: existingBillId ? 'Party Bill Updated' : 'Party Bill Saved'});
        const savedBillData: PartyBill = { ...(originalBillState || {}), ...billPayload, id: billId! } as PartyBill;
        return savedBillData;
    } catch(e: any) {
        const operation = existingBillId ? 'update' : 'create';
        const path = billRef.path;
        errorEmitter.emit('permission-error', new FirestorePermissionError({ operation, path, requestResourceData: billPayload }));
        return null;
    }
  }, [firestore, currentUser, partyBills, toast]);

  const deletePartyBill = useCallback(async (billToDelete: PartyBill) => {
    if (!firestore || !currentUser) return;
    
    const batch = writeBatch(firestore);

    const billRef = doc(firestore, 'partyBills', billToDelete.id);
    batch.delete(billRef);

    const balanceRef = doc(firestore, 'partyBalances', billToDelete.partyId);

    let currentBalance = 0;
    try {
        const balanceDoc = await getDoc(balanceRef);
        if (balanceDoc.exists()) {
            currentBalance = balanceDoc.data().balanceAmount || 0;
        }
    } catch (e) {
         console.warn("Could not fetch existing party balance, assuming 0.", e);
    }
    
    const balanceChange = billToDelete.netAmount - billToDelete.totalReceived;
    const newBalance = currentBalance - balanceChange;
    batch.set(balanceRef, { partyId: billToDelete.partyId, balanceAmount: Number(newBalance.toFixed(2)), updatedAt: serverTimestamp() }, { merge: true });

    batch.commit().catch(e => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: billRef.path }));
    });


  }, [firestore, currentUser]);

  const addStatementPrintHistory = useCallback(async (record: Omit<StatementPrintHistory, 'id' | 'printedAt'>) => {
    if (!firestore) return;
    const col = collection(firestore, 'statementPrintHistory');
    const payload = {
      ...record,
      fromDate: record.fromDate instanceof Date ? Timestamp.fromDate(record.fromDate) : record.fromDate,
      toDate: record.toDate instanceof Date ? Timestamp.fromDate(record.toDate) : record.toDate,
      printedAt: serverTimestamp(),
    };
    try {
      await addDoc(col, payload);
    } catch (e) {
      console.error('Failed to save statement print history:', e);
    }
  }, [firestore]);

  const deleteStatementPrintHistory = useCallback(async (recordId: string) => {
    if (!firestore) return;
    try {
      const docRef = doc(firestore, 'statementPrintHistory', recordId);
      await deleteDoc(docRef);
    } catch (e) {
      console.error('Failed to delete statement print history:', e);
      throw e;
    }
  }, [firestore]);

  const getStatementPrintHistoryForCustomer = useCallback((customerId: string): StatementPrintHistory[] => {
    return statementPrintHistory
      .filter(r => r.customerId === customerId)
      .sort((a, b) => {
        const dateA = a.printedAt?.toDate ? a.printedAt.toDate().getTime() : new Date(a.printedAt).getTime();
        const dateB = b.printedAt?.toDate ? b.printedAt.toDate().getTime() : new Date(b.printedAt).getTime();
        return dateB - dateA;
      });
  }, [statementPrintHistory]);

  // ── Box Billing CRUD ───────────────────────────────────────────────────

  const findBoxBillForCustomerOnDate = useCallback((customerId: string, date: Date): BoxBill | undefined => {
    const targetDay = new Date(date);
    targetDay.setHours(0, 0, 0, 0);
    return (boxBills || []).find(bill => {
      if (bill.customerId !== customerId) return false;
      const billDate = bill.billDate?.toDate ? bill.billDate.toDate() : new Date(bill.billDate);
      const billDay = new Date(billDate);
      billDay.setHours(0, 0, 0, 0);
      return billDay.getTime() === targetDay.getTime();
    });
  }, [boxBills]);

  const getBoxBill = useCallback((billId: string): BoxBill | undefined => {
    return (boxBills || []).find(b => b.id === billId);
  }, [boxBills]);

  const addOrUpdateBoxBill = useCallback(async (
    billData: Omit<BoxBill, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    existingBillId?: string | null
  ): Promise<BoxBill | null> => {
    if (!firestore || !currentUser) return null;

    const { id: _id, ...sanitized } = billData as any;
    let billId = existingBillId;
    let billRef;
    let billPayload: any;

    try {
      if (billId) {
        // UPDATE existing bill
        billRef = doc(firestore, 'box_bills', billId);
        billPayload = { ...sanitized, updatedAt: serverTimestamp() };
        await setDoc(billRef, billPayload, { merge: true });
        const original = (boxBills || []).find(b => b.id === billId);
        return { ...original, ...billPayload, id: billId } as BoxBill;
      } else {
        // CREATE new bill — sequential BB# IDs
        const maxId = (boxBills || [])
          .map(b => parseInt(b.id.replace('BB', ''), 10))
          .filter(n => !isNaN(n))
          .reduce((max, n) => Math.max(max, n), 0);
        billId = `BB${maxId + 1}`;
        billRef = doc(firestore, 'box_bills', billId);
        billPayload = {
          ...sanitized,
          id: billId,
          createdBy: currentUser.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(billRef, billPayload);
        return { ...billPayload, id: billId } as BoxBill;
      }
    } catch (e) {
      const path = billId ? `box_bills/${billId}` : 'box_bills';
      const operation = existingBillId ? 'update' : 'create';
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation, path, requestResourceData: billPayload }));
      return null;
    }
  }, [firestore, currentUser, boxBills]);

  const recalculateFutureBoxBalances = useCallback(async (customerId: string, skipBillIds: string[] = []) => {
    if (!firestore) return;
    try {
      // Fetch FRESH data from Firestore directly — do NOT use in-memory boxBills state
      // which may not have propagated the just-saved bill yet.
      const q = query(collection(firestore, 'box_bills'), where('customerId', '==', customerId));
      const snapshot = await getDocs(q);
      const freshBills: BoxBill[] = [];
      snapshot.forEach(d => {
        if (!skipBillIds.includes(d.id)) {
          freshBills.push({ ...d.data(), id: d.id } as BoxBill);
        }
      });

      freshBills.sort((a, b) => {
        const dateA = a.billDate?.toDate ? a.billDate.toDate() : new Date(a.billDate as any);
        const dateB = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate as any);
        return dateA.getTime() - dateB.getTime();
      });

      const recalcBatch = writeBatch(firestore);
      let updates = 0;
      let runningBalance = openingBoxBalances[customerId] || 0;

      for (const bill of freshBills) {
        const correctBalance = runningBalance + bill.todaysFishBox - bill.emptyBox;
        if (bill.prevBalanceBox !== runningBalance || bill.balanceBox !== correctBalance) {
          recalcBatch.update(doc(firestore, 'box_bills', bill.id), {
            prevBalanceBox: runningBalance,
            balanceBox: correctBalance,
            updatedAt: serverTimestamp(),
          });
          updates++;
          runningBalance = correctBalance;
        } else {
          runningBalance = bill.balanceBox;
        }
      }

      if (updates > 0) {
        await recalcBatch.commit();
      }
    } catch (e) {
      console.error('Failed to recalculate future box balances', e);
    }
  }, [firestore, openingBoxBalances]);

  const deleteBoxBills = useCallback(async (billIds: string[]) => {
    if (!firestore || !isCurrentUserAdmin) {
      toast({ variant: 'destructive', title: 'Permission Denied' });
      return;
    }
    const batch = writeBatch(firestore);
    const customersToRecalculate = new Set<string>();

    billIds.forEach(id => {
      const bill = boxBills.find(b => b.id === id);
      if (bill) customersToRecalculate.add(bill.customerId);
      batch.delete(doc(firestore, 'box_bills', id));
      // Also delete all entries belonging to this bill so they don't linger as orphans
      boxBillEntries
        .filter(e => e.boxBillId === id)
        .forEach(e => batch.delete(doc(firestore, 'box_bill_entries', e.id)));
    });

    try {
      await batch.commit();
      // Re-use the shared function which fetches fresh data from Firestore
      for (const customerId of customersToRecalculate) {
        await recalculateFutureBoxBalances(customerId, [...billIds]);
      }
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: 'box_bills' }));
    }
  }, [firestore, isCurrentUserAdmin, toast, boxBills, boxBillEntries, recalculateFutureBoxBalances]);

  const addBoxBillEntry = useCallback(async (entryData: Omit<BoxBillEntry, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>): Promise<BoxBillEntry | null> => {
    if (!firestore || !currentUser) return null;
    try {
      const entryRef = doc(collection(firestore, 'box_bill_entries'));
      const payload = {
        ...entryData,
        id: entryRef.id,
        createdBy: currentUser.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(entryRef, payload);
      return payload as BoxBillEntry;
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'create', path: 'box_bill_entries', requestResourceData: entryData }));
      return null;
    }
  }, [firestore, currentUser]);

  const updateBoxBillEntry = useCallback(async (entryId: string, boxesAdded: number): Promise<void> => {
    if (!firestore) return;
    try {
      const entryRef = doc(firestore, 'box_bill_entries', entryId);
      await updateDoc(entryRef, { boxesAdded, updatedAt: serverTimestamp() });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: `box_bill_entries/${entryId}` }));
    }
  }, [firestore]);

  const deleteBoxBillEntry = useCallback(async (entryId: string): Promise<void> => {
    if (!firestore) return;
    try {
      const entryRef = doc(firestore, 'box_bill_entries', entryId);
      await deleteDoc(entryRef);
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: `box_bill_entries/${entryId}` }));
    }
  }, [firestore]);

  // ── Party Box Billing CRUD ───────────────────────────────────────────────

  const setPartyOpeningBoxBalance = useCallback(async (partyId: string, balance: number): Promise<void> => {
    if (!firestore) return;
    const ref = doc(firestore, 'partyBoxBalances', partyId);
    await setDoc(ref, { partyId, balanceAmount: balance, updatedAt: serverTimestamp() }, { merge: true }).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'write', path: ref.path }));
    });
  }, [firestore]);

  const findPartyBoxBillForPartyOnDate = useCallback((partyId: string, date: Date): PartyBoxBill | undefined => {
    const targetDay = new Date(date); targetDay.setHours(0, 0, 0, 0);
    return (partyBoxBills || []).find(bill => {
      if (bill.partyId !== partyId) return false;
      const billDate = bill.billDate?.toDate ? bill.billDate.toDate() : new Date(bill.billDate);
      const billDay = new Date(billDate); billDay.setHours(0, 0, 0, 0);
      return billDay.getTime() === targetDay.getTime();
    });
  }, [partyBoxBills]);

  const getPartyBoxBill = useCallback((billId: string): PartyBoxBill | undefined => {
    return (partyBoxBills || []).find(b => b.id === billId);
  }, [partyBoxBills]);

  const addOrUpdatePartyBoxBill = useCallback(async (
    billData: Omit<PartyBoxBill, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    existingBillId?: string | null
  ): Promise<PartyBoxBill | null> => {
    if (!firestore || !currentUser) return null;
    const { id: _id, ...sanitized } = billData as any;
    let billId = existingBillId;
    let billRef;
    let billPayload: any;
    try {
      if (billId) {
        billRef = doc(firestore, 'party_box_bills', billId);
        billPayload = { ...sanitized, updatedAt: serverTimestamp() };
        await setDoc(billRef, billPayload, { merge: true });
        const original = (partyBoxBills || []).find(b => b.id === billId);
        return { ...original, ...billPayload, id: billId } as PartyBoxBill;
      } else {
        const maxId = (partyBoxBills || [])
          .map(b => parseInt(b.id.replace('PBB', ''), 10))
          .filter(n => !isNaN(n))
          .reduce((max, n) => Math.max(max, n), 0);
        billId = `PBB${maxId + 1}`;
        billRef = doc(firestore, 'party_box_bills', billId);
        billPayload = { ...sanitized, id: billId, createdBy: currentUser.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
        await setDoc(billRef, billPayload);
        return { ...billPayload, id: billId } as PartyBoxBill;
      }
    } catch (e) {
      const path = billId ? `party_box_bills/${billId}` : 'party_box_bills';
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: existingBillId ? 'update' : 'create', path, requestResourceData: billPayload }));
      return null;
    }
  }, [firestore, currentUser, partyBoxBills]);

  const recalculateFuturePartyBoxBalances = useCallback(async (partyId: string, skipBillIds: string[] = []) => {
    if (!firestore) return;
    try {
      const recalcBatch = writeBatch(firestore);
      let updates = 0;
      const partyBillsFiltered = partyBoxBills.filter(b => b.partyId === partyId && !skipBillIds.includes(b.id));
      partyBillsFiltered.sort((a, b) => {
        const dateA = a.billDate?.toDate ? a.billDate.toDate() : new Date(a.billDate);
        const dateB = b.billDate?.toDate ? b.billDate.toDate() : new Date(b.billDate);
        return dateA.getTime() - dateB.getTime();
      });
      let runningBalance = partyOpeningBoxBalances[partyId] || 0;
      for (const bill of partyBillsFiltered) {
        if (bill.prevBalanceBox !== runningBalance) {
          const newBalanceBox = runningBalance + bill.todaysFishBox - bill.emptyBox;
          recalcBatch.update(doc(firestore, 'party_box_bills', bill.id), { prevBalanceBox: runningBalance, balanceBox: newBalanceBox, updatedAt: serverTimestamp() });
          updates++;
          runningBalance = newBalanceBox;
        } else {
          runningBalance = bill.balanceBox;
        }
      }
      if (updates > 0) await recalcBatch.commit();
    } catch (e) { console.error('Failed to recalculate future party box balances', e); }
  }, [firestore, partyBoxBills, partyOpeningBoxBalances]);

  const deletePartyBoxBills = useCallback(async (billIds: string[]) => {
    if (!firestore || !isCurrentUserAdmin) { toast({ variant: 'destructive', title: 'Permission Denied' }); return; }
    const batch = writeBatch(firestore);
    billIds.forEach(id => batch.delete(doc(firestore, 'party_box_bills', id)));
    try {
      await batch.commit();
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: 'party_box_bills' }));
    }
  }, [firestore, isCurrentUserAdmin, toast]);

  const addPartyBoxBillEntry = useCallback(async (entryData: Omit<PartyBoxBillEntry, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>): Promise<PartyBoxBillEntry | null> => {
    if (!firestore || !currentUser) return null;
    try {
      const entryRef = doc(collection(firestore, 'party_box_bill_entries'));
      const payload = { ...entryData, id: entryRef.id, createdBy: currentUser.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      await setDoc(entryRef, payload);
      return payload as PartyBoxBillEntry;
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'create', path: 'party_box_bill_entries', requestResourceData: entryData }));
      return null;
    }
  }, [firestore, currentUser]);

  const updatePartyBoxBillEntry = useCallback(async (entryId: string, boxesAdded: number): Promise<void> => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'party_box_bill_entries', entryId), { boxesAdded, updatedAt: serverTimestamp() });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'update', path: `party_box_bill_entries/${entryId}` }));
    }
  }, [firestore]);

  const deletePartyBoxBillEntry = useCallback(async (entryId: string): Promise<void> => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'party_box_bill_entries', entryId));
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'delete', path: `party_box_bill_entries/${entryId}` }));
    }
  }, [firestore]);

  return (
    <DataContext.Provider
      value={{
        customers,
        products,
        users,
        uoms,
        vehicles,
        drivers,
        parties,
        partyBills,
        partyBalances,
        vehicleBills,
        liveBillSummaries,
        productPrices,
        customerProductPrices,
        setCustomerProductPrice,
        getCustomerProductPrice,
        openingBalances,
        customerBalances,
        payments,
        partyPayments,
        currentUser,
        isCurrentUserAdmin,
        liveBillItems,
        dashboardStats,
        logout,
        addCustomer,
        editCustomer,
        deleteCustomer,
        addProduct,
        editProduct,
        deleteProduct,
        addUser,
        deleteUser,
        promoteUser,
        updateUserProfile,
        addUom,
        addVehicle,
        editVehicle,
        deleteVehicle,
        addDriver,
        editDriver,
        deleteDriver,
        addParty,
        editParty,
        deleteParty,
        addOrUpdateVehicleBill,
        deleteVehicleBill,
        addOrUpdatePartyBill,
        deletePartyBill,
        setOpeningBalance,
        setPartyBalance,
        createOrUpdateLiveBill,
        deleteBills,
        updateProductPrice,
        addPayment,
        updatePayment,
        softDeletePayment,
        addPartyPayment,
        updatePartyPayment,
        softDeletePartyPayment,
        updateBillPayment,
        findBillForCustomerToday,
        findBillForCustomerOnDate,
        getBill,
        getCustomerLedger,
        getSalesReport,
        statementPrintHistory,
        addStatementPrintHistory,
        getStatementPrintHistoryForCustomer,
        deleteStatementPrintHistory,
        // Box Billing
        boxBills,
        openingBoxBalances,
        customerBoxBalances,
        setOpeningBoxBalance,

        partyBoxBills,
        partyOpeningBoxBalances,
        partyBoxBalances,
        setPartyOpeningBoxBalance,
        addOrUpdatePartyBoxBill,
        deletePartyBoxBills,
        recalculateFuturePartyBoxBalances,
        findPartyBoxBillForPartyOnDate,
        getPartyBoxBill,
        partyBoxBillEntries,
        addPartyBoxBillEntry,
        updatePartyBoxBillEntry,
        deletePartyBoxBillEntry,

        addOrUpdateBoxBill,
        deleteBoxBills,
        recalculateFutureBoxBalances,
        findBoxBillForCustomerOnDate,
        getBoxBill,
        boxBillEntries,
        addBoxBillEntry,
        updateBoxBillEntry,
        deleteBoxBillEntry,
        rolePermissions,
        updateRolePermissions,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
