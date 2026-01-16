'use client';
import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
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
import { collection, doc, serverTimestamp, writeBatch, getDoc, getDocs, query, where, Timestamp, setDoc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { FirestorePermissionError, errorEmitter } from '@/firebase';


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
  logout: () => void;
  addCustomer: (customer: Omit<Customer, 'id'> & { id?: string }) => void;
  deleteCustomer: (customerId: string) => void;
  addProduct: (product: Omit<Product, 'id'> & { id?: string }) => void;
  editProduct: (productId: string, data: Partial<Omit<Product, 'id'>>) => void;
  deleteProduct: (productId: string) => void;
  addUser: (user: Omit<User, 'id' | 'status'> & { password?: string }) => Promise<void>;
  deleteUser: (userId: string) => void;
  addUom: (uom: Uom) => void;
  removeBillItem: (itemId: string, billNo: string) => void;
  createOrUpdateLiveBill: (
    summary: Omit<LiveBillSummary, 'billNo' | 'amount'>,
    items: BillItem[],
    paidAmount: number,
    existingBillNo?: string | null
  ) => string;
  deleteBills: (billNos: string[]) => void;
  updateProductPrice: (productId: string, uom: string, price: number) => void;
  addPayment: (payment: Omit<Payment, 'id' | 'date'>) => void;
  findBillForCustomerToday: (customerId: string) => LiveBillSummary | undefined;
  getBill: (billNo: string) => LiveBillSummary | undefined;
  getCustomerLedger: (
    customerId: string, 
    dateRange: { from: Date, to: Date }
  ) => { transactions: Transaction[], openingBalance: number };
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


  const billsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'bills') : null, [firestore, firebaseUser]);
  const { data: liveBillSummariesData } = useCollection<LiveBillSummary>(billsCollection);
  const liveBillSummaries = useMemo(() => liveBillSummariesData || [], [liveBillSummariesData]);


  const paymentsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'payments') : null, [firestore, firebaseUser]);
  const { data: paymentsData } = useCollection<Payment>(paymentsCollection);
  const payments = useMemo(() => paymentsData || [], [paymentsData]);
  
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

  const currentUser = useMemo(() => {
    if (isUserLoading || !firebaseUser || isUsersLoading) return null;
    return users.find(u => u.id === firebaseUser.uid) || null;
  }, [firebaseUser, isUserLoading, users, isUsersLoading]);


  useEffect(() => {
    const handleFirstSignIn = async () => {
      if (!firestore || !firebaseUser || isUserLoading || isUsersLoading) return;
      
      const userDocRef = doc(firestore, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      // Only proceed if the user document does *not* exist.
      if (!userDocSnap.exists()) {
        const username = firebaseUser.email?.split('@')[0] || 'new-user';
        
        let role: User['role'] = 'MANAGER'; // Default role
        
        // Special check for the 'creator' user.
        if (username.toLowerCase() === 'creator' && firebaseUser.email === 'creator@mcandsons.com') {
            role = 'CREATOR';
        }

        const newUser: User = {
          id: firebaseUser.uid,
          username,
          role,
          status: 'Active',
        };

        const batch = writeBatch(firestore);
        batch.set(userDocRef, newUser);

        // If the role is Creator, also grant them admin privileges.
        if (role === 'CREATOR') {
            const adminRoleRef = doc(firestore, 'roles_admin', firebaseUser.uid);
            batch.set(adminRoleRef, { uid: firebaseUser.uid });
        }
        
        // This commit can still fail if the rules are not set up for the first user.
        try {
            await batch.commit();
            toast({
              title: 'Profile Created',
              description: `Your user profile has been set up with the role: ${role}`,
            });
        } catch (error) {
            console.error("Failed to create initial user profile:", error);
            // Don't show a toast here as it might be a transient permissions issue during setup
        }
      }
    };

    if (!isUserLoading && firebaseUser && !isUsersLoading) {
      handleFirstSignIn();
    }
  }, [firebaseUser, isUserLoading, isUsersLoading, firestore, toast]);


  const customerBalances = useMemo(() => {
    const balances: CustomerBalances = {};
    if (!customers) return balances;
    customers.forEach(c => balances[c.id] = 0);

    const allTransactions: {customerId: string, amount: number, type: 'bill' | 'payment', date: Date | Timestamp}[] = [
        ...(liveBillSummaries || []).map(bill => ({
            customerId: bill.customerId,
            amount: bill.amount,
            type: 'bill' as const,
            date: bill.date || new Date(0)
        })),
        ...(payments || []).map(payment => ({
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
        }
    });
    
    return balances;
  }, [customers, liveBillSummaries, payments]);

  
  const logout = () => {
    if (auth) {
      signOut(auth);
    }
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

  const addUser = async (user: Omit<User, 'id' | 'status'> & { password?: string }) => {
    if (!firestore || !auth) {
        toast({ variant: "destructive", title: "Action not allowed", description: "Services not available."});
        return;
    };
    if (currentUser?.role !== 'CREATOR') {
      toast({ variant: "destructive", title: "Permission Denied", description: "Only the Creator can add new users."});
      return;
    }
    if (!user.password) {
        toast({ variant: "destructive", title: "Password Required", description: "A password must be provided."});
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

        const batch = writeBatch(firestore);
        const userRef = doc(firestore, 'users', newUser.id);
        batch.set(userRef, newUser);
        
        if (user.role === 'ADMIN' || user.role === 'CREATOR') {
            const adminRoleRef = doc(firestore, 'roles_admin', newUser.id);
            batch.set(adminRoleRef, { uid: newUser.id });
        }
        
        await batch.commit();

        toast({ title: "User Created", description: `User ${user.username} has been created.`});
    } catch(error: any) {
        console.error("Error creating user:", error);
        if (error.code === 'auth/email-already-in-use') {
             toast({ variant: "destructive", title: "User Exists", description: "A user with this username already exists." });
        } else if (error.code?.includes('permission-denied')) {
             toast({ variant: "destructive", title: "Permission Denied", description: "Could not set admin privileges. Please do this manually in the Firebase console." });
        }
        else {
            toast({ variant: "destructive", title: "Failed to create user", description: error.message });
        }
    }
  };

  const deleteUser = (userId: string) => {
    if (!firestore || !currentUser) return;
    if (currentUser.role !== 'CREATOR') {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You do not have permission to delete users.',
      });
      return;
    }
    if (currentUser.id === userId) {
      toast({
        variant: 'destructive',
        title: 'Action Not Allowed',
        description: 'You cannot delete your own account.',
      });
      return;
    }

    const batch = writeBatch(firestore);

    const userRef = doc(firestore, 'users', userId);
    batch.delete(userRef);

    // Also attempt to delete their admin role document, if it exists
    const adminRoleRef = doc(firestore, 'roles_admin', userId);
    batch.delete(adminRoleRef);

    batch
      .commit()
      .then(() => {
        toast({
          title: 'User Deleted',
          description: 'The user has been successfully deleted.',
        });
      })
      .catch((error) => {
        console.error('Failed to delete user:', error);
        toast({
          variant: 'destructive',
          title: 'Delete Failed',
          description: 'Could not delete the user.',
        });
      });
  };
  
  const addUom = (uom: Uom) => {
    if (!firestore) return;
    const uomRef = doc(firestore, 'uoms', uom.toUpperCase());
    setDocumentNonBlocking(uomRef, { name: uom.toUpperCase() }, {});
  };

  const removeBillItem = (itemId: string, billNo: string) => {
    if (!firestore) return;
    const itemRef = doc(firestore, 'bills', billNo, 'billItems', itemId);
    deleteDocumentNonBlocking(itemRef);
  };
  
  const findBillForCustomerToday = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return undefined;
    const today = startOfDay(new Date());
    return (liveBillSummaries || []).find(bill => {
        const billDate = bill.date ? (bill.date as Timestamp).toDate() : null;
        if (!billDate || bill.customerId !== customerId) return false;
        return startOfDay(billDate).getTime() === today.getTime();
    });
  };

  const getBill = (billNo: string) => {
    return (liveBillSummaries || []).find(b => b.billNo === billNo);
  };


  const createOrUpdateLiveBill = (
    summary: Omit<LiveBillSummary, 'billNo' | 'amount'>,
    items: BillItem[],
    paidAmount: number,
    existingBillNo?: string | null
  ) => {
    if (!firestore) return "error-no-firestore";

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const customerId = summary.customerId;

    // 1. Determine Bill Number
    const billNo = existingBillNo || (() => {
        const maxBillNo = (liveBillSummaries || [])
            .map(b => parseInt(b.billNo.replace('B', ''), 10))
            .filter(num => !isNaN(num))
            .reduce((max, num) => Math.max(max, num), 1237);
        return `B${maxBillNo + 1}`;
    })();
    
    const billRef = doc(firestore, 'bills', billNo);
    const batch = writeBatch(firestore);

    // 2. Create or Update Bill Summary Document
    const summaryPayload: LiveBillSummary = { ...summary, billNo, amount: totalAmount };
    if (existingBillNo) {
      batch.update(billRef, { ...summaryPayload, updatedAt: serverTimestamp() });
    } else {
      batch.set(billRef, { ...summaryPayload, createdAt: serverTimestamp() }, {});
      
      if (paidAmount > 0) {
        addPayment({ customerId, amount: paidAmount, notes: `Payment for new bill ${billNo}` });
      }
    }

    // 3. Batch write all items with correct billId
    const itemsCollectionRef = collection(firestore, 'bills', billNo, 'billItems');
    items.forEach(item => {
      const itemData: BillItem = { ...item, billId: billNo };
      const itemRef = doc(itemsCollectionRef, item.id);
      batch.set(itemRef, itemData, { merge: true });
    });

    // 4. Commit batch and handle errors
    batch.commit().catch(error => {
      console.error("Batch commit failed:", error);
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: `bills/${billNo}/billItems`,
          operation: 'write',
          requestResourceData: items.map(i => ({...i, billId: billNo})),
        })
      );
    });

    return billNo;
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

    const allBills = (liveBillSummaries || []).filter(b => b.customerId === customerId && b.date);
    const allPayments = (payments || []).filter(p => p.customerId === customerId);

    const priorBills = allBills.filter(b => ((b.date as Timestamp).toDate()) < fromDateStart);
    const priorPayments = allPayments.filter(p => ((p.date as Timestamp).toDate()) < fromDateStart);

    const totalPriorBilled = priorBills.reduce((sum, b) => sum + b.amount, 0);
    const totalPriorPaid = priorPayments.reduce((sum, p) => sum + p.amount, 0);
    const openingBalance = totalPriorBilled - totalPriorPaid;
    
    const interval = { start: fromDateStart, end: toDateEnd };
    
    const billsInRange = allBills.filter(b => isWithinInterval((b.date as Timestamp).toDate(), interval));
    const paymentsInRange = allPayments.filter(p => isWithinInterval((p.date as Timestamp).toDate(), interval));

    const mappedBills: Transaction[] = billsInRange.map(b => ({
      date: (b.date as Timestamp).toDate(),
      description: `Bill No: ${b.billNo}`,
      billedAmount: b.amount,
      balance: 0,
      type: 'bill',
    }));

    const mappedPayments: Transaction[] = paymentsInRange.map(p => ({
      date: (p.date as Timestamp).toDate(),
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
        logout,
        addCustomer,
        deleteCustomer,
        addProduct,
        editProduct,
        deleteProduct,
        addUser,
        deleteUser,
        addUom,
        removeBillItem,
        createOrUpdateLiveBill,
        deleteBills,
        updateProductPrice,
        addPayment,
        findBillForCustomerToday,
        getBill,
        getCustomerLedger,
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
