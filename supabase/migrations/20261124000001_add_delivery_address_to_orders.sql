-- Migration: add delivery_address column to orders for direct text address support
alter table public.orders add column if not exists delivery_address text;
