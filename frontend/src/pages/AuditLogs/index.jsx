import { useState, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLogs, getUsers } from '../../api'

export default function AuditLogs() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [filters, setFilters] = useState({ user_id: '', module: '', action: '', from: '', to: '' })

  const { data: usersData } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const usersList = usersData?.data || []

  const queryParams = { page, limit, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => getAuditLogs(queryParams),
  })
  const logs = data?.data || []
  const pagination = data?.pagination || {}

  const [expandedId, setExpandedId] = useState(null)

  const modules = ['products', 'categories', 'pricing', 'bundles', 'sales', 'gallery', 'users', 'auth', 'audit_logs']
  const actions = ['create', 'update', 'delete', 'login']

  const actionColors = {
    create: { bg: 'color-mix(in srgb, #22c55e 12%, transparent)', color: '#22c55e', border: 'color-mix(in srgb, #22c55e 20%, transparent)' },
    update: { bg: 'color-mix(in srgb, #3b82f6 12%, transparent)', color: '#3b82f6', border: 'color-mix(in srgb, #3b82f6 20%, transparent)' },
    delete: { bg: 'color-mix(in srgb, #ef4444 12%, transparent)', color: '#ef4444', border: 'color-mix(in srgb, #ef4444 20%, transparent)' },
    login: { bg: 'color-mix(in srgb, #a855f7 12%, transparent)', color: '#a855f7', border: 'color-mix(in srgb, #a855f7 20%, transparent)' },
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
    <div className="flex flex-col gap-6 p-6 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2" style={{ color: 'var(--text)' }}>
          Audit Logs
          <span className="t-badge-gray" style={{ fontSize: '11px', letterSpacing: '0.07em' }}>
            System Activity
          </span>
        </h1>
        <p className="text-[14px] font-medium" style={{ color: 'var(--text-subtle)' }}>
          Traceability and security tracking for all dashboard operations
        </p>
      </div>

      {/* Filters (Toolbar Style) */}
      <div className="flex flex-col gap-3 p-3 rounded-2xl t-toolbar">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-0.5">
          <div className="relative shrink-0">
            <select className="t-input h-10 pl-3 pr-8 min-w-[140px] text-[12px] font-bold uppercase tracking-wider appearance-none"
              value={filters.user_id}
              onChange={e => { setFilters({ ...filters, user_id: e.target.value }); setPage(1); }}>
              <option value="">All Users</option>
              {usersList.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username}</option>)}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none opacity-40"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg></div>
          </div>

          <div className="relative shrink-0">
            <select className="t-input h-10 pl-3 pr-8 min-w-[140px] text-[12px] font-bold uppercase tracking-wider appearance-none"
              value={filters.module}
              onChange={e => { setFilters({ ...filters, module: e.target.value }); setPage(1); }}>
              <option value="">All Modules</option>
              {modules.map(m => <option key={m} value={m} className="capitalize">{m.replace('_', ' ')}</option>)}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none opacity-40"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg></div>
          </div>

          <div className="relative shrink-0">
            <select className="t-input h-10 pl-3 pr-8 min-w-[140px] text-[12px] font-bold uppercase tracking-wider appearance-none"
              value={filters.action}
              onChange={e => { setFilters({ ...filters, action: e.target.value }); setPage(1); }}>
              <option value="">All Actions</option>
              {actions.map(a => <option key={a} value={a} className="capitalize">{a === 'login' ? 'Logged In' : a}</option>)}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none opacity-40"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg></div>
          </div>

          <div className="t-divider" />

          <div className="flex items-center gap-2 shrink-0">
            <input className="t-input h-10 px-3 text-[12px] font-bold uppercase tracking-wider w-40"
              type="date"
              value={filters.from}
              onChange={e => { setFilters({ ...filters, from: e.target.value }); setPage(1); }}
              placeholder="From" />
            <span className="opacity-30 text-[10px] font-black uppercase tracking-widest">To</span>
            <input className="t-input h-10 px-3 text-[12px] font-bold uppercase tracking-wider w-40"
              type="date"
              value={filters.to}
              onChange={e => { setFilters({ ...filters, to: e.target.value }); setPage(1); }}
              placeholder="To" />
          </div>

          {(filters.user_id || filters.module || filters.action || filters.from || filters.to) && (
            <button
              onClick={() => { setFilters({ user_id: '', module: '', action: '', from: '', to: '' }); setPage(1); }}
              className="text-[11px] font-black uppercase tracking-widest text-brand hover:opacity-100 opacity-60 ml-2"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="t-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-2)' }}>
              <th className="t-th" style={{ width: '180px' }}>Timestamp</th>
              <th className="t-th">Administrator</th>
              <th className="t-th" style={{ width: '130px' }}>User IP</th>
              <th className="t-th">Operation</th>
              <th className="t-th">Module</th>
              <th className="t-th">Log Description</th>
              <th className="t-th text-center" style={{ width: '80px' }}>Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5 text-[13px]">
            {isLoading ? (
              <tr><td colSpan={6} className="t-td text-center py-24" style={{ color: 'var(--text-subtle)' }}>
                <div className="login-spinner mx-auto mb-4" />
                <span className="text-[13px] font-bold uppercase tracking-widest opacity-40">Synchronizing system logs…</span>
              </td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="t-td text-center py-24" style={{ color: 'var(--text-subtle)' }}>
                <span className="text-[13px] font-bold uppercase tracking-widest opacity-40">No activity logs found for current filters</span>
              </td></tr>
            ) : logs.map(log => (
              <Fragment key={log.id}>
                <tr
                  className={`transition-all duration-200 cursor-pointer ${expandedId === log.id ? 'bg-black/5 dark:bg-white/5' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'}`}
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                >
                  <td className="t-td">
                    <div className="flex flex-col">
                      <span className="font-black tracking-tight" style={{ color: 'var(--text)' }}>
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">
                        {new Date(log.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </td>
                  <td className="t-td">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black text-white shadow-lg transition-transform group-hover:scale-110"
                        style={{ backgroundColor: 'var(--color-brand)', borderRadius: '10px' }}>
                        {(log.full_name || log.username || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold tracking-tight">{log.full_name || log.username || 'System Agent'}</span>
                        <span className="text-[9px] font-black uppercase tracking-tighter opacity-30">ID: {log.user_id || '0'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="t-td">
                    <span className="text-[11px] font-mono opacity-50 tracking-tight" style={{ color: 'var(--text-muted)' }}>
                      {log.ip_address || '—'}
                    </span>
                  </td>
                  <td className="t-td">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all"
                      style={actionColors[log.action] ? {
                        backgroundColor: actionColors[log.action].bg,
                        color: actionColors[log.action].color,
                        borderColor: actionColors[log.action].border,
                      } : {}}>
                      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: actionColors[log.action]?.color || 'var(--text-muted)' }} />
                      {log.action === 'login' ? 'Auth / Login' : log.action}
                    </span>
                  </td>
                  <td className="t-td">
                    <span className="text-[11px] font-black uppercase tracking-widest opacity-40">
                      {log.module?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="t-td font-medium" style={{ color: 'var(--text)' }}>
                    {getLogSummary(log)}
                  </td>
                  <td className="t-td text-center">
                    <div className="flex items-center justify-center">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${expandedId === log.id ? 'bg-brand text-white' : 'bg-black/5 dark:bg-white/5 text-(--text-subtle)'}`}>
                        <svg className={`w-3 h-3 transition-transform duration-300 ${expandedId === log.id ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </div>
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr key={`${log.id}-details`}>
                    <td colSpan={6} className="px-6 pb-6 pt-0">
                      <div className="rounded-2xl p-5 text-[11px] font-mono overflow-hidden shadow-inner border animate-in slide-in-from-top-2 duration-300"
                        style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', borderColor: 'var(--border-soft)' }}>
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-black/5 dark:border-white/5 opacity-50">
                          <span className="font-black uppercase tracking-widest text-[9px]">Payload Data / JSON</span>
                          <span className="text-[9px] font-bold">UID: {log.id}</span>
                        </div>
                        <pre className="whitespace-pre-wrap leading-relaxed opacity-80">{JSON.stringify(log.details, null, 2)}</pre>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination (Products Style) */}
      {(pagination.totalPages > 1 || limit !== 10) && (
        <div className="flex items-center justify-between p-3 rounded-2xl t-toolbar bg-white/5 mt-4">
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-0.5 px-2">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-30 select-none">Navigation Control</p>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold" style={{ color: 'var(--text-subtle)' }}>
                  Page {pagination.page} <span className="opacity-20 mx-1">/</span> {pagination.totalPages || 1}
                </span>
                <div className="t-divider h-3 mx-1" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-30">Jump to</span>
                  <input
                    type="number"
                    min={1}
                    max={pagination.totalPages}
                    value={page}
                    onChange={(e) => {
                      const p = Number(e.target.value)
                      if (p >= 1 && p <= (pagination.totalPages || 1)) setPage(p)
                    }}
                    className="w-10 h-7 bg-black/10 dark:bg-white/10 rounded-lg text-center text-[11px] font-bold outline-none border border-transparent focus:border-brand/40 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 border-l border-black/5 dark:border-white/5 pl-6">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-30 select-none">Showing Entries</p>
              <div className="relative">
                <select
                  value={limit}
                  onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="t-input h-7 pl-2 pr-6 text-[11px] font-bold appearance-none bg-black/5 dark:bg-white/5 border-none"
                  style={{ minWidth: '90px' }}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <div className="absolute right-2 top-2 pointer-events-none opacity-40"><svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg></div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 h-9 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all bg-black/[0.03] dark:bg-white/[0.03] hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-20 active:scale-95"
            >
              ← Prev
            </button>

            <div className="flex items-center mx-1">
              {[...Array(Math.min(5, pagination.totalPages || 0))].map((_, i) => {
                let pNum = i + 1
                if ((pagination.totalPages || 0) > 5) {
                  if (page > 3) pNum = page - 2 + i
                  if (page > (pagination.totalPages || 0) - 2) pNum = (pagination.totalPages || 0) - 4 + i
                }
                if (pNum < 1 || pNum > (pagination.totalPages || 0)) return null
                return (
                  <button
                    key={pNum}
                    onClick={() => setPage(pNum)}
                    className={`w-9 h-9 rounded-xl text-[11px] font-black transition-all active:scale-90 mx-0.5 ${page === pNum ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-40 hover:opacity-100'}`}
                  >
                    {pNum}
                  </button>
                )
              })}
            </div>

            <button
              disabled={page >= (pagination.totalPages || 1)}
              onClick={() => setPage(p => p + 1)}
              className="px-4 h-9 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all bg-brand text-white shadow-lg shadow-brand/20 hover:scale-105 active:scale-95 disabled:opacity-20"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
