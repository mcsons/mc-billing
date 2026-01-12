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

export type Uom = string;

export type Product = {
  id: string;
  name_en: string;
  name_ta: string;
  uom_allowed: Uom[];
};

export type BillItem = {
  id: number;
  product: string; // This is the Tamil name for display
  productId: string; // The actual product ID
  uom: string;
  qty: number;
  rate: number;
  amount: number;
  user: string;
  stall: string;
};

export type LiveBillSummary = {
  billNo: string;
  customerName: string;
  amount: number;
  createdBy: string;
  stall: string;
  date?: Date;
}

export type Payment = {
    id: number;
    customerId: string;
    amount: number;
    date: Date;
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


export const users: User[] = [
  { id: 'U01', username: 'creator', password: 'password', role: 'CREATOR', status: 'Active' },
  { id: 'U02', username: 'admin', password: 'password', role: 'ADMIN', status: 'Active' },
  { id: 'U03', username: 'manager', password: 'password', role: 'MANAGER', status: 'Active' },
];


export const customers: Customer[] = [
  { id: 'C001', name_en: 'Retail Shop A', name_ta: 'சில்லறை கடை அ', phone: '9876543210' },
  { id: 'C002', name_en: 'Hotel B', name_ta: 'ஹோட்டல் ஆ', phone: '9876543211' },
  { id: 'C003', name_en: 'Catering Service C', name_ta: 'சமையல் சேவை இ', phone: '9876543212' },
  { id: 'C004', name_en: 'Exporter D', name_ta: 'ஏற்றுமதியாளர் ஈ', phone: '9876543213' },
];

export const initialUoms: Uom[] = ['KGS', 'BOX', 'NOS', 'ITEMS'];

export const products: Product[] = [
  { id: 'P01', name_en: 'Tuna', name_ta: 'டூனா', uom_allowed: ['KGS', 'NOS'] },
  { id: 'P02', name_en: 'Prawn', name_ta: 'இறால்', uom_allowed: ['KGS', 'BOX'] },
  { id: 'P03', name_en: 'Crab', name_ta: 'நண்டு', uom_allowed: ['KGS', 'NOS'] },
  { id: 'P04', name_en: 'Sardine', name_ta: 'மத்தி', uom_allowed: ['KGS', 'BOX'] },
  { id: 'P05', name_en: 'Mackerel', name_ta: 'காணாங்கெளுத்தி', uom_allowed: ['KGS', 'NOS'] },
];

export const liveBillSummaries: LiveBillSummary[] = [
    { billNo: 'B1234', customerName: 'Retail Shop A (சில்லறை கடை அ)', amount: 2200, createdBy: 'Admin', stall: '1', date: subDays(new Date(), 7) },
    { billNo: 'B1235', customerName: 'Hotel B (ஹோட்டல் ஆ)', amount: 6000, createdBy: 'Manager', stall: '2', date: subDays(new Date(), 6) },
    { billNo: 'B1236', customerName: 'Catering Service C (சமையல் சேவை இ)', amount: 2475, createdBy: 'Admin', stall: '1', date: subDays(new Date(), 5) },
    { billNo: 'B1237', customerName: 'Retail Shop A (சில்லறை கடை அ)', amount: 3500, createdBy: 'Admin', stall: '1', date: subDays(new Date(), 2) },

];

export const liveHistoryItems: Record<string, BillItem[]> = {
    'B1234': [{ id: 1, productId: 'P01', product: 'டூனா', uom: 'KGS', qty: 10, rate: 220, amount: 2200, user: 'Admin', stall: '1' }],
    'B1235': [{ id: 2, productId: 'P02', product: 'இறால்', uom: 'BOX', qty: 2, rate: 3000, amount: 6000, user: 'Manager', stall: '2' }],
    'B1236': [{ id: 3, productId: 'P03', product: 'நண்டு', uom: 'KGS', qty: 5.5, rate: 450, amount: 2475, user: 'Admin', stall: '1' }],
    'B1237': [{ id: 4, productId: 'P01', product: 'டூனா', uom: 'KGS', qty: 14, rate: 250, amount: 3500, user: 'Admin', stall: '1' }],
};

export const samplePayments: Payment[] = [
    { id: 1, customerId: 'C001', amount: 1000, date: subDays(new Date(), 5), notes: 'Cash payment' },
    { id: 2, customerId: 'C002', amount: 2500, date: subDays(new Date(), 3), notes: 'Bank transfer for bill B1230' },
    { id: 3, customerId: 'C001', amount: 500, date: subDays(new Date(), 1), notes: 'Partial payment' },
    { id: 4, customerId: 'C004', amount: 1000, date: subDays(new Date(), 2) },
];
