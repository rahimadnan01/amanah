'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AdminUser {
  id: string
  email: string
  name: string
  role: string
  mfaEnabled: boolean
  permissions: string[]
}

interface NavItem {
  label: string
  href: string
  permission: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', permission: '' },
  { label: 'Administrators', href: '/dashboard/admin-users', permission: 'admins.view' },
  { label: 'Sessions', href: '/dashboard/sessions', permission: 'sessions.view' },
  { label: 'Audit Logs', href: '/dashboard/audit-logs', permission: 'audit.view' },
]

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  moderator: 'bg-blue-100 text-blue-800',
  support_agent: 'bg-green-100 text-green-800',
  operations_admin: 'bg-orange-100 text-orange-800',
  analyst: 'bg-gray-100 text-gray-800',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data)
      } else {
        router.push('/login')
      }
    } catch (error) {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const filteredNavItems = navItems.filter(
    (item) => !item.permission || user.permissions.includes(item.permission)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b z-50 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {sidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <span className="font-semibold text-gray-900">Admin Panel</span>
        <div className="w-10" />
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full pt-16 lg:pt-0">
          {/* Logo */}
          <div className="p-6 border-b">
            <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* User info */}
          <div className="p-4 border-t">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${roleColors[user.role]}`}
              >
                {user.role.replace('_', ' ')}
              </span>
            </div>

            {!user.mfaEnabled && (
              <a
                href="/dashboard/mfa-setup"
                className="block w-full text-center px-4 py-2 mb-3 text-sm bg-yellow-50 text-yellow-800 rounded-md hover:bg-yellow-100"
              >
                Set up MFA
              </a>
            )}

            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        {/* Top header */}
        <header className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Dashboard</h2>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <span
                className={`px-3 py-1 text-xs font-medium rounded-full ${roleColors[user.role]}`}
              >
                {user.role.replace('_', ' ')}
              </span>
              {!user.mfaEnabled && (
                <a
                  href="/dashboard/mfa-setup"
                  className="text-sm text-yellow-600 hover:text-yellow-700"
                >
                  MFA not enabled
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
