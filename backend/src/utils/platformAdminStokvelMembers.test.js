import { jest, describe, it, expect, beforeEach } from '@jest/globals'
import {
    normalizeUuid,
    fetchPlatformAdminUserIds,
    groupRoleForUserProfile,
    ensurePlatformAdminsInStokvel,
  } from './platformAdminStokvelMembers.js' // Adjust the import path to match your filename

describe('Stokvel Members & Admin Utilities', () => {
  const VALID_UUID_1 = '123e4567-e89b-12d3-a456-426614174000'
  const VALID_UUID_2 = '987f6543-a21b-12d3-a456-426614174000'
  
  let mockProfilesChain
  let mockStokvelMembersChain
  let mockClient

  beforeEach(() => {
    jest.clearAllMocks()

    // 1. Mock the 'profiles' table chain
    mockProfilesChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
    }

    // 2. Mock the 'stokvel_members' table chain
    mockStokvelMembersChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
    }

    // 3. Mock the primary client interface to route to the correct chain
    mockClient = {
      from: jest.fn((tableName) => {
        if (tableName === 'profiles') return mockProfilesChain
        if (tableName === 'stokvel_members') return mockStokvelMembersChain
        throw new Error(`Unexpected table: ${tableName}`)
      }),
    }
  })

  // ==========================================
  // normalizeUuid()
  // ==========================================
  describe('normalizeUuid', () => {
    it('returns a lowercase, trimmed valid UUID', () => {
      expect(normalizeUuid(`  ${VALID_UUID_1.toUpperCase()}  `)).toBe(VALID_UUID_1)
    })

    it('returns an empty string for invalid UUID formats', () => {
      expect(normalizeUuid('not-a-uuid')).toBe('')
      expect(normalizeUuid('123e4567-e89b-12d3-a456-42661417400Z')).toBe('') // Invalid hex 'Z'
      expect(normalizeUuid(VALID_UUID_1 + '0000')).toBe('') // Too long
    })

    it('returns an empty string for non-string inputs', () => {
      expect(normalizeUuid(null)).toBe('')
      expect(normalizeUuid(undefined)).toBe('')
      expect(normalizeUuid(12345)).toBe('')
      expect(normalizeUuid({})).toBe('')
    })
  })

  // ==========================================
  // fetchPlatformAdminUserIds()
  // ==========================================
  describe('fetchPlatformAdminUserIds', () => {
    it('fetches and extracts admin IDs successfully', async () => {
      mockProfilesChain.eq.mockResolvedValueOnce({
        data: [{ id: VALID_UUID_1 }, { id: VALID_UUID_2 }],
        error: null,
      })

      const result = await fetchPlatformAdminUserIds(mockClient)

      expect(mockClient.from).toHaveBeenCalledWith('profiles')
      expect(mockProfilesChain.select).toHaveBeenCalledWith('id')
      expect(mockProfilesChain.eq).toHaveBeenCalledWith('role', 'admin')
      expect(result).toEqual({ ids: [VALID_UUID_1, VALID_UUID_2], error: null })
    })

    it('handles null data gracefully (returns empty array)', async () => {
      mockProfilesChain.eq.mockResolvedValueOnce({ data: null, error: null })
      const result = await fetchPlatformAdminUserIds(mockClient)
      expect(result).toEqual({ ids: [], error: null })
    })

    it('returns the error if the database query fails', async () => {
      const dbError = { message: 'DB Error' }
      mockProfilesChain.eq.mockResolvedValueOnce({ data: null, error: dbError })

      const result = await fetchPlatformAdminUserIds(mockClient)
      expect(result).toEqual({ ids: [], error: dbError })
    })
  })

  // ==========================================
  // groupRoleForUserProfile()
  // ==========================================
  describe('groupRoleForUserProfile', () => {
    it('returns "admin" if the user profile role is admin', async () => {
      mockProfilesChain.maybeSingle.mockResolvedValueOnce({
        data: { role: 'admin' },
        error: null,
      })

      const role = await groupRoleForUserProfile(mockClient, VALID_UUID_1)

      expect(mockProfilesChain.eq).toHaveBeenCalledWith('id', VALID_UUID_1)
      expect(role).toBe('admin')
    })

    it('returns "member" if the user profile role is user', async () => {
      mockProfilesChain.maybeSingle.mockResolvedValueOnce({
        data: { role: 'user' },
        error: null,
      })

      const role = await groupRoleForUserProfile(mockClient, VALID_UUID_1)
      expect(role).toBe('member')
    })

    it('returns "member" if data is null (profile not found)', async () => {
      mockProfilesChain.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
      const role = await groupRoleForUserProfile(mockClient, VALID_UUID_1)
      expect(role).toBe('member')
    })

    it('returns "member" if a database error occurs', async () => {
      mockProfilesChain.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB Error' },
      })
      const role = await groupRoleForUserProfile(mockClient, VALID_UUID_1)
      expect(role).toBe('member')
    })
  })

  // ==========================================
  // ensurePlatformAdminsInStokvel()
  // ==========================================
  describe('ensurePlatformAdminsInStokvel', () => {
    const STOKVEL_ID = 'stokvel-999'

    it('returns early with no error if there are zero platform admins in the system', async () => {
      // 1. fetchPlatformAdminUserIds mock response
      mockProfilesChain.eq.mockResolvedValueOnce({ data: [], error: null })

      const result = await ensurePlatformAdminsInStokvel(mockClient, STOKVEL_ID)

      expect(result).toEqual({ error: null })
      expect(mockClient.from).not.toHaveBeenCalledWith('stokvel_members') // Should not fetch existing members
    })

    it('returns error if fetching platform admins fails', async () => {
      const dbError = { message: 'Fetch Admins Error' }
      mockProfilesChain.eq.mockResolvedValueOnce({ data: null, error: dbError })

      const result = await ensurePlatformAdminsInStokvel(mockClient, STOKVEL_ID)
      expect(result).toEqual({ error: dbError })
    })

    it('returns error if fetching existing stokvel members fails', async () => {
      // 1. Admins exist
      mockProfilesChain.eq.mockResolvedValueOnce({ data: [{ id: VALID_UUID_1 }], error: null })
      // 2. Fetching existing members fails
      const dbError = { message: 'Fetch Members Error' }
      mockStokvelMembersChain.eq.mockResolvedValueOnce({ data: null, error: dbError })

      const result = await ensurePlatformAdminsInStokvel(mockClient, STOKVEL_ID)
      expect(result).toEqual({ error: dbError })
    })

    it('inserts missing admins, skipping invalid IDs, existing members, and duplicates in admin list', async () => {
      // 1. Admins mock: Contains a valid ID, an already existing ID, an invalid ID, and a duplicate
      mockProfilesChain.eq.mockResolvedValueOnce({
        data: [
          { id: VALID_UUID_2 },     // Needs to be inserted
          { id: VALID_UUID_1 },     // Already exists (should skip)
          { id: 'invalid-id' },     // Invalid UUID format (should skip)
          { id: VALID_UUID_2 },     // Duplicate in admin list (should skip to avoid DB conflict)
        ],
        error: null,
      })

      // 2. Existing members mock
      mockStokvelMembersChain.eq.mockResolvedValueOnce({
        data: [{ user_id: VALID_UUID_1 }],
        error: null,
      })

      // 3. Insert success mock
      mockStokvelMembersChain.insert.mockResolvedValueOnce({ error: null })

      const result = await ensurePlatformAdminsInStokvel(mockClient, STOKVEL_ID)

      // Verify the insert payload
      expect(mockStokvelMembersChain.insert).toHaveBeenCalledTimes(1)
      expect(mockStokvelMembersChain.insert).toHaveBeenCalledWith([
        {
          stokvel_id: STOKVEL_ID,
          user_id: VALID_UUID_2,
          group_role: 'admin',
        },
      ])

      expect(result).toEqual({ error: null })
    })

    it('returns early with no error if all admins are already in the stokvel (or invalid)', async () => {
      mockProfilesChain.eq.mockResolvedValueOnce({
        data: [{ id: VALID_UUID_1 }, { id: 'bad-uuid' }],
        error: null,
      })
      mockStokvelMembersChain.eq.mockResolvedValueOnce({
        data: [{ user_id: VALID_UUID_1 }],
        error: null,
      })

      const result = await ensurePlatformAdminsInStokvel(mockClient, STOKVEL_ID)

      expect(mockStokvelMembersChain.insert).not.toHaveBeenCalled()
      expect(result).toEqual({ error: null })
    })

    it('returns error if the final insert operation fails', async () => {
      mockProfilesChain.eq.mockResolvedValueOnce({ data: [{ id: VALID_UUID_1 }], error: null })
      mockStokvelMembersChain.eq.mockResolvedValueOnce({ data: [], error: null })
      
      const insertError = { message: 'Insert Error' }
      mockStokvelMembersChain.insert.mockResolvedValueOnce({ error: insertError })

      const result = await ensurePlatformAdminsInStokvel(mockClient, STOKVEL_ID)
      expect(result).toEqual({ error: insertError })
    })

    it('handles null data when fetching existing members', async () => {
      mockProfilesChain.eq.mockResolvedValueOnce({ data: [{ id: VALID_UUID_1 }], error: null })
      // Simulate null data return from Supabase
      mockStokvelMembersChain.eq.mockResolvedValueOnce({ data: null, error: null })
      mockStokvelMembersChain.insert.mockResolvedValueOnce({ error: null })

      const result = await ensurePlatformAdminsInStokvel(mockClient, STOKVEL_ID)

      expect(mockStokvelMembersChain.insert).toHaveBeenCalledWith([{
        stokvel_id: STOKVEL_ID,
        user_id: VALID_UUID_1,
        group_role: 'admin',
      }])
      expect(result).toEqual({ error: null })
    })
  })
})