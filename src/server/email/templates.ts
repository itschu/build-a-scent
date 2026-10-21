// Every transactional email, keyed by template name. Payloads are stored in the outbox as
// JSON, so they must contain only plain data.
import { formatNaira } from "@/lib/money";
import { button, escapeHtml, layout, paragraph } from "./layout";

export type RenderedEmail = { subject: string; text: string; html: string };

type OrderEmailItem = { name: string; detail: string; quantity: number; lineTotalKobo: number };

type TemplateMap = {
  order_paid: {
    name: string;
    orderNumber: string;
    items: OrderEmailItem[];
    shippingFeeKobo: number;
    totalKobo: number;
    eta: string | null;
    lookupUrl: string;
  };
  verify_email: { name: string; url: string };
  reset_password: { name: string; url: string };
  test_email: { sentBy: string };
  listing_approved: { name: string; scentName: string; url: string };
  listing_rejected: { name: string; scentName: string; reason: string; url: string };
  listing_unavailable: { name: string; scentName: string; reason: string; url: string };
  listing_available: { name: string; scentName: string; url: string };
};

export type EmailTemplate = keyof TemplateMap;
export type EmailPayload<T extends EmailTemplate> = TemplateMap[T];

function itemsTable(items: OrderEmailItem[], shippingFeeKobo: number, totalKobo: number): string {
  const row = (left: string, right: string, muted = false) =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #2a2a2a;${muted ? "color:#8a8a8a" : ""}">${left}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #2a2a2a;color:#c9a84c">${right}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;font-size:14px">${items
    .map((i) =>
      row(
        `${escapeHtml(i.name)} × ${i.quantity}<br><span style="color:#8a8a8a;font-size:12px">${escapeHtml(i.detail)}</span>`,
        formatNaira(i.lineTotalKobo),
      ),
    )
    .join("")}${row("Shipping", formatNaira(shippingFeeKobo), true)}${row("<strong>Total</strong>", `<strong>${formatNaira(totalKobo)}</strong>`)}</table>`;
}

const templates: { [T in EmailTemplate]: (p: TemplateMap[T]) => RenderedEmail } = {
  order_paid: ({ name, orderNumber, items, shippingFeeKobo, totalKobo, eta, lookupUrl }) => ({
    subject: `Order ${orderNumber} confirmed`,
    text: [
      `Hi ${name},`,
      "",
      `Thank you! We've received your payment for order ${orderNumber}.`,
      "",
      ...items.map((i) => `${i.name} × ${i.quantity} (${i.detail}): ${formatNaira(i.lineTotalKobo)}`),
      `Shipping: ${formatNaira(shippingFeeKobo)}`,
      `Total: ${formatNaira(totalKobo)}`,
      "",
      eta ? `Estimated delivery: ${eta}` : "",
      `Track your order: ${lookupUrl}`,
    ].join("\n"),
    html: layout(
      `Order ${orderNumber} confirmed`,
      paragraph(`Hi ${name},`) +
        paragraph("Thank you! We've received your payment and our team will start blending your order.") +
        itemsTable(items, shippingFeeKobo, totalKobo) +
        (eta ? paragraph(`Estimated delivery: ${eta}`) : "") +
        button("LOOK UP YOUR ORDER", lookupUrl) +
        paragraph(`You can check on your order any time with your order number (${orderNumber}) and this email address.`),
    ),
  }),
  verify_email: ({ name, url }) => ({
    subject: "Verify your email",
    text: `Hi ${name},\n\nConfirm your email address to finish setting up your Build a Scent account:\n${url}\n\nIf you didn't create an account, you can ignore this email.`,
    html: layout(
      "Verify your email",
      paragraph(`Hi ${name},`) +
        paragraph("Confirm your email address to finish setting up your Build a Scent account.") +
        button("VERIFY EMAIL", url) +
        paragraph("If you didn't create an account, you can ignore this email."),
    ),
  }),
  reset_password: ({ name, url }) => ({
    subject: "Reset your password",
    text: `Hi ${name},\n\nUse this link to choose a new password (valid for 1 hour):\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
    html: layout(
      "Reset your password",
      paragraph(`Hi ${name},`) +
        paragraph("Use the button below to choose a new password. The link is valid for 1 hour.") +
        button("RESET PASSWORD", url) +
        paragraph("If you didn't ask for this, you can ignore this email."),
    ),
  }),
  listing_approved: ({ name, scentName, url }) => ({
    subject: `${scentName} is now live on the marketplace`,
    text: `Hi ${name},\n\nYour scent ${scentName} is now live on the marketplace!\n\nSee it here: ${url}`,
    html: layout(
      "Your scent is live",
      paragraph(`Hi ${name},`) + paragraph(`Your scent ${scentName} is now live on the marketplace!`) + button("VIEW YOUR LISTING", url),
    ),
  }),
  listing_rejected: ({ name, scentName, reason, url }) => ({
    subject: `${scentName} needs changes before it can go live`,
    text: `Hi ${name},\n\nWe couldn't approve ${scentName} yet. Reason:\n${reason}\n\nYou can update the listing and resubmit it: ${url}`,
    html: layout(
      "Your listing needs changes",
      paragraph(`Hi ${name},`) +
        paragraph(`We couldn't approve ${scentName} yet. Here's why:`) +
        `<blockquote style="margin:0 0 16px;padding:12px 16px;border-left:2px solid #c9a84c;color:#f0e6cc">${escapeHtml(reason)}</blockquote>` +
        paragraph("Update the description, markup or featured notes, then resubmit it for review.") +
        button("RESUBMIT", url),
    ),
  }),
  listing_unavailable: ({ name, scentName, reason, url }) => ({
    subject: `${scentName} is temporarily unavailable`,
    text: `Hi ${name},\n\n${scentName} has been taken off the marketplace for now: ${reason}\nIt will go live again automatically when it's available. ${url}`,
    html: layout(
      "Your listing is paused",
      paragraph(`Hi ${name},`) +
        paragraph(`${scentName} has been taken off the marketplace for now: ${reason}`) +
        paragraph("It will go live again automatically as soon as it's available. You don't need to do anything.") +
        button("SELLER DASHBOARD", url),
    ),
  }),
  listing_available: ({ name, scentName, url }) => ({
    subject: `${scentName} is back on the marketplace`,
    text: `Hi ${name},\n\nGood news: ${scentName} is available again and back on the marketplace. ${url}`,
    html: layout(
      "Your listing is back",
      paragraph(`Hi ${name},`) + paragraph(`Good news: ${scentName} is available again and back on the marketplace.`) + button("VIEW YOUR LISTING", url),
    ),
  }),
  test_email: ({ sentBy }) => ({
    subject: "Build a Scent test email",
    text: `This is a test email sent by ${sentBy}. Email delivery is working.`,
    html: layout("Test email", paragraph(`This is a test email sent by ${sentBy}. Email delivery is working.`)),
  }),
};

export function renderEmail<T extends EmailTemplate>(template: T, payload: EmailPayload<T>): RenderedEmail {
  const render = templates[template] as (p: EmailPayload<T>) => RenderedEmail;
  if (!render) throw new Error(`Unknown email template ${template}`);
  return render(payload);
}

export function isEmailTemplate(value: string): value is EmailTemplate {
  return value in templates;
}
