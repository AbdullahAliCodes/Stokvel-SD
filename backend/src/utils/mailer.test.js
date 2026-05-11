import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

// --- 1. Mock Dependencies ---
const mockSendMail = jest.fn()
const mockCreateTransport = jest.fn().mockReturnValue({
  sendMail: mockSendMail,
})

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}))

// Dynamically import the module after mocking
const { getMailer, sendMailSafe } = await import('./mailer.js')

describe('Mailer Utility', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Create a fresh copy of the environment variables for each test
    process.env = { ...originalEnv }
    
    // Silence console warnings and errors during tests
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore environment variables and console mocks
    process.env = originalEnv
    console.warn.mockRestore()
    console.error.mockRestore()
  })

  // ==========================================
  // Missing Configuration Cases (Uncached)
  // ==========================================
  describe('Missing Configuration', () => {
    it('returns null from getMailer if EMAIL_USER is missing', () => {
      delete process.env.EMAIL_USER
      process.env.EMAIL_APP_PASSWORD = 'password123'
      
      expect(getMailer()).toBeNull()
    })

    it('returns null from getMailer if EMAIL_APP_PASSWORD is missing', () => {
      process.env.EMAIL_USER = 'test@example.com'
      delete process.env.EMAIL_APP_PASSWORD
      
      expect(getMailer()).toBeNull()
    })

    it('skips sending email and warns if configuration is missing', async () => {
      delete process.env.EMAIL_USER
      delete process.env.EMAIL_APP_PASSWORD

      const payload = { to: 'recipient@test.com', subject: 'Test' }
      const result = await sendMailSafe(payload)

      expect(result).toEqual({ skipped: true })
      expect(console.warn).toHaveBeenCalledWith(
        'sendMailSafe: EMAIL_USER / EMAIL_APP_PASSWORD not configured; email skipped.'
      )
      expect(mockCreateTransport).not.toHaveBeenCalled()
      expect(mockSendMail).not.toHaveBeenCalled()
    })
  })

  // ==========================================
  // Successful Configuration & Caching
  // ==========================================
  describe('Configuration Present & Transporter Caching', () => {
    it('creates a new transporter and caches it on subsequent calls', () => {
      process.env.EMAIL_USER = 'test@example.com'
      process.env.EMAIL_APP_PASSWORD = 'secure-password'

      // First call - should create the transporter
      const transporter1 = getMailer()
      
      expect(mockCreateTransport).toHaveBeenCalledTimes(1)
      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        family: 4,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        auth: {
          user: 'test@example.com',
          pass: 'secure-password',
        },
      })
      expect(transporter1).not.toBeNull()

      // Second call - should hit the cache and NOT call createTransport again
      const transporter2 = getMailer()
      
      expect(mockCreateTransport).toHaveBeenCalledTimes(1) // Still exactly 1
      expect(transporter1).toBe(transporter2) // Must be the exact same instance in memory
    })
  })

  // ==========================================
  // sendMailSafe Try/Catch Logic
  // ==========================================
  describe('sendMailSafe Logic', () => {
    // Make sure config is present for these tests
    beforeEach(() => {
      process.env.EMAIL_USER = 'test@example.com'
      process.env.EMAIL_APP_PASSWORD = 'secure-password'
    })

    it('successfully sends an email and returns the info object', async () => {
      const mockInfo = { messageId: '<1234@gmail.com>', response: '250 OK' }
      mockSendMail.mockResolvedValueOnce(mockInfo)

      const payload = { to: 'user@test.com', subject: 'Hello World' }
      const result = await sendMailSafe(payload)

      expect(mockSendMail).toHaveBeenCalledTimes(1)
      expect(mockSendMail).toHaveBeenCalledWith(payload)
      expect(result).toEqual({ skipped: false, info: mockInfo })
      expect(console.error).not.toHaveBeenCalled()
    })

    it('catches and returns the error if sendMail throws an exception', async () => {
      const mockError = new Error('SMTP Connection Timeout')
      mockSendMail.mockRejectedValueOnce(mockError)

      const payload = { to: 'user@test.com', subject: 'Failing Email' }
      const result = await sendMailSafe(payload)

      expect(mockSendMail).toHaveBeenCalledTimes(1)
      expect(mockSendMail).toHaveBeenCalledWith(payload)
      
      // Asserts that the error was caught and formatted properly
      expect(result).toEqual({ skipped: false, error: mockError })
      expect(console.error).toHaveBeenCalledWith('sendMailSafe error:', mockError)
    })
  })
})