/**
 * Resend delivery for proposal links.
 *
 * Lazy like lib/db — the BFF boots without RESEND_API_KEY; only the
 * /send route fails (loudly) when it is absent. The "from" defaults to Resend's
 * shared sandbox sender until the operator verifies a domain and sets
 * PROPOSAL_FROM_EMAIL (sandbox only delivers to the Resend account owner).
 */
import { Resend } from "resend";

export interface SendLinkInput {
  to: string;
  clientName: string;
  ref: string;
  /** The full shareable shell link, e.g. https://client.rarestructure.com/p/RS-… */
  url: string;
  templateLabel: string;
}

export interface EmailResult {
  sent: boolean;
  id?: string;
  error?: string;
}

const DEFAULT_FROM = "Rare Structure <onboarding@resend.dev>";

export async function sendProposalLink(input: SendLinkInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY not configured" };
  const from = process.env.PROPOSAL_FROM_EMAIL ?? DEFAULT_FROM;

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: `Rare Structure — Engagement Proposal (${input.ref})`,
      html: renderEmail(input),
    });
    if (error) return { sent: false, error: `${error.name}: ${error.message}` };
    return { sent: true, id: data?.id };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function renderEmail(i: SendLinkInput): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#0a0e1a;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#e4e4e7;padding:40px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px">
          <tr><td style="padding:0 8px 24px">
            <div style="font-size:13px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#fafafa">Rare Structure</div>
            <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#82828c;margin-top:4px">Catalyst-Driven Origination</div>
          </td></tr>
          <tr><td style="padding:0 8px">
            <p style="font-size:15px;line-height:1.6;color:#e4e4e7;margin:0 0 16px">${escapeHtml(i.clientName)},</p>
            <p style="font-size:15px;line-height:1.6;color:#a1a1aa;margin:0 0 24px">
              Your engagement proposal is ready to review and sign. The terms and the full agreement are at the link below.
            </p>
            <a href="${i.url}" style="display:inline-block;background:#3461c4;color:#fff;text-decoration:none;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;padding:14px 28px;border:1px solid #3461c4">Review &amp; sign proposal</a>
            <p style="font-size:11px;line-height:1.5;color:#82828c;margin:24px 0 0">
              ${escapeHtml(i.templateLabel)} · Ref ${escapeHtml(i.ref)}<br/>
              If the button does not work, paste this link: <span style="color:#93b4f5">${i.url}</span>
            </p>
          </td></tr>
          <tr><td style="padding:32px 8px 0;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#82828c">
            Confidential · Originated by Rare Structure LLC
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
