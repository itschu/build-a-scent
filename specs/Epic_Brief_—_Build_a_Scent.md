# Epic Brief — Build a Scent

## Summary

**Build a Scent** is a Next.js + Supabase web platform that reimagines fragrance shopping as an interactive, game-inspired experience. Users drag-and-drop liquid ingredients through a visually stunning step-by-step mixer to build a completely personalised scent, then order it in their chosen bottle size and format. Beyond the custom mixer, the platform operates as a full e-commerce store where admins sell pre-made products, and as a peer marketplace where users can list their own creations for others to buy — earning real money while the platform takes a commission. The aesthetic is dark, luxurious, and moody: deep blacks, golds, and rich purples that position the brand as a high-end perfumery experience.

## Context & Problem

The fragrance industry is dominated by passive, browse-and-buy experiences that offer no personalisation or creative engagement. Customers have no way to express their individual scent identity, and the barrier to owning a truly unique fragrance is high. Meanwhile, fragrance enthusiasts with a nose for blending have no accessible platform to monetise their creativity.

**Build a Scent** solves both sides of this problem:

- **For buyers:** A playful yet premium mixer that makes building a custom scent feel like a game — lowering the creative barrier while raising the perceived value of the end product.
- **For creators:** A marketplace where users can list their custom blends for sale, earn income, and build a scent identity — with the platform handling fulfilment.
- **For the business:** Three interlocking revenue streams — custom orders, standard product sales, and marketplace commissions — all managed through a single admin panel.

## Who Is Affected

| Persona | Role | Need |
| --- | --- | --- |
| **Casual Buyer** | Guest or logged-in shopper | Browse standard products or build a custom scent without friction |
| **Scent Creator** | Logged-in user | Save, refine, and monetise personal blends via the marketplace |
| **Marketplace Buyer** | Guest or logged-in shopper | Discover and purchase community-created scents |
| **Platform Admin** | Internal team | Manage ingredients, products, orders, listings, commissions, and analytics |

## Scope

| Area | In Scope |
| --- | --- |
| Scent Mixer | Step-by-step drag-and-drop builder (base → middle → top notes), animated transitions, bottle/format/size selection |
| Standard Store | Admin-uploaded pre-made products, standard cart + checkout |
| Marketplace | User-listed scents, admin approval flow, commission tracking, seller earnings wallet |
| Scent Library | Save, re-order, edit, and share blends (logged-in users) |
| Auth | Optional accounts (Supabase); guests can buy, accounts unlock library + marketplace |
| Payments | Paystack + Flutterwave (user selects at checkout); NGN primary, USD secondary |
| Admin Panel | Ingredient catalog, product management, order management, marketplace moderation, commission config, analytics dashboard |
| Fulfilment | Manual blend-and-ship by platform team; order details captured in admin panel |

## Out of Scope (for now)

- Automated third-party lab fulfilment integrations
- Seller payout disbursement (earnings tracked, payouts deferred)
- Multi-language support
- Mobile native apps