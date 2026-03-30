import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getCampaigns, updateCampaignStatus, deleteCampaign, restoreCampaign, hardDeleteCampaign, getCountries, getCampaign } from '../../api'
import CampaignPreview from './CampaignPreview'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import { useState, useEffect } from 'react'
import { useDebounce } from 'use-debounce'

const FLAGS = { AE:'🇦🇪', SA:'🇸🇦', QA:'🇶🇦', BH:'🇧🇭', KW:'🇰🇼', OM:'🇴🇲' }

const TYPE_BADGE = {
  discount: { label: 'Discount', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  bxgy:     { label: 'Buy X Get Y', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  foc:      { label: 'FOC', bg: '#fef3c7', color: '#d97706', border: '#fde68a' },
}

const STATUS_BADGE = {
  draft:     { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
  scheduled: { bg: '#eff6ff', color: '#3b82f6', border: '#bfdbfe' },
  active:    { bg: '#f0fdf4', color: '#22c55e', border: '#bbf7d0' },
  paused:    { bg: '#fefce8', color: '#eab308', border: '#fef08a' },
  expired:   { bg: '#fef2f2', color: '#ef4444', border: '#fecaca' },
  archived:  { bg: '#f9fafb', color: '#9ca3af', border: '#e5e7eb' },
}

const STATUS_TABS = ['all', 'active', 'scheduled', 'draft', 'paused', 'expired', 'archived']

function TypeBadge({ type }) {
  const t = TYPE_BADGE[type] || TYPE_BADGE.discount
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight"
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}>
      {t.label}
    </span>
  )
}

function StatusBadge({ status }) {
  const s = STATUS_BADGE[status] || STATUS_BADGE.draft
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tight"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {status}
    </span>
  )
}

function SortIcon({ sortBy, col, sortOrder }) {
  if (sortBy !== col) return <span className="ml-1 opacity-20">↕</span>
  return <span className="ml-1" style={{ color: 'var(--color-brand)' }}>{sortOrder === 'asc' ? '↑' : '↓'}</span>
}

function CampaignPreviewWrapper({ campaignId, countries }) {
  const { data: campaignDetails, isLoading, isError } = useQuery({
    queryKey: ['campaign-full', campaignId],
    queryFn: () => getCampaign(campaignId),
    enabled: !!campaignId
  })

  if (isLoading) return <div className="p-10 text-center animate-pulse opacity-40 font-bold text-[11px] uppercase tracking-widest">Loading campaign details...</div>
  if (isError) return <div className="p-10 text-center text-red-500 font-bold text-[11px]">Failed to load campaign data.</div>

  const campaign = campaignDetails?.data
  if (!campaign) return null

  // Map to the format CampaignPreview expects (same as CampaignForm's INITIAL_STATE)
  const tempState = {
    ...campaign,
    countries: campaign.countries?.map(c => c.id) || [],
    scope: campaign.scope || [],
    discount_rules: campaign.discount_rules || { discount_type: 'percentage', discount_value: 0, min_price: 0 },
    bxgy_rules: campaign.bxgy_rules || { buy_qty: 2, get_qty: 1, get_discount_type: 'free', get_discount_value: 0, is_repeatable: false, max_repeats: '', allow_overlap: false },
    foc_rules: campaign.foc_rules || { cart_min: 0, cart_max: '', selection_mode: 'auto', max_free_items: 1 },
    product_overrides: campaign.product_overrides || [],
    bxgy_products: {
      buy: campaign.bxgy_products?.buy?.map(p => p.product_id) || [],
      get: campaign.bxgy_products?.get?.map(p => p.product_id) || []
    },
    foc_products: campaign.foc_products?.map(p => p.product_id) || []
  }

  return <CampaignPreview campaignId={campaignId} tempState={tempState} countries={countries} />
}

export default function CampaignList() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '')
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [debouncedSearch] = useDebounce(search, 500)
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [limit, setLimit] = useState(Number(searchParams.get('limit')) || 20)
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'created_at')
  const [sortOrder, setSortOrder] = useState(searchParams.get('order') || 'desc')
  const [expanded, setExpanded] = useState(null)
  const [showPreview, setShowPreview] = useState(null)
  const [showBin, setShowBin] = useState(false)
  const [selectedCampaignIds, setSelectedCampaignIds] = useState(() => new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const { data: countriesData } = useQuery({ queryKey: ['countries'], queryFn: getCountries })
  const countries = countriesData?.data || []

  useEffect(() => {
    const p = new URLSearchParams()
    if (statusFilter !== 'all') p.set('status', statusFilter)
    if (typeFilter) p.set('type', typeFilter)
    if (search) p.set('search', search)
    if (page > 1) p.set('page', String(page))
    if (limit !== 20) p.set('limit', String(limit))
    if (sortBy !== 'created_at') p.set('sort', sortBy)
    if (sortOrder !== 'desc') p.set('order', sortOrder)
    setSearchParams(p, { replace: true })
  }, [statusFilter, typeFilter, search, page, limit, sortBy, sortOrder, setSearchParams])

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', statusFilter, typeFilter, debouncedSearch, page, limit, sortBy, sortOrder, showBin],
    queryFn: () => getCampaigns({
      status: statusFilter === 'all' ? undefined : statusFilter,
      type: typeFilter || undefined,
      search: debouncedSearch || undefined,
      deleted_status: showBin ? 'bin' : undefined,
      page, limit, sort: sortBy, order: sortOrder,
    }),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['campaigns'] })

  const clearSelection = () => {
    setSelectedCampaignIds(new Set())
    setExpanded(null)
    setShowPreview(null)
  }

  const handleSort = (col) => {
    if (sortBy === col) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortOrder('desc'); }
    clearSelection()
    setPage(1)
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateCampaignStatus(id, newStatus)
      toast.success(`Campaign ${newStatus}`)
      refresh()
    } catch { toast.error('Failed to update status') }
  }

  const handleDelete = async (id, status) => {
    const res = await Swal.fire({
      title: status === 'draft' ? 'Delete Campaign?' : 'Archive Campaign?',
      text: status === 'draft' ? 'This action cannot be undone.' : 'The campaign will be moved to the recycle bin.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: status === 'draft' ? 'Yes, delete it!' : 'Yes, archive it!',
    })
    if (res.isConfirmed) {
      try {
        await deleteCampaign(id)
        toast.success(status === 'draft' ? 'Campaign deleted' : 'Campaign archived')
        refresh()
      } catch { toast.error('Failed') }
    }
  }

  const handleRestore = async (id) => {
    try { await restoreCampaign(id); toast.success('Campaign restored'); refresh() }
    catch { toast.error('Failed to restore campaign') }
  }

  const handleHardDelete = async (id) => {
    const res = await Swal.fire({ title: 'Permanently Delete?', text: 'This action cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, delete forever!' })
    if (res.isConfirmed) {
      try { await hardDeleteCampaign(id); toast.success('Campaign permanently deleted'); refresh() }
      catch { toast.error('Failed to delete permanently') }
    }
  }

  const visibleCampaignIds = (data?.data || []).map(c => c.id)
  const allVisibleSelected = visibleCampaignIds.length > 0 && visibleCampaignIds.every(id => selectedCampaignIds.has(id))

  const toggleSelected = (id) => {
    setSelectedCampaignIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllVisible = () => {
    setSelectedCampaignIds(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleCampaignIds.forEach(id => next.delete(id))
      } else {
        visibleCampaignIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const bulkMoveToBin = async () => {
    const ids = Array.from(selectedCampaignIds)
    if (!ids.length) return

    const res = await Swal.fire({
      title: 'Move selected to recycle bin?',
      text: 'Selected campaigns will be moved to the recycle bin.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, move to bin!',
    })

    if (!res.isConfirmed) return

    setBulkLoading(true)
    const results = await Promise.allSettled(ids.map(id => deleteCampaign(id)))
    setBulkLoading(false)

    const ok = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - ok
    if (ok) toast.success(`Moved ${ok} campaign(s) to bin`)
    if (failed) toast.error(`Failed to move ${failed} campaign(s)`)

    setSelectedCampaignIds(new Set())
    refresh()
  }

  const bulkRestore = async () => {
    const ids = Array.from(selectedCampaignIds)
    if (!ids.length) return

    const res = await Swal.fire({
      title: 'Restore selected campaigns?',
      text: 'Selected campaigns will be restored from the recycle bin.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, restore!',
    })
    if (!res.isConfirmed) return

    setBulkLoading(true)
    const results = await Promise.allSettled(ids.map(id => restoreCampaign(id)))
    setBulkLoading(false)

    const ok = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - ok
    if (ok) toast.success(`Restored ${ok} campaign(s)`)
    if (failed) toast.error(`Failed to restore ${failed} campaign(s)`)

    setSelectedCampaignIds(new Set())
    refresh()
  }

  const bulkHardDelete = async () => {
    const ids = Array.from(selectedCampaignIds)
    if (!ids.length) return

    const res = await Swal.fire({
      title: 'Permanently delete selected campaigns?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, delete forever!',
    })
    if (!res.isConfirmed) return

    setBulkLoading(true)
    const results = await Promise.allSettled(ids.map(id => hardDeleteCampaign(id)))
    setBulkLoading(false)

    const ok = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - ok
    if (ok) toast.success(`Deleted ${ok} campaign(s) permanently`)
    if (failed) toast.error(`Failed to delete ${failed} campaign(s) permanently`)

    setSelectedCampaignIds(new Set())
    refresh()
  }

  const campaigns = data?.data || []
  const pagination = data?.pagination || { page: 1, limit: 20, total: 0 }
  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              Campaigns
              {showBin ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 uppercase tracking-widest leading-none flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  Recycle Bin
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-black/50 uppercase tracking-widest leading-none"
                  style={{ background: 'color-mix(in srgb, var(--color-brand) 10%, transparent)', color: 'var(--color-brand)' }}>
                  Promotions
                </span>
              )}
            </h1>
            <p className="text-[12px] font-medium opacity-40">Manage discount campaigns, Buy X Get Y offers, and free gifts</p>
          </div>
          <div className="flex items-center gap-2">
            <button
               onClick={() => { clearSelection(); setShowBin(!showBin); setPage(1); }}
               className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all shadow-sm border ${showBin ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white text-black/60 border-black/10 hover:bg-black/5 active:scale-95'}`}
             >
               <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
               {showBin ? 'Exit Bin' : 'View Bin'}
            </button>
            <Link
              to="/campaigns/new"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all active:scale-95 shadow-lg"
              style={{ backgroundColor: 'var(--color-brand)', color: '#fff', boxShadow: '0 4px 14px color-mix(in srgb, var(--color-brand) 35%, transparent)' }}
            >
              <span className="text-lg leading-none">+</span> Create Campaign
            </Link>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--text-subtle)' }}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
              </div>
              <input
                type="search"
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => { clearSelection(); setSearch(e.target.value); setPage(1) }}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-[12px] font-medium outline-none transition-all"
                style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
              />
            </div>

            <div className="h-6 w-px" style={{ backgroundColor: 'var(--border)' }} />

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => { clearSelection(); setTypeFilter(e.target.value); setPage(1) }}
              className="px-3 py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer outline-none"
              style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-soft)', color: 'var(--text)' }}
            >
              <option value="">All Types</option>
              <option value="discount">Discount</option>
              <option value="bxgy">Buy X Get Y</option>
              <option value="foc">Free of Charge</option>
            </select>
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--surface-2)' }}>
            {STATUS_TABS.map(s => (
              <button
                key={s}
                onClick={() => { clearSelection(); setStatusFilter(s); setPage(1) }}
                className="text-[11px] px-3 py-1.5 rounded-lg font-bold transition-all capitalize"
                style={{
                  backgroundColor: statusFilter === s ? 'var(--surface)' : 'transparent',
                  color: statusFilter === s ? 'var(--text)' : 'var(--text-subtle)',
                  boxShadow: statusFilter === s ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-col rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
        {/* Table header bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
          <div className="text-[11px] font-bold opacity-40 uppercase tracking-widest px-1">
            Displaying <span style={{ color: 'var(--text)' }}>{campaigns.length}</span> of {pagination.total} Campaigns
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold opacity-30 uppercase tracking-widest">Show</span>
            <select
              value={limit}
              onChange={(e) => { clearSelection(); setLimit(Number(e.target.value)); setPage(1) }}
              className="px-2 py-1 rounded-lg text-[11px] font-bold outline-none cursor-pointer transition-colors border-none"
              style={{ backgroundColor: 'var(--surface)', color: 'var(--text)' }}
            >
              {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {selectedCampaignIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
            <div className="text-[12px] font-medium opacity-70">
              Selected <span style={{ color: 'var(--text)', fontWeight: 800 }}>{selectedCampaignIds.size}</span> campaign(s)
            </div>
            <div className="flex items-center gap-2">
              {!showBin ? (
                <button
                  disabled={bulkLoading}
                  onClick={bulkMoveToBin}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50"
                >
                  {bulkLoading ? 'Moving...' : 'Move to Bin'}
                </button>
              ) : (
                <>
                  <button
                    disabled={bulkLoading}
                    onClick={bulkRestore}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-50"
                  >
                    {bulkLoading ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    disabled={bulkLoading}
                    onClick={bulkHardDelete}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50"
                  >
                    {bulkLoading ? 'Deleting...' : 'Delete Forever'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="flex flex-col">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="grid grid-cols-12 gap-4 items-center p-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="col-span-3 h-5 animate-pulse rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
                <div className="col-span-1 h-5 animate-pulse rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
                <div className="col-span-1 h-5 animate-pulse rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
                <div className="col-span-2 h-5 animate-pulse rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
                <div className="col-span-2 h-5 animate-pulse rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
                <div className="col-span-1 h-5 animate-pulse rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
                <div className="col-span-2 h-5 animate-pulse rounded" style={{ backgroundColor: 'var(--surface-2)' }} />
              </div>
            ))}
          </div>
        ) : !campaigns.length ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-4xl opacity-20">📋</div>
            <p className="text-[13px] font-medium opacity-40">No campaigns found</p>
            <Link to="/campaigns/new" className="text-[12px] font-bold" style={{ color: 'var(--color-brand)' }}>
              Create your first campaign →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Column header */}
            <div className="grid grid-cols-12 gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b"
              style={{ color: 'var(--text-subtle)', borderColor: 'var(--border)' }}>
              <div className="col-span-1 flex items-center justify-start">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={handleSelectAllVisible}
                  disabled={bulkLoading || campaigns.length === 0}
                  aria-label="Select all campaigns"
                  style={{ accentColor: 'var(--color-brand)' }}
                />
              </div>
              <div className="col-span-2 cursor-pointer select-none" onClick={() => handleSort('name_en')}>
                Campaign <SortIcon sortBy={sortBy} col="name_en" sortOrder={sortOrder} />
              </div>
              <div className="col-span-1">Type</div>
              {!showBin && <div className="col-span-1">Status</div>}
              <div className="col-span-1">Countries</div>
              <div className="col-span-2 cursor-pointer select-none" onClick={() => handleSort('start_at')}>
                Date Range <SortIcon sortBy={sortBy} col="start_at" sortOrder={sortOrder} />
              </div>
              <div className="col-span-1 cursor-pointer select-none" onClick={() => handleSort('priority')}>
                Priority <SortIcon sortBy={sortBy} col="priority" sortOrder={sortOrder} />
              </div>
              <div className="col-span-1">Scope</div>
              <div className={showBin ? "col-span-3 text-right" : "col-span-2 text-right"}>Actions</div>
            </div>

            {campaigns.map(c => (
              <div key={c.id}>
                <div
                  className="grid grid-cols-12 gap-3 px-4 py-3.5 items-center border-b transition-colors cursor-pointer"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                >
                  {/* Select */}
                  <div className="col-span-1 flex items-center justify-start">
                    <input
                      type="checkbox"
                      checked={selectedCampaignIds.has(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelected(c.id)}
                      disabled={bulkLoading}
                      aria-label={`Select campaign ${c.name_en}`}
                      style={{ accentColor: 'var(--color-brand)' }}
                    />
                  </div>

                  {/* Name */}
                  <div className="col-span-2">
                    <p className="font-bold text-[12px] truncate" style={{ color: 'var(--text)' }}>{c.name_en}</p>
                    {c.name_ar && <p className="text-[10px] truncate font-medium" dir="rtl" style={{ color: 'var(--text-subtle)' }}>{c.name_ar}</p>}
                  </div>

                  {/* Type */}
                  <div className="col-span-1"><TypeBadge type={c.type} /></div>

                  {/* Status (HIDDEN in Bin to save space) */}
                  {!showBin && <div className="col-span-1"><StatusBadge status={c.status} /></div>}

                  {/* Countries */}
                  <div className="col-span-1">
                    <div className="flex flex-wrap gap-0.5">
                      {(c.countries || []).map(code => (
                        <span key={code} className="text-[10px]" title={code}>{FLAGS[code] || code}</span>
                      ))}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="col-span-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text)' }}>{formatDate(c.start_at)}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>→ {formatDate(c.end_at)}</span>
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="col-span-1">
                    <span className="font-mono text-[12px] font-bold" style={{ color: 'var(--text-muted)' }}>{c.priority}</span>
                  </div>

                  {/* Scope */}
                  <div className="col-span-1">
                    <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{c.scope_summary}</span>
                  </div>

                  {/* Actions */}
                  <div className={showBin ? "col-span-3 flex items-center justify-end gap-1" : "col-span-2 flex items-center justify-end gap-1"} onClick={(e) => e.stopPropagation()}>
                    {showBin ? (
                      <>
                        <button 
                          onClick={() => handleRestore(c.id)}
                          title="Restore Campaign"
                          className="px-2 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all hover:scale-105"
                        >
                          RESTORE
                        </button>
                        <button 
                          onClick={() => handleHardDelete(c.id)}
                          title="Delete Permanently"
                          className="px-2 py-1.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all hover:scale-105"
                        >
                          DELETE
                        </button>
                      </>
                    ) : (
                      <>
                        {c.status === 'draft' && (
                          <button onClick={() => handleStatusChange(c.id, 'active')} title="Activate"
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-all hover:scale-110">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                            </svg>
                          </button>
                        )}
                        {c.status === 'active' && (
                          <button onClick={() => handleStatusChange(c.id, 'paused')} title="Pause"
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-all hover:scale-110">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                            </svg>
                          </button>
                        )}
                        {c.status === 'paused' && (
                          <button onClick={() => handleStatusChange(c.id, 'active')} title="Resume"
                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-all hover:scale-110">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                            </svg>
                          </button>
                        )}

                        <Link to={`/campaigns/${c.id}`} title="Edit"
                          className="p-1.5 rounded-lg transition-all hover:scale-110"
                          style={{ color: 'var(--color-brand)' }}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </Link>

                        <button onClick={() => handleDelete(c.id, c.status)} title="Delete/Archive"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-all hover:scale-110">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded row */}
                {expanded === c.id && (
                  <div className="px-6 py-4 border-b space-y-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
                    <div className="grid grid-cols-3 gap-6 text-[11px]">
                      <div className="space-y-2">
                        <span className="font-black uppercase tracking-widest opacity-40 block mb-1">Configuration</span>
                        <div className="space-y-1">
                          <p><span className="font-bold opacity-60">ID:</span> <span className="font-mono">#{c.id}</span></p>
                          <p><span className="font-bold opacity-60">Stackable:</span> {c.is_stackable ? 'Yes' : 'No'}</p>
                          {c.max_uses && <p><span className="font-bold opacity-60">Max Uses:</span> {c.current_uses}/{c.max_uses}</p>}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="font-black uppercase tracking-widest opacity-40 block mb-1">Target Scope</span>
                        <div className="p-3 rounded-lg bg-surface border border-border/50 font-bold" style={{ color: 'var(--color-brand)' }}>
                          {c.scope_summary}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="font-black uppercase tracking-widest opacity-40 block mb-1">History</span>
                        <div className="space-y-1">
                          <p><span className="font-bold opacity-60">Created:</span> {formatDate(c.created_at)}</p>
                          {c.notes && <p className="mt-1 font-medium opacity-60 leading-relaxed italic">"{c.notes}"</p>}
                        </div>
                      </div>
                    </div>

                    {/* Preview Toggle */}
                    <div className="flex flex-col gap-4 pt-4 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-text-muted">Live Impact Preview</h4>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowPreview(showPreview === c.id ? null : c.id) }}
                          className="px-4 py-1.5 rounded-xl text-[11px] font-black transition-all hover:scale-105 shadow-sm border border-brand/20 active:scale-95"
                          style={{
                            backgroundColor: showPreview === c.id ? 'var(--color-brand)' : 'var(--surface)',
                            color: showPreview === c.id ? '#fff' : 'var(--color-brand)',
                          }}
                        >
                          {showPreview === c.id ? 'Hide Preview' : 'Show Impact Preview →'}
                        </button>
                      </div>

                      {showPreview === c.id && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <CampaignPreviewWrapper campaignId={c.id} countries={countries} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between p-3 border-t gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
            <p className="text-[12px] font-medium opacity-50">
              Page <span className="font-bold" style={{ color: 'var(--text)' }}>{page}</span> of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => { clearSelection(); setPage(p => p - 1) }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-20"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                ← Prev
              </button>
              <div className="flex items-center mx-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pNum = i + 1
                  if (totalPages > 5) {
                    if (page > 3) pNum = page - 2 + i
                    if (page > totalPages - 2) pNum = totalPages - 4 + i
                  }
                  if (pNum < 1 || pNum > totalPages) return null
                  return (
                    <button
                      key={pNum}
                      onClick={() => { clearSelection(); setPage(pNum) }}
                      className="w-7 h-7 rounded-lg text-[11px] font-bold transition-all mx-0.5"
                      style={{
                        backgroundColor: page === pNum ? 'var(--color-brand)' : 'transparent',
                        color: page === pNum ? '#fff' : 'var(--text-muted)',
                      }}
                    >
                      {pNum}
                    </button>
                  )
                })}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => { clearSelection(); setPage(p => p + 1) }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-20"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
