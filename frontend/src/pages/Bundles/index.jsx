import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBundles, deleteBundle } from '../../api'
import { useState, useEffect, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import PageHeader from '../../components/PageHeader'
import BundleForm from './BundleForm'

function SortIcon({ sortBy, col, sortOrder }) {
  if (sortBy !== col) return <span className="ml-1 opacity-20 text-[10px]">↕</span>
  return <span className="ml-1 text-[10px]" style={{ color: 'var(--color-brand)' }}>{sortOrder === 'ASC' ? '↑' : '↓'}</span>
}

export default function Bundles() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [debouncedSearch] = useDebounce(search, 500)
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'bundle_id')
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'DESC')
  const [limit, setLimit] = useState(Number(searchParams.get('limit')) || 20)
  const [expandedId, setExpandedId] = useState(null)
  const [editingBundle, setEditingBundle] = useState(null) // { product_id, bundle_id, etc }
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams()
    if (page > 1) params.set('page', String(page))
    if (search) params.set('search', search)
    if (sortBy !== 'bundle_id') params.set('sortBy', sortBy)
    if (sortOrder !== 'DESC') params.set('sortOrder', sortOrder)
    if (limit !== 20) params.set('limit', String(limit))
    setSearchParams(params, { replace: true })
  }, [page, search, sortBy, sortOrder, limit, setSearchParams])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bundles', { search: debouncedSearch, sortBy, sortOrder, page, limit }],
    queryFn: () => getBundles({ search: debouncedSearch, sort: sortBy, order: sortOrder, page, limit })
  })

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortBy(col)
      setSortOrder('ASC')
    }
    setPage(1)
  }

  const handleRemove = async (bundle) => {
    const res = await Swal.fire({
      title: 'Remove bundle definition?',
      text: `"${bundle.name_en}" will remain as a regular product, but its bundle items will be detached.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, remove it'
    })
    if (!res.isConfirmed) return
    try {
      await deleteBundle(bundle.product_id)
      toast.success('Bundle removed')
      refetch()
    } catch (err) {
      toast.error('Failed to remove bundle')
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full min-h-screen">
      {/* Header */}
      <PageHeader
        title="Bundles / Gift Sets"
        subtitle="Manage gift-set products"
      >
        <button
          onClick={() => { setEditingBundle(null); setShowForm(true); }}
          className="t-btn-primary"
        >
          <span className="text-lg leading-none">+</span> New Bundle
        </button>
      </PageHeader>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--text-subtle)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </div>
            <input
              type="search"
              placeholder="Search Bundle Name or SKU..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-[12px] font-medium outline-none transition-all"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold opacity-30 uppercase tracking-widest">Show</span>
          <select
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            className="px-2 py-1 rounded-lg text-[11px] font-bold outline-none cursor-pointer transition-colors border-none"
            style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)' }}
          >
            {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex flex-col rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--surface-2)' }} className="text-[10px] uppercase font-bold tracking-widest text-text-subtle">
                <th className="t-th w-8"></th>
                <th className="t-th cursor-pointer select-none" onClick={() => handleSort('bundle_id')}>
                  ID <SortIcon sortBy={sortBy} col="bundle_id" sortOrder={sortOrder} />
                </th>
                <th className="t-th cursor-pointer select-none" onClick={() => handleSort('fgd')}>
                  FGD <SortIcon sortBy={sortBy} col="fgd" sortOrder={sortOrder} />
                </th>
                <th className="t-th cursor-pointer select-none" onClick={() => handleSort('name_en')}>
                  Bundle Name (EN / AR) <SortIcon sortBy={sortBy} col="name_en" sortOrder={sortOrder} />
                </th>
                <th className="t-th">Items Count</th>
                <th className="t-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="t-td text-center py-10 opacity-40">Loading bundles…</td></tr>
              ) : !data?.data?.length ? (
                <tr><td colSpan={5} className="t-td text-center py-20 opacity-40">No bundles found</td></tr>
              ) : data.data.map(bundle => (
                <Fragment key={bundle.bundle_id}>
                  <tr
                    className="hover:bg-black/2 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === bundle.bundle_id ? null : bundle.bundle_id)}
                  >
                    <td className="t-td text-center">
                      <svg className={`w-3 h-3 transition-transform ${expandedId === bundle.bundle_id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </td>
                    <td className="t-td font-mono text-[11px] opacity-40">#{bundle.bundle_id}</td>
                    <td className="t-td font-mono text-[11px] font-bold" style={{ color: 'var(--color-brand)' }}>{bundle.fgd}</td>
                    <td className="t-td">
                      <div className="flex items-center gap-4">
                        <p className="w-1/2 font-bold text-[12px] truncate" style={{ color: 'var(--text)' }}>{bundle.name_en}</p>
                        <p className="w-1/2 text-[11px] opacity-30 truncate font-semibold text-right" dir="rtl">{bundle.name_ar}</p>
                      </div>
                    </td>
                    <td className="t-td text-[11px] font-bold opacity-60">
                      <span className="px-2 py-0.5 rounded-full bg-black/5">{bundle.items?.length || 0} Items</span>
                    </td>
                    <td className="t-td text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditingBundle(bundle); setShowForm(true); }}
                          className="p-1.5 rounded-lg hover:bg-black/5 text-[11px] font-bold text-blue-500 transition-all font-mono tracking-tight"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => handleRemove(bundle)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-[11px] font-bold text-red-500 transition-all font-mono tracking-tight"
                        >
                          REMOVE
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Accordion Content */}
                  {expandedId === bundle.bundle_id && (
                    <tr>
                      <td colSpan={6} className="p-0 border-b" style={{ backgroundColor: 'var(--surface-2)' }}>
                        <div className="px-12 py-4 animate-in slide-in-from-top-1 duration-200">
                          <h4 className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-40">Bundle Components</h4>
                          <div className="rounded-xl border overflow-hidden shadow-sm" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                            <table className="w-full">
                              <thead>
                                <tr className="text-[9px] font-bold uppercase tracking-widest opacity-40" style={{ borderBottom: '1px solid var(--border)' }}>
                                  <th className="px-4 py-2 text-left">#</th>
                                  <th className="px-4 py-2 text-left">Component Name</th>
                                  <th className="px-4 py-2 text-left">FGD Code</th>
                                  <th className="px-4 py-2 text-left">Qty</th>
                                  <th className="px-4 py-2 text-left">Type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bundle.items?.map((item, i) => (
                                  <tr key={item.id} className="text-[11px]" style={{ borderBottom: i < bundle.items.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                                    <td className="px-4 py-2 text-text-subtle font-mono">{i + 1}</td>
                                    <td className="px-4 py-2 font-bold">{item.product_id ? item.product_name_en : item.component_name_en}</td>
                                    <td className="px-4 py-2 font-mono opacity-60">{item.product_fgd || '—'}</td>
                                    <td className="px-4 py-2 font-black text-brand">× {item.qty}</td>
                                    <td className="px-4 py-2">
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${item.product_id ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                        {item.product_id ? 'LINKED PRODUCT' : 'STANDALONE'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                                {!bundle.items?.length && (
                                  <tr><td colSpan={6} className="py-4 text-center text-[11px] opacity-40 italic">No items in this bundle</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
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
        {data?.meta && data.meta.pages > 1 && (
          <div className="flex items-center justify-between p-3 border-t bg-black/1" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[12px] font-medium opacity-50">
              Page <span className="font-bold text-black">{page}</span> of {data.meta.pages}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-20 bg-white border border-black/10 hover:bg-black/5"
              >← Prev</button>
              <button
                disabled={page >= data.meta.pages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-20 bg-white border border-black/10 hover:bg-black/5"
              >Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Render Form Modal */}
      {showForm && (
        <BundleForm
          bundle={editingBundle}
          onClose={() => { setShowForm(false); setEditingBundle(null); }}
          onRefresh={refetch}
        />
      )}
    </div>
  )
}

