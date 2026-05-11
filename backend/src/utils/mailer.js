import nodemailer from 'nodemailer'

function hasMailConfig() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD)
}

let cachedTransporter = null

export function getMailer() {
  if (!hasMailConfig()) return null
  if (cachedTransporter) return cachedTransporter
  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  })
  return cachedTransporter
}

export async function sendMailSafe(payload) {
  const transporter = getMailer()
  if (!transporter) {
    console.warn('sendMailSafe: EMAIL_USER / EMAIL_APP_PASSWORD not configured; email skipped.')
    return { skipped: true }
  }
  try {
    const info = await transporter.sendMail(payload)
    return { skipped: false, info }
  } catch (error) {
    console.error('sendMailSafe error:', error)
    return { skipped: false, error }
  }
}
