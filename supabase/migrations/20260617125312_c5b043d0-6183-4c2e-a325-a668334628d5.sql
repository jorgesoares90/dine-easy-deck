
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('owner','manager','waiter','kitchen','cashier');
CREATE TYPE public.table_status AS ENUM ('livre','ocupada','aguardando_pagamento','fechando');
CREATE TYPE public.order_item_status AS ENUM ('recebido','em_preparo','finalizado','cancelado');
CREATE TYPE public.order_status AS ENUM ('aberto','enviado','fechado','cancelado');
CREATE TYPE public.partial_payment_status AS ENUM ('pendente','aprovado','rejeitado','pago');
CREATE TYPE public.payment_method AS ENUM ('dinheiro','credito','debito','pix','outro');
CREATE TYPE public.cash_tx_type AS ENUM ('abertura','sangria','reforco','venda','fechamento');

-- =========================================
-- TENANTS (restaurantes)
-- =========================================
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#ea580c',
  secondary_color TEXT DEFAULT '#0f172a',
  whatsapp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tenants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- =========================================
-- PROFILES (staff)
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- USER ROLES
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- SECURITY DEFINER HELPERS
-- =========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _tenant_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.belongs_to_tenant(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================================
-- TENANTS policies
-- =========================================
CREATE POLICY "Tenants publicly readable" ON public.tenants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Owners update tenant" ON public.tenants FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), id, ARRAY['owner','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), id, ARRAY['owner','manager']::public.app_role[]));
CREATE POLICY "Authenticated create tenant" ON public.tenants FOR INSERT TO authenticated WITH CHECK (true);

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- PROFILES policies
-- =========================================
CREATE POLICY "View own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "View teammates profiles" ON public.profiles FOR SELECT TO authenticated
  USING (tenant_id IS NOT NULL AND public.belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- USER ROLES policies
-- =========================================
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "View tenant roles" ON public.user_roles FOR SELECT TO authenticated
  USING (public.belongs_to_tenant(auth.uid(), tenant_id));
CREATE POLICY "Owner manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), tenant_id, 'owner'))
  WITH CHECK (public.has_role(auth.uid(), tenant_id, 'owner'));

-- =========================================
-- RESTAURANT TABLES (mesas)
-- =========================================
CREATE TABLE public.restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  number INT NOT NULL,
  label TEXT,
  capacity INT DEFAULT 4,
  qr_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12),'hex'),
  status public.table_status NOT NULL DEFAULT 'livre',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);
GRANT SELECT ON public.restaurant_tables TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.restaurant_tables TO service_role;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tables public read" ON public.restaurant_tables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage tables" ON public.restaurant_tables FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager','waiter']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager','waiter']::public.app_role[]));

CREATE TRIGGER trg_tables_updated BEFORE UPDATE ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- TABLE SESSIONS
-- =========================================
CREATE TABLE public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.table_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_sessions TO authenticated;
GRANT ALL ON public.table_sessions TO service_role;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sessions public read" ON public.table_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone open session" ON public.table_sessions FOR INSERT TO anon, authenticated WITH CHECK (closed_at IS NULL);
CREATE POLICY "Staff manage sessions" ON public.table_sessions FOR ALL TO authenticated
  USING (public.belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.belongs_to_tenant(auth.uid(), tenant_id));

-- =========================================
-- SESSION CUSTOMERS (CRM / Lead capture)
-- =========================================
CREATE TABLE public.session_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_session_customers_whatsapp ON public.session_customers(tenant_id, whatsapp);
GRANT SELECT, INSERT ON public.session_customers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_customers TO authenticated;
GRANT ALL ON public.session_customers TO service_role;
ALTER TABLE public.session_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers self register" ON public.session_customers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Customer read own row" ON public.session_customers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Staff manage customers" ON public.session_customers FOR ALL TO authenticated
  USING (public.belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.belongs_to_tenant(auth.uid(), tenant_id));

-- =========================================
-- CATEGORIES
-- =========================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories public" ON public.categories FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Managers manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[]));

CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- PRODUCTS
-- =========================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products public" ON public.products FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Managers manage products" ON public.products FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[]));

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- PRODUCT MODIFIERS (complementos/variações)
-- =========================================
CREATE TABLE public.product_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_name TEXT,
  extra_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_modifiers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_modifiers TO authenticated;
GRANT ALL ON public.product_modifiers TO service_role;
ALTER TABLE public.product_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Modifiers public" ON public.product_modifiers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Managers manage modifiers" ON public.product_modifiers FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[]));

-- =========================================
-- ORDERS
-- =========================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.session_customers(id) ON DELETE SET NULL,
  status public.order_status NOT NULL DEFAULT 'aberto',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Orders public read by session" ON public.orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Customers create orders" ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Customers update own orders" ON public.orders FOR UPDATE TO anon, authenticated USING (status = 'aberto');
CREATE POLICY "Staff manage orders" ON public.orders FOR ALL TO authenticated
  USING (public.belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.belongs_to_tenant(auth.uid(), tenant_id));

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- ORDER ITEMS
-- =========================================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  modifiers JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status public.order_item_status NOT NULL DEFAULT 'recebido',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.order_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items public read" ON public.order_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Customers add items" ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Staff manage items" ON public.order_items FOR ALL TO authenticated
  USING (public.belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.belongs_to_tenant(auth.uid(), tenant_id));

CREATE TRIGGER trg_items_updated BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- PARTIAL PAYMENTS
-- =========================================
CREATE TABLE public.partial_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.session_customers(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  item_ids JSONB DEFAULT '[]'::jsonb,
  status public.partial_payment_status NOT NULL DEFAULT 'pendente',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  payment_method public.payment_method,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.partial_payments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partial_payments TO authenticated;
GRANT ALL ON public.partial_payments TO service_role;
ALTER TABLE public.partial_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partial public read" ON public.partial_payments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Customers request partial" ON public.partial_payments FOR INSERT TO anon, authenticated WITH CHECK (status = 'pendente');
CREATE POLICY "Staff manage partials" ON public.partial_payments FOR ALL TO authenticated
  USING (public.belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.belongs_to_tenant(auth.uid(), tenant_id));

-- =========================================
-- CASH REGISTER
-- =========================================
CREATE TABLE public.cash_register_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES auth.users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(10,2)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_register_sessions TO authenticated;
GRANT ALL ON public.cash_register_sessions TO service_role;
ALTER TABLE public.cash_register_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cashier sees register" ON public.cash_register_sessions FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager','cashier']::public.app_role[]));
CREATE POLICY "Cashier manages register" ON public.cash_register_sessions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager','cashier']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager','cashier']::public.app_role[]));

CREATE TABLE public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  register_session_id UUID REFERENCES public.cash_register_sessions(id) ON DELETE CASCADE,
  type public.cash_tx_type NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method public.payment_method,
  partial_payment_id UUID REFERENCES public.partial_payments(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_transactions TO authenticated;
GRANT ALL ON public.cash_transactions TO service_role;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cashier sees tx" ON public.cash_transactions FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager','cashier']::public.app_role[]));
CREATE POLICY "Cashier manages tx" ON public.cash_transactions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager','cashier']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), tenant_id, ARRAY['owner','manager','cashier']::public.app_role[]));

-- =========================================
-- Auto-create profile on signup
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- Realtime (KDS, notificações garçom)
-- =========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partial_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_tables;
