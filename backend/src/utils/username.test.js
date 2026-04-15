import { normalizeUsername } from './username.js'

describe('normalizeUsername', () => {

  // 🔹 Non-string inputs
  describe('non-string inputs', () => {
    it('should return empty string for null', () => {
      expect(normalizeUsername(null)).toBe('')
    })

    it('should return empty string for undefined', () => {
      expect(normalizeUsername(undefined)).toBe('')
    })

    it('should return empty string for numbers', () => {
      expect(normalizeUsername(123)).toBe('')
    })

    it('should return empty string for objects', () => {
      expect(normalizeUsername({})).toBe('')
    })
  })

  // 🔹 Basic valid cases
  describe('valid usernames', () => {
    it('should lowercase uppercase letters', () => {
      expect(normalizeUsername('JohnDoe')).toBe('johndoe')
    })

    it('should trim whitespace', () => {
      expect(normalizeUsername('  johndoe  ')).toBe('johndoe')
    })

    it('should replace spaces with underscores', () => {
      expect(normalizeUsername('john doe')).toBe('john_doe')
    })

    it('should handle multiple spaces', () => {
      expect(normalizeUsername('john    doe')).toBe('john_doe')
    })

    it('should keep valid underscores', () => {
      expect(normalizeUsername('john_doe')).toBe('john_doe')
    })

    it('should keep numbers', () => {
      expect(normalizeUsername('john123')).toBe('john123')
    })
  })

  // 🔹 Special characters
  describe('special characters', () => {
    it('should remove special characters', () => {
      expect(normalizeUsername('john@doe!')).toBe('johndoe')
    })

    it('should remove mixed invalid characters', () => {
      expect(normalizeUsername('jo#hn$ do%e^')).toBe('john_doe')
    })
  })

  // 🔹 Length constraints
  describe('length validation', () => {
    it('should return empty string if less than 3 chars', () => {
      expect(normalizeUsername('ab')).toBe('')
    })

    it('should return empty string if cleaned string is less than 3 chars', () => {
      expect(normalizeUsername('a!')).toBe('')
    })

    it('should allow exactly 3 characters', () => {
      expect(normalizeUsername('abc')).toBe('abc')
    })

    it('should allow exactly 30 characters', () => {
      const input = 'a'.repeat(30)
      expect(normalizeUsername(input)).toBe(input)
    })

    it('should return empty string if more than 30 characters', () => {
      const input = 'a'.repeat(31)
      expect(normalizeUsername(input)).toBe('')
    })
  })

  // 🔹 Combined transformations
  describe('combined transformations', () => {
    it('should normalize complex input correctly', () => {
      expect(normalizeUsername('  John   Doe!!123  '))
        .toBe('john_doe123')
    })
  })

})