# Launch smoke checks

Run these against the **production** deployment (real gateways in test mode first, then one
small live payment per gateway) before announcing launch, and again after any risky deploy.
Tick each box; anything that fails blocks launch.

Use two browsers: one signed in as a customer/seller, one signed in as the admin. Keep the
admin **Orders**, **Marketplace** and **Settings → Email delivery** pages open.

## 0. Platform

- [ ] `GET /api/health` returns `200 {"status":"ok"}`; Railway shows the app healthy
- [ ] The **jobs** cron service ran in the last 5 minutes (Railway → jobs → Deployments shows a successful run whose log line is a JSON summary with no `error` keys)
- [ ] Postgres backups are enabled and the last restore test is recorded below
- [ ] Settings → Email delivery → **Send test email** arrives in the admin inbox
- [ ] Gateway dashboards point webhooks at `https://<domain>/api/webhooks/paystack` and `https://<domain>/api/webhooks/flutterwave`

## 1. Homepage → build

- [ ] Homepage loads, hero links to **Build your scent**
- [ ] Mixer: choose bottle, base, heart, top; price updates at each step and matches the review step
- [ ] Inactive ingredients and bottles never appear in the mixer

## 2. Drafts, library and sharing

- [ ] Signed out: building then **Save** asks to sign in and returns to the same step afterwards
- [ ] Save a draft at step 2, leave, resume it from the Library at the same step
- [ ] Finish and save the scent; it shows in the Library with its notes
- [ ] Create a share link; open it signed out: notes visible, ingredient proportions are not
- [ ] Revoke the link; it now shows the unavailable page

## 3. Marketplace listing

- [ ] From a saved scent, **List for sale** with a markup; listing appears as *Pending review*
- [ ] Listing the same formula again (another account) is blocked as a duplicate
- [ ] Buyer-facing listing page and API responses show featured notes only, never the formula

## 4. Custom scent purchase

- [ ] Add a custom scent to cart, checkout as a guest with a Lagos address; shipping and delivery window shown
- [ ] An unsupported state is refused with a clear message before payment
- [ ] Pay (Paystack): redirected to processing → confirmation; confirmation email received
- [ ] Repeat with Flutterwave

## 5. Standard product purchase

- [ ] Buy a shop product with stock ≤ the low-stock threshold: a reservation is held during checkout
- [ ] Abandon a second checkout for the last unit; within ~5 minutes after the payment window the hold is released (jobs) and the item is buyable again
- [ ] Paid order deducts stock exactly once

## 6. Marketplace purchase

- [ ] Buy an approved listing; seller sees a *pending* earning on their seller dashboard
- [ ] Seller receives the in-app notification

## 7. Late webhook / server-side verify

- [ ] Temporarily disable the webhook in the gateway test dashboard, pay, and stay on the processing page: after ~20 seconds it verifies with the gateway and shows the confirmation
- [ ] Re-enable the webhook; the late webhook does not send a second email or create a second ledger entry
- [ ] A payment that can't be confirmed lands in Admin → Orders → **Needs review** with reference, verify attempts, last gateway status and age; the customer gets the "payment under review" email after 10 minutes

## 8. Guest order lookup

- [ ] `/orders/lookup` with order number + email shows the order; wrong email shows a generic "not found"
- [ ] More than 5 attempts on one order in 10 minutes are refused with "Too many attempts"

## 9. Admin moderation

- [ ] Approve a pending listing: it goes live, seller gets notification + email
- [ ] Reject another with a reason: seller sees the reason and can edit and resubmit

## 10. Catalog cascade

- [ ] Deactivate an ingredient used by a live listing: listing becomes *Unavailable*, seller notified and emailed, mixer hides the ingredient
- [ ] Saved scents using it can't be ordered and say why
- [ ] Reactivate it: listing returns to the marketplace, seller notified and emailed

## 11. Fulfilment → earnings

- [ ] Admin moves the marketplace order through processing → shipped → delivered; customer gets shipped and delivered emails
- [ ] On delivery the seller's earning moves from *pending* to *available*

## 12. Refund → earnings reversed

- [ ] Record a refund on a delivered marketplace order: customer gets the refund email, seller balance shows the reversal
- [ ] Cancelling an unshipped paid order releases its stock

## 13. Failure states

- [ ] Gateway failure / cancelled payment returns to checkout with a clear message and the cart intact
- [ ] A price change between cart and checkout is shown and must be accepted before paying
- [ ] Unknown URLs show the styled 404 page; a server error shows the styled error page with **Try again**
- [ ] Settings → Email delivery lists no undeliverable emails (or each has been retried)

## Restore test log

| Date | Backup used | Scratch database | Checked | By |
| --- | --- | --- | --- | --- |
| | | | | |
