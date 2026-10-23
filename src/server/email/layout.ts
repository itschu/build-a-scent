// Shared HTML wrapper for transactional emails. Inline styles only; email clients ignore stylesheets.

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function button(label: string, url: string): string {
  return `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="background:#c9a84c;color:#0a0a0a;padding:14px 28px;text-decoration:none;letter-spacing:2px;font-size:13px">${escapeHtml(label)}</a></p>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(text)}</p>`;
}

/** Replaced with the support contact (Settings → Storefront) when an email is sent. */
export const SUPPORT_SLOT = "<!--support-contact-->";

export function supportHtml(email: string, phone: string): string {
  const parts = [email && `<a href="mailto:${escapeHtml(email)}" style="color:#c9a84c">${escapeHtml(email)}</a>`, phone && escapeHtml(phone)].filter(Boolean);
  return parts.length
    ? `<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #2a2a2a;font-size:13px;color:#8a8a8a">Questions? Contact us at ${parts.join(" or ")}.</p>`
    : "";
}

export function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#0a0a0a;font-family:Georgia,serif;color:#e8d5a3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #2a2a2a;background:#111">
<tr><td style="padding:24px 32px;border-bottom:1px solid #2a2a2a;letter-spacing:4px;color:#c9a84c;font-size:13px">BUILD A SCENT</td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 20px;font-weight:normal;font-size:24px;color:#f0e6cc">${escapeHtml(heading)}</h1>
${bodyHtml}
${SUPPORT_SLOT}
</td></tr></table></td></tr></table></body></html>`;
}
