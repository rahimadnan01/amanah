'use client'

import { useEffect, useState } from 'react'

interface Session {
  id: string
  ipAddress: string
  userAgent: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  revokedReason: string | null
  lastActiveAt: string
  isCurrent: boolean
}

interface AdminUser {
  id: string
  email: string
  name: string
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [selectedAdminId, setSelectedAdminId] = useState<string>('')
  const [currentUser, setCurrentUser] = useState<{ role: string; id: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeTargetName, setRevokeTargetName] = useState('')

  useEffect(() => {
    fetchCurrentUser()
    fetchAdminUsers()
    fetchSessions()
  }, [selectedAdminId])

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser({ role: data.role, id: data.id })
      }
    } catch (error) {
      console.error('Failed to fetch current user', error)
    }
  }

  const fetchAdminUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setAdminUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch admin users', error)
    }
  }

  const fetchSessions = async () => {
    try {
      const url = selectedAdminId 
        ? `/api/auth/sessions?adminUserId=${selectedAdminId}`
        : '/api/auth/sessions'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions)
      } else {
        setError('Failed to fetch sessions')
      }
    } catch (error) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reason: 'Manual revoke' }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Session revoked successfully')
        fetchSessions()
      } else {
        setError(data.error?.message || 'Failed to revoke session')
      }
    } catch (error) {
      setError('An error occurred')
    }
  }

  const handleRevokeAll = async () => {
    if (!revokeReason) {
      setError('Please provide a reason')
      return
    }

    setError('')
    setSuccess('')

    try {
      const body: any = { revokeAll: true, reason: revokeReason }
      if (selectedAdminId && selectedAdminId !== currentUser?.id) {
        body.targetAdminId = selectedAdminId
      }

      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(`Revoked ${data.revokedCount} session(s) successfully`)
        setShowRevokeAllModal(false)
        setRevokeReason('')
        setRevokeTargetName('')
        fetchSessions()
      } else {
        setError(data.error?.message || 'Failed to revoke sessions')
      }
    } catch (error) {
      setError('An error occurred')
    }
  }

  const handleRevokeAllForAdmin = (adminId: string, adminName: string) => {
    setSelectedAdminId(adminId)
    setRevokeTargetName(adminName)
    setShowRevokeAllModal(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const isExpired = (session: Session) => {
    return new Date(session.expiresAt) < new Date()
  }

  if (loading) {
    return <div className="text-gray-600">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {selectedAdminId ? `${revokeTargetName}'s Sessions` : 'My Sessions'}
        </h1>
        <div className="flex items-center space-x-3">
          {currentUser?.role === 'super_admin' && (
            <select
              value={selectedAdminId}
              onChange={(e) => {
                setSelectedAdminId(e.target.value)
                const admin = adminUsers.find(u => u.id === e.target.value)
                setRevokeTargetName(admin?.name || '')
              }}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="">My Sessions</option>
              {adminUsers.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.name} ({admin.email})
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowRevokeAllModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Revoke All {selectedAdminId ? 'Sessions' : 'Other Sessions'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IP Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Browser / User Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Active
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expires
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.map((session) => (
              <tr key={session.id} className={session.isCurrent ? 'bg-blue-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {session.isCurrent && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      Current
                    </span>
                  )}
                  {session.revokedAt && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                      Revoked
                    </span>
                  )}
                  {!session.revokedAt && !session.isCurrent && isExpired(session) && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                      Expired
                    </span>
                  )}
                  {!session.revokedAt && !session.isCurrent && !isExpired(session) && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {session.ipAddress}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  {session.userAgent}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(session.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(session.lastActiveAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(session.expiresAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {!session.isCurrent && !session.revokedAt && !isExpired(session) && (
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Revoke
                    </button>
                  )}
                  {session.revokedAt && (
                    <span className="text-sm text-gray-500">
                      {session.revokedReason || 'No reason provided'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Revoke All Modal */}
      {showRevokeAllModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {selectedAdminId && selectedAdminId !== currentUser?.id
                ? `Revoke All Sessions for ${revokeTargetName}`
                : 'Revoke All Other Sessions'}
            </h2>
            <p className="text-gray-600 mb-4">
              {selectedAdminId && selectedAdminId !== currentUser?.id
                ? `This will revoke all active sessions for ${revokeTargetName}. They will be logged out immediately.`
                : 'This will revoke all your active sessions except the current one. You will be logged out of all other devices.'}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                required
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                rows={3}
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleRevokeAll}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Revoke All
              </button>
              <button
                onClick={() => {
                  setShowRevokeAllModal(false)
                  setRevokeReason('')
                  setRevokeTargetName('')
                  if (selectedAdminId && selectedAdminId === currentUser?.id) {
                    setSelectedAdminId('')
                  }
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
