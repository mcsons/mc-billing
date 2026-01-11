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
} from '@/lib/data';

type ProductPrices = Record<string, Record<string, number>>;
type CustomerBalances = Record<string, number>;
type UserRole = 'CREATOR' | 'ADMIN' | 'MANAGER';

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
  login: (username: string, password?: string) => User | null;
  logout: () => void;
  addCustomer: (customer: Omit<Customer, 'id'> & { id?: string }) => void;
  addProduct: (product: Omit<Product, 'id'> & { id?: string }) => void;
  addBillItem: (item: BillItem) => void;
  removeBillItem: (itemId: number) => void;
  clearBill: () => void;
  addLiveBillSummary: (summary: Omit<LiveBillSummary, 'billNo'>, paidAmount: number) => void;
  updateProductPrice: (productId: string, uom: string, price: number) => void;
  setCurrentBillItems: React.Dispatch<React.SetStateAction<BillItem[]>>;
  updateLiveBillSummary: (summary: LiveBillSummary, paidAmount: number, oldTotal: number) => void;
  addPayment: (payment: Omit<Payment, 'id' | 'date'>) => void;
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

  const addBillItem = (item: BillItem) => {
    setCurrentBillItems(prev => [...prev, item]);
  }

  const removeBillItem = (itemId: number) => {
    setCurrentBillItems(prev => prev.filter(item => item.id !== itemId));
  }

  const clearBill = () => {
    setCurrentBillItems([]);
  }

  const getCustomerIdFromName = (customerName: string) => {
      const customer = customers.find(c => customerName.includes(c.name_en));
      return customer?.id;
  }

  const addLiveBillSummary = (summary: Omit<LiveBillSummary, 'billNo'>, paidAmount: number) => {
    setLiveBillSummaries(prev => {
        const maxBillNo = prev
            .map(b => parseInt(b.billNo.replace('B', ''), 10))
            .filter(num => !isNaN(num))
            .reduce((max, num) => Math.max(max, num), 1236); // Starting from after the initial data
        const newBillNo = `B${maxBillNo + 1}`;
        const newSummary: LiveBillSummary = {
            ...summary,
            billNo: newBillNo,
        };

        const customerId = getCustomerIdFromName(summary.customerName);
        if (customerId) {
            setCustomerBalances(prevBalances => ({
                ...prevBalances,
                [customerId]: (prevBalances[customerId] || 0) + summary.amount - paidAmount,
            }));
        }

        return [newSummary, ...prev];
    });
  };

  const updateLiveBillSummary = (summary: LiveBillSummary, paidAmount: number, oldTotal: number) => {
    setLiveBillSummaries(prev => {
        const index = prev.findIndex(b => b.billNo === summary.billNo);
        if (index !== -1) {
            const newSummaries = [...prev];
            const oldSummary = newSummaries[index];
            newSummaries[index] = summary;

            const customerId = getCustomerIdFromName(summary.customerName);
            if(customerId){
                const balanceChange = (summary.amount - oldSummary.amount);
                setCustomerBalances(prevBalances => ({
                    ...prevBalances,
                    [customerId]: (prevBalances[customerId] || 0) + balanceChange,
                }));
            }
            return newSummaries;
        }
        return prev;
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
        currentBillItems,
        productPrices,
        customerBalances,
        payments,
        currentUser,
        login,
        logout,
        addCustomer,
        addProduct,
        addBillItem,
        removeBillItem,
        clearBill,
        addLiveBillSummary,
        updateProductPrice,
        setCurrentBillItems,
        updateLiveBillSummary,
        addPayment,
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
