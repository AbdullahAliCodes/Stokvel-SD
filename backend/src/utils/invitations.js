import crypto from 'crypto'
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
  return sendMailSafe({
    from: process.env.EMAIL_USER,
    to,
    subject: `Added to ${groupName}`,
    text: `Dear Member,\n\nYou have been added to the stokvel "${groupName}" with the role of ${role}. Please sign in to your dashboard to view the group details.\n\nKind regards,\nStokvel Team`,
  })
}

export async function sendInvitationEmail({ to, groupName, token }) {
  const link = inviteLink(token)
  return sendMailSafe({
    from: process.env.EMAIL_USER,
    to,
    subject: `Invitation to join ${groupName}`,
    text: `Dear Member,\n\nYou are invited to join the stokvel "${groupName}". Please accept your invitation using the link below:\n${link}\n\nKind regards,\nStokvel Team`,
  })
}

export async function sendGroupStatusEmail({ to, groupName, status }) {
  const statusText = status === 'active' ? 'accepted' : 'rejected'
  return sendMailSafe({
    from: process.env.EMAIL_USER,
    to,
    subject: `Your group request was ${statusText}`,
    text: `Dear Member,\n\nYour request for the group "${groupName}" has been ${statusText}.\n\nKind regards,\nStokvel Team`,
    
  })
}

export async function sendMeetingScheduledEmail({
  to,
  groupName,
  title,
  meetingDate,
  meetingLink,
  agenda,
}) {
  return sendMailSafe({
    from: process.env.EMAIL_USER,
    to,
    subject: `New meeting scheduled: ${title}`,
    text: [
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
      'Stokvel Team',
    ].join('\n'),
    
  })
}
