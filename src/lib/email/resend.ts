import "server-only";
import { Resend } from "resend";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./types";
import { brand } from "@/config/brand";

export class ResendEmailProvider implements EmailProvider {
  private client: Resend;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.client = new Resend(apiKey);
    this.defaultFrom = defaultFrom;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const from =
      input.from ??
      this.defaultFrom ??
      `${brand.emailFromName} <noreply@example.com>`;

    const result = await this.client.emails.send({
      from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }

    return {
      id: result.data?.id ?? "unknown",
      provider: "resend",
    };
  }
}
