-- =============================================================================
-- v63: Shop Profile Logistics Fields
-- Adds fields used by the Options > Shop Profile logistics control center.
-- =============================================================================

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS shop_code TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS default_carrier TEXT DEFAULT 'VNPost',
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_code TEXT,
  ADD COLUMN IF NOT EXISTS default_package_weight INTEGER DEFAULT 500,
  ADD COLUMN IF NOT EXISTS default_package_note TEXT,
  ADD COLUMN IF NOT EXISTS shipping_fee_payer TEXT DEFAULT 'sender';

COMMENT ON COLUMN public.shops.default_carrier IS 'Default carrier gateway for new shipments, e.g. VNPost or J&T.';
COMMENT ON COLUMN public.shops.default_package_weight IS 'Default parcel weight in grams for carrier forms.';
COMMENT ON COLUMN public.shops.default_package_note IS 'Default delivery note applied when creating shipments.';
COMMENT ON COLUMN public.shops.shipping_fee_payer IS 'Shipping fee payer: sender, receiver, or cod.';
