'use client';
import { subDays } from 'date-fns';

export type User = {
  id: string;
  username: string;
  password?: string;
  role: 'CREATOR' | 'ADMIN' | 'MANAGER';
  status: 'Active' | 'Inactive';
};

export type Customer = {
  id: string;
  name_en: string;
  name_ta: string;
  phone: string;
};

export type CustomerBalance = {
  customerId: string;
  balanceAmount: number;
  updatedAt?: any;
};

export type Uom = string;

export type Product = {
  id: string;
  name_en: string;
  name_ta: string;
  uom_allowed: Uom[];
};

export type BillItem = {
  id: string;
  billId?: string;
  product: string; // This is the Tamil name for display
  productId: string; // The actual product ID
  uom: string;
  qty: number;
  rate: number;
  amount: number;
  addedBy: string;
  stall: string;
};

export type LiveBillSummary = {
  billNo: string;
  customerName: string;
  customerId: string;
  amount: number;
  deliveryCharge?: number;
  paidAmount?: number;
  createdBy: string;
  stall: string;
  date?: any;
  finalBalance?: number;
  description?: string;
  prevBalance?: number;
}

export type Payment = {
    id: string;
    customerId: string;
    amount: number;
    date: any;
    notes?: string;
}

export type Transaction = {
  date: Date;
  description: string;
  billedAmount?: number;
  receivedAmount?: number;
  balance: number;
  type: 'bill' | 'payment';
};

export type SalesReportData = {
  customer: Customer;
  itemsByDate: { date: string; items: BillItem[] }[];
  totalQty: Record<string, number>;
  totalAmount: number;
  previousBalance: number;
  netAmount: number;
  dateRange: { from: Date; to: Date };
};

export type Vehicle = {
  id: string; // Registration Number
  name: string;
  active: boolean;
};

export type Driver = {
  id: string;
  name: string;
  licenseNumber: string;
  active: boolean;
};

export type Party = {
  id: string;
  name: string;
  location: string;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
};

export type PartyBalance = {
  partyId: string;
  balanceAmount: number;
  updatedAt?: any;
};

export type VehicleBill = {
  id: string;
  date: any; // Can be Date or Firestore Timestamp
  vehicleId: string; // Registration Number
  driverIds: string[];
  driverNames: string[];
  partyId: string;
  partyName: string;
  destination: string;
  advance: number;
  expenses: number;
  createdBy: string;
};

export type VehicleStatementTransaction = {
  date: Date;
  description: string;
  advance: number;
  expenses: number;
  balance: number;
};

export type PartyBillItem = {
  id: string; // A unique ID for the item row, e.g., timestamp
  productId: string;
  productName: string;
  rate: number;
  box: number;
  kgs: number;
  amount: number;
};

export type PartyBill = {
  id: string;
  date: any;
  partyId: string;
  partyName: string;
  totalBox: number;
  totalKgs: number;
  items: PartyBillItem[];
  totalAmount: number;
  commission: number;
  expenses: number;
  rent: number;
  totalDeductions: number;
  netAmount: number;
  cashReceived: number;
  bankReceived: number;
  totalReceived: number;
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
};
