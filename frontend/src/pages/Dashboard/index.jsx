import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Link } from 'react-router-dom'
import api from '../../api/client'

export default function Dashboard() {
  const { user, hasPermission } = useAuth()
  const [stats, setStats] = useState({ products: 0, categories: 0, campaigns: 0 })
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const reqs = [
      (hasPermission('products') || user?.role === 'admin') ? api.get('/products?limit=1') : Promise.resolve({ skip: true }),
      (hasPermission('categories') || user?.role === 'admin') ? api.get('/categories?admin=1') : Promise.resolve({ skip: true }),
      (hasPermission('campaigns') || user?.role === 'admin') ? api.get('/campaigns?limit=1') : Promise.resolve({ skip: true }),
      (hasPermission('audit_logs') || user?.role === 'admin') ? api.get('/audit-logs?limit=6') : Promise.resolve({ skip: true })
    ]

    Promise.allSettled(reqs).then(([prodRes, catRes, campRes, logRes]) => {
      setStats({
        products: (prodRes.status === 'fulfilled' && !prodRes.value.skip) ? prodRes.value.meta?.total || 0 : 0,
        categories: (catRes.status === 'fulfilled' && !catRes.value.skip) ? (catRes.value.data?.data?.length || catRes.value.data?.length || 0) : 0,
        campaigns: (campRes.status === 'fulfilled' && !campRes.value.skip) ? (campRes.value.data?.pagination?.total || campRes.value.data?.meta?.total || 0) : 0
      })
      if (logRes.status === 'fulfilled' && !logRes.value.skip) {
        setActivity(logRes.value.data?.data || logRes.value.data || [])
      }
      setLoading(false)
    })
  }, [hasPermission, user])

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex flex-col gap-2 mb-4">
        <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
          Welcome back, {user?.full_name?.split(' ')[0] || user?.username} 👋
        </h1>
        <p className="text-[14px] font-medium opacity-60">
          This is your central control panel for the Ahmed Al Maghribi GCC storefronts.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(hasPermission('products') || user?.role === 'admin') && (
          <div className="flex flex-col gap-2 p-6 rounded-2xl transition-all hover:scale-[1.02]" 
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold uppercase tracking-widest opacity-60">Catalogue</h3>
            </div>
            {loading ? (
               <div className="h-10 w-24 bg-(--surface-2) rounded" />
            ) : (
              <div className="text-4xl font-black">{stats.products}</div>
            )}
            <Link to="/products" className="text-[12px] font-bold text-blue-500 mt-2 hover:underline">Manage Products →</Link>
          </div>
        )}

        {(hasPermission('categories') || user?.role === 'admin') && (
          <div className="flex flex-col gap-2 p-6 rounded-2xl transition-all hover:scale-[1.02]" 
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold uppercase tracking-widest opacity-60">Categories</h3>
            </div>
            {loading ? (
               <div className="h-10 w-24 bg-(--surface-2) rounded" />
            ) : (
               <div className="text-4xl font-black">{stats.categories}</div>
            )}
            <Link to="/categories" className="text-[12px] font-bold text-emerald-500 mt-2 hover:underline">Manage Taxonomy →</Link>
          </div>
        )}

        {(hasPermission('campaigns') || user?.role === 'admin') && (
          <div className="flex flex-col gap-2 p-6 rounded-2xl transition-all hover:scale-[1.02]" 
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 18H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 12h7.5" />
                </svg>
              </div>
              <h3 className="text-[14px] font-bold uppercase tracking-widest opacity-60">Campaigns</h3>
            </div>
            {loading ? (
               <div className="h-10 w-24 bg-(--surface-2) rounded" />
            ) : (
               <div className="text-4xl font-black">{stats.campaigns}</div>
            )}
            <Link to="/campaigns" className="text-[12px] font-bold text-purple-500 mt-2 hover:underline">Manage Promotions →</Link>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {(hasPermission('audit_logs') || user?.role === 'admin') && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--text)' }}>Recent Activity</h2>
            <Link to="/audit-logs" className="text-[11px] font-bold uppercase tracking-wider text-blue-500 hover:text-blue-400 block p-1">View All Logs →</Link>
          </div>
          
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
             {loading ? (
                <div className="p-8 text-center animate-pulse" style={{ color: 'var(--text-subtle)' }}>Loading activity...</div>
             ) : activity.length === 0 ? (
                <div className="p-8 text-center text-[13px]" style={{ color: 'var(--text-subtle)' }}>No recent activity to show.</div>
             ) : (
                <table className="w-full text-left">
                  <tbody>
                    {activity.map((log, i) => {
                      const d = log.details || {};
                      let name = d.name_en || d.username || d.slug || d.title || '';
                      if (!name && d.url) name = 'file';
                      if (!name && log.target_id) name = `#${log.target_id}`;
                      
                      let text = `${log.action} ${log.module} ${name ? `'${name}'` : ''}`.trim()
                      if (log.action === 'login' && log.module === 'auth') text = 'Logged into the system'

                      return (
                        <tr key={log.id} style={{ borderBottom: i === activity.length - 1 ? 'none' : '1px solid var(--border)' }}>
                          <td className="p-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                                style={{ backgroundColor: 'var(--color-brand)' }}>
                                {(log.full_name || log.username || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                                  <span className="opacity-80 font-normal mr-1">{log.full_name || log.username || 'System'}</span>
                                  <span className="capitalize">{text}</span>
                                </p>
                                  <p className="text-[11px] mt-0.5 opacity-50" style={{ color: 'var(--text-subtle)' }}>
                                    {new Date(log.created_at).toLocaleString()} • {log.ip_address || 'Local'}
                                  </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
             )}
          </div>
        </div>
      )}

    </div>
  )
}
