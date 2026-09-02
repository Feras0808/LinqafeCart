export type OrderItem = {
  name: string;
  arName: string;
  image: string;
  price: number;
  quantity: number;
};

export type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  order_type: "pickup" | "dine-in";
  table_number?: string | null;
  notes?: string | null;
  items: OrderItem[];
  total: number;
  payment_status: string;
  payment_method?: string | null;
  order_status: string;
  created_at: string;
};
