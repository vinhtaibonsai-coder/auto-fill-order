-- =========================================================================
-- AUTO FILL ORDER: BASE SCHEMA (MIGRATION 00)
-- Create missing base tables if they don't exist to prevent "column not found" errors
-- =========================================================================

-- 1. Create shops table (Base)
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL,
    shop_code TEXT UNIQUE NOT NULL
);

-- 2. Create shop_members table
CREATE TABLE IF NOT EXISTS public.shop_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'STAFF' CHECK (role IN ('OWNER', 'MANAGER', 'STAFF')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(shop_id, user_id)
);

-- 3. Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    customer_name TEXT,
    customer_phone TEXT,
    address TEXT,
    status TEXT DEFAULT 'DRAFT'
);

-- If shop_members already existed but was missing user_id (e.g. it had uid instead)
-- We can try to add it (this will silently fail if it already exists, which is fine)
DO $$ 
BEGIN
    BEGIN
        ALTER TABLE public.shop_members ADD COLUMN user_id UUID REFERENCES auth.users(id);
    EXCEPTION
        WHEN duplicate_column THEN null;
    END;
END $$;
