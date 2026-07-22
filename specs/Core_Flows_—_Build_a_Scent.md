# Core Flows — Build a Scent

## Navigation Structure

The global navigation bar contains: **Logo · Build a Scent · Shop · Marketplace · My Library** (logged-in only) **· Account** (avatar/icon top-right). On mobile, collapses to a hamburger menu. Guests see "Sign In" in place of Account.

## Flow 1 — Landing & Entry

**Trigger:** User visits the homepage.

1. User lands on a full-screen marketing/hero section with brand visuals (dark, moody, luxurious aesthetic).
2. A prominent **"Build Your Scent"** CTA button is displayed front and centre.
3. Secondary CTAs: **"Shop"** (pre-made products) and **"Explore Marketplace"** (community scents).
4. User clicks "Build Your Scent" → navigates to the Mixer page (`/build`).

```wireframe

<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Georgia, serif; }
  body { background: #0a0a0a; color: #e8d5a3; min-height: 100vh; }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 18px 40px; border-bottom: 1px solid #2a2a2a; }
  .nav-logo { font-size: 1.2rem; letter-spacing: 3px; color: #c9a84c; }
  .nav-links { display: flex; gap: 32px; font-size: 0.8rem; letter-spacing: 2px; color: #999; }
  .nav-links span { cursor: pointer; }
  .nav-links span:hover { color: #c9a84c; }
  .hero { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 85vh; text-align: center; padding: 40px; }
  .hero-eyebrow { font-size: 0.7rem; letter-spacing: 4px; color: #c9a84c; margin-bottom: 20px; }
  .hero-title { font-size: 3rem; color: #f0e6cc; margin-bottom: 16px; line-height: 1.2; }
  .hero-sub { font-size: 0.95rem; color: #888; max-width: 480px; margin-bottom: 40px; line-height: 1.7; }
  .cta-primary { background: #c9a84c; color: #0a0a0a; padding: 16px 40px; font-size: 0.85rem; letter-spacing: 3px; border: none; cursor: pointer; margin-bottom: 16px; }
  .cta-secondary { display: flex; gap: 24px; }
  .cta-ghost { border: 1px solid #444; color: #aaa; padding: 12px 28px; font-size: 0.75rem; letter-spacing: 2px; cursor: pointer; background: transparent; }
</style>
</head>
<body>
  <nav>
    <div class="nav-logo">BUILD A SCENT</div>
    <div class="nav-links">
      <span>BUILD A SCENT</span>
      <span>SHOP</span>
      <span>MARKETPLACE</span>
      <span>SIGN IN</span>
    </div>
  </nav>
  <div class="hero">
    <div class="hero-eyebrow">CRAFT YOUR SIGNATURE FRAGRANCE</div>
    <h1 class="hero-title">Your Scent.<br/>Your Story.</h1>
    <p class="hero-sub">Blend rare ingredients into a fragrance that is uniquely yours. Order it, wear it, or sell it to the world.</p>
    <button class="cta-primary" data-element-id="hero-cta-build">BUILD YOUR SCENT</button>
    <div class="cta-secondary">
      <button class="cta-ghost" data-element-id="hero-cta-shop">SHOP COLLECTION</button>
      <button class="cta-ghost" data-element-id="hero-cta-marketplace">EXPLORE MARKETPLACE</button>
    </div>
  </div>
</body>
</html>
```

## Flow 2 — Scent Mixer Journey

**Trigger:** User clicks "Build Your Scent" from homepage or nav.

The mixer is a 4-step wizard with a persistent animated bottle visual on the right that fills as ingredients are added.

### Step 1 — Base Notes

1. User sees a grid of base note ingredient cards (e.g. Sandalwood, Musk, Amber, Cedarwood). Each card shows a colour swatch, name, and scent family tag.
2. User drags 1–3 ingredient cards into the bottle drop zone. The bottle animates — coloured liquid pours in from the bottom.
3. A progress indicator shows "Step 1 of 4 — Base Notes". A "Next" button activates once at least 1 ingredient is selected.
4. User clicks **Next** → transitions to Step 2 with an animated slide.

### Step 2 — Middle / Heart Notes

1. Same mechanic — user drags 1–3 heart note ingredients (e.g. Rose, Jasmine, Iris, Ylang Ylang).
2. Bottle fills further; the new colour layer blends visually above the base layer.
3. User clicks **Next**.

### Step 3 — Top Notes

1. Same mechanic — user drags 1–3 top note ingredients (e.g. Bergamot, Lemon, Mint, Pepper).
2. Bottle is now visually full with all three colour layers visible.
3. User clicks **Next**.

### Step 4 — Name & Preview

1. User sees their completed bottle with all three note layers animated.
2. A text field prompts: **"Give your scent a name"**.
3. Below the bottle: a breakdown card showing all selected ingredients grouped by tier.
4. User selects **bottle size** (10ml / 30ml / 50ml / 100ml) and **format** (Spray / Roll-on / Oil) — price updates dynamically.
5. Four action buttons:
  - **"Add to Cart"** → proceeds to checkout flow.
  - **"Save Draft"** → saves the current blend as a draft so the user can resume later (auth gate for guests).
  - **"Save to Library"** → saves the scent as a finished blend (auth gate for guests) then shows a success toast.
  - **"List for Sale"** → requires auth if needed, saves the scent first, then opens the marketplace listing flow (see Flow 5).

```wireframe

<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Georgia, serif; }
  body { background: #0a0a0a; color: #e8d5a3; min-height: 100vh; }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 14px 32px; border-bottom: 1px solid #1e1e1e; }
  .nav-logo { font-size: 1rem; letter-spacing: 3px; color: #c9a84c; }
  .nav-links { display: flex; gap: 24px; font-size: 0.75rem; letter-spacing: 2px; color: #666; }
  .mixer-layout { display: grid; grid-template-columns: 1fr 320px; gap: 0; min-height: calc(100vh - 53px); }
  .mixer-left { padding: 32px 40px; border-right: 1px solid #1e1e1e; }
  .step-indicator { display: flex; gap: 8px; margin-bottom: 28px; }
  .step { width: 32px; height: 3px; background: #222; }
  .step.active { background: #c9a84c; }
  .step.done { background: #5a4a2a; }
  .mixer-title { font-size: 0.7rem; letter-spacing: 3px; color: #c9a84c; margin-bottom: 8px; }
  .mixer-heading { font-size: 1.6rem; color: #f0e6cc; margin-bottom: 6px; }
  .mixer-sub { font-size: 0.8rem; color: #666; margin-bottom: 28px; }
  .ingredient-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 32px; }
  .ingredient-card { border: 1px solid #2a2a2a; padding: 14px 12px; cursor: grab; text-align: center; }
  .ingredient-card.selected { border-color: #c9a84c; }
  .swatch { width: 36px; height: 36px; border-radius: 50%; margin: 0 auto 8px; }
  .ing-name { font-size: 0.75rem; color: #ccc; letter-spacing: 1px; }
  .ing-tag { font-size: 0.65rem; color: #666; margin-top: 3px; }
  .drop-zone { border: 1px dashed #333; padding: 16px; text-align: center; color: #555; font-size: 0.75rem; letter-spacing: 2px; margin-bottom: 24px; }
  .btn-next { background: #c9a84c; color: #0a0a0a; padding: 14px 36px; font-size: 0.8rem; letter-spacing: 2px; border: none; cursor: pointer; }
  .mixer-right { padding: 32px 24px; display: flex; flex-direction: column; align-items: center; }
  .bottle-visual { width: 100px; height: 200px; border: 2px solid #333; border-radius: 8px 8px 4px 4px; margin: 24px auto; position: relative; overflow: hidden; background: #111; }
  .bottle-layer { position: absolute; bottom: 0; width: 100%; }
  .layer-base { height: 40%; background: linear-gradient(180deg, #6b3a2a, #8b4513); opacity: 0.8; }
  .bottle-label { font-size: 0.65rem; letter-spacing: 2px; color: #666; text-align: center; margin-top: 8px; }
  .notes-summary { width: 100%; margin-top: 16px; }
  .note-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1a1a1a; font-size: 0.72rem; color: #888; }
  .note-label { color: #c9a84c; }
</style>
</head>
<body>
  <nav>
    <div class="nav-logo">BUILD A SCENT</div>
    <div class="nav-links"><span>BUILD A SCENT</span><span>SHOP</span><span>MARKETPLACE</span><span>MY LIBRARY</span></div>
  </nav>
  <div class="mixer-layout">
    <div class="mixer-left">
      <div class="step-indicator">
        <div class="step done"></div>
        <div class="step active"></div>
        <div class="step"></div>
        <div class="step"></div>
      </div>
      <div class="mixer-title">STEP 2 OF 4</div>
      <h2 class="mixer-heading">Heart Notes</h2>
      <p class="mixer-sub">Choose 1–3 ingredients that form the soul of your scent.</p>
      <div class="ingredient-grid">
        <div class="ingredient-card selected" data-element-id="ing-rose">
          <div class="swatch" style="background:#c06080;"></div>
          <div class="ing-name">ROSE</div><div class="ing-tag">Floral</div>
        </div>
        <div class="ingredient-card" data-element-id="ing-jasmine">
          <div class="swatch" style="background:#e8d870;"></div>
          <div class="ing-name">JASMINE</div><div class="ing-tag">Floral</div>
        </div>
        <div class="ingredient-card" data-element-id="ing-iris">
          <div class="swatch" style="background:#7b68c8;"></div>
          <div class="ing-name">IRIS</div><div class="ing-tag">Powdery</div>
        </div>
        <div class="ingredient-card" data-element-id="ing-ylang">
          <div class="swatch" style="background:#d4a843;"></div>
          <div class="ing-name">YLANG YLANG</div><div class="ing-tag">Exotic</div>
        </div>
        <div class="ingredient-card" data-element-id="ing-geranium">
          <div class="swatch" style="background:#7ab648;"></div>
          <div class="ing-name">GERANIUM</div><div class="ing-tag">Green</div>
        </div>
        <div class="ingredient-card" data-element-id="ing-peony">
          <div class="swatch" style="background:#e8a0b0;"></div>
          <div class="ing-name">PEONY</div><div class="ing-tag">Floral</div>
        </div>
      </div>
      <div class="drop-zone" data-element-id="drop-zone">DRAG INGREDIENTS HERE · 1 SELECTED · MAX 3</div>
      <button class="btn-next" data-element-id="btn-next">NEXT →</button>
    </div>
    <div class="mixer-right">
      <div class="bottle-label">YOUR BLEND</div>
      <div class="bottle-visual">
        <div class="bottle-layer layer-base"></div>
      </div>
      <div class="bottle-label">FILLING...</div>
      <div class="notes-summary">
        <div class="note-row"><span class="note-label">BASE</span><span>Sandalwood, Musk</span></div>
        <div class="note-row"><span class="note-label">HEART</span><span>Rose ···</span></div>
        <div class="note-row"><span class="note-label">TOP</span><span>—</span></div>
      </div>
    </div>
  </div>
</body>
</html>
```

## Flow 3 — Guest Auth Gate (Save to Library)

**Trigger:** Guest user clicks **"Save Draft"**, **"Save to Library"**, **"List for Sale"**, or another save/listing action in the mixer.

1. A modal overlays the current screen with the message: **"Save your scent — create a free account or sign in."**
2. Options: **Sign Up** (email/password) or **Sign In** (existing account). Social login options shown below.
3. On successful auth, the modal closes, the requested action completes automatically. If the action was **List for Sale**, the scent is first saved and then the listing flow opens.
4. User is returned to exactly where they were (mixer step, listing flow, library, etc.).

## Flow 4 — Checkout (Custom Scent or Standard Product)

**Trigger:** User clicks "Add to Cart" from the mixer preview or a product page.

1. Cart icon in nav updates with item count. User can continue shopping or click cart to review.
2. **Cart page:** Shows item(s) with name, size/format (for custom), quantity, price in NGN (toggle to USD available). Edit or remove items.
3. User clicks **"Proceed to Checkout"**.
4. **Checkout page:**
  - Guest: enters name, email, delivery address.
  - Logged-in: address pre-filled from profile; can edit.
  - Order summary shown on the right.
5. **Payment selection:** Two options displayed — **Paystack** and **Flutterwave** (radio buttons with logos). User selects one.
6. User clicks **"Pay Now"**.
7. Before payment starts, the platform revalidates cart prices, listing availability, and stock. If anything has changed, checkout is blocked and the user is returned to cart review with the updated state.
8. If revalidation passes, the user is redirected to the selected gateway's payment page/modal.
9. After payment, user is redirected to a **Payment Processing** page while the platform verifies the transaction.
10. If verification takes too long, the page stops spinning and explains that the payment is under manual review; the user is told they will be updated once the team confirms the payment.
11. Once verification succeeds, the user is taken to the **Order Confirmation page**.
12. **Confirmation page:** Animated visual of the custom bottle (or product image) with scent name, notes breakdown, order number, and estimated delivery timeframe. Email confirmation sent automatically. Guest users can later look up the order using **order number + email**.

```wireframe

<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Georgia, serif; }
  body { background: #0a0a0a; color: #e8d5a3; }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 14px 32px; border-bottom: 1px solid #1e1e1e; }
  .nav-logo { font-size: 1rem; letter-spacing: 3px; color: #c9a84c; }
  .checkout-layout { display: grid; grid-template-columns: 1fr 360px; gap: 0; min-height: calc(100vh - 53px); }
  .checkout-left { padding: 40px; border-right: 1px solid #1e1e1e; }
  .section-title { font-size: 0.65rem; letter-spacing: 3px; color: #c9a84c; margin-bottom: 16px; }
  .form-group { margin-bottom: 16px; }
  label { display: block; font-size: 0.7rem; color: #888; letter-spacing: 1px; margin-bottom: 6px; }
  input { width: 100%; background: #111; border: 1px solid #2a2a2a; color: #e8d5a3; padding: 10px 12px; font-size: 0.85rem; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .payment-section { margin-top: 32px; }
  .payment-option { display: flex; align-items: center; gap: 12px; border: 1px solid #2a2a2a; padding: 14px 16px; margin-bottom: 10px; cursor: pointer; }
  .payment-option.selected { border-color: #c9a84c; }
  .payment-radio { width: 14px; height: 14px; border: 1px solid #c9a84c; border-radius: 50%; }
  .payment-radio.filled { background: #c9a84c; }
  .payment-name { font-size: 0.8rem; color: #ccc; letter-spacing: 1px; }
  .pay-btn { width: 100%; background: #c9a84c; color: #0a0a0a; padding: 16px; font-size: 0.85rem; letter-spacing: 3px; border: none; cursor: pointer; margin-top: 24px; }
  .checkout-right { padding: 40px 32px; background: #080808; }
  .order-item { display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #1a1a1a; }
  .item-name { font-size: 0.85rem; color: #ccc; }
  .item-detail { font-size: 0.7rem; color: #666; margin-top: 3px; }
  .item-price { font-size: 0.85rem; color: #c9a84c; }
  .total-row { display: flex; justify-content: space-between; padding: 20px 0 0; }
  .total-label { font-size: 0.75rem; letter-spacing: 2px; color: #888; }
  .total-amount { font-size: 1.1rem; color: #c9a84c; }
  .currency-toggle { font-size: 0.65rem; color: #555; letter-spacing: 2px; margin-top: 8px; cursor: pointer; }
</style>
</head>
<body>
  <nav>
    <div class="nav-logo">BUILD A SCENT</div>
    <div style="font-size:0.75rem;letter-spacing:2px;color:#666;">SECURE CHECKOUT</div>
  </nav>
  <div class="checkout-layout">
    <div class="checkout-left">
      <div class="section-title">DELIVERY DETAILS</div>
      <div class="form-group"><label>FULL NAME</label><input value="Adaeze Okonkwo" /></div>
      <div class="form-group"><label>EMAIL</label><input value="adaeze@email.com" /></div>
      <div class="form-group"><label>DELIVERY ADDRESS</label><input value="14 Victoria Island, Lagos" /></div>
      <div class="form-row">
        <div class="form-group"><label>CITY</label><input value="Lagos" /></div>
        <div class="form-group"><label>STATE</label><input value="Lagos State" /></div>
      </div>
      <div class="payment-section">
        <div class="section-title">SELECT PAYMENT METHOD</div>
        <div class="payment-option selected" data-element-id="pay-paystack">
          <div class="payment-radio filled"></div>
          <div class="payment-name">PAYSTACK</div>
        </div>
        <div class="payment-option" data-element-id="pay-flutterwave">
          <div class="payment-radio"></div>
          <div class="payment-name">FLUTTERWAVE</div>
        </div>
        <button class="pay-btn" data-element-id="btn-pay">PAY ₦24,500</button>
      </div>
    </div>
    <div class="checkout-right">
      <div class="section-title">ORDER SUMMARY</div>
      <div class="order-item">
        <div><div class="item-name">Midnight Bloom</div><div class="item-detail">Custom Scent · 50ml · Spray</div></div>
        <div class="item-price">₦24,500</div>
      </div>
      <div class="total-row">
        <div class="total-label">TOTAL</div>
        <div class="total-amount">₦24,500</div>
      </div>
      <div class="currency-toggle" data-element-id="currency-toggle">VIEW IN USD →</div>
    </div>
  </div>
</body>
</html>
```

## Flow 5 — Marketplace Listing

**Trigger:** User clicks "List for Sale" from the mixer post-build screen OR from a saved scent in their Scent Library.

1. If the user starts from the mixer, the platform requires auth if needed, saves the scent to the library first, then opens the listing form.
2. A listing form slides in (or navigates to `/marketplace/list`):
  - Scent name (pre-filled from saved name).
  - Description field (optional, max 200 chars).
  - **Seller price** input — user sets their desired price. A current commission estimate is shown below (e.g. "At the current platform rate, you would earn ₦X"). Final commission is calculated at sale time.
  - Bottle size and format inherited from the saved blend (shown as read-only in v1).
3. User clicks **"Submit for Review"**.
4. Confirmation screen: **"Your scent has been submitted for review. We'll notify you once it's approved."**
5. Listing appears in the user's dashboard with status **"Pending Review"**.

## Flow 6 — Admin Approval of Marketplace Listings

**Trigger:** A user submits a scent for marketplace listing.

1. Admin sees a **"Pending Listings"** queue in the admin panel with count badge.
2. Each listing card shows: scent name, creator, notes breakdown, seller price, current commission estimate, and submission date.
3. Admin clicks a listing to open the detail view.
4. Admin chooses:
  - **Approve** → listing goes live on the marketplace immediately. Seller receives an in-app notification + email: **"Your scent [Name] is now live on the marketplace!"**
  - **Reject** → admin must enter a required reason (text field). Seller receives in-app notification + email with the reason and a **"Resubmit"** button.
5. Seller can edit their listing based on the rejection reason and resubmit — re-enters the approval queue.

```wireframe

<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Georgia, serif; }
  body { background: #0d0d0d; color: #e8d5a3; display: flex; min-height: 100vh; }
  .sidebar { width: 220px; background: #080808; border-right: 1px solid #1e1e1e; padding: 24px 0; flex-shrink: 0; }
  .sidebar-logo { font-size: 0.85rem; letter-spacing: 3px; color: #c9a84c; padding: 0 20px 24px; border-bottom: 1px solid #1e1e1e; }
  .sidebar-item { padding: 12px 20px; font-size: 0.72rem; letter-spacing: 2px; color: #666; cursor: pointer; }
  .sidebar-item.active { color: #c9a84c; border-left: 2px solid #c9a84c; }
  .badge { background: #c9a84c; color: #000; font-size: 0.6rem; padding: 2px 6px; border-radius: 10px; margin-left: 8px; }
  .main { flex: 1; padding: 32px 40px; }
  .page-title { font-size: 0.65rem; letter-spacing: 3px; color: #c9a84c; margin-bottom: 8px; }
  .page-heading { font-size: 1.4rem; color: #f0e6cc; margin-bottom: 28px; }
  .listing-card { border: 1px solid #2a2a2a; padding: 20px; margin-bottom: 14px; display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: start; }
  .listing-name { font-size: 1rem; color: #f0e6cc; margin-bottom: 4px; }
  .listing-meta { font-size: 0.72rem; color: #666; margin-bottom: 10px; }
  .notes-pills { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .pill { border: 1px solid #333; padding: 3px 10px; font-size: 0.65rem; color: #888; letter-spacing: 1px; }
  .price-row { font-size: 0.8rem; color: #ccc; }
  .price-highlight { color: #c9a84c; }
  .action-btns { display: flex; flex-direction: column; gap: 8px; }
  .btn-approve { background: #2a4a2a; color: #7acc7a; border: 1px solid #3a6a3a; padding: 10px 20px; font-size: 0.72rem; letter-spacing: 2px; cursor: pointer; }
  .btn-reject { background: transparent; color: #cc7a7a; border: 1px solid #4a2a2a; padding: 10px 20px; font-size: 0.72rem; letter-spacing: 2px; cursor: pointer; }
</style>
</head>
<body>
  <div class="sidebar">
    <div class="sidebar-logo">ADMIN</div>
    <div class="sidebar-item">DASHBOARD</div>
    <div class="sidebar-item">ORDERS</div>
    <div class="sidebar-item">PRODUCTS</div>
    <div class="sidebar-item">INGREDIENTS</div>
    <div class="sidebar-item active">LISTINGS <span class="badge">3</span></div>
    <div class="sidebar-item">ANALYTICS</div>
    <div class="sidebar-item">SETTINGS</div>
  </div>
  <div class="main">
    <div class="page-title">MARKETPLACE MODERATION</div>
    <h1 class="page-heading">Pending Listings</h1>
    <div class="listing-card" data-element-id="listing-1">
      <div>
        <div class="listing-name">Midnight Bloom</div>
        <div class="listing-meta">By Adaeze Okonkwo · Submitted 2 hours ago</div>
        <div class="notes-pills">
          <span class="pill">BASE: Sandalwood</span>
          <span class="pill">HEART: Rose, Jasmine</span>
          <span class="pill">TOP: Bergamot</span>
        </div>
        <div class="price-row">Seller price: <span class="price-highlight">₦18,000</span> · Current estimate at 20%: seller may earn ₦14,400</div>
      </div>
      <div class="action-btns">
        <button class="btn-approve" data-element-id="btn-approve-1">APPROVE</button>
        <button class="btn-reject" data-element-id="btn-reject-1">REJECT</button>
      </div>
    </div>
    <div class="listing-card" data-element-id="listing-2">
      <div>
        <div class="listing-name">Desert Gold</div>
        <div class="listing-meta">By Emeka Nwosu · Submitted 5 hours ago</div>
        <div class="notes-pills">
          <span class="pill">BASE: Amber, Musk</span>
          <span class="pill">HEART: Iris</span>
          <span class="pill">TOP: Pepper, Lemon</span>
        </div>
        <div class="price-row">Seller price: <span class="price-highlight">₦22,000</span> · Current estimate at 20%: seller may earn ₦17,600</div>
      </div>
      <div class="action-btns">
        <button class="btn-approve" data-element-id="btn-approve-2">APPROVE</button>
        <button class="btn-reject" data-element-id="btn-reject-2">REJECT</button>
      </div>
    </div>
  </div>
</body>
</html>
```

## Flow 7 — Scent Library

**Trigger:** Logged-in user clicks "My Library" in the nav.

1. Library page has two sections/tabs: **Saved Scents** and **Drafts**.
2. **Saved Scents** shows a grid of finished scent cards. Each card displays: bottle visual, scent name, notes summary, date saved, and action buttons.
3. **Actions per saved scent card:**
  - **Reorder** → adds the exact blend (with last-used size/format) to cart. One click.
  - **Edit** → opens the mixer pre-loaded with the saved blend. User can tweak ingredients and save as a new version (original is preserved).
  - **List for Sale** → triggers Flow 5 (marketplace listing).
4. **Drafts** shows in-progress scents with a **Resume** action that reopens the mixer at the saved draft state.
5. If a saved scent contains an ingredient that has since been deactivated by admin, the scent remains visible but becomes **fully view-only**. **Edit**, **Reorder**, and **List for Sale** are disabled, and the card explains that the formula is no longer available for sale or reorder.
6. Empty state (no saved scents): a prompt card — **"You haven't saved any scents yet. Build your first one."** with a CTA to the mixer.

## Flow 8 — Standard Store (Shop)

**Trigger:** User clicks "Shop" in the nav.

1. Shop page shows a grid of admin-uploaded products with filters (scent family, price range, format).
2. User clicks a product → product detail page with images, description, notes breakdown, size/format options, and price.
3. User selects size/format → clicks **"Add to Cart"** → proceeds through the same checkout flow (Flow 4).

## Flow 9 — Marketplace Browse & Purchase

**Trigger:** User clicks "Marketplace" in the nav.

1. Marketplace page shows a grid of community-created, approved scents. Each card shows: bottle visual, scent name, creator name, notes summary, and price.
2. Filters: scent family, price range, top ingredients.
3. User clicks a scent → detail page with full notes breakdown, creator profile snippet, and price.
4. User clicks **"Add to Cart"** → same checkout flow (Flow 4). Platform commission is handled invisibly in the backend.

## Flow 10 — Guest Order Lookup

**Trigger:** Guest user clicks a **Look Up Order** link from the confirmation email, help/footer area, or support path.

1. User lands on a dedicated order lookup page.
2. User enters **order number + email**.
3. If the combination matches, the platform shows the order status and confirmation-safe order details.
4. If the order is still under manual payment review, the page explains that verification is in progress.

## Flow Overview

```mermaid
flowchart TD
    A[Homepage] --> B[Build Your Scent CTA]
    A --> C[Shop]
    A --> D[Marketplace]
    B --> E[Mixer: Base Notes]
    E --> F[Mixer: Heart Notes]
    F --> G[Mixer: Top Notes]
    G --> H[Name & Preview]
    H --> I[Add to Cart]
    H --> J[Save Draft]
    H --> K[Save to Library]
    H --> L[List for Sale]
    J --> M{Guest?}
    K --> M
    L --> M
    M -- Yes --> N[Auth Gate Modal]
    N --> J
    N --> K
    N --> O[Auto-save Scent]
    M -- No --> P[Library]
    L --> O
    O --> Q[Listing Form]
    Q --> R[Admin Review Queue]
    R -- Approve --> S[Live on Marketplace]
    R -- Reject + Reason --> T[Seller Notified]
    T --> Q
    I --> U[Cart]
    U --> V[Checkout]
    V --> W{Revalidation OK?}
    W -- No --> U
    W -- Yes --> X[Payment Gateway]
    X --> Y[Payment Processing]
    Y --> Z{Verified?}
    Z -- Yes --> AA[Order Confirmation]
    Z -- Delayed --> AB[Manual Review Message]
    P --> AC[Saved Tab / Drafts Tab]
    AC --> AD[Resume Draft or View-Only Scent]
    AE[Guest Order Lookup] --> AF[Order Status]
```