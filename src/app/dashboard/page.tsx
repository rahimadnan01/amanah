'use client'

import { useEffect, useState } from 'react'

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  mfaEnabled: boolean
  lastLoginAt: string | null
  permissions: string[]
}

export default function DashboardPage() {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-gray-600">Loading...</div>
  }

  if (!user) {
    return null
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  const getNavItems = () => {
    const items = [
      { label: 'Administrators', href: '/dashboard/admin-users', permission: 'admins.view' },
      { label: 'Sessions', href: '/dashboard/sessions', permission: 'sessions.view' },
      { label: 'Audit Logs', href: '/dashboard/audit-logs', permission: 'audit.view' },
    ]
    return items.filter(item => user.permissions.includes(item.permission))
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Welcome back, {user.name}
      </h1>

      {/* MFA Warning Banner */}
      {!user.mfaEnabled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800">MFA Not Enabled</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Your account does not have multi-factor authentication enabled. This is a security risk.
                </p>
              </div>
            </div>
            <a
              href="/dashboard/mfa-setup"
              className="px-4 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700"
            >
              Set up MFA now
            </a>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Role</h3>
          <p className="text-2xl font-semibold text-gray-900 capitalize">
            {user.role.replace('_', ' ')}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">MFA Status</h3>
          <p className={`text-2xl font-semibold ${user.mfaEnabled ? 'text-green-600' : 'text-red-600'}`}>
            {user.mfaEnabled ? 'Enabled' : 'Disabled'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Last Login</h3>
          <p className="text-lg font-semibold text-gray-900">
            {formatDate(user.lastLoginAt)}
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {getNavItems().map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-4 py-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors text-center"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
