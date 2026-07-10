'use client'

import { useEffect, useState } from 'react'

interface AuditLog {
  id: string
  adminUserId: string
  adminEmail: string
  action: string
  targetType: string | null
  targetId: string | null
  previousValue: string | null
  newValue: string | null
  reason: string | null
  requestId: string
  ipAddress: string
  sessionId: string | null
  outcome: 'success' | 'failure' | 'denied'
  timestamp: string
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Filters
  const [actionFilter, setActionFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  
  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchLogs()
  }, [page, actionFilter, fromDate, toDate])

  const fetchLogs = async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
      })

      if (actionFilter) params.append('action', actionFilter)
      if (fromDate) params.append('fromDate', fromDate)
      if (toDate) params.append('toDate', toDate)

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`)
      
      if (response.ok) {
        const data = await response.json()
        setLogs(data.data)
        setPagination(data.pagination)
      } else {
        setError('Failed to fetch audit logs')
      }
    } catch (error) {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFilters = () => {
    setPage(1)
    fetchLogs()
  }

  const handleClearFilters = () => {
    setActionFilter('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const outcomeColors: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    failure: 'bg-red-100 text-red-800',
    denied: 'bg-yellow-100 text-yellow-800',
  }

  const formatJSON = (jsonString: string | null) => {
    if (!jsonString) return 'N/A'
    try {
      const parsed = JSON.parse(jsonString)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return jsonString
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Logs</h1>

      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-6">
        Audit records are append-only and cannot be modified.
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Keyword</label>
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="e.g., login, admin"
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleApplyFilters}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Apply
            </button>
            <button
              onClick={handleClearFilters}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="text-gray-600">Loading...</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outcome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <>
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-mono bg-gray-100 rounded">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.adminEmail}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {log.ipAddress}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${outcomeColors[log.outcome]}`}>
                          {log.outcome}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleRow(log.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {expandedRows.has(log.id) ? 'Hide' : 'Show'}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.has(log.id) && (
                      <tr key={`${log.id}-details`} className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Target Type:</span> {log.targetType || 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Target ID:</span> {log.targetId || 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Request ID:</span> {log.requestId}
                            </div>
                            <div>
                              <span className="font-medium">Session ID:</span> {log.sessionId || 'N/A'}
                            </div>
                            {log.reason && (
                              <div className="col-span-2">
                                <span className="font-medium">Reason:</span> {log.reason}
                              </div>
                            )}
                            {(log.previousValue || log.newValue) && (
                              <>
                                <div className="col-span-2">
                                  <span className="font-medium">Previous Value:</span>
                                  <pre className="mt-1 bg-white p-2 rounded text-xs overflow-x-auto">
                                    {formatJSON(log.previousValue)}
                                  </pre>
                                </div>
                                <div className="col-span-2">
                                  <span className="font-medium">New Value:</span>
                                  <pre className="mt-1 bg-white p-2 rounded text-xs overflow-x-auto">
                                    {formatJSON(log.newValue)}
                                  </pre>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
