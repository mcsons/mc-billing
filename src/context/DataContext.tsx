'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';
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
  currentBillItems: BillItem[];
  productPrices: ProductPrices;
  customerBalances: CustomerBalances;
  payments: Payment[];
  currentUser: User | null;
  liveBillItems: LiveBillItems;
  login: (username: string, password?: string) => User | null;
  logout: () => void;
  addCustomer: (customer: Omit<Customer, 'id'> & { id?: string }) => void;
  addProduct: (product: Omit<Product, 'id'> & { id?: string }) => void;
  addUser: (user: Omit<User, 'id' | 'status'>) => void;
  addBillItem: (item: BillItem, billNo: string) => void;
  removeBillItem: (itemId: number, billNo: string) => void;
  clearBill: () => void;
  createOrUpdateLiveBill: (
    summary: Omit<LiveBillSummary, 'billNo'>,
    items: BillItem[],
    paidAmount: number,
    existingBillNo?: string | null
  ) => string;
  updateProductPrice: (productId: string, uom: string, price: number) => void;
  setCurrentBillItems: React.Dispatch<React.SetStateAction<BillItem[]>>;
  addPayment: (payment: Omit<Payment, 'id' | 'date'>) => void;
  findBillForCustomerToday: (customerId: string) => LiveBillSummary | undefined;
  getBillItems: (billNo: string) => BillItem[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [liveBillSummaries, setLiveBillSummaries] = useState<LiveBillSummary[]>(initialLiveBillSummaries);
  const [currentBillItems, setCurrentBillItems] = useState<BillItem[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [productPrices, setProductPrices] = useState<ProductPrices>({
    'P01': { KGS: 250, NOS: 50 },
    'P02': { KGS: 450, BOX: 3200 },
  });
  const [customerBalances, setCustomerBalances] = useState<CustomerBalances>({
    'C001': 500,
    'C002': 1200,
    'C003': 0,
    'C004': -300,
  });
  const [payments, setPayments] = useState<Payment[]>([]);

  const [liveBillItems, setLiveBillItems] = useState<LiveBillItems>({
    'B1234': liveHistoryItems.filter(i => i.id === 1),
    'B1235': liveHistoryItems.filter(i => i.id === 2),
    'B1236': liveHistoryItems.filter(i => i.id === 3),
  });

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
    clearBill();
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

  const addBillItem = (item: BillItem, billNo: string) => {
    // This function will now update the central liveBillItems state
    setLiveBillItems(prev => {
        const currentItems = prev[billNo] || [];
        const newItems = [...currentItems, item];
        return {...prev, [billNo]: newItems};
    });
    // We also update the summary
    setLiveBillSummaries(prev => prev.map(summary => 
        summary.billNo === billNo 
        ? { ...summary, amount: summary.amount + item.amount }
        : summary
    ));
  };
  
  const removeBillItem = (itemId: number, billNo: string) => {
    let removedItemAmount = 0;
    setLiveBillItems(prev => {
        const billItems = prev[billNo] || [];
        const itemToRemove = billItems.find(i => i.id === itemId);
        if (itemToRemove) {
            removedItemAmount = itemToRemove.amount;
        }
        const newItems = billItems.filter(item => item.id !== itemId);
        return {...prev, [billNo]: newItems};
    });
    
    if (removedItemAmount > 0) {
        setLiveBillSummaries(prev => prev.map(summary =>
            summary.billNo === billNo
            ? { ...summary, amount: summary.amount - removedItemAmount }
            : summary
        ));
    }
  };
  
  const clearBill = () => {
    setCurrentBillItems([]);
  };
  
  const findBillForCustomerToday = (customerId: string) => {
    // In a real app, you'd also check the date.
    // For this demo, we assume all live bills are for today.
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return undefined;
    return liveBillSummaries.find(bill => bill.customerName.includes(customer.name_en));
  };

  const getBillItems = (billNo: string) => {
    return liveBillItems[billNo] || [];
  };

  const createOrUpdateLiveBill = (
    summary: Omit<LiveBillSummary, 'billNo'>, 
    items: BillItem[],
    paidAmount: number,
    existingBillNo?: string | null
  ) => {
    const customerId = getCustomerIdFromName(summary.customerName);
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    if (existingBillNo) {
        // Update existing bill
        setLiveBillSummaries(prev => {
            const oldSummary = prev.find(b => b.billNo === existingBillNo);
            const oldAmount = oldSummary?.amount || 0;

            if (customerId) {
                const balanceChange = totalAmount - oldAmount;
                setCustomerBalances(prevBalances => ({
                    ...prevBalances,
                    [customerId]: (prevBalances[customerId] || 0) + balanceChange,
                }));
            }

            return prev.map(b => b.billNo === existingBillNo ? { ...summary, billNo: existingBillNo, amount: totalAmount } : b);
        });

        setLiveBillItems(prev => ({...prev, [existingBillNo]: items}));
        return existingBillNo;
    } else {
        // Create new bill
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

  // The below functions are now deprecated in favor of the new logic, but kept for compatibility.
  const addLiveBillSummary = (summary: Omit<LiveBillSummary, 'billNo'>, paidAmount: number) => {};
  const updateLiveBillSummary = (summary: LiveBillSummary, paidAmount: number, oldTotal: number) => {};

  return (
    <DataContext.Provider
      value={{
        customers,
        products,
        users,
        liveBillSummaries,
        currentBillItems,
        productPrices,
        customerBalances,
        payments,
        currentUser,
        liveBillItems,
        login,
        logout,
        addCustomer,
        addProduct,
        addUser,
        addBillItem,
        removeBillItem,
        clearBill,
        createOrUpdateLiveBill,
        updateProductPrice,
        setCurrentBillItems,
        addPayment,
        findBillForCustomerToday,
        getBillItems,
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
