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

export type Product = {
  id: string;
  name_en: string;
  name_ta: string;
  uom_allowed: ('BOX' | 'KGS' | 'ITEMS' | 'NOS')[];
};

export type BillItem = {
  id: number;
  product: string;
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
}

export type Payment = {
    id: number;
    customerId: string;
    amount: number;
    date: Date;
    notes?: string;
}

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

export const products: Product[] = [
  { id: 'P01', name_en: 'Tuna', name_ta: 'டூனா', uom_allowed: ['KGS', 'NOS'] },
  { id: 'P02', name_en: 'Prawn', name_ta: 'இறால்', uom_allowed: ['KGS', 'BOX'] },
  { id: 'P03', name_en: 'Crab', name_ta: 'நண்டு', uom_allowed: ['KGS', 'NOS'] },
  { id: 'P04', name_en: 'Sardine', name_ta: 'மத்தி', uom_allowed: ['KGS', 'BOX'] },
  { id: 'P05', name_en: 'Mackerel', name_ta: 'காணாங்கெளுத்தி', uom_allowed: ['KGS', 'NOS'] },
];

export const liveBillSummaries: LiveBillSummary[] = [
    { billNo: 'B1234', customerName: 'Retail Shop A (சில்லறை கடை அ)', amount: 8200, createdBy: 'Admin', stall: '1' },
    { billNo: 'B1235', customerName: 'Hotel B (ஹோட்டல் ஆ)', amount: 15500, createdBy: 'Manager', stall: '2' },
    { billNo: 'B1236', customerName: 'Catering Service C (சமையல் சேவை இ)', amount: 4850, createdBy: 'Admin', stall: '1' },
];

export const liveHistoryItems: BillItem[] = [
    { id: 1, product: 'டூனா', uom: 'KGS', qty: 10, rate: 220, amount: 2200, user: 'Admin', stall: '1' },
    { id: 2, product: 'இறால்', uom: 'BOX', qty: 2, rate: 3000, amount: 6000, user: 'Manager', stall: '2' },
    { id: 3, product: 'நண்டு', uom: 'KGS', qty: 5.5, rate: 450, amount: 2475, user: 'Admin', stall: '1' },
    { id: 4, product: 'மத்தி', uom: 'BOX', qty: 5, rate: 1500, amount: 7500, user: 'Creator', stall: '3' },
];
