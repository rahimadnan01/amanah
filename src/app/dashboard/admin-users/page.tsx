'use client'

import { useEffect, useState } from 'react'

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  status: string
  mfaEnabled: boolean
  lastLoginAt: string | null
  createdAt: string
}

interface CurrentUser {
  id: string
  permissions: string[]
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDisableModal, setShowDisableModal] = useState(false)
  const [showRevokeSessionsModal, setShowRevokeSessionsModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Create form state
  const [createForm, setCreateForm] = useState({
    email: '',
    name: '',
    role: 'moderator',
    password: '',
  })

  // Disable form state
  const [disableReason, setDisableReason] = useState('')
  
  // Revoke sessions form state
  const [revokeSessionsReason, setRevokeSessionsReason] = useState('')

  const roleColors: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-800',
    moderator: 'bg-blue-100 text-blue-800',
    support_agent: 'bg-green-100 text-green-800',
    operations_admin: 'bg-orange-100 text-orange-800',
    analyst: 'bg-gray-100 text-gray-800',
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    disabled: 'bg-red-100 text-red-800',
    locked: 'bg-yellow-100 text-yellow-800',
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [usersRes, meRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/auth/me'),
      ])

      if (usersRes.ok && meRes.ok) {
        const usersData = await usersRes.json()
        const meData = await meRes.json()
        setUsers(usersData.users)
        setCurrentUser(meData)
      } else {
        setError('Failed to fetch data')
      }
    } catch (error) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Admin user created successfully')
        setShowCreateModal(false)
        setCreateForm({ email: '', name: '', role: 'moderator', password: '' })
        fetchData()
      } else {
        setError(data.error?.message || 'Failed to create user')
      }
    } catch (error) {
      setError('An error occurred')
    }
  }

  const handleDisableUser = async () => {
    if (!selectedUser || !disableReason) {
      setError('Please provide a reason')
      return
    }

    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          status: selectedUser.status === 'active' ? 'disabled' : 'active',
          reason: disableReason,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(`User ${selectedUser.status === 'active' ? 'disabled' : 'enabled'} successfully`)
        setShowDisableModal(false)
        setSelectedUser(null)
        setDisableReason('')
        fetchData()
      } else {
        setError(data.error?.message || 'Failed to update user')
      }
    } catch (error) {
      setError('An error occurred')
    }
  }

  const handleRevokeSessions = async () => {
    if (!selectedUser || !revokeSessionsReason) {
      setError('Please provide a reason')
      return
    }

    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAdminId: selectedUser.id,
          revokeAll: true,
          reason: revokeSessionsReason,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(`Revoked ${data.revokedCount} session(s) for ${selectedUser.name}`)
        setShowRevokeSessionsModal(false)
        setSelectedUser(null)
        setRevokeSessionsReason('')
      } else {
        setError(data.error?.message || 'Failed to revoke sessions')
      }
    } catch (error) {
      setError('An error occurred')
    }
  }

  const canCreate = currentUser?.permissions.includes('admins.create')
  const canEdit = currentUser?.permissions.includes('admins.edit')
  const isSuperAdmin = currentUser?.permissions.includes('admins.manage')

  if (loading) {
    return <div className="text-gray-600">Loading...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Administrators & Roles</h1>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create New Admin
          </button>
        )}
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

      {/* Role Legend */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Role Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
          <div><span className="px-2 py-1 rounded bg-purple-100 text-purple-800 mr-1">Super Admin</span> Full access</div>
          <div><span className="px-2 py-1 rounded bg-blue-100 text-blue-800 mr-1">Moderator</span> Content & users</div>
          <div><span className="px-2 py-1 rounded bg-green-100 text-green-800 mr-1">Support</span> Users & sessions</div>
          <div><span className="px-2 py-1 rounded bg-orange-100 text-orange-800 mr-1">Operations</span> Settings & media</div>
          <div><span className="px-2 py-1 rounded bg-gray-100 text-gray-800 mr-1">Analyst</span> View only</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name / Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MFA
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Login
              </th>
              {canEdit && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${roleColors[user.role]}`}>
                    {user.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm ${user.mfaEnabled ? 'text-green-600' : 'text-red-600'}`}>
                    {user.mfaEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[user.status]}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                </td>
                {canEdit && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    {user.id !== currentUser?.id && (
                      <button
                        onClick={() => {
                          setSelectedUser(user)
                          setDisableReason('')
                          setShowDisableModal(true)
                        }}
                        className={`px-3 py-1 rounded ${
                          user.status === 'active'
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {user.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    )}
                    {isSuperAdmin && user.id !== currentUser?.id && (
                      <button
                        onClick={() => {
                          setSelectedUser(user)
                          setRevokeSessionsReason('')
                          setShowRevokeSessionsModal(true)
                        }}
                        className="px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                      >
                        Revoke Sessions
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Admin</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="moderator">Moderator</option>
                  <option value="support_agent">Support Agent</option>
                  <option value="operations_admin">Operations Admin</option>
                  <option value="analyst">Analyst</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password (min 12 chars)</label>
                <input
                  type="password"
                  required
                  minLength={12}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateForm({ email: '', name: '', role: 'moderator', password: '' })
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disable/Enable Modal */}
      {showDisableModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {selectedUser.status === 'active' ? 'Disable Admin' : 'Enable Admin'}
            </h2>
            <p className="text-gray-600 mb-4">
              {selectedUser.status === 'active'
                ? `Are you sure you want to disable ${selectedUser.name}? This will revoke all their active sessions.`
                : `Are you sure you want to enable ${selectedUser.name}?`}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                required
                value={disableReason}
                onChange={(e) => setDisableReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                rows={3}
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleDisableUser}
                className={`flex-1 px-4 py-2 text-white rounded-md ${
                  selectedUser.status === 'active' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {selectedUser.status === 'active' ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => {
                  setShowDisableModal(false)
                  setSelectedUser(null)
                  setDisableReason('')
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Sessions Modal */}
      {showRevokeSessionsModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Revoke All Sessions</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to revoke all sessions for {selectedUser.name}? They will be logged out immediately.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                required
                value={revokeSessionsReason}
                onChange={(e) => setRevokeSessionsReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                rows={3}
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleRevokeSessions}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                Revoke Sessions
              </button>
              <button
                onClick={() => {
                  setShowRevokeSessionsModal(false)
                  setSelectedUser(null)
                  setRevokeSessionsReason('')
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
