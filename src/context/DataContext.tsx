'use client';
import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Customer,
  Product,
  BillItem,
  LiveBillSummary,
  Payment,
  User,
  Transaction,
  Uom,
} from '@/lib/data';
import { isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { useAuth, useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';


type ProductPrices = Record<string, Record<string, number>>;
type CustomerBalances = Record<string, number>;
type LiveBillItems = Record<string, BillItem[]>; // Keyed by billNo

interface DataContextType {
  customers: Customer[];
  products: Product[];
  users: User[];
  uoms: Uom[];
  liveBillSummaries: LiveBillSummary[];
  productPrices: ProductPrices;
  customerBalances: CustomerBalances;
  payments: Payment[];
  currentUser: User | null;
  liveBillItems: LiveBillItems;
  login: (username: string, password?: string) => User | null;
  logout: () => void;
  addCustomer: (customer: Omit<Customer, 'id'> & { id?: string }) => void;
  deleteCustomer: (customerId: string) => void;
  addProduct: (product: Omit<Product, 'id'> & { id?: string }) => void;
  editProduct: (productId: string, data: Partial<Omit<Product, 'id'>>) => void;
  deleteProduct: (productId: string) => void;
  addUser: (user: Omit<User, 'id' | 'status'>) => void;
  addUom: (uom: Uom) => void;
  removeBillItem: (itemId: number, billNo: string) => void;
  createOrUpdateLiveBill: (
    summary: Omit<LiveBillSummary, 'billNo' | 'amount' | 'customerId'> & { customerId: string },
    items: BillItem[],
    paidAmount: number,
    existingBillNo?: string | null
  ) => string;
  deleteBills: (billNos: string[]) => void;
  updateProductPrice: (productId: string, uom: string, price: number) => void;
  addPayment: (payment: Omit<Payment, 'id' | 'date'>) => void;
  findBillForCustomerToday: (customerId: string) => LiveBillSummary | undefined;
  getBillItems: (billNo: string) => BillItem[];
  getBill: (billNo: string) => LiveBillSummary | undefined;
  getCustomerLedger: (
    customerId: string, 
    dateRange: { from: Date, to: Date }
  ) => { transactions: Transaction[], openingBalance: number };
  auth: any;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user: firebaseUser, isUserLoading } = useUser();

  const customersCollection = useMemoFirebase(() => firestore ? collection(firestore, 'customers') : null, [firestore]);
  const { data: customersData } = useCollection<Customer>(customersCollection);
  const customers = useMemo(() => customersData || [], [customersData]);

  const productsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'products') : null, [firestore]);
  const { data: productsData } = useCollection<Product>(productsCollection);
  const products = useMemo(() => productsData || [], [productsData]);
  
  const usersCollection = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: usersData } = useCollection<User>(usersCollection);
  const users = useMemo(() => usersData || [], [usersData]);

  const uomsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'uoms') : null, [firestore]);
  const { data: uomsData } = useCollection<{name: string}>(uomsCollection);
  const uoms = useMemo(() => (uomsData || []).map(u => u.name), [uomsData]);


  const billsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'bills') : null, [firestore]);
  const { data: liveBillSummariesData } = useCollection<LiveBillSummary>(billsCollection);
  const liveBillSummaries = useMemo(() => liveBillSummariesData || [], [liveBillSummariesData]);


  const paymentsCollection = useMemoFirebase(() => firestore ? collection(firestore, 'payments') : null, [firestore]);
  const { data: paymentsData } = useCollection<Payment>(paymentsCollection);
  const payments = useMemo(() => paymentsData || [], [paymentsData]);
  
  const [liveBillItems, setLiveBillItems] = useState<LiveBillItems>({});
  
  const { data: pricesData } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'productPrices') : null, [firestore]));
  const productPrices = useMemo(() => {
    return (pricesData || []).reduce((acc, price) => {
        if (!acc[price.productId]) {
            acc[price.productId] = {};
        }
        acc[price.productId][price.uom] = price.pricePerUom;
        return acc;
    }, {} as ProductPrices);
  }, [pricesData]);


  const currentUser = useMemo(() => {
    if (isUserLoading || !firebaseUser) return null;
    return users.find(u => u.id === firebaseUser.uid) || null;
  }, [firebaseUser, isUserLoading, users]);


  const customerBalances = useMemo(() => {
    const balances: CustomerBalances = {};
    customers.forEach(c => balances[c.id] = 0);

    const allTransactions = [
        ...liveBillSummaries.map(bill => ({
            customerId: bill.customerId,
            amount: bill.amount,
            type: 'bill' as const,
            date: bill.date || new Date(0)
        })),
        ...payments.map(payment => ({
            customerId: payment.customerId,
            amount: payment.amount,
            type: 'payment' as const,
            date: payment.date
        }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    allTransactions.forEach(tx => {
        if (tx.customerId && typeof balances[tx.customerId] !== 'undefined') {
            if (tx.type === 'bill') {
                balances[tx.customerId] += tx.amount;
            } else {
                balances[tx.customerId] -= tx.amount;
            }
        }
    });
    
    return balances;
  }, [customers, liveBillSummaries, payments]);


  const login = (username: string, password?: string): User | null => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      return user;
    }
    return null;
  };
  
  const logout = () => {
    auth?.signOut();
  };

  const addCustomer = (customer: Omit<Customer, 'id'> & { id?: string }) => {
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
    const newCustomerData = {
      ...customer,
      id: newId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      active: true,
    }
    setDocumentNonBlocking(customerRef, newCustomerData, {});
  };
  
  const deleteCustomer = (customerId: string) => {
    if (!firestore) return;
    const customerRef = doc(firestore, 'customers', customerId);
    deleteDocumentNonBlocking(customerRef);
    toast({ title: 'Customer Deleted', description: `Customer ${customerId} has been deleted.` });
  };

  const addProduct = (product: Omit<Product, 'id'> & { id?: string }) => {
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
      setDocumentNonBlocking(productRef, newProductData, {});
  };
  
  const editProduct = (productId: string, data: Partial<Omit<Product, 'id'>>) => {
    if (!firestore) return;
    const productRef = doc(firestore, 'products', productId);
    updateDocumentNonBlocking(productRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
  };
  
  const deleteProduct = (productId: string) => {
    if (!firestore) return;
    const productRef = doc(firestore, 'products', productId);
    deleteDocumentNonBlocking(productRef);
    toast({ title: 'Product Deleted', description: `Product ${productId} has been deleted.` });
  };

  const addUser = (user: Omit<User, 'id' | 'status'>) => {
    // This should be a cloud function for security reasons
    console.log("addUser is not implemented for client-side for security reasons.", user);
    toast({ variant: "destructive", title: "Action not allowed", description: "Creating users from the client is disabled."});
  };
  
  const addUom = (uom: Uom) => {
    if (!firestore) return;
    const uomRef = doc(firestore, 'uoms', uom.toUpperCase());
    setDocumentNonBlocking(uomRef, { name: uom.toUpperCase() }, {});
  };

  const removeBillItem = (itemId: number, billNo: string) => {
    // Bill items are now subcollections, handle this with a transaction
    console.log("removeBillItem needs to be implemented with subcollections", itemId, billNo);
  };
  
  const findBillForCustomerToday = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return undefined;
    const today = startOfDay(new Date());
    return liveBillSummaries.find(bill => {
        const billDate = bill.date ? new Date(bill.date) : null;
        if (!billDate || bill.customerId !== customerId) return false;
        return startOfDay(billDate).getTime() === today.getTime();
    });
  };

  const getBillItems = useCallback((billNo: string) => {
    // This will need to be replaced with a `useCollection` call for the subcollection
    return liveBillItems[billNo] || [];
  }, [liveBillItems]);
  
  const getBill = (billNo: string) => {
    return liveBillSummaries.find(b => b.billNo === billNo);
  };


  const createOrUpdateLiveBill = (
    summary: Omit<LiveBillSummary, 'billNo' | 'amount' | 'customerId'> & {customerId: string}, 
    items: BillItem[],
    paidAmount: number,
    existingBillNo?: string | null
  ) => {
    if (!firestore) return "error-no-firestore";

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const customerId = summary.customerId;

    if (existingBillNo) {
        const billRef = doc(firestore, 'bills', existingBillNo);
        updateDocumentNonBlocking(billRef, { ...summary, amount: totalAmount, updatedAt: serverTimestamp() });
        // Update bill items subcollection
        const batch = writeBatch(firestore);
        const itemsCollectionRef = collection(firestore, 'bills', existingBillNo, 'billItems');
        // This is simplified. In reality, you'd need to fetch existing items and diff.
        items.forEach(item => {
            const itemRef = doc(itemsCollectionRef, item.id.toString());
            batch.set(itemRef, item);
        });
        batch.commit();
        return existingBillNo;
    } else {
        const maxBillNo = liveBillSummaries
            .map(b => parseInt(b.billNo.replace('B', ''), 10))
            .filter(num => !isNaN(num))
            .reduce((max, num) => Math.max(max, num), 1237);
        const newBillNo = `B${maxBillNo + 1}`;
        
        const newSummary: LiveBillSummary = {
            ...summary,
            billNo: newBillNo,
            amount: totalAmount,
            customerId: customerId
        };
        const billRef = doc(firestore, 'bills', newBillNo);
        setDocumentNonBlocking(billRef, { ...newSummary, createdAt: serverTimestamp() }, {});

        const batch = writeBatch(firestore);
        const itemsCollectionRef = collection(firestore, 'bills', newBillNo, 'billItems');
        items.forEach(item => {
            const itemRef = doc(itemsCollectionRef, item.id.toString());
            batch.set(itemRef, item);
        });
        batch.commit();

        if (paidAmount > 0) {
            addPayment({
                customerId,
                amount: paidAmount,
                notes: `Payment for new bill ${newBillNo}`
            });
        }
        
        return newBillNo;
    }
  };

    const deleteBills = (billNos: string[]) => {
       if (!firestore) return;
       const batch = writeBatch(firestore);
       billNos.forEach(billNo => {
           const billRef = doc(firestore, 'bills', billNo);
           batch.delete(billRef);
       });
       batch.commit().then(() => {
           toast({
                title: 'Bills Deleted',
                description: `${billNos.length} bill(s) have been permanently deleted.`,
            });
       });
    };

  const addPayment = (payment: Omit<Payment, 'id' | 'date'>) => {
      if (!firestore) return;
      const paymentsCol = collection(firestore, 'payments');
      addDocumentNonBlocking(paymentsCol, {
          ...payment,
          date: serverTimestamp(),
      });
  }

  const updateProductPrice = (productId: string, uom: string, price: number) => {
    if (!firestore) return;
    const priceId = `${productId}_${uom}_${new Date().toISOString().split('T')[0]}`;
    const priceRef = doc(firestore, 'productPrices', priceId);
    setDocumentNonBlocking(priceRef, {
        productId,
        uom,
        pricePerUom: price,
        priceDate: new Date().toISOString().split('T')[0]
    }, {merge: true});
  };

  const getCustomerLedger = (
    customerId: string, 
    dateRange: { from: Date, to: Date }
  ): { transactions: Transaction[], openingBalance: number } => {
    
    const fromDateStart = startOfDay(dateRange.from);
    const toDateEnd = endOfDay(dateRange.to);

    const allBills = liveBillSummaries.filter(b => b.customerId === customerId && b.date);
    const allPayments = payments.filter(p => p.customerId === customerId);

    const priorBills = allBills.filter(b => new Date(b.date!) < fromDateStart);
    const priorPayments = allPayments.filter(p => new Date(p.date) < fromDateStart);

    const totalPriorBilled = priorBills.reduce((sum, b) => sum + b.amount, 0);
    const totalPriorPaid = priorPayments.reduce((sum, p) => sum + p.amount, 0);
    const openingBalance = totalPriorBilled - totalPriorPaid;
    
    const interval = { start: fromDateStart, end: toDateEnd };
    
    const billsInRange = allBills.filter(b => isWithinInterval(new Date(b.date!), interval));
    const paymentsInRange = allPayments.filter(p => isWithinInterval(new Date(p.date), interval));

    const mappedBills: Transaction[] = billsInRange.map(b => ({
      date: new Date(b.date!),
      description: `Bill No: ${b.billNo}`,
      billedAmount: b.amount,
      balance: 0,
      type: 'bill',
    }));

    const mappedPayments: Transaction[] = paymentsInRange.map(p => ({
      date: new Date(p.date),
      description: p.notes || 'Payment Received',
      receivedAmount: p.amount,
      balance: 0,
      type: 'payment',
    }));

    const sortedTransactions = [...mappedBills, ...mappedPayments].sort((a, b) => a.date.getTime() - b.date.getTime());

    let currentBalance = openingBalance;
    const finalTransactions = sortedTransactions.map(t => {
      if (t.type === 'bill') {
        currentBalance += t.billedAmount || 0;
      } else {
        currentBalance -= t.receivedAmount || 0;
      }
      return { ...t, balance: currentBalance };
    });

    return { transactions: finalTransactions, openingBalance };
  };

  return (
    <DataContext.Provider
      value={{
        customers,
        products,
        users,
        uoms,
        liveBillSummaries,
        productPrices,
        customerBalances,
        payments,
        currentUser,
        liveBillItems,
        login,
        logout,
        addCustomer,
        deleteCustomer,
        addProduct,
        editProduct,
        deleteProduct,
        addUser,
        addUom,
        removeBillItem,
        createOrUpdateLiveBill,
        deleteBills,
        updateProductPrice,
        addPayment,
        findBillForCustomerToday,
        getBillItems,
        getBill,
        getCustomerLedger,
        auth,
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
