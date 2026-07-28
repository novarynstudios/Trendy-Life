import "server-only"

import nodemailer from "nodemailer"
import { db } from "@/lib/db"

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]!))
}

export async function sendClientMail(input: {
  userId?: number
  recipient: string
  template: string
  subject: string
  heading: string
  message: string
  actionLabel?: string
  actionUrl?: string
}) {
  const safeHeading = escapeHtml(input.heading)
  const safeMessage = escapeHtml(input.message)
  const safeUrl = input.actionUrl ? escapeHtml(input.actionUrl) : ""
  const html = `<!doctype html><html><body style="margin:0;background:#f4f2ee;font-family:Arial,sans-serif;color:#1d1b1e"><div style="max-width:620px;margin:auto;padding:32px 18px"><div style="background:#18171a;padding:20px;color:#fff;font-weight:800">Trendy Life</div><main style="background:#fff;padding:30px;border:1px solid #e1ded9"><h1 style="font-size:24px">${safeHeading}</h1><p style="line-height:1.65;color:#555">${safeMessage}</p>${input.actionUrl ? `<p><a href="${safeUrl}" style="display:inline-block;padding:13px 20px;background:#e51b2a;color:#fff;text-decoration:none;border-radius:30px">${escapeHtml(input.actionLabel || "Open client area")}</a></p>` : ""}<p style="font-size:12px;color:#777">If you did not request this, contact support immediately.</p></main></div></body></html>`
  const text = `${input.heading}\n\n${input.message}${input.actionUrl ? `\n\n${input.actionLabel || "Open client area"}: ${input.actionUrl}` : ""}\n\nIf you did not request this, contact support immediately.`
  const row = db.prepare(`
    INSERT INTO client_email_outbox(user_id,template,recipient,subject,html_body,text_body,status)
    VALUES (?,?,?,?,?,?,'queued')
  `).run(input.userId ?? null, input.template, input.recipient, input.subject, html, text)
  const id = Number(row.lastInsertRowid)
  if (!process.env.SMTP_HOST) {
    db.prepare("UPDATE client_email_outbox SET status='development' WHERE id=?").run(id)
    return { delivered: false, previewId: id }
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: process.env.SMTP_USERNAME ? { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD } : undefined,
    })
    const result = await transporter.sendMail({
      from: { name: process.env.SMTP_FROM_NAME || "Trendy Life", address: process.env.SMTP_FROM_EMAIL || "no-reply@trendylife.com.bd" },
      to: input.recipient,
      subject: input.subject,
      html,
      text,
    })
    db.prepare("UPDATE client_email_outbox SET status='sent',provider_id=?,sent_at=CURRENT_TIMESTAMP WHERE id=?").run(result.messageId, id)
    return { delivered: true, previewId: id }
  } catch (error) {
    db.prepare("UPDATE client_email_outbox SET status='failed',failure_reason=? WHERE id=?")
      .run(error instanceof Error ? error.message.slice(0, 300) : "SMTP delivery failed", id)
    return { delivered: false, previewId: id }
  }
}
