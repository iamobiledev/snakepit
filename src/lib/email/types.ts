/**
 * Reusable transactional email service interface.
 * Swap Resend for another provider without changing call sites.
 */

export type EmailAddress = string;

export type SendEmailInput = {
  to: EmailAddress | EmailAddress[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
};

export type SendEmailResult = {
  id: string;
  provider: string;
};

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export class ConsoleEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const id = `console-${Date.now()}`;
    console.info(
      JSON.stringify({
        level: "info",
        message: "email.console",
        to: input.to,
        subject: input.subject,
        id,
      }),
    );
    return { id, provider: "console" };
  }
}
