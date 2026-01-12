'use client';
import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Customer,
  Product,
  BillItem,
  LiveBillSummary,
  Payment,
  User,
  customers as initialCustomers,
  products as initialProducts,
  liveBillSummaries as initialLiveBillSummaries,
  users as initialUsers,
  liveHistoryItems,
} from '@/lib/data';

type ProductPrices = Record<string, Record<string, number>>;
type CustomerBalances = Record<string, number>;
type LiveBillItems = Record<string, BillItem[]>; // Keyed by billNo

interface DataContextType {
  customers: Customer[];
  products: Product[];
  users: User[];
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
  removeBillItem: (itemId: number, billNo: string) => void;
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
  getBillItems: (billNo: string) => BillItem[];
  getBill: (billNo: string) => LiveBillSummary | undefined;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [liveBillSummaries, setLiveBillSummaries] = useState<LiveBillSummary[]>(initialLiveBillSummaries);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [productPrices, setProductPrices] = useState<ProductPrices>({
    'P01': { KGS: 250, NOS: 50 },
    'P02': { KGS: 450, BOX: 3200 },
    'P03': { KGS: 400, NOS: 150 },
    'P04': { KGS: 180, BOX: 1500 },
    'P05': { KGS: 200, NOS: 40 },
  });
  const [customerBalances, setCustomerBalances] = useState<CustomerBalances>({
    'C001': 500,
    'C002': 1200,
    'C003': 0,
    'C004': -300,
  });
  const [payments, setPayments] = useState<Payment[]>([]);

  const [liveBillItems, setLiveBillItems] = useState<LiveBillItems>(liveHistoryItems);

  const getCustomerIdFromName = (customerName: string) => {
    const customer = customers.find(c => customerName.includes(c.name_en));
    return customer?.id;
  };

  const login = (username: string, password?: string): User | null => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      return user;
    }
    setCurrentUser(null);
    return null;
  };
  
  const logout = () => {
    setCurrentUser(null);
  };

  const addCustomer = (customer: Omit<Customer, 'id'> & { id?: string }) => {
    setCustomers((prev) => {
      let newId = customer.id;
      if (!newId) {
        const maxId = prev
          .map(c => parseInt(c.id.replace('C', ''), 10))
          .filter(num => !isNaN(num))
          .reduce((max, num) => Math.max(max, num), 0);
        newId = `C${(maxId + 1).toString().padStart(3, '0')}`;
      }
      const newCustomer: Customer = {
        ...customer,
        id: newId,
      };
      setCustomerBalances(prevBalances => ({...prevBalances, [newId as string]: 0}));
      return [...prev, newCustomer];
    });
  };
  
  const deleteCustomer = (customerId: string) => {
    setCustomers(prev => prev.filter(c => c.id !== customerId));
    toast({ title: 'Customer Deleted', description: `Customer ${customerId} has been deleted.` });
  };

  const addProduct = (product: Omit<Product, 'id'> & { id?: string }) => {
    setProducts((prev) => {
      let newId = product.id;
      if (!newId) {
        const maxId = prev
          .map(p => parseInt(p.id.replace('P', ''), 10))
          .filter(num => !isNaN(num))
          .reduce((max, num) => Math.max(max, num), 0);
        newId = `P${(maxId + 1).toString().padStart(2, '0')}`;
      }
      const newProduct: Product = {
        ...product,
        id: newId,
      };
      return [...prev, newProduct];
    });
  };
  
  const editProduct = (productId: string, data: Partial<Omit<Product, 'id'>>) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...data } : p));
  };
  
  const deleteProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
    toast({ title: 'Product Deleted', description: `Product ${productId} has been deleted.` });
  };

  const addUser = (user: Omit<User, 'id' | 'status'>) => {
    setUsers((prev) => {
        const maxId = prev
            .map(u => parseInt(u.id.replace('U', ''), 10))
            .filter(num => !isNaN(num))
            .reduce((max, num) => Math.max(max, num), 0);
        const newId = `U${(maxId + 1).toString().padStart(2, '0')}`;
        
        const newUser: User = {
            ...user,
            id: newId,
            status: 'Active',
        };
        return [...prev, newUser];
    });
  };

  const updateLiveBill = (billNo: string, items: BillItem[]) => {
    const newTotal = items.reduce((sum, item) => sum + item.amount, 0);

    setLiveBillItems(prevItems => ({...prevItems, [billNo]: items}));
    
    setLiveBillSummaries(prevSummaries => {
      const oldSummary = prevSummaries.find(b => b.billNo === billNo);
      const oldAmount = oldSummary?.amount || 0;

      if (oldSummary) {
          const customerId = getCustomerIdFromName(oldSummary.customerName);
          if (customerId) {
              const balanceChange = newTotal - oldAmount;
              setCustomerBalances(prevBalances => ({
                  ...prevBalances,
                  [customerId]: (prevBalances[customerId] || 0) + balanceChange,
              }));
          }
      }

      return prevSummaries.map(b => b.billNo === billNo ? { ...b, amount: newTotal } : b);
    });
  };
  
  const removeBillItem = (itemId: number, billNo: string) => {
    const items = liveBillItems[billNo] || [];
    const newItems = items.filter(item => item.id !== itemId);
    updateLiveBill(billNo, newItems);
  };
  
  const findBillForCustomerToday = (customerId: string) => {
    // In a real app, you'd also check the date.
    // For this demo, we assume all live bills are for today.
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return undefined;
    return liveBillSummaries.find(bill => bill.customerName.includes(customer.name_en));
  };

  const getBillItems = useCallback((billNo: string) => {
    return liveBillItems[billNo] || [];
  }, [liveBillItems]);
  
  const getBill = (billNo: string) => {
    return liveBillSummaries.find(b => b.billNo === billNo);
  };


  const createOrUpdateLiveBill = (
    summary: Omit<LiveBillSummary, 'billNo' | 'amount'>, 
    items: BillItem[],
    paidAmount: number,
    existingBillNo?: string | null
  ) => {
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    if (existingBillNo) {
      updateLiveBill(existingBillNo, items);
      return existingBillNo;
    } else {
        const maxBillNo = liveBillSummaries
            .map(b => parseInt(b.billNo.replace('B', ''), 10))
            .filter(num => !isNaN(num))
            .reduce((max, num) => Math.max(max, num), 1236);
        const newBillNo = `B${maxBillNo + 1}`;

        const newSummary: LiveBillSummary = {
            ...summary,
            billNo: newBillNo,
            amount: totalAmount,
        };

        const customerId = getCustomerIdFromName(summary.customerName);
        if (customerId) {
            setCustomerBalances(prevBalances => ({
                ...prevBalances,
                [customerId]: (prevBalances[customerId] || 0) + totalAmount - paidAmount,
            }));
        }
        
        setLiveBillSummaries(prev => [newSummary, ...prev]);
        setLiveBillItems(prev => ({...prev, [newBillNo]: items}));
        return newBillNo;
    }
  };

    const deleteBills = (billNos: string[]) => {
        const billsToDelete = liveBillSummaries.filter(b => billNos.includes(b.billNo));
        
        // Revert customer balances
        const balanceUpdates: CustomerBalances = {};
        billsToDelete.forEach(bill => {
            const customerId = getCustomerIdFromName(bill.customerName);
            if (customerId) {
                if (!balanceUpdates[customerId]) balanceUpdates[customerId] = 0;
                balanceUpdates[customerId] -= bill.amount; // Subtract the bill amount
            }
        });

        setCustomerBalances(prev => {
            const newBalances = { ...prev };
            for (const customerId in balanceUpdates) {
                newBalances[customerId] = (newBalances[customerId] || 0) + balanceUpdates[customerId];
            }
            return newBalances;
        });

        // Delete bills and items
        setLiveBillSummaries(prev => prev.filter(b => !billNos.includes(b.billNo)));
        setLiveBillItems(prev => {
            const newItems = { ...prev };
            billNos.forEach(billNo => delete newItems[billNo]);
            return newItems;
        });

        toast({
            title: 'Bills Deleted',
            description: `${billNos.length} bill(s) have been permanently deleted.`,
        });
    };

  const addPayment = (payment: Omit<Payment, 'id' | 'date'>) => {
      setPayments(prev => {
          const newPayment: Payment = {
              ...payment,
              id: prev.length + 1,
              date: new Date(),
          };
          return [...prev, newPayment];
      });

      setCustomerBalances(prevBalances => ({
          ...prevBalances,
          [payment.customerId]: (prevBalances[payment.customerId] || 0) - payment.amount,
      }));
  }

  const updateProductPrice = (productId: string, uom: string, price: number) => {
    setProductPrices(prev => ({
        ...prev,
        [productId]: {
            ...prev[productId],
            [uom]: price,
        },
    }));
  };

  return (
    <DataContext.Provider
      value={{
        customers,
        products,
        users,
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
        removeBillItem,
        createOrUpdateLiveBill,
        deleteBills,
        updateProductPrice,
        addPayment,
        findBillForCustomerToday,
        getBillItems,
        getBill,
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
