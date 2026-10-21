// Every transactional email, keyed by template name. Payloads are stored in the outbox as
// JSON, so they must contain only plain data.
import { button, layout, paragraph } from "./layout";

export type RenderedEmail = { subject: string; text: string; html: string };

type TemplateMap = {
  verify_email: { name: string; url: string };
  reset_password: { name: string; url: string };
  test_email: { sentBy: string };
};

export type EmailTemplate = keyof TemplateMap;
export type EmailPayload<T extends EmailTemplate> = TemplateMap[T];

const templates: { [T in EmailTemplate]: (p: TemplateMap[T]) => RenderedEmail } = {
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
