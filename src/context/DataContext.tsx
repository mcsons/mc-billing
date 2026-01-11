'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  Customer,
  Product,
  BillItem,
  LiveBillSummary,
  customers as initialCustomers,
  products as initialProducts,
  liveBillSummaries as initialLiveBillSummaries,
} from '@/lib/data';

interface DataContextType {
  customers: Customer[];
  products: Product[];
  liveBillSummaries: LiveBillSummary[];
  currentBillItems: BillItem[];
  addCustomer: (customer: Customer) => void;
  addProduct: (product: Product) => void;
  addBillItem: (item: BillItem) => void;
  clearBill: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [liveBillSummaries, setLiveBillSummaries] = useState<LiveBillSummary[]>(initialLiveBillSummaries);
  const [currentBillItems, setCurrentBillItems] = useState<BillItem[]>([]);

  const addCustomer = (customer: Customer) => {
    setCustomers((prev) => [...prev, customer]);
  };

  const addProduct = (product: Product) => {
    setProducts((prev) => [...prev, product]);
  };

  const addBillItem = (item: BillItem) => {
    setCurrentBillItems(prev => [...prev, item]);
  }

  const clearBill = () => {
    setCurrentBillItems([]);
  }

  return (
    <DataContext.Provider
      value={{
        customers,
        products,
        liveBillSummaries,
        currentBillItems,
        addCustomer,
        addProduct,
        addBillItem,
        clearBill
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
