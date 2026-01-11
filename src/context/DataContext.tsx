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

type ProductPrices = Record<string, Record<string, number>>;

interface DataContextType {
  customers: Customer[];
  products: Product[];
  liveBillSummaries: LiveBillSummary[];
  currentBillItems: BillItem[];
  productPrices: ProductPrices;
  addCustomer: (customer: Omit<Customer, 'id'> & { id?: string }) => void;
  addProduct: (product: Omit<Product, 'id'> & { id?: string }) => void;
  addBillItem: (item: BillItem) => void;
  removeBillItem: (itemId: number) => void;
  clearBill: () => void;
  addLiveBillSummary: (summary: Omit<LiveBillSummary, 'billNo'>) => void;
  updateProductPrice: (productId: string, uom: string, price: number) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [liveBillSummaries, setLiveBillSummaries] = useState<LiveBillSummary[]>(initialLiveBillSummaries);
  const [currentBillItems, setCurrentBillItems] = useState<BillItem[]>([]);
  const [productPrices, setProductPrices] = useState<ProductPrices>({
    'P01': { KGS: 250, NOS: 50 },
    'P02': { KGS: 450, BOX: 3200 },
  });


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

  const addLiveBillSummary = (summary: Omit<LiveBillSummary, 'billNo'>) => {
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
        return [newSummary, ...prev];
    });
  };

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
        liveBillSummaries,
        currentBillItems,
        productPrices,
        addCustomer,
        addProduct,
        addBillItem,
        removeBillItem,
        clearBill,
        addLiveBillSummary,
        updateProductPrice,
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
