import crypto from 'crypto'
import { buildStokGeldEmail, escapeHtml } from './emailSignature.js'
import { sendMailSafe } from './mailer.js'

function appBaseUrl() {
  const first = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .find(Boolean)
  return first || 'http://localhost:5173'
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function inviteLink(token) {
  return `${appBaseUrl()}/accept-invitation?token=${encodeURIComponent(token)}`
}

export function normalizeInviteEmail(value) {
  const email = normalizeEmail(value)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ''
  return email
}

export function createInviteToken() {
  return crypto.randomUUID()
}

export async function createInvitation(
  client,
  { stokvelId, email, invitedBy, status = 'pending', groupRole = null },
) {
  const token = createInviteToken()
  const row = {
    stokvel_id: stokvelId,
    email: normalizeEmail(email),
    token,
    status,
    invited_by: invitedBy ?? null,
    group_role: groupRole ?? null,
  }
  const { data, error } = await client.from('invitations').insert(row).select('*').single()
  return { data, error }
}

export async function sendGroupAddedEmail({ to, groupName, role = 'member' }) {
  return sendMailSafe(
    buildStokGeldEmail({
      from: process.env.EMAIL_USER,
      to,
      subject: `Added to ${groupName}`,
      mainText: `Dear Member,\n\nYou have been added to the stokvel "${groupName}" with the role of ${role}. Please sign in to your dashboard to view the group details.\n\nKind regards,`,
    }),
  )
}

export async function sendInvitationEmail({ to, groupName, token }) {
  const link = inviteLink(token)
  const mainText = `Dear Member,\n\nYou are invited to join the stokvel "${groupName}". Please accept your invitation using the link below:\n${link}\n\nKind regards,`
  const mainHtml = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222">
<p style="margin:0 0 12px">Dear Member,</p>
<p style="margin:0 0 12px">You are invited to join the stokvel <strong>${escapeHtml(
    groupName,
  )}</strong>. Please accept your invitation using the link below:</p>
<p style="margin:0 0 12px"><a href="${escapeHtml(link)}" style="color:#1e4d2b;font-weight:600">${escapeHtml(
    link,
  )}</a></p>
<p style="margin:0">Kind regards,</p>
</div>`
  return sendMailSafe(
    buildStokGeldEmail({
      from: process.env.EMAIL_USER,
      to,
      subject: `Invitation to join ${groupName}`,
      mainText,
      mainHtml,
    }),
  )
}

export async function sendGroupStatusEmail({ to, groupName, status }) {
  const statusText = status === 'active' ? 'accepted' : 'rejected'
  return sendMailSafe(
    buildStokGeldEmail({
      from: process.env.EMAIL_USER,
      to,
      subject: `Your group request was ${statusText}`,
      mainText: `Dear Member,\n\nYour request for the group "${groupName}" has been ${statusText}.\n\nKind regards,`,
    }),
  )
}

export async function sendMeetingScheduledEmail({
  to,
  groupName,
  title,
  meetingDate,
  meetingLink,
  agenda,
}) {
  const mainText = [
    'Dear Member,',
    '',
    `A new meeting has been scheduled for "${groupName}".`,
    '',
    `Title: ${title}`,
    `Date: ${meetingDate}`,
    `Link: ${meetingLink || 'Not provided.'}`,
    '',
    'Agenda:',
    agenda || 'Not provided.',
    '',
    'Kind regards,',
  ].join('\n')
  return sendMailSafe(
    buildStokGeldEmail({
      from: process.env.EMAIL_USER,
      to,
      subject: `New meeting scheduled: ${title}`,
      mainText,
    }),
  )
}
