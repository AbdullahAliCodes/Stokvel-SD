import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import crypto from 'crypto'

// --- 1. Mock Dependencies ---
const mockSendMailSafe = jest.fn()

jest.unstable_mockModule('./mailer.js', () => ({
  sendMailSafe: mockSendMailSafe,
}))

// Dynamically import the module after mocking
const {
  normalizeInviteEmail,
  createInviteToken,
  createInvitation,
  sendGroupAddedEmail,
  sendInvitationEmail,
  sendGroupStatusEmail,
  sendMeetingScheduledEmail,
} = await import('./invitations.js')

describe('Invitations & Email Utilities', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.EMAIL_USER = 'no-reply@stokgeld.com'
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  // ==========================================
  // normalizeInviteEmail()
  // ==========================================
  describe('normalizeInviteEmail', () => {
    it('normalizes a valid email (trims and lowercases)', () => {
      expect(normalizeInviteEmail('  TestUser@Example.com  ')).toBe('testuser@example.com')
    })

    it('returns an empty string for invalid email formats', () => {
      expect(normalizeInviteEmail('not-an-email')).toBe('')
      expect(normalizeInviteEmail('missing@domain')).toBe('')
      expect(normalizeInviteEmail('@missingusername.com')).toBe('')
      expect(normalizeInviteEmail('spaces in@email.com')).toBe('')
    })

    it('returns an empty string for non-string inputs', () => {
      expect(normalizeInviteEmail(null)).toBe('')
      expect(normalizeInviteEmail(undefined)).toBe('')
      expect(normalizeInviteEmail(12345)).toBe('')
      expect(normalizeInviteEmail({})).toBe('')
    })
  })

  // ==========================================
  // createInviteToken()
  // ==========================================
  describe('createInviteToken', () => {
    it('returns a valid UUID', () => {
      jest.spyOn(crypto, 'randomUUID').mockReturnValue('123e4567-e89b-12d3-a456-426614174000')
      const token = createInviteToken()
      expect(token).toBe('123e4567-e89b-12d3-a456-426614174000')
    })
  })

  // ==========================================
  // createInvitation()
  // ==========================================
  describe('createInvitation', () => {
    let mockSupabaseChain;
    let mockClient;

    beforeEach(() => {
      mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
      }
      mockClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue(mockSupabaseChain),
        }),
      }
      jest.spyOn(crypto, 'randomUUID').mockReturnValue('mock-token-abc')
    })

    it('creates an invitation with all provided fields', async () => {
      const args = {
        stokvelId: 'stokvel-123',
        email: '  Invitee@test.com ',
        invitedBy: 'admin-456',
        status: 'accepted',
        groupRole: 'treasurer',
      }

      const result = await createInvitation(mockClient, args)

      expect(mockClient.from).toHaveBeenCalledWith('invitations')
      expect(mockClient.from().insert).toHaveBeenCalledWith({
        stokvel_id: 'stokvel-123',
        email: 'invitee@test.com', // Normalizes automatically
        token: 'mock-token-abc',
        status: 'accepted',
        invited_by: 'admin-456',
        group_role: 'treasurer',
      })
      expect(result).toEqual({ data: { id: 1 }, error: null })
    })

    it('uses correct fallback defaults for optional fields', async () => {
      const args = {
        stokvelId: 'stokvel-123',
        email: 'invitee@test.com',
        // Omitting invitedBy, status, and groupRole
      }

      await createInvitation(mockClient, args)

      expect(mockClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',       // Default
          invited_by: null,        // Fallback
          group_role: null,        // Fallback
        })
      )
    })
  })

  // ==========================================
  // Email Notifications
  // ==========================================
  describe('Email Notifications', () => {
    describe('sendGroupAddedEmail', () => {
      it('sends an email with the provided role', async () => {
        await sendGroupAddedEmail({ to: 'user@test.com', groupName: 'Test Group', role: 'admin' })

        expect(mockSendMailSafe).toHaveBeenCalledWith({
          from: 'no-reply@stokgeld.com',
          to: 'user@test.com',
          subject: 'Added to Test Group',
          text: expect.stringContaining('role of admin'),
        })
      })

      it('falls back to "member" role if none is provided', async () => {
        await sendGroupAddedEmail({ to: 'user@test.com', groupName: 'Test Group' })

        expect(mockSendMailSafe).toHaveBeenCalledWith(
          expect.objectContaining({ text: expect.stringContaining('role of member') })
        )
      })
    })

    describe('sendInvitationEmail & appBaseUrl logic', () => {
      it('generates a link using the first URL from a comma-separated FRONTEND_URL env var', async () => {
        process.env.FRONTEND_URL = 'https://prod.com , http://localhost:3000'
        await sendInvitationEmail({ to: 'user@test.com', groupName: 'Test Group', token: 'my-token' })

        expect(mockSendMailSafe).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: 'Invitation to join Test Group',
            text: expect.stringContaining('https://prod.com/accept-invitation?token=my-token'),
          })
        )
      })

      it('URL encodes the token in the link', async () => {
        process.env.FRONTEND_URL = 'https://prod.com'
        // Tokens shouldn't normally have spaces, but if they do, encodeURIComponent catches it
        await sendInvitationEmail({ to: 'user@test.com', groupName: 'Test Group', token: 'a b/c' })

        expect(mockSendMailSafe).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('https://prod.com/accept-invitation?token=a%20b%2Fc'),
          })
        )
      })

      it('falls back to http://localhost:5173 if FRONTEND_URL is completely missing', async () => {
        delete process.env.FRONTEND_URL
        await sendInvitationEmail({ to: 'user@test.com', groupName: 'Test Group', token: 'token123' })

        expect(mockSendMailSafe).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('http://localhost:5173/accept-invitation?token=token123'),
          })
        )
      })

      it('falls back to http://localhost:5173 if FRONTEND_URL is a string of commas/spaces', async () => {
        process.env.FRONTEND_URL = ', , ' // .find(Boolean) will return undefined
        await sendInvitationEmail({ to: 'user@test.com', groupName: 'Test Group', token: 'token123' })

        expect(mockSendMailSafe).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('http://localhost:5173/accept-invitation?token=token123'),
          })
        )
      })
    })

    describe('sendGroupStatusEmail', () => {
      it('sends an "accepted" email when status is active', async () => {
        await sendGroupStatusEmail({ to: 'user@test.com', groupName: 'Test Group', status: 'active' })

        expect(mockSendMailSafe).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: 'Your group request was accepted',
            text: expect.stringContaining('has been accepted.'),
          })
        )
      })

      it('sends a "rejected" email when status is anything else', async () => {
        await sendGroupStatusEmail({ to: 'user@test.com', groupName: 'Test Group', status: 'declined' })

        expect(mockSendMailSafe).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: 'Your group request was rejected',
            text: expect.stringContaining('has been rejected.'),
          })
        )
      })
    })

    describe('sendMeetingScheduledEmail', () => {
      it('sends an email with all meeting details', async () => {
        await sendMeetingScheduledEmail({
          to: 'user@test.com',
          groupName: 'Test Group',
          title: 'Monthly Catchup',
          meetingDate: '2026-05-01 10:00 AM',
          meetingLink: 'https://zoom.us/j/123',
          agenda: '1. Finances\n2. New Members',
        })

        expect(mockSendMailSafe).toHaveBeenCalledWith({
          from: 'no-reply@stokgeld.com',
          to: 'user@test.com',
          subject: 'New meeting scheduled: Monthly Catchup',
          text: expect.stringContaining('Link: https://zoom.us/j/123\n\nAgenda:\n1. Finances\n2. New Members'),
        })
      })

      it('uses "Not provided." fallbacks for missing link and agenda', async () => {
        await sendMeetingScheduledEmail({
          to: 'user@test.com',
          groupName: 'Test Group',
          title: 'Quick Sync',
          meetingDate: 'Tomorrow',
          // Omitting meetingLink and agenda
        })

        expect(mockSendMailSafe).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining('Link: Not provided.\n\nAgenda:\nNot provided.'),
          })
        )
      })
    })
  })
})