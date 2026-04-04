import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBundles, deleteBundle } from '../../api'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'

function StatusBadge({ active }) {
  return active
    ? <span className="t-badge-active"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active</span>
    : <span className="t-badge-inactive"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Draft</span>
}

export default function Bundles() {
  const { data: rawData, isLoading, refetch } = useQuery({ queryKey: ['bundles'], queryFn: getBundles })

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [expandedId, setExpandedId] = useState(null)
  const [sortBy, setSortBy] = useState('bundle_id')
  const [sortOrder, setSortOrder] = useState('DESC')

  const handleDelete = async (productId) => {
    const res = await Swal.fire({
      title: 'Remove bundle definition?',
      text: "The product itself stays in the database.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, remove it'
    })
    if (!res.isConfirmed) return
    try {
      await deleteBundle(productId)
      toast.success('Bundle removed')
      refetch()
    } catch { toast.error('Failed to remove bundle') }
  }

  // Client-side filtering and sorting
  const filteredData = useMemo(() => {
    if (!rawData?.data) return []
    let list = [...rawData.data]

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(b =>
        b.name_en.toLowerCase().includes(q) ||
        b.fgd.toLowerCase().includes(q)
      )
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[sortBy], valB = b[sortBy]
      if (typeof valA === 'string') {
        const res = valA.localeCompare(valB)
        return sortOrder === 'ASC' ? res : -res
      }
      return sortOrder === 'ASC' ? valA - valB : valB - valA
    })

    return list
  }, [rawData, search, sortBy, sortOrder])

  const totalPages = Math.ceil(filteredData.length / limit)
  const pagedData = filteredData.slice((page - 1) * limit, page * limit)

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center h-64 text-sm animate-pulse" style={{ color: 'var(--text-subtle)' }}>
      Loading bundle architecture…
    </div>
  )

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortBy(field)
      setSortOrder('ASC')
    }
  }

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <span className="opacity-20 ml-1 text-[10px]">↕</span>
    return <span className="ml-1 text-[10px]">{sortOrder === 'ASC' ? '↑' : '↓'}</span>
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text)' }}>Bundles &amp; Gift Sets</h1>
          <p className="text-[13px] opacity-60 mt-1">Manage complex product compositions and linked inventory</p>
        </div>
        <button className="t-btn-primary h-11 px-6 gap-2 shadow-lg shadow-brand/10">
          <span className="text-lg leading-none">+</span> Create New Bundle
        </button>
      </div>

      {/* Toolbar / Search */}
      <div className="flex items-center gap-3 p-4 rounded-2xl"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 text-lg">🔍</span>
          <input
            className="t-input pl-10 h-10 w-full max-w-sm"
            placeholder="Search bundles by name or FGD..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex items-center gap-2 text-[12px] font-medium ml-auto" style={{ color: 'var(--text-subtle)' }}>
          {filteredData.length} bundles found
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl overflow-hidden shadow-sm"
        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-2)' }}>
              <th className="t-th w-12 !pr-0"></th>
              <th className="t-th cursor-pointer group" onClick={() => handleSort('fgd')}>
                FGD <SortIcon field="fgd" />
              </th>
              <th className="t-th cursor-pointer group" onClick={() => handleSort('name_en')}>
                Name <SortIcon field="name_en" />
              </th>
              <th className="t-th text-center">Composition</th>
              <th className="t-th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedData.map(bundle => {
              const isExpanded = expandedId === bundle.bundle_id
              return (
                <React.Fragment key={bundle.bundle_id}>
                  {/* Row */}
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : bundle.bundle_id)}
                    className={`transition-all cursor-pointer group/row ${isExpanded ? 'bg-brand/[0.04]' : 'hover:bg-white/[0.02]'}`}
                    style={{ borderTop: '1px solid var(--border-soft)' }}
                  >
                    <td className="t-td !pr-0">
                      <div
                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-300 ${isExpanded ? 'rotate-90 bg-brand text-white shadow-lg shadow-brand/20' : 'opacity-30 group-hover/row:opacity-100 group-hover/row:bg-white/10'}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </td>
                    <td className="t-td font-mono text-[12px] font-bold group-hover/row:text-brand transition-colors">
                      {bundle.fgd}
                    </td>
                    <td className="t-td">
                      <div className="flex flex-col">
                        <span className="font-semibold" style={{ color: 'var(--text)' }}>{bundle.name_en}</span>
                        <span className="text-[11px] opacity-40 uppercase tracking-wider font-bold" dir="rtl">{bundle.name_ar}</span>
                      </div>
                    </td>
                    <td className="t-td text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold group-hover/row:bg-brand/10 group-hover/row:text-brand transition-all"
                        style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                        {bundle.items?.length || 0} Elements
                      </div>
                    </td>
                    <td className="t-td text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-all opacity-40 hover:opacity-100 group/btn" title="Edit Bundle Items">
                          <svg className="w-4 h-4 transition-transform group-hover/btn:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                        <button onClick={() => handleDelete(bundle.product_id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-all opacity-40 hover:opacity-100 group/trash" title="Remove Link">
                          <svg className="w-4 h-4 transition-transform group-hover/trash:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Accordion Detail */}
                  {isExpanded && (
                    <tr className="bg-brand/[0.02]">
                      <td colSpan={5} className="p-0 border-b overflow-hidden" style={{ borderColor: 'var(--border-soft)' }}>
                        <div className="px-6 py-6 animate-in slide-in-from-top-2 duration-500 ease-out">
                          {bundle.items?.length > 0 ? (
                            <div className="flex flex-col gap-2 relative">
                              {/* Subtle vertical trace line */}
                              <div className="absolute left-3.5 top-0 bottom-4 w-[1px] opacity-10" style={{ backgroundColor: 'var(--color-brand)' }} />

                              <div className="space-y-1">
                                {bundle.items.map(item => (
                                  <div key={item.id}
                                    className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all hover:bg-white/[0.03] group/item"
                                  >
                                    {/* Indent marker */}
                                    <div className="w-2.5 h-[1px] opacity-20 shrink-0" style={{ backgroundColor: 'var(--color-brand)' }} />

                                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/5 group-hover/item:border-brand/20 transition-all">
                                      <span className="text-lg opacity-40 group-hover/item:opacity-100 group-hover/item:scale-110 transition-all">📦</span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <p className="text-[14px] font-bold truncate" style={{ color: 'var(--text)' }}>
                                          {item.product_id ? item.product_name_en : item.component_name_en}
                                        </p>
                                        {item.product_fgd && (
                                          <span className="text-[10px] font-mono opacity-30 group-hover/item:opacity-60 transition-opacity">
                                            #{item.product_fgd}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-20 group-hover/item:opacity-40 transition-opacity">
                                        {item.product_id ? 'Master Connected' : 'Static Component'}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-6 pr-4">
                                      <div className="text-center w-16">
                                        <p className="text-[10px] uppercase font-black opacity-20 mb-0.5">Quantity</p>
                                        <p className="text-[15px] font-black tabular-nums tracking-tighter" style={{ color: 'var(--text)' }}>×{item.qty}</p>
                                      </div>
                                      <div className="w-24 text-right">
                                        {item.product_id ? (
                                          <div className="inline-flex h-5 items-center px-1.5 rounded bg-green-500/10 text-green-500 text-[9px] font-black uppercase tracking-tighter border border-green-500/20">
                                            Live Link
                                          </div>
                                        ) : (
                                          <div className="inline-flex h-5 items-center px-1.5 rounded bg-white/5 text-white/30 text-[9px] font-black uppercase tracking-tighter border border-white/10">
                                            Static
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-6 opacity-30 grayscale italic">
                              <p className="text-3xl mb-2">💨</p>
                              <p className="text-[12px] font-bold tracking-widest uppercase">No Composition Data</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}


                </React.Fragment>
              )
            })}

            {pagedData.length === 0 && (
              <tr>
                <td colSpan={5} className="py-20 text-center">
                  <p className="text-2xl mb-2">🔎</p>
                  <p className="text-[14px]" style={{ color: 'var(--text-subtle)' }}>No bundles match your search</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}>
          <p className="text-[12px] font-medium opacity-50">
            Page {page} of {totalPages || 1}
          </p>
          <div className="flex gap-1.5">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 disabled:opacity-20 transition-all hover:bg-white/10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 border border-white/5 disabled:opacity-20 transition-all hover:bg-white/10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

import React from 'react'

