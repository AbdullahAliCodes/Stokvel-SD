import {
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
    jest,
  } from '@jest/globals'
  import { requireAdmin } from './requireAdmin.js'
  
  describe('requireAdmin Middleware', () => {
    let mockReq
    let mockRes
    let mockNext
  
    beforeEach(() => {
      mockReq = { user: {} }
  
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      }
  
      mockNext = jest.fn()
    })
  
    afterEach(() => {
      jest.clearAllMocks()
    })
  
    describe('Success Cases', () => {
      it('should call next() when user role is exactly "admin"', () => {
        mockReq.user = { role: 'admin' }
  
        requireAdmin(mockReq, mockRes, mockNext)
  
        expect(mockNext).toHaveBeenCalledTimes(1)
        expect(mockRes.status).not.toHaveBeenCalled()
        expect(mockRes.json).not.toHaveBeenCalled()
      })
  
      it('should call next() when user role is "admin" with mixed casing', () => {
        mockReq.user = { role: 'AdMiN' }
  
        requireAdmin(mockReq, mockRes, mockNext)
  
        expect(mockNext).toHaveBeenCalledTimes(1)
      })
    })
  
    describe('Failure Cases', () => {
      it('should return 403 when user role is a non-admin string (e.g., "user")', () => {
        mockReq.user = { role: 'user' }
  
        requireAdmin(mockReq, mockRes, mockNext)
  
        expect(mockRes.status).toHaveBeenCalledWith(403)
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Forbidden: admin access required',
        })
        expect(mockNext).not.toHaveBeenCalled()
      })
  
      it('should return 403 when user role is an empty string', () => {
        mockReq.user = { role: '' }
  
        requireAdmin(mockReq, mockRes, mockNext)
  
        expect(mockRes.status).toHaveBeenCalledWith(403)
        expect(mockNext).not.toHaveBeenCalled()
      })
    })
  
    describe('Edge Cases', () => {
      it('should return 403 when req.user is entirely undefined', () => {
        mockReq.user = undefined
  
        requireAdmin(mockReq, mockRes, mockNext)
  
        expect(mockRes.status).toHaveBeenCalledWith(403)
        expect(mockNext).not.toHaveBeenCalled()
      })
  
      it('should return 403 when req.user exists but the role property is missing', () => {
        mockReq.user = { name: 'John Doe' }
  
        requireAdmin(mockReq, mockRes, mockNext)
  
        expect(mockRes.status).toHaveBeenCalledWith(403)
        expect(mockNext).not.toHaveBeenCalled()
      })
  
      it('should return 403 when req.user.role is a non-string type (e.g., a number)', () => {
        mockReq.user = { role: 123 }
  
        requireAdmin(mockReq, mockRes, mockNext)
  
        expect(mockRes.status).toHaveBeenCalledWith(403)
        expect(mockNext).not.toHaveBeenCalled()
      })
  
      it('should return 403 when req.user.role is null', () => {
        mockReq.user = { role: null }
  
        requireAdmin(mockReq, mockRes, mockNext)
  
        expect(mockRes.status).toHaveBeenCalledWith(403)
        expect(mockNext).not.toHaveBeenCalled()
      })
    })
  })