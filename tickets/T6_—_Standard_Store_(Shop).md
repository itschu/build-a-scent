# T6 — Standard Store (Shop)

## Overview

Build the public-facing shop: product listing page, product detail page, and the admin product management interface.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 8 (Standard Store); spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — ProductsManager, product/product_variants schema

**Depends on:** T2, T5

## Scope

### In scope

- Shop page at `/shop` — server-rendered grid of active products; filters by scent family, price range, format
- Product detail page at `/shop/[slug]` — images, description, notes breakdown, size/format variant selector, price, Add to Cart
- Admin `ProductsManager` at `/admin/products` — CRUD for products and variants; image upload to Supabase Storage; toggle active/inactive; set stock quantities per variant

### Out of scope

- Checkout (T5)
- Analytics (T9)

## Acceptance Criteria

- Shop page is server-rendered and shows only active products
- Filters work correctly
- Product detail page shows all variants; selecting a variant updates price
- Add to Cart adds the correct variant to `CartStore`
- Admin can create, edit, and deactivate products and variants
- Admin can upload product images to Supabase Storage
- Stock quantity is editable per variant