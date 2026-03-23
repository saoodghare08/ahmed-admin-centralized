import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart
} from 'recharts'
import {
    getAnalyticsSummary, getMonthlySales, getTopProducts,
    getLeastProducts, getOrderStatus, getRecentOrders, getDeliveryPerformance,
    getCategorySales, getSubcategorySales, getCategoryMonthly,
    getAnalyticsCategories, searchProducts, getProductMonthlySales
} from '../../api'

/* ── Constants ──────────────────────────────────────────────── */
const STATUS_COLORS = {
    completed: '#22c55e', cancelled: '#ef4444', returned: '#f59e0b',
    trash: '#6b7280', pending: '#3b82f6', processing: '#8b5cf6',
}
const PIE_COLORS = ['#a6792d', '#22c55e', '#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316']
const BAR_COLORS = ['#a6792d', '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtMonth(ym) { if (!ym) return ''; const [y, m] = ym.split('-'); return `${MONTH_NAMES[Number(m) - 1]} ${y}` }
function fmtNum(n) { return Number(n || 0).toLocaleString() }
function fmtCur(n) { return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

/* ── Tab definitions ────────────────────────────────────────── */
const TABS = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'products', label: 'Products', icon: '🛍️' },
    { id: 'categories', label: 'Categories', icon: '📂' },
]

/* ── Reusable components ────────────────────────────────────── */
function StatusBadge({ status }) {
    const s = (status || 'unknown').toLowerCase()
    const color = STATUS_COLORS[s] || '#6b7280'
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 9999,
            fontSize: 11, fontWeight: 600, background: `color-mix(in srgb, ${color} 14%, transparent)`,
            color, border: `1px solid color-mix(in srgb, ${color} 24%, transparent)`
        }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            {s.charAt(0).toUpperCase() + s.slice(1)}
        </span>
    )
}

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,.15)'
        }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color || p.fill, fontWeight: 500 }}>{p.name}: {fmtNum(p.value)}</p>
            ))}
        </div>
    )
}

const Card = ({ children, className = '', ...rest }) => (
    <div className={`rounded-xl ${className}`}
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', ...rest.style }} {...rest}>
        {children}
    </div>
)

const KpiCard = ({ icon, label, value, sub, accent }) => (
    <Card className="px-5 py-5 flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: 18 }}>{icon}</span>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-subtle)' }}>{label}</p>
        </div>
        <p className="text-[24px] font-bold" style={{ color: accent || 'var(--text)' }}>{value}</p>
        {sub && <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>{sub}</p>}
    </Card>
)

const Spinner = () => (
    <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--text-subtle)' }}>
        <div className="flex flex-col items-center gap-3">
            <div style={{
                width: 28, height: 28, border: '3px solid var(--border)',
                borderTopColor: 'var(--color-brand)', borderRadius: '50%', animation: 'spin .8s linear infinite'
            }} />
            Loading…
        </div>
    </div>
)

const Empty = ({ icon = '📋', text = 'No data available' }) => (
    <div className="flex flex-col items-center justify-center h-40" style={{ color: 'var(--text-subtle)' }}>
        <p className="text-2xl mb-2">{icon}</p><p className="text-[13px]">{text}</p>
    </div>
)

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */
export default function Analytics() {
    const [tab, setTab] = useState('overview')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')

    const dp = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to])

    /* ── Preset buttons ──────────────────────────────────────── */
    function setPreset(days) {
        const now = new Date(); const past = new Date(now)
        past.setDate(past.getDate() - days)
        setFrom(past.toISOString().slice(0, 10)); setTo(now.toISOString().slice(0, 10))
    }
    const activePreset = !from && !to ? 'All' : null

    const presetBtn = (label) => (
        <button key={label} onClick={() => {
            if (label === 'All') { setFrom(''); setTo('') }
            else if (label === '7D') setPreset(7)
            else if (label === '30D') setPreset(30)
            else if (label === '90D') setPreset(90)
            else if (label === '1Y') setPreset(365)
        }} style={{
            fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 6,
            cursor: 'pointer', transition: 'all .15s', border: 'none',
            ...(activePreset === label
                ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
                : { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' })
        }}>{label}</button>
    )

    return (
        <div className="flex flex-col gap-5 w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Order Analytics</h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Insights from your order data</p>
                </div>
            </div>

            {/* Tabs + Filters */}
            <Card className="p-4">
                <div className="flex items-end gap-6 flex-wrap">
                    {/* Tabs */}
                    <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--surface-2)' }}>
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                style={{
                                    fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 6,
                                    cursor: 'pointer', transition: 'all .15s', border: 'none', display: 'flex', alignItems: 'center', gap: 6,
                                    ...(tab === t.id
                                        ? { backgroundColor: 'var(--color-brand)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--color-brand) 30%, transparent)' }
                                        : { backgroundColor: 'transparent', color: 'var(--text-muted)' })
                                }}>
                                <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
                            </button>
                        ))}
                    </div>

                    {/* Quick ranges */}
                    <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-subtle)' }}>Range</label>
                        <div className="flex gap-1">{['All', '7D', '30D', '90D', '1Y'].map(presetBtn)}</div>
                    </div>

                    {/* Date pickers */}
                    <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-subtle)' }}>From</label>
                        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="t-input" style={{ width: 'auto' }} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-subtle)' }}>To</label>
                        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="t-input" style={{ width: 'auto' }} />
                    </div>
                </div>
            </Card>

            {/* Tab Content */}
            {tab === 'overview' && <OverviewTab dp={dp} />}
            {tab === 'products' && <ProductsTab dp={dp} />}
            {tab === 'categories' && <CategoriesTab dp={dp} />}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ══════════════════════════════════════════════════════════════ */
function OverviewTab({ dp }) {
    const summary = useQuery({ queryKey: ['a-summary', dp], queryFn: () => getAnalyticsSummary(dp) })
    const monthly = useQuery({ queryKey: ['a-monthly', dp], queryFn: () => getMonthlySales(dp) })
    const statuses = useQuery({ queryKey: ['a-status', dp], queryFn: () => getOrderStatus(dp) })
    const delivery = useQuery({ queryKey: ['a-delivery', dp], queryFn: () => getDeliveryPerformance(dp) })
    const recent = useQuery({ queryKey: ['a-recent', dp], queryFn: () => getRecentOrders(dp) })

    const s = summary.data?.data || {}
    const monthlyData = (monthly.data?.data || []).map(r => ({ ...r, label: fmtMonth(r.month), revenue: Number(r.revenue), order_count: Number(r.order_count) }))
    const statusData = (statuses.data?.data || []).map(r => ({ name: r.status, value: Number(r.count) }))
    const d = delivery.data?.data || {}
    const recentData = recent.data?.data || []

    if (summary.isLoading) return <Spinner />

    return (
        <>
            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-3">
                <KpiCard icon="📦" label="Total Orders" value={fmtNum(s.total_orders)} sub="all statuses" />
                <KpiCard icon="💰" label="Revenue" value={fmtCur(s.total_revenue)} sub="order amounts" accent="var(--color-brand)" />
                <KpiCard icon="📊" label="Avg Order" value={fmtCur(s.avg_order_value)} sub="per order" />
                <KpiCard icon="🏷️" label="Total Tax" value={fmtCur(s.total_tax)} sub="tax collected" />
                <KpiCard icon="👥" label="Customers" value={fmtNum(s.total_customers)} sub="unique buyers" />
            </div>

            {/* Monthly Sales Chart */}
            <Card className="p-5">
                <h2 className="text-[14px] font-bold mb-4" style={{ color: 'var(--text)' }}>Monthly Sales Trend</h2>
                {monthlyData.length ? (
                    <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={monthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <YAxis yAxisId="rev" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <YAxis yAxisId="cnt" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="var(--color-brand)" radius={[4, 4, 0, 0]} opacity={0.85} />
                            <Line yAxisId="cnt" dataKey="order_count" name="Orders" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : <Empty icon="📈" text="No monthly data" />}
            </Card>

            {/* Status + Delivery */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="p-5">
                    <h2 className="text-[14px] font-bold mb-4" style={{ color: 'var(--text)' }}>Order Status</h2>
                    {statusData.length ? (
                        <div className="flex items-center gap-5">
                            <ResponsiveContainer width="50%" height={200}>
                                <PieChart>
                                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={82} paddingAngle={3} dataKey="value">
                                        {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip content={<ChartTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-col gap-2">
                                {statusData.map((item, i) => (
                                    <div key={item.name} className="flex items-center gap-2">
                                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{item.name?.charAt(0).toUpperCase() + item.name?.slice(1)}</span>
                                        <span className="text-[13px] font-bold ml-auto pl-3" style={{ color: 'var(--text)' }}>{fmtNum(item.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : <Empty icon="🥧" text="No status data" />}
                </Card>

                <Card className="p-5">
                    <h2 className="text-[14px] font-bold mb-4" style={{ color: 'var(--text)' }}>Completion Performance</h2>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                        {[
                            { icon: '⏱️', label: 'Avg Completion', value: d.avg_completion_days, unit: 'days' },
                            { icon: '✅', label: 'Completed', value: fmtNum(d.completed_count), unit: 'orders' },
                            { icon: '📦', label: 'Total', value: fmtNum(d.total_count), unit: 'orders' },
                        ].map(m => (
                            <div key={m.label} className="rounded-lg p-4 text-center" style={{ backgroundColor: 'var(--surface-2)' }}>
                                <p style={{ fontSize: 22 }}>{m.icon}</p>
                                <p className="text-[20px] font-bold mt-1.5" style={{ color: 'var(--text)' }}>{m.value != null ? m.value : '—'}</p>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color: 'var(--text-subtle)' }}>Avg {m.label}</p>
                                <p className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>days</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Recent Orders */}
            <Card className="overflow-hidden">
                <div className="px-5 pt-4 pb-2">
                    <h2 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Recent Orders</h2>
                </div>
                {recentData.length ? (
                    <table className="w-full">
                        <thead style={{ backgroundColor: 'var(--surface-2)' }}>
                            <tr>{['Order', 'Customer', 'Amount', 'Tax', 'Status', 'Date'].map(h => <th key={h} className="t-th">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                            {recentData.map((row, i) => (
                                <tr key={i} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                                    <td className="t-td">
                                        <span className="font-mono text-[12px] px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--color-brand)' }}>{row.order_code}</span>
                                    </td>
                                    <td className="t-td">
                                        <p className="font-medium text-[13px]" style={{ color: 'var(--text)' }}>{row.customer_name || '—'}</p>
                                        <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>{row.customer_email || ''}</p>
                                    </td>
                                    <td className="t-td font-semibold">{fmtCur(row.amount)}</td>
                                    <td className="t-td text-[12px]" style={{ color: 'var(--text-muted)' }}>{fmtCur(row.tax_amount)}</td>
                                    <td className="t-td"><StatusBadge status={row.status} /></td>
                                    <td className="t-td text-[12px]" style={{ color: 'var(--text-muted)' }}>
                                        {row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : <Empty icon="📋" text="No recent orders" />}
            </Card>
        </>
    )
}

/* ══════════════════════════════════════════════════════════════
   PRODUCTS TAB
   ══════════════════════════════════════════════════════════════ */
function ProductsTab({ dp }) {
    const [selectedCat, setSelectedCat] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedProduct, setSelectedProduct] = useState(null)
    const [showResults, setShowResults] = useState(false)

    const cats = useQuery({ queryKey: ['a-cats'], queryFn: () => getAnalyticsCategories() })
    const topProd = useQuery({ queryKey: ['a-top', dp, selectedCat], queryFn: () => getTopProducts({ ...dp, category: selectedCat || undefined }) })
    const leastPrd = useQuery({ queryKey: ['a-least', dp, selectedCat], queryFn: () => getLeastProducts({ ...dp, category: selectedCat || undefined }) })

    const searchRes = useQuery({
        queryKey: ['a-search', searchQuery],
        queryFn: () => searchProducts({ q: searchQuery }),
        enabled: searchQuery.length > 1
    })

    const prodMonthly = useQuery({
        queryKey: ['a-pm', dp, selectedProduct?.product_id],
        queryFn: () => getProductMonthlySales({ ...dp, product_id: selectedProduct?.product_id }),
        enabled: !!selectedProduct
    })

    const topData = (topProd.data?.data || []).map(r => ({ ...r, total_qty: Number(r.total_qty), total_revenue: Number(r.total_revenue) }))
    const leastData = (leastPrd.data?.data || []).map(r => ({ ...r, total_qty: Number(r.total_qty), total_revenue: Number(r.total_revenue) }))
    const prodMonthlyData = (prodMonthly.data?.data || []).map(r => ({ ...r, label: fmtMonth(r.month), total_qty: Number(r.total_qty), total_revenue: Number(r.total_revenue) }))

    if (topProd.isLoading) return <Spinner />

    const ProductSection = ({ title, emoji, data, color }) => (
        <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>{emoji} {title}</h2>
                <select value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
                    className="t-input inline-block w-auto py-1 px-3 text-xs">
                    <option value="">All Categories</option>
                    {(cats.data?.data || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            {data.length ? (
                <div className="grid grid-cols-[1fr_1fr] gap-5 items-start">
                    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32)}>
                        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <YAxis type="category" dataKey="product_name" width={120} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="total_qty" name="Qty Sold" fill={color} radius={[0, 4, 4, 0]} opacity={0.85} />
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-soft)' }}>
                        <table className="w-full">
                            <thead style={{ backgroundColor: 'var(--surface-2)' }}>
                                <tr>{['#', 'Product', 'Qty', 'Revenue'].map(h => <th key={h} className="t-th">{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {data.map((row, i) => (
                                    <tr key={i} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                                        <td className="t-td font-bold" style={{ color, width: 32 }}>{i + 1}</td>
                                        <td className="t-td text-[12px]">{row.product_name || `#${row.product_id}`}</td>
                                        <td className="t-td font-semibold">{fmtNum(row.total_qty)}</td>
                                        <td className="t-td">{fmtCur(row.total_revenue)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : <Empty icon={emoji} text={`No product data`} />}
        </Card>
    )

    return (
        <>
            <ProductSection title="Top 10 Products" emoji="🏆" data={topData} color="#22c55e" />
            <ProductSection title="Least 10 Products" emoji="📉" data={leastData} color="#ef4444" />

            {/* Product Tracking & Search */}
            <Card className="p-5 overflow-visible">
                <h2 className="text-[14px] font-bold mb-4" style={{ color: 'var(--text)' }}>🔍 Product Tracking</h2>
                <div style={{ position: 'relative', width: 320, maxWidth: '100%', marginBottom: 20 }}>
                    <input type="text" placeholder="Search product by name or ID..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setShowResults(true); }}
                        onFocus={() => setShowResults(true)}
                        onBlur={() => setTimeout(() => setShowResults(false), 200)}
                        className="t-input w-full" />
                    {showResults && searchRes.data?.data?.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, width: '100%',
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 6, zIndex: 50, maxHeight: 220, overflowY: 'auto',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', marginTop: 4
                        }}>
                            {searchRes.data.data.map(p => (
                                <div key={p.product_id}
                                    onClick={() => { setSelectedProduct(p); setSearchQuery(p.product_name); setShowResults(false); }}
                                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-soft)' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                                    <div className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{p.product_name || `Product #${p.product_id}`}</div>
                                    <div className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>{p.product_category || 'Uncategorized'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedProduct ? (
                    prodMonthly.isLoading ? <Spinner /> : prodMonthlyData.length > 0 ? (
                        <div className="mt-4">
                            <div className="mb-4">
                                <h3 className="font-bold text-[15px]" style={{ color: 'var(--text)' }}>{selectedProduct.product_name}</h3>
                                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Monthly sales performance for this product.</p>
                            </div>
                            <ResponsiveContainer width="100%" height={260}>
                                <ComposedChart data={prodMonthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <YAxis yAxisId="rev" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <YAxis yAxisId="qty" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar yAxisId="rev" dataKey="total_revenue" name="Revenue" fill="var(--color-brand)" radius={[4, 4, 0, 0]} opacity={0.85} />
                                    <Line yAxisId="qty" dataKey="total_qty" name="Qty Sold" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <Empty icon="📊" text="No sales data found for this product in the selected range." />
                    )
                ) : (
                    <Empty icon="🔍" text="Search and select a product to see its performance." />
                )}
            </Card>
        </>
    )
}

/* ══════════════════════════════════════════════════════════════
   CATEGORIES TAB
   ══════════════════════════════════════════════════════════════ */
function CategoriesTab({ dp }) {
    const [selectedCat, setSelectedCat] = useState(null)

    const catSales = useQuery({ queryKey: ['a-cat', dp], queryFn: () => getCategorySales(dp) })
    const subSales = useQuery({ queryKey: ['a-sub', dp, selectedCat], queryFn: () => getSubcategorySales({ ...dp, category: selectedCat || undefined }) })
    const catMonthly = useQuery({ queryKey: ['a-cat-m', dp], queryFn: () => getCategoryMonthly(dp) })

    const catData = (catSales.data?.data || []).map(r => ({ ...r, total_qty: Number(r.total_qty), total_revenue: Number(r.total_revenue), order_count: Number(r.order_count) }))
    const subData = (subSales.data?.data || []).map(r => ({ ...r, total_qty: Number(r.total_qty), total_revenue: Number(r.total_revenue), order_count: Number(r.order_count) }))

    // Transform monthly data for stacked chart: pivot categories into keys
    const catMonthlyRaw = catMonthly.data?.data || []
    const allCats = [...new Set(catMonthlyRaw.map(r => r.category))]
    const monthlyMap = {}
    catMonthlyRaw.forEach(r => {
        const lbl = fmtMonth(r.month)
        if (!monthlyMap[r.month]) monthlyMap[r.month] = { label: lbl }
        monthlyMap[r.month][r.category] = Number(r.total_revenue)
    })
    const catMonthlyData = Object.values(monthlyMap)

    if (catSales.isLoading) return <Spinner />

    const totalCatRev = catData.reduce((s, r) => s + r.total_revenue, 0)

    return (
        <>
            {/* Category Summary Cards */}
            <div className="grid grid-cols-4 gap-3">
                <KpiCard icon="📂" label="Categories" value={catData.length} sub="with orders" />
                <KpiCard icon="💰" label="Total Revenue" value={fmtCur(totalCatRev)} sub="all categories" accent="var(--color-brand)" />
                <KpiCard icon="📦" label="Total Qty" value={fmtNum(catData.reduce((s, r) => s + r.total_qty, 0))} sub="items sold" />
                <KpiCard icon="🛒" label="Orders" value={fmtNum(catData.reduce((s, r) => s + r.order_count, 0))} sub="across categories" />
            </div>

            {/* Category Breakdown: Pie + Table */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="p-5">
                    <h2 className="text-[14px] font-bold mb-4" style={{ color: 'var(--text)' }}>Revenue by Category</h2>
                    {catData.length ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie data={catData.map(r => ({ name: r.category, value: r.total_revenue }))}
                                    cx="50%" cy="50%" outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                                    {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <Tooltip content={<ChartTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <Empty icon="📂" text="No category data" />}
                </Card>

                <Card className="overflow-hidden">
                    <div className="px-5 pt-4 pb-2">
                        <h2 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Category Performance</h2>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>Click a row to view subcategories</p>
                    </div>
                    {catData.length ? (
                        <table className="w-full">
                            <thead style={{ backgroundColor: 'var(--surface-2)' }}>
                                <tr>{['Category', 'Qty', 'Revenue', 'Orders'].map(h => <th key={h} className="t-th">{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {catData.map((row, i) => (
                                    <tr key={i} onClick={() => setSelectedCat(row.category === selectedCat ? null : row.category)}
                                        style={{ cursor: 'pointer', ...(selectedCat === row.category ? { backgroundColor: 'color-mix(in srgb, var(--color-brand) 10%, transparent)' } : {}) }}
                                        onMouseEnter={e => { if (selectedCat !== row.category) e.currentTarget.style.backgroundColor = 'var(--surface-2)' }}
                                        onMouseLeave={e => { if (selectedCat !== row.category) e.currentTarget.style.backgroundColor = '' }}>
                                        <td className="t-td">
                                            <div className="flex items-center gap-2">
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                <span className="font-medium text-[13px]">{row.category}</span>
                                            </div>
                                        </td>
                                        <td className="t-td font-semibold">{fmtNum(row.total_qty)}</td>
                                        <td className="t-td" style={{ color: 'var(--color-brand)' }}>{fmtCur(row.total_revenue)}</td>
                                        <td className="t-td">{fmtNum(row.order_count)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <Empty icon="📂" text="No category data" />}
                </Card>
            </div>

            {/* Subcategories — shown when a category is selected */}
            {selectedCat && (
                <Card className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <h2 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>
                            Subcategories of <span style={{ color: 'var(--color-brand)' }}>{selectedCat}</span>
                        </h2>
                        <button onClick={() => setSelectedCat(null)} className="t-btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>✕ Clear</button>
                    </div>
                    {subSales.isLoading ? <Spinner /> : subData.length ? (
                        <div className="grid grid-cols-[1fr_1fr] gap-5 items-start">
                            <ResponsiveContainer width="100%" height={Math.max(200, subData.length * 36)}>
                                <BarChart data={subData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <YAxis type="category" dataKey="subcategory" width={120} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Bar dataKey="total_revenue" name="Revenue" fill="var(--color-brand)" radius={[0, 4, 4, 0]} opacity={0.85} />
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-soft)' }}>
                                <table className="w-full">
                                    <thead style={{ backgroundColor: 'var(--surface-2)' }}>
                                        <tr>{['Subcategory', 'Qty', 'Revenue', 'Orders'].map(h => <th key={h} className="t-th">{h}</th>)}</tr>
                                    </thead>
                                    <tbody>
                                        {subData.map((row, i) => (
                                            <tr key={i} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                                                <td className="t-td font-medium text-[13px]">{row.subcategory}</td>
                                                <td className="t-td font-semibold">{fmtNum(row.total_qty)}</td>
                                                <td className="t-td" style={{ color: 'var(--color-brand)' }}>{fmtCur(row.total_revenue)}</td>
                                                <td className="t-td">{fmtNum(row.order_count)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : <Empty icon="📁" text="No subcategory data" />}
                </Card>
            )}

            {/* Category Monthly Trend */}
            <Card className="p-5">
                <h2 className="text-[14px] font-bold mb-4" style={{ color: 'var(--text)' }}>Category Monthly Trend</h2>
                {catMonthlyData.length ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={catMonthlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                            <Tooltip content={<ChartTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {allCats.map((cat, i) => (
                                <Bar key={cat} dataKey={cat} stackId="a" fill={BAR_COLORS[i % BAR_COLORS.length]} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                ) : <Empty icon="📈" text="No monthly category data" />}
            </Card>
        </>
    )
}
