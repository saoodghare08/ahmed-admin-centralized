import { useState, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLogs, getUsers } from '../../api'

export default function AuditLogs() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ user_id: '', module: '', action: '', from: '', to: '' })

  const { data: usersData } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const usersList = usersData?.data || []

  const queryParams = { page, limit: 30, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => getAuditLogs(queryParams),
  })
  const logs = data?.data || []
  const pagination = data?.pagination || {}

  const [expandedId, setExpandedId] = useState(null)

  const modules = ['products', 'categories', 'pricing', 'bundles', 'sales', 'gallery', 'analytics', 'users', 'auth', 'audit_logs']
  const actions = ['create', 'update', 'delete', 'login']

  const actionColors = {
    create: { bg: 'color-mix(in srgb, #22c55e 12%, transparent)', color: '#22c55e', border: 'color-mix(in srgb, #22c55e 20%, transparent)' },
    update: { bg: 'color-mix(in srgb, #3b82f6 12%, transparent)', color: '#3b82f6', border: 'color-mix(in srgb, #3b82f6 20%, transparent)' },
    delete: { bg: 'color-mix(in srgb, #ef4444 12%, transparent)', color: '#ef4444', border: 'color-mix(in srgb, #ef4444 20%, transparent)' },
    login:  { bg: 'color-mix(in srgb, #a855f7 12%, transparent)', color: '#a855f7', border: 'color-mix(in srgb, #a855f7 20%, transparent)' },
  }

  const getModuleName = (mod) => {
    const singles = { products: 'product', categories: 'category', subcategories: 'subcategory', users: 'user', pricing: 'price', media: 'media', bundles: 'bundle', sales: 'sale', audit_logs: 'audit log' };
    return singles[mod] || mod;
  }

  const getLogSummary = (log) => {
    if (log.action === 'login' && log.module === 'auth') {
      return `User logged into the dashboard`
    }

    const d = log.details || {};
    // Extract a recognizable name
    let name = d.name_en || d.username || d.slug || d.title || '';
    if (d.country_id) name += (name ? ` (Country: ${d.country_id})` : `Country: ${d.country_id}`);
    if (!name && d.url) name = 'file';
    if (!name && log.target_id) name = `#${log.target_id}`;
    
    const mod = getModuleName(log.module);
    let actionText = log.action;
    if (actionText === 'create') actionText = 'Created';
    if (actionText === 'update') actionText = 'Updated';
    if (actionText === 'delete') actionText = 'Deleted';

    let extra = d.action ? ` - ${d.action.replace(/_/g, ' ')}` : '';
    let text = `${actionText} ${mod} ${name ? `'${name}'` : ''}${extra}`;
    return text.trim();
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Audit Logs</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
          Track all changes made by users across the system
        </p>
      </div>

      {/* Filters */}
      <div className="t-card p-4 mb-4">
        <div className="grid grid-cols-5 gap-3">
          <select className="t-input" value={filters.user_id} onChange={e => { setFilters({ ...filters, user_id: e.target.value }); setPage(1); }}>
            <option value="">All Users</option>
            {usersList.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
          </select>
          <select className="t-input" value={filters.module} onChange={e => { setFilters({ ...filters, module: e.target.value }); setPage(1); }}>
            <option value="">All Modules</option>
            {modules.map(m => <option key={m} value={m} className="capitalize">{m.replace('_', ' ')}</option>)}
          </select>
          <select className="t-input" value={filters.action} onChange={e => { setFilters({ ...filters, action: e.target.value }); setPage(1); }}>
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a} className="capitalize">{a === 'login' ? 'Logged In' : a}</option>)}
          </select>
          <input className="t-input" type="date" value={filters.from} onChange={e => { setFilters({ ...filters, from: e.target.value }); setPage(1); }} placeholder="From" />
          <input className="t-input" type="date" value={filters.to} onChange={e => { setFilters({ ...filters, to: e.target.value }); setPage(1); }} placeholder="To" />
        </div>
      </div>

      {/* Table */}
      <div className="t-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-2)' }}>
              <th className="t-th" style={{ width: '170px' }}>Timestamp</th>
              <th className="t-th">User</th>
              <th className="t-th">Action</th>
              <th className="t-th">Module</th>
              <th className="t-th">Description</th>
              <th className="t-th" style={{ width: '60px' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="t-td text-center py-8" style={{ color: 'var(--text-subtle)' }}>Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="t-td text-center py-8" style={{ color: 'var(--text-subtle)' }}>No logs found</td></tr>
            ) : logs.map(log => (
              <Fragment key={log.id}>
                <tr className="hover:brightness-105 transition-all">
                  <td className="t-td">
                    <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </td>
                  <td className="t-td">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: 'var(--color-brand)' }}>
                        {(log.full_name || log.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[12px] font-medium">{log.full_name || log.username || 'System'}</span>
                    </div>
                  </td>
                  <td className="t-td">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize"
                      style={actionColors[log.action] ? {
                        backgroundColor: actionColors[log.action].bg,
                        color: actionColors[log.action].color,
                        border: `1px solid ${actionColors[log.action].border}`,
                      } : {}}>
                      {log.action === 'login' ? 'Logged In' : log.action}
                    </span>
                  </td>
                  <td className="t-td">
                    <span className="text-[12px] capitalize" style={{ color: 'var(--text-muted)' }}>
                      {log.module?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="t-td">
                    <span className="text-[12px]" style={{ color: 'var(--text)' }}>
                      {getLogSummary(log)}
                    </span>
                  </td>
                  <td className="t-td text-center">
                    <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors">
                      <svg className={`w-3.5 h-3.5 transition-transform ${expandedId === log.id ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-subtle)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr key={`${log.id}-details`}>
                    <td colSpan={6} className="px-4 pb-4 pt-0">
                      <div className="rounded-lg p-3 text-[11px] font-mono overflow-x-auto"
                        style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-soft)' }}>
                        <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total entries
          </p>
          <div className="flex gap-1">
            <button className="t-btn-ghost text-[12px]" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
              ← Prev
            </button>
            <button className="t-btn-ghost text-[12px]" onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
