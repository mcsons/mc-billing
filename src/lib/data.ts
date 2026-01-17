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
};

export type VehicleBill = {
  id: string;
  date: any; // Can be Date or Firestore Timestamp
  vehicleId: string; // Registration Number
  driverId: string;
  driverName: string;
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
