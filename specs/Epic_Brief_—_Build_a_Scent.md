# Epic Brief — Build a Scent

## Summary

**Build a Scent** is a Next.js web platform backed by PostgreSQL (hosted on Railway) that reimagines fragrance shopping as an interactive, game-inspired experience. Users drag-and-drop liquid ingredients through a visually stunning step-by-step mixer to build a completely personalised scent, then order it in their chosen bottle size and format. Beyond the custom mixer, the platform operates as a full e-commerce store where admins sell pre-made products, and as a peer marketplace where users can list their own creations for others to buy — earning a creator markup on every sale while the platform covers production and takes a commission. The aesthetic is dark, luxurious, and moody: deep blacks, golds, and rich purples that position the brand as a high-end perfumery experience.

## Context & Problem

The fragrance industry is dominated by passive, browse-and-buy experiences that offer no personalisation or creative engagement. Customers have no way to express their individual scent identity, and the barrier to owning a truly unique fragrance is high. Meanwhile, fragrance enthusiasts with a nose for blending have no accessible platform to monetise their creativity.

**Build a Scent** solves both sides of this problem:

- **For buyers:** A playful yet premium mixer that makes building a custom scent feel like a game — lowering the creative barrier while raising the perceived value of the end product.
- **For creators:** A marketplace where users can list their custom blends for sale, earn income, and build a scent identity — with the platform handling production and fulfilment, and their exact formula kept private from buyers.
- **For the business:** Three interlocking revenue streams — custom orders, standard product sales, and marketplace sales (full blend price plus a commission on the creator's markup) — all managed through a single admin panel.

## Who Is Affected

| Persona | Role | Need |
| --- | --- | --- |
| **Casual Buyer** | Guest or logged-in shopper | Browse standard products or build a custom scent without friction |
| **Scent Creator** | Logged-in user | Save, refine, share, and monetise personal blends via the marketplace |
| **Marketplace Buyer** | Guest or logged-in shopper | Discover and purchase community-created scents |
| **Platform Admin** | Internal team | Manage ingredients, bottle options, products, orders, refunds, listings, commissions, shipping, and analytics |

## Business Model Guardrails

- **Custom scent price** = bottle option base price + ingredient cost, where ingredient cost scales with bottle volume and format concentration. All component prices are admin-set retail prices.
- **Marketplace price** = the live custom price of the same blend + a creator markup set by the seller. The platform keeps the full blend price plus its commission on the markup; the seller earns the rest of the markup. A listing can therefore never sell below production cost.
- **Recipe protection:** buyers see a note profile (scent families + up to 3 seller-chosen featured notes), never the full formula. Exact-duplicate formulas cannot be listed by a second seller.

## Scope

| Area | In Scope |
| --- | --- |
| Scent Mixer | Step-by-step drag-and-drop builder (base → middle → top notes), animated transitions, bottle/format/size selection, save draft at any step |
| Standard Store | Admin-uploaded pre-made products, standard cart + checkout |
| Marketplace | User-listed scents with creator markup, admin approval flow, recipe protection, duplicate-formula guard, commission tracking, seller earnings wallet |
| Scent Library | Save, re-order, edit (as new version), resume drafts, and share blends via public link (logged-in users) |
| Auth | Optional accounts (self-hosted, email/password + Google); guests can buy, accounts unlock library + marketplace |
| Payments | Paystack + Flutterwave (user selects at checkout); NGN checkout, USD display-only |
| Shipping | Nigeria-only delivery; admin-managed shipping zones with flat fee and ETA per zone |
| Refunds & Cancellations | Admin cancels unpaid orders and records full refunds (issued in the gateway dashboard); seller earnings reversed automatically |
| Admin Panel | Ingredient catalog, bottle options, product management, order management (incl. manual payment review), marketplace moderation, commission & pricing config, shipping zones, analytics dashboard |
| Fulfilment | Manual blend-and-ship by platform team; order details captured in admin panel |
| Infrastructure | Next.js app, PostgreSQL, and cron jobs on Railway; S3-compatible object storage for images; SMTP email |

## Out of Scope (for now)

- Automated third-party lab fulfilment integrations
- Seller payout disbursement (earnings tracked, payouts deferred)
- Partial refunds and in-app gateway refund API calls
- International shipping
- Per-ingredient proportions in the mixer (tier shares are fixed platform settings)
- Multi-language support
- Mobile native apps
