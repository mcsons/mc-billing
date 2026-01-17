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
  Vehicle,
  Driver,
  VehicleBill,
  CustomerBalance,
} from '@/lib/data';
import { isWithinInterval, startOfDay, endOfDay, startOfYesterday, endOfYesterday } from 'date-fns';
import { useAuth, useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, writeBatch, getDoc, getDocs, query, where, Timestamp, setDoc, addDoc, updateDoc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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
  activeCustomers: number;
  recentBills: LiveBillSummary[];
  topProducts: {
    productId: string;
    productName: string;
    totalQty: number;
    uom: string;
    percentage: number;
  }[];
}

interface DataContextType {
  customers: Customer[];
  products: Product[];
  users: User[];
  uoms: Uom[];
  vehicles: Vehicle[];
  drivers: Driver[];
  vehicleBills: VehicleBill[];
  liveBillSummaries: LiveBillSummary[];
  productPrices: ProductPrices;
  openingBalances: CustomerBalances;
  customerBalances: CustomerBalances;
  payments: Payment[];
  currentUser: User | null;
  isCurrentUserAdmin: boolean;
  liveBillItems: LiveBillItems;
  dashboardStats: DashboardStats;
  logout: () => void;
  addCustomer: (customer: Omit<Customer, 'id'> & { id?: string, openingBalance?: number }) => void;
  deleteCustomer: (customerId: string) => void;
  addProduct: (product: Omit<Product, 'id'> & { id?: string }) => void;
  editProduct: (productId: string, data: Partial<Omit<Product, 'id'>>) => void;
  deleteProduct: (productId: string) => void;
  addUser: (user: Omit<User, 'id' | 'status'> & { password?: string }) => Promise<void>;
  deleteUser: (userId: string) => void;
  promoteUser: (userId: string, username: string, role: 'ADMIN' | 'CREATOR') => void;
  addUom: (uom: Uom) => void;
  addVehicle: (vehicle: Omit<Vehicle, 'active'>) => void;
  editVehicle: (vehicleId: string, data: Partial<Vehicle>) => void;
  deleteVehicle: (vehicleId: string) => void;
  addDriver: (driver: Omit<Driver, 'id' | 'active'>) => void;
  editDriver: (driverId: string, data: Partial<Driver>) => void;
  deleteDriver: (driverId: string) => void;
  addOrUpdateVehicleBill: (bill: Omit<VehicleBill, 'id' | 'createdBy'>, existingBillId?: string) => Promise<VehicleBill | null>;
  deleteVehicleBill: (billId: string) => void;
  removeBillItem: (itemId: string, billNo: string) => void;
  setOpeningBalance: (customerId: string, balance: number) => void;
  createOrUpdateLiveBill: (
    summary: Omit<LiveBillSummary, 'billNo' | 'amount'>,
    items: BillItem[],
    paidAmount: number,
    existingBillNo?: string | null
  ) => { billNo: string; commitPromise: Promise<void> };
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
  
  const vehiclesCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'vehicles') : null, [firestore, firebaseUser]);
  const { data: vehiclesData } = useCollection<Vehicle>(vehiclesCollection);
  const vehicles = useMemo(() => vehiclesData || [], [vehiclesData]);

  const driversCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'drivers') : null, [firestore, firebaseUser]);
  const { data: driversData } = useCollection<Driver>(driversCollection);
  const drivers = useMemo(() => driversData || [], [driversData]);

  const vehicleBillsCollection = useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'vehicleBills') : null, [firestore, firebaseUser]);
  const { data: vehicleBillsData } = useCollection<VehicleBill>(vehicleBillsCollection);
  const vehicleBills = useMemo(() => vehicleBillsData || [], [vehicleBillsData]);


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

  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    todaySales: 0,
    salesChange: 0,
    todayBills: 0,
    billsChange: 0,
    totalPendingBalance: 0,
    activeCustomers: 0,
    recentBills: [],
    topProducts: [],
  });

  const currentUser = useMemo(() => {
    if (isUserLoading || !firebaseUser || isUsersLoading) return null;
    return users.find(u => u.id === firebaseUser.uid) || null;
  }, [firebaseUser, isUserLoading, users, isUsersLoading]);
  
  const adminRoleDocRef = useMemoFirebase(() => {
    if (!firestore || !currentUser) return null;
    return doc(firestore, 'roles_admin', currentUser.id);
  }, [firestore, currentUser]);

  const { data: adminRoleDoc } = useDoc(adminRoleDocRef);

  const isCurrentUserAdmin = useMemo(() => !!adminRoleDoc, [adminRoleDoc]);


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
  }, [firebaseUser, isUserLoading, isUsersLoading, firestore, toast]);

  const { data: customerBalancesData } = useCollection<CustomerBalance>(useMemoFirebase(() => firestore && firebaseUser ? collection(firestore, 'customerBalances') : null, [firestore, firebaseUser]));

  const openingBalances = useMemo(() => {
    if (!customerBalancesData) return {};
    return customerBalancesData.reduce((acc, cb) => {
        acc[cb.id] = cb.balanceAmount;
        return acc;
    }, {} as CustomerBalances);
  }, [customerBalancesData]);

  const customerBalances = useMemo(() => {
    const balances: CustomerBalances = {};
    
    customers.forEach(c => {
        balances[c.id] = openingBalances[c.id] || 0;
    });

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
  }, [customers, liveBillSummaries, payments, openingBalances]);
  
  useEffect(() => {
    if (isUserLoading || !firestore || !products.length) return;

    const calculateStats = async () => {
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      const yesterdayStart = startOfYesterday();
      const yesterdayEnd = endOfYesterday();

      const todayBillsList = (liveBillSummaries || []).filter(bill => {
          const billDate = bill.date ? (bill.date as Timestamp).toDate() : null;
          return billDate && billDate >= todayStart && billDate <= todayEnd;
      });

      const yesterdayBillsList = (liveBillSummaries || []).filter(bill => {
          const billDate = bill.date ? (bill.date as Timestamp).toDate() : null;
          return billDate && billDate >= yesterdayStart && billDate <= yesterdayEnd;
      });

      // Sales and Bills stats
      const todaySales = todayBillsList.reduce((sum, bill) => sum + bill.amount, 0);
      const yesterdaySales = yesterdayBillsList.reduce((sum, bill) => sum + bill.amount, 0);
      const salesChange = yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : todaySales > 0 ? 100 : 0;
      
      const todayBillsCount = todayBillsList.length;
      const yesterdayBillsCount = yesterdayBillsList.length;
      const billsChange = yesterdayBillsCount > 0 ? todayBillsCount - yesterdayBillsCount : todayBillsCount;
      
      // Balance and Customer stats
      const totalPendingBalance = Object.values(customerBalances).reduce((sum, bal) => sum + bal, 0);
      const activeCustomers = new Set(todayBillsList.map(b => b.customerId)).size;

      // Recent Bills
      const recentBills = todayBillsList.sort((a,b) => (b.date as Timestamp).toMillis() - (a.date as Timestamp).toMillis()).slice(0, 5);

      // Top Products
      let topProducts: DashboardStats['topProducts'] = [];
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

          const sortedProducts = [...productSales.entries()]
              .sort(([, a], [, b]) => b.totalQty - a.totalQty)
              .slice(0, 5);

          const maxQty = sortedProducts[0]?.[1].totalQty || 1;

          topProducts = sortedProducts.map(([productId, data]) => ({
              productId,
              productName: data.name,
              totalQty: data.totalQty,
              uom: data.uom,
              percentage: (data.totalQty / maxQty) * 100,
          }));
      }

      setDashboardStats({
          todaySales,
          salesChange,
          todayBills: todayBillsCount,
          billsChange,
          totalPendingBalance,
          activeCustomers,
          recentBills,
          topProducts
      });
    };

    calculateStats();

  }, [liveBillSummaries, customerBalances, firestore, products, isUserLoading]);
  
  
  const logout = () => {
    if (auth) {
      signOut(auth);
    }
  };

  const addCustomer = (customer: Omit<Customer, 'id'> & { id?: string, openingBalance?: number }) => {
    if (!firestore) return;
    let newId = customer.id;
    if (!newId) {
      const maxId = customers
        .map(c => parseInt(c.id.replace('C', ''), 10))
        .filter(num => !isNaN(num))
        .reduce((max, num) => Math.max(max, num), 0);
      newId = `C${(maxId + 1).toString().padStart(3, '0')}`;
    }

    const batch = writeBatch(firestore);
    
    const customerRef = doc(firestore, 'customers', newId);
    const newCustomerData = {
      id: newId,
      name_en: customer.name_en,
      name_ta: customer.name_ta,
      phone: customer.phone,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      active: true,
    };
    batch.set(customerRef, newCustomerData);

    const balanceRef = doc(firestore, 'customerBalances', newId);
    const balanceData = {
        customerId: newId,
        balanceAmount: customer.openingBalance || 0,
        updatedAt: serverTimestamp(),
    };
    batch.set(balanceRef, balanceData);

    batch.commit().catch(error => {
        console.error("Failed to add customer with opening balance:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not save customer."});
    });
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
  
    if (user.role !== 'MANAGER') {
        toast({
            variant: 'destructive',
            title: 'Invalid Role',
            description: 'New users can only be created with the MANAGER role. Promote them to Admin/Creator after creation.',
        });
        return;
    }

    try {
      const email = `${user.username.toLowerCase()}@mcandsons.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, user.password);
      
      const newUser: User = {
        id: userCredential.user.uid,
        username: user.username,
        role: 'MANAGER',
        status: 'Active'
      };
  
      const userRef = doc(firestore, 'users', newUser.id);
      await setDoc(userRef, newUser);

      console.warn("Admin was logged out after user creation. This is expected Firebase behavior. Please log in again to continue managing users.");
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

  const deleteUser = (userId: string) => {
    if (!firestore) return;
    if (!isCurrentUserAdmin) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You do not have permission to delete users.',
      });
      return;
    }
    if (currentUser?.id === userId) {
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

    const adminRoleRef = doc(firestore, 'roles_admin', userId);
    batch.delete(adminRoleRef);

    batch
      .commit()
      .then(() => {
        toast({
          title: 'User Data Removed',
          description: 'To fully delete their login, you must also remove the user from the Firebase Authentication console.',
          duration: 10000,
        });
      })
      .catch((error) => {
        console.error('Failed to delete user data:', error);
        const contextualError = new FirestorePermissionError({
          operation: 'delete',
          path: `users/${userId}`
        });
        errorEmitter.emit('permission-error', contextualError);
      });
  };
  
  const promoteUser = (userId: string, username: string, role: 'ADMIN' | 'CREATOR') => {
    if (!firestore) return;
    if (!isCurrentUserAdmin) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You do not have permission to promote users.',
      });
      return;
    }

    const batch = writeBatch(firestore);

    const userRef = doc(firestore, 'users', userId);
    batch.update(userRef, { role });

    const adminRoleRef = doc(firestore, 'roles_admin', userId);
    batch.set(adminRoleRef, { uid: userId });

    batch.commit()
      .then(() => {
        toast({
          title: 'User Promoted',
          description: `${username} has been promoted to ${role}.`,
        });
      })
      .catch((error) => {
        console.error('Failed to promote user:', error);
        const contextualError = new FirestorePermissionError({
          operation: 'write', 
          path: `users/${userId} and roles_admin/${userId}`,
          requestResourceData: { role }
        });
        errorEmitter.emit('permission-error', contextualError);
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
  ): { billNo: string; commitPromise: Promise<void> } => {
    if (!firestore) {
        toast({
            variant: "destructive",
            title: "Database not available",
            description: "Could not connect to Firestore.",
        });
        return { billNo: "error-no-firestore", commitPromise: Promise.reject(new Error("Firestore not available")) };
    }

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const customerId = summary.customerId;

    const billNo = existingBillNo || (() => {
        const maxBillNo = (liveBillSummaries || [])
            .map(b => parseInt(b.billNo.replace('B', ''), 10))
            .filter(num => !isNaN(num))
            .reduce((max, num) => Math.max(max, num), 1237);
        return `B${maxBillNo + 1}`;
    })();
    
    const billRef = doc(firestore, 'bills', billNo);
    const batch = writeBatch(firestore);

    const summaryPayload: Omit<LiveBillSummary, 'date'> & {date: any, createdAt?: any, updatedAt?: any} = { ...summary, billNo, amount: totalAmount };
    if (existingBillNo) {
      summaryPayload.updatedAt = serverTimestamp();
      batch.update(billRef, summaryPayload);
    } else {
      summaryPayload.createdAt = serverTimestamp();
      batch.set(billRef, summaryPayload, {});
      
      if (paidAmount > 0) {
        addPayment({ customerId, amount: paidAmount, notes: `Payment for new bill ${billNo}` });
      }
    }

    const itemsCollectionRef = collection(firestore, 'bills', billNo, 'billItems');
    items.forEach(item => {
      const itemData: BillItem = { ...item, billId: billNo }; 
      const itemRef = doc(itemsCollectionRef, item.id);
      batch.set(itemRef, itemData, { merge: true });
    });

    const commitPromise = batch.commit().catch(error => {
      console.error("Batch commit failed:", error);
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: `bills/${billNo}/billItems`,
          operation: 'write',
          requestResourceData: items.map(i => ({...i, billId: billNo})),
        })
      );
      throw error;
    });

    return { billNo, commitPromise };
  };

    const deleteBills = async (billNos: string[]) => {
      if (!firestore) return;
  
      try {
          const batch = writeBatch(firestore);
  
          for (const billNo of billNos) {
              const billRef = doc(firestore, 'bills', billNo);
  
              // Find and delete billItems
              const itemsQuery = query(collection(firestore, 'bills', billNo, 'billItems'));
              const itemsSnapshot = await getDocs(itemsQuery);
              itemsSnapshot.forEach(itemDoc => {
                  batch.delete(itemDoc.ref);
              });
  
              // Delete the bill itself
              batch.delete(billRef);
          }
  
          await batch.commit();
          toast({
              title: 'Bills Deleted',
              description: `${billNos.length} bill(s) and their items have been permanently deleted.`,
          });
  
      } catch (error) {
          console.error("Failed to delete bills:", error);
          toast({
              variant: "destructive",
              title: "Deletion Failed",
              description: "Could not delete one or more bills. Check permissions and console for details.",
          });
          const contextualError = new FirestorePermissionError({
              operation: 'delete',
              path: `bills collection`, // Generic path
          });
          errorEmitter.emit('permission-error', contextualError);
      }
    };

  const addPayment = (payment: Omit<Payment, 'id' | 'date'>) => {
      if (!firestore) return;
      const paymentsCol = collection(firestore, 'payments');
      addDocumentNonBlocking(paymentsCol, {
          ...payment,
          date: serverTimestamp(),
      });
  }

  const setOpeningBalance = (customerId: string, balance: number) => {
    if (!firestore) return;
    const balanceRef = doc(firestore, 'customerBalances', customerId);
    setDocumentNonBlocking(balanceRef, {
        customerId: customerId,
        balanceAmount: balance,
        updatedAt: serverTimestamp()
    }, { merge: true });
    toast({ title: 'Balance Updated', description: `Opening balance has been set to ₹${balance.toFixed(2)}.` });
  };

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

    const initialOpeningBalance = openingBalances[customerId] || 0;

    const allBills = (liveBillSummaries || []).filter(b => b.customerId === customerId && b.date);
    const allPayments = (payments || []).filter(p => p.customerId === customerId);

    const priorBills = allBills.filter(b => ((b.date as Timestamp).toDate()) < fromDateStart);
    const priorPayments = allPayments.filter(p => ((p.date as Timestamp).toDate()) < fromDateStart);

    const totalPriorBilled = priorBills.reduce((sum, b) => sum + b.amount, 0);
    const totalPriorPaid = priorPayments.reduce((sum, p) => sum + p.amount, 0);
    const openingBalanceForPeriod = initialOpeningBalance + totalPriorBilled - totalPriorPaid;
    
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

    let currentBalance = openingBalanceForPeriod;
    const finalTransactions = sortedTransactions.map(t => {
      if (t.type === 'bill') {
        currentBalance += t.billedAmount || 0;
      } else {
        currentBalance -= t.receivedAmount || 0;
      }
      return { ...t, balance: currentBalance };
    });

    return { transactions: finalTransactions, openingBalance: openingBalanceForPeriod };
  };

  // Vehicle and Driver Management
  const addVehicle = (vehicle: Omit<Vehicle, 'active'>) => {
    if (!firestore) return;
    const vehicleRef = doc(firestore, 'vehicles', vehicle.id);
    setDocumentNonBlocking(vehicleRef, { ...vehicle, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, {});
    toast({ title: 'Vehicle Added' });
  };

  const editVehicle = (vehicleId: string, data: Partial<Vehicle>) => {
    if (!firestore) return;
    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    updateDocumentNonBlocking(vehicleRef, { ...data, updatedAt: serverTimestamp() });
    toast({ title: 'Vehicle Updated' });
  };

  const deleteVehicle = (vehicleId: string) => {
    if (!firestore) return;
    const vehicleRef = doc(firestore, 'vehicles', vehicleId);
    deleteDocumentNonBlocking(vehicleRef);
    toast({ title: 'Vehicle Deleted' });
  };

  const addDriver = (driver: Omit<Driver, 'id' | 'active'>) => {
    if (!firestore) return;
    const driversCol = collection(firestore, 'drivers');
    addDocumentNonBlocking(driversCol, { ...driver, active: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    toast({ title: 'Driver Added' });
  };

  const editDriver = (driverId: string, data: Partial<Driver>) => {
    if (!firestore) return;
    const driverRef = doc(firestore, 'drivers', driverId);
    updateDocumentNonBlocking(driverRef, { ...data, updatedAt: serverTimestamp() });
    toast({ title: 'Driver Updated' });
  };

  const deleteDriver = (driverId: string) => {
    if (!firestore) return;
    const driverRef = doc(firestore, 'drivers', driverId);
    deleteDocumentNonBlocking(driverRef);
    toast({ title: 'Driver Deleted' });
  };

  const addOrUpdateVehicleBill = async (bill: Omit<VehicleBill, 'id' | 'createdBy'>, existingBillId?: string): Promise<VehicleBill | null> => {
    if (!firestore || !currentUser) return null;
    
    const finalBillData: Omit<VehicleBill, 'id'> = {
        ...bill,
        createdBy: currentUser.id,
        updatedAt: serverTimestamp(),
    };

    if (existingBillId) {
        const billRef = doc(firestore, 'vehicleBills', existingBillId);
        await updateDoc(billRef, finalBillData);
        return { ...finalBillData, id: existingBillId };
    } else {
        const billWithCreationDate = {
            ...finalBillData,
            createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(firestore, 'vehicleBills'), billWithCreationDate);
        return { ...billWithCreationDate, id: docRef.id };
    }
  };

  const deleteVehicleBill = (billId: string) => {
    if (!firestore) return;
    const billRef = doc(firestore, 'vehicleBills', billId);
    deleteDocumentNonBlocking(billRef);
    toast({ title: 'Vehicle Bill Deleted' });
  };


  return (
    <DataContext.Provider
      value={{
        customers,
        products,
        users,
        uoms,
        vehicles,
        drivers,
        vehicleBills,
        liveBillSummaries,
        productPrices,
        openingBalances,
        customerBalances,
        payments,
        currentUser,
        isCurrentUserAdmin,
        liveBillItems,
        dashboardStats,
        logout,
        addCustomer,
        deleteCustomer,
        addProduct,
        editProduct,
        deleteProduct,
        addUser,
        deleteUser,
        promoteUser,
        addUom,
        addVehicle,
        editVehicle,
        deleteVehicle,
        addDriver,
        editDriver,
        deleteDriver,
        addOrUpdateVehicleBill,
        deleteVehicleBill,
        removeBillItem,
        setOpeningBalance,
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
