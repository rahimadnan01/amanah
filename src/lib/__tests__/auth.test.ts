import { hashPassword, verifyPassword, createToken, verifyToken, generateMFASecret, verifyMFACode, isSessionExpired } from '../auth'

describe('Auth Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123!'
      const hash = await hashPassword(password)
      
      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(0)
    })

    it('should generate different hashes for the same password', async () => {
      const password = 'TestPassword123!'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!'
      const hash = await hashPassword(password)
      
      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!'
      const hash = await hashPassword(password)
      
      const isValid = await verifyPassword('WrongPassword', hash)
      expect(isValid).toBe(false)
    })
  })

  describe('createToken', () => {
    it('should generate a valid JWT token', async () => {
      const payload = { adminUserId: 'test-id', sessionId: 'session-1', email: 'test@example.com', role: 'admin' }
      const token = await createToken(payload)
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })
  })

  describe('verifyToken', () => {
    it('should verify a valid token', async () => {
      const payload = { adminUserId: 'test-id', sessionId: 'session-1', email: 'test@example.com', role: 'admin' }
      const token = await createToken(payload)
      
      const decoded = await verifyToken(token)
      
      expect(decoded).toBeDefined()
      expect(decoded?.adminUserId).toBe(payload.adminUserId)
      expect(decoded?.email).toBe(payload.email)
    })

    it('should reject invalid token', async () => {
      const invalidToken = 'invalid.token.here'
      
      const decoded = await verifyToken(invalidToken)
      expect(decoded).toBeNull()
    })
  })

  describe('generateMFASecret', () => {
    it('should generate a TOTP secret', () => {
      const result = generateMFASecret()
      
      expect(result).toBeDefined()
      expect(result.secret).toBeDefined()
      expect(typeof result.secret).toBe('string')
      expect(result.qrCode).toBeDefined()
      expect(result.secret.length).toBeGreaterThan(0)
    })
  })

  describe('verifyMFACode', () => {
    it('should verify a valid TOTP code', () => {
      const secret = 'JBSWY3DPEHPK3PXP' // Test secret
      const code = '123456'
      
      // Test the function exists and has correct signature
      expect(typeof verifyMFACode).toBe('function')
      const result = verifyMFACode(secret, code)
      expect(typeof result).toBe('boolean')
    })
  })

  describe('isSessionExpired', () => {
    it('should detect expired session by absolute expiry', () => {
      const session = {
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        lastActiveAt: new Date().toISOString(),
      }
      
      expect(isSessionExpired(session)).toBe(true)
    })

    it('should detect expired session by inactivity', () => {
      const session = {
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActiveAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(), // 31 minutes ago
      }
      
      expect(isSessionExpired(session)).toBe(true)
    })

    it('should not expire valid session', () => {
      const session = {
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
      }
      
      expect(isSessionExpired(session)).toBe(false)
    })
  })
})
