create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  customer_phone text not null,
  order_type text not null check (order_type in ('pickup','dine-in')),
  table_number text,
  notes text,
  items jsonb not null,
  total numeric(10,2) not null,
  payment_status text not null default 'pending',
  payment_method text,
  payment_invoice_id text,
  payment_url text,
  order_status text not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
