# T6 — Standard Store (Shop)

## Overview

Build the public-facing shop (product listing page and product detail page) and the admin product management interface.

**Spec refs:** spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/9ca5d031-12af-4933-8fe6-baa630809264 — Flow 8 (Standard Store); spec:5ab899a7-6fad-481d-a6c8-237a9d2cad95/0472cd63-9195-4a88-b627-a2d14dbc6a3e — ProductsManager, `products` / `product_variants` schema

**Depends on:** T2, T5, T10

## Scope

### In scope

- Shop page at `/shop`: server-rendered grid of active products; filters by scent family, price range, format
- Product detail page at `/shop/[slug]`: images, description, notes breakdown (`products.notes`), active variant selector (size/format), price, stock state ("Only N left" / "Out of stock"), Add to Cart
- Admin `ProductsManager` at `/admin/products` (inside the T10 admin shell):
  - CRUD for products (unique slug) and variants (price in kobo)
  - image upload to object storage via `/api/uploads/presign` (admin-only)
  - toggle active/inactive for products and variants
  - set stock quantities per variant
- DAL authorization tests for products and variants (public active-only reads, admin writes)

### Out of scope

- Checkout (T5)
- Analytics (T9)

## Acceptance Criteria

- The shop page is server-rendered and shows only active products with at least one active variant
- Filters work correctly
- The product detail page shows all active variants; selecting a variant updates the price and stock state
- Add to Cart adds the correct variant to `CartStore`; out-of-stock variants cannot be added
- Admin can create, edit, and deactivate products and variants
- Admin can upload product images to object storage; non-admins cannot get a presigned URL
- Stock quantity is editable per variant
