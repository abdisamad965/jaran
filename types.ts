export type Role = 'admin' | 'cashier';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  address?: string;
  created_at?: string;
}

export interface Settings {
  id: string;
  store_name: string;
  tax_rate: number;
  // phone and address are now handled within receipt_template to avoid DB schema conflicts
  receipt_template: {
    phone?: string;
    address?: string;
    header_message?: string;
    footer_message?: string;
  };
  shift_closing_enabled: boolean;
}

export interface Shift {
  id: string;
  user_id: string;
  start_time: string;
  end_time?: string;
  total_sales: number;
  total_cash: number;
  total_card: number;
  total_mpesa?: number;
  total_expenses?: number;
  total_cogs?: number;
  closed: boolean;
  created_at?: string;
  user?: User;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost_price: number;
  stock_quantity: number;
  reorder_level: number;
  supplier_id?: string;
  created_at?: string;
}

export interface Sale {
  id: string;
  sale_date: string;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'mpesa';
  cashier_id: string;
  shift_id: string;
  created_at?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: Product;
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description?: string;
  date: string;
  receipt_url?: string;
  created_by: string;
  shift_id?: string;
  created_at?: string;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  payment_type: 'debit' | 'credit';
  amount: number;
  payment_date: string;
  notes?: string;
  created_by: string;
  created_at?: string;
}

export interface CartItem extends Product {
  cartQuantity: number;
}