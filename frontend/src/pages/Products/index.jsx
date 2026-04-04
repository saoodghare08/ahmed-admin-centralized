import { Routes, Route, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getProducts, toggleProduct, deleteProduct, restoreProduct, hardDeleteProduct } from '../../api'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import { useState, useEffect } from 'react'
import { useDebounce } from 'use-debounce'
import ProductForm from './ProductForm'
import ImportModal from './ImportModal'
import { getCategories } from '../../api'

const COUNTRIES = ['AE','SA','QA','BH','KW','OM']
const FLAGS     = { AE:'🇦🇪', SA:'🇸🇦', QA:'🇶🇦', BH:'🇧🇭', KW:'🇰🇼', OM:'🇴🇲' }

const FILTER_KEY = 'ahmed_product_filters'

function StatusBadge({ active }) {

  return active
    ? <span className="t-badge-active"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active</span>
    : <span className="t-badge-inactive"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Inactive</span>
}

function SortIcon({ sortBy, col, sortOrder }) {
  if (sortBy !== col) return <span className="ml-1 opacity-20">↕</span>
  return <span className="ml-1" style={{ color: 'var(--color-brand)' }}>{sortOrder === 'ASC' ? '↑' : '↓'}</span>
}

function ProductList() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters] = useState(() => {
    try {
      const saved = localStorage.getItem(FILTER_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  // Initial states merge URL params and saved filters
  const [country, setCountry] = useState(() => searchParams.get('country') || filters?.country || 'AE')
  const [page, setPage]       = useState(() => Number(searchParams.get('page')) || filters?.page || 1)
  const [search, setSearch]   = useState(() => searchParams.get('search') || filters?.search || '')
  const [debouncedSearch]     = useDebounce(search, 500)
  const [showImport, setShowImport] = useState(false)
  const [showBin, setShowBin] = useState(false)

  const [selectedProductIds, setSelectedProductIds] = useState(() => new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  
  const [catId, setCatId]         = useState(() => searchParams.get('catId') || filters?.catId || '')
  const [subId, setSubId]         = useState(() => searchParams.get('subId') || filters?.subId || '')
  const [sortBy, setSortBy]       = useState(() => searchParams.get('sortBy') || filters?.sortBy || 'id')
  const [sortOrder, setSortOrder] = useState(() => searchParams.get('sortOrder') || filters?.sortOrder || 'DESC')
  const [limit, setLimit]         = useState(() => Number(searchParams.get('limit')) || filters?.limit || 10)


  // Update URL search params when state changes
  useEffect(() => {
    const params = new URLSearchParams()
    if (country) params.set('country', country)
    if (page > 1) params.set('page', String(page))
    if (search) params.set('search', search)
    if (catId) params.set('catId', catId)
    if (subId) params.set('subId', subId)
    if (sortBy !== 'id') params.set('sortBy', sortBy)
    if (sortOrder !== 'DESC') params.set('sortOrder', sortOrder)
    if (limit !== 10) params.set('limit', String(limit))
    
    setSearchParams(params, { replace: true })

    // Save to localStorage for persistence across re-mounts
    localStorage.setItem(FILTER_KEY, JSON.stringify({ country, page, search, catId, subId, sortBy, sortOrder, limit }))
  }, [country, page, search, catId, subId, sortBy, sortOrder, limit, setSearchParams])


  const { data: catData } = useQuery({
    queryKey: ['categories-admin'],
    queryFn:  () => getCategories({ admin: true }),
    select:   res => res.data?.data || res.data || [],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['products', country, page, debouncedSearch, catId, subId, sortBy, sortOrder, limit, showBin],
    queryFn:  () => getProducts({ 
      country, 
      page, 
      limit, 
      search: debouncedSearch, 
      category: catId, 
      subcategory: subId,
      sort: sortBy,
      order: sortOrder,
      status: showBin ? 'bin' : undefined,
      admin: true 
    }),
  })

  // Prevent multiple refetches by using QC invalidate
  const refresh = () => qc.invalidateQueries({ queryKey: ['products'] })

  const clearSelection = () => {
    setSelectedProductIds(new Set())
    setBulkLoading(false)
  }

  const handleToggle = async (id) => { 
    await toggleProduct(id, country)
    toast.success(`${country} visibility toggled`)
    refresh()
  }

  const visibleProductIds = (data?.data || []).map(p => p.id)
  const allVisibleSelected = visibleProductIds.length > 0 && visibleProductIds.every(id => selectedProductIds.has(id))

  const toggleSelected = (id) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAllVisible = () => {
    setSelectedProductIds(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) visibleProductIds.forEach(id => next.delete(id))
      else visibleProductIds.forEach(id => next.add(id))
      return next
    })
  }

  const bulkMoveToBin = async () => {
    const ids = Array.from(selectedProductIds)
    if (!ids.length) return

    const res = await Swal.fire({
      title: 'Move selected to recycle bin?',
      text: 'Selected products will be moved to the recycle bin.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, move to bin!',
    })
    if (!res.isConfirmed) return

    setBulkLoading(true)
    const results = await Promise.allSettled(ids.map(id => deleteProduct(id)))
    setBulkLoading(false)

    const ok = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - ok
    if (ok) toast.success(`Moved ${ok} product(s) to bin`)
    if (failed) toast.error(`Failed to move ${failed} product(s)`)

    clearSelection()
    refresh()
  }

  const bulkRestore = async () => {
    const ids = Array.from(selectedProductIds)
    if (!ids.length) return

    const res = await Swal.fire({
      title: 'Restore selected products?',
      text: 'Selected products will be restored from the recycle bin.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, restore!',
    })
    if (!res.isConfirmed) return

    setBulkLoading(true)
    const results = await Promise.allSettled(ids.map(id => restoreProduct(id)))
    setBulkLoading(false)

    const ok = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - ok
    if (ok) toast.success(`Restored ${ok} product(s)`)
    if (failed) toast.error(`Failed to restore ${failed} product(s)`)

    clearSelection()
    refresh()
  }

  const bulkHardDelete = async () => {
    const ids = Array.from(selectedProductIds)
    if (!ids.length) return

    const res = await Swal.fire({
      title: 'Permanently delete selected products?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, delete forever!',
    })
    if (!res.isConfirmed) return

    setBulkLoading(true)
    const results = await Promise.allSettled(ids.map(id => hardDeleteProduct(id)))
    setBulkLoading(false)

    const ok = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - ok
    if (ok) toast.success(`Deleted ${ok} product(s) permanently`)
    if (failed) toast.error(`Failed to delete ${failed} product(s) permanently`)

    clearSelection()
    refresh()
  }

  const handleDelete = async (id) => {
    const res = await Swal.fire({
      title: 'Delete Product?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, delete it!'
    })
    
    if (res.isConfirmed) {
      try {
        await deleteProduct(id)
        toast.success('Product moved to bin')
        refresh()
      } catch {
        toast.error('Failed to delete product')
      }
    }
  }

  const handleRestore = async (id) => {
    try {
      await restoreProduct(id)
      toast.success('Product restored successfully')
      refresh()
    } catch { toast.error('Failed to restore product') }
  }

  const handleHardDelete = async (id) => {
    const res = await Swal.fire({
      title: 'Permanently Delete?',
      text: 'This action cannot be undone and will erase it from the database forever.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete forever!'
    })
    
    if (res.isConfirmed) {
      try {
        await hardDeleteProduct(id)
        toast.success('Product permanently deleted')
        refresh()
      } catch { toast.error('Failed to delete permanently') }
    }
  }

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')
    } else {
      setSortBy(key)
      setSortOrder('DESC')
    }
    clearSelection()
    setPage(1)
  }

  const selectedCat = catData?.find(c => String(c.id) === String(catId))

  const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')
  const resolveUrl = (src) => {
    if (!src) return null
    if (src.startsWith('http') || src.startsWith('data:')) return src
    return `${API_ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      {/* ── Product Page Toolbar ─────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
           <div className="flex flex-col gap-1">
             <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                Products
                {showBin ? (
                  <span className="t-badge-red" style={{ fontSize: '12px', letterSpacing: '0.07em' }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    Recycle Bin
                  </span>
                ) : (
                  <span className="t-badge-gray" style={{ fontSize: '11px', letterSpacing: '0.07em' }}>
                    Inventory
                  </span>
                )}
             </h1>
             <p className="text-[14px] font-medium" style={{ color: 'var(--text-subtle)' }}>Manage global catalog, pricing, and visibility</p>
          </div>
          
          <div className="flex items-center gap-2">
             <button
               onClick={() => { clearSelection(); setShowBin(!showBin); setPage(1); }}
               className={`t-btn-bin ${showBin ? 'active' : ''}`}
             >
               <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
               {showBin ? 'Exit Bin' : 'View Bin'}
             </button>
             <button 
               onClick={() => setShowImport(true)}
               className="t-btn-surface"
             >
               <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
               Import
             </button>
             <Link 
               to="/products/new" 
               className="t-btn-dark"
             >
               <span className="text-lg leading-none">+</span> Add Product
             </Link>
          </div>
        </div>

        {/* Filters & Country Selection */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl t-toolbar">
           <div className="flex items-center gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{ color: 'var(--text-subtle)' }}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                </div>
                <input
                  type="search"
                  placeholder="Search SKU or Name..."
                  value={search}
                  onChange={(e) => { clearSelection(); setSearch(e.target.value); setPage(1); }}
                  className="t-search-input pl-9 pr-4"
                />
              </div>

              <div className="t-divider mx-1" />

              {/* Categorization */}
              <div className="flex items-center gap-2">
                <select 
                  value={catId} 
                  onChange={(e) => { clearSelection(); setCatId(e.target.value); setSubId(''); setPage(1); }}
                  className="t-select"
                >
                  <option value="">All Categories</option>
                  {catData?.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
                </select>

                <select 
                  value={subId} 
                  disabled={!selectedCat || !selectedCat.subcategories?.length}
                  onChange={(e) => { clearSelection(); setSubId(e.target.value); setPage(1); }}
                  className="t-select disabled:opacity-30"
                >
                  <option value="">All Subcategories</option>
                  {selectedCat?.subcategories?.map(s => <option key={s.id} value={s.id}>{s.name_en}</option>)}
                </select>
              </div>
           </div>

           {/* Country Selector */}
           <div className="t-pill-group">
             {COUNTRIES.map(c => (
                <button
                  key={c}
                  onClick={() => { clearSelection(); setCountry(c); setPage(1) }}
                  className={country === c ? 'active' : ''}
                >
                  <span className="mr-1.5">{FLAGS[c]}</span> {c}
                </button>
             ))}
           </div>
        </div>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}

      {/* Compact Table Unit */}
      <div className="flex flex-col rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        
        {/* Integrated Filter/Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
           <div className="flex items-center gap-4">
              <div className="text-[12px] font-bold uppercase tracking-widest px-1" style={{ color: 'var(--text-subtle)' }}>
                 Displaying <span style={{ color: 'var(--text)' }}>{data?.data?.length || 0}</span> of {data?.meta?.total || 0} Products
              </div>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <span className="text-[12px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-subtle)' }}>Show</span>
                 <select 
                   value={limit} 
                   onChange={(e) => { clearSelection(); setLimit(Number(e.target.value)); setPage(1); }}
                   className="t-select py-1 px-2 text-[12px]"
                 >
                   {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                 </select>
              </div>
           </div>
        </div>

        {selectedProductIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
            <div className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
              Selected <span style={{ color: 'var(--text)', fontWeight: 800 }}>{selectedProductIds.size}</span> product(s)
            </div>
            <div className="flex items-center gap-2">
              {!showBin ? (
                <button
                  disabled={bulkLoading}
                  onClick={bulkMoveToBin}
                  className="t-bulk-delete"
                >
                  {bulkLoading ? 'Moving...' : 'Move to Bin'}
                </button>
              ) : (
                <>
                  <button
                    disabled={bulkLoading}
                    onClick={bulkRestore}
                    className="t-bulk-restore"
                  >
                    {bulkLoading ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    disabled={bulkLoading}
                    onClick={bulkHardDelete}
                    className="t-bulk-delete"
                  >
                    {bulkLoading ? 'Deleting...' : 'Delete Forever'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Table Content */}
        {isLoading ? (
          <div className="flex flex-col">
             {[...Array(8)].map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 items-center p-3 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                   <div className="col-span-1 h-6 t-skeleton" />
                   <div className="col-span-1 h-6 t-skeleton" />
                   <div className="col-span-5 h-6 t-skeleton" />
                   <div className="col-span-2 h-6 t-skeleton" />
                   <div className="col-span-2 h-6 t-skeleton" />
                   <div className="col-span-1 h-6 t-skeleton" />
                </div>
             ))}
          </div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-[14px] font-medium" style={{ color: 'var(--text-subtle)' }}>No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[500px]">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-widest border-b" 
              style={{ color: 'var(--text-subtle)', borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
              <div className="col-span-1 cursor-pointer select-none" onClick={() => handleSort('id')}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={bulkLoading || visibleProductIds.length === 0}
                    onClick={(e) => e.stopPropagation()}
                    onChange={handleSelectAllVisible}
                    aria-label="Select all products"
                    style={{ accentColor: 'var(--color-brand)' }}
                  />
                  ID <SortIcon sortBy={sortBy} col="id" sortOrder={sortOrder} />
                </div>
              </div>
              <div className="col-span-1 cursor-pointer select-none" onClick={() => handleSort('fgd')}>FGD <SortIcon sortBy={sortBy} col="fgd" sortOrder={sortOrder} /></div>
              <div className="col-span-1 font-bold">Img</div>
              <div className="col-span-3 cursor-pointer select-none" onClick={() => handleSort('name_en')}>Product (EN / AR) <SortIcon sortBy={sortBy} col="name_en" sortOrder={sortOrder} /></div>
              <div className="col-span-3 cursor-pointer select-none" onClick={() => handleSort('category_name_en')}>Category <SortIcon sortBy={sortBy} col="category_name_en" sortOrder={sortOrder} /></div>
              <div className="col-span-1 cursor-pointer select-none" onClick={() => handleSort('price')}>Price <SortIcon sortBy={sortBy} col="price" sortOrder={sortOrder} /></div>
              {!showBin && <div className="col-span-1">Status</div>}
              <div className={showBin ? "col-span-2 text-right" : "col-span-1 text-right"}>Actions</div>
            </div>

            {data.data.map(p => {
              const primaryImg = p.media?.find(m => m.is_primary)?.url || p.media?.[0]?.url
              const isActiveLocal = p.is_active && (p.country_visibility === null || p.country_visibility)
              
              return (
                <div key={p.id} 
                  onClick={() => navigate(`/products/${p.id}`)}
                  className="grid grid-cols-12 gap-3 px-4 py-4 items-center border-b last:border-0 transition-colors cursor-pointer t-row-hover"
                  style={{ borderColor: 'var(--border)' }}>
                  
                  {/* ID */}
                  <div className="col-span-1 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.has(p.id)}
                      disabled={bulkLoading}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelected(p.id)}
                      aria-label={`Select product ${p.id}`}
                      style={{ accentColor: 'var(--color-brand)' }}
                    />
                    <span className="text-[13px] font-bold" style={{ color: 'var(--text-subtle)' }}>#{p.id}</span>
                  </div>

                  {/* FGD */}
                  <div className="col-span-1">
                    <span className="font-mono text-[12px] font-bold tracking-tight" style={{ color: 'var(--text-muted)' }}>
                      {p.fgd}
                    </span>
                  </div>

                  {/* IMG */}
                  <div className="col-span-1">
                    <div className="w-9 h-9 rounded-lg border overflow-hidden shadow-sm" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
                      {primaryImg ? (
                        <img src={resolveUrl(primaryImg)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[11px] italic" style={{ color: 'var(--text-subtle)' }}>No Img</div>
                      )}
                    </div>
                  </div>

                  {/* Name (EN/AR 50/50) */}
                  <div className="col-span-3 flex items-center gap-4">
                    <p className="w-1/2 font-bold text-[14px] truncate" style={{ color: 'var(--text)' }}>{p.name_en}</p>
                    <p className="w-1/2 text-[13px] truncate font-semibold text-right" dir="rtl" style={{ color: 'var(--text-subtle)' }}>{p.name_ar}</p>
                  </div>

                  {/* Cat */}
                  <div className="col-span-3 truncate">
                    <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>{p.category_name_en || '—'}</p>
                    {p.sub_name_en && <p className="text-[11px] truncate" style={{ color: 'var(--text-subtle)' }}>↳ {p.sub_name_en}</p>}
                  </div>

                  {/* Price */}
                  <div className="col-span-1">
                    {p.price ? (
                      <div className="flex flex-col">
                        <span className="font-bold text-[15px]" style={{ color: 'var(--text)' }}>
                          {Number(p.price.regular_price).toLocaleString(undefined, { minimumFractionDigits: p.price.decimal_places, maximumFractionDigits: p.price.decimal_places })}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-bold uppercase" style={{ color: 'var(--text-subtle)' }}>{p.price.currency_code}</span>
                          {p.price.sale_price && <span className="t-badge-red" style={{ fontSize: '11px', padding: '0 4px' }}>SALE</span>}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[12px] italic" style={{ color: 'var(--text-subtle)' }}>No Price</span>
                    )}
                  </div>

                  {/* Status Label (HIDDEN in Bin to save space) */}
                  {!showBin && (
                    <div className="col-span-1">
                      {isActiveLocal ? (
                        <span className="t-badge-green" style={{ fontSize: '11px', letterSpacing: '0.03em' }}>Active</span>
                      ) : (
                        <span className="t-badge-gray" style={{ fontSize: '11px', letterSpacing: '0.03em' }}>Hidden</span>
                      )}
                    </div>
                  )}

                  {/* Actions (Icon Buttons) */}
                  <div className={showBin ? "col-span-2 flex items-center justify-end gap-1.5" : "col-span-1 flex items-center justify-end gap-1.5"} onClick={(e) => e.stopPropagation()}>
                    {showBin ? (
                      <>
                        <button 
                          onClick={() => handleRestore(p.id)}
                          title="Restore Product"
                          className="t-bulk-restore text-[11px] hover:scale-105"
                        >
                          RESTORE
                        </button>
                        <button 
                          onClick={() => handleHardDelete(p.id)}
                          title="Delete Permanently"
                          className="t-bulk-delete text-[11px] hover:scale-105"
                        >
                          DELETE
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleToggle(p.id)}
                          title={isActiveLocal ? 'Hide Locally' : 'Show Locally'}
                          className={`p-1.5 rounded-lg transition-all hover:scale-110 ${isActiveLocal ? 't-action-amber' : 't-action-green'}`}
                        >
                          {isActiveLocal ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.822 7.822L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.352 7.962 7.248 4.5 12 4.5s8.648 3.462 9.964 7.178a1.012 1.012 0 010 .644C20.648 16.038 16.752 19.5 12 19.5s-8.648-3.462-9.964-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          )}
                        </button>
                        
                        <Link 
                          to={`/products/${p.id}`} 
                          title="Edit Product"
                          className="p-1.5 rounded-lg t-action-blue transition-all hover:scale-110"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </Link>
                        
                        <button 
                          onClick={() => handleDelete(p.id)} 
                          title="Move to Bin"
                          className="p-1.5 rounded-lg t-action-red transition-all hover:scale-110"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {/* Enhanced Pagination Footer */}
        {data?.meta && (
          <div className="flex flex-wrap items-center justify-between p-3 border-t gap-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
            <div className="flex items-center gap-6">
               <p className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
                 Page <span className="font-bold" style={{ color: 'var(--text)' }}>{page}</span> of {data.meta.pages}
               </p>
               <div className="flex items-center gap-2">
                 <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-subtle)' }}>Jump</span>
                 <input 
                   type="number" 
                   min="1" 
                   max={data.meta.pages}
                   value={page}
                   onChange={(e) => {
                     const p = Number(e.target.value)
                     if (p >= 1 && p <= data.meta.pages) { clearSelection(); setPage(p) }
                   }}
                   className="t-page-jump"
                 />
               </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                disabled={page === 1} 
                onClick={() => { clearSelection(); setPage(p => p - 1) }} 
                className="t-page-btn"
              >
                ← Prev
              </button>
              
              <div className="flex items-center mx-1">
                 {[...Array(Math.min(5, data.meta.pages))].map((_, i) => {
                    let pNum = i + 1
                    if (data.meta.pages > 5) {
                      if (page > 3) pNum = page - 2 + i
                      if (page > data.meta.pages - 2) pNum = data.meta.pages - 4 + i
                    }
                    if (pNum < 1 || pNum > data.meta.pages) return null
                    return (
                      <button 
                        key={pNum}
                        onClick={() => { clearSelection(); setPage(pNum) }}
                        className={`t-page-num mx-0.5 ${page === pNum ? 'active' : ''}`}
                      >
                        {pNum}
                      </button>
                    )
                 })}
              </div>

              <button 
                disabled={page >= data.meta.pages} 
                onClick={() => { clearSelection(); setPage(p => p + 1) }} 
                className="t-page-btn"
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

export default function Products() {
  return (
    <Routes>
      <Route index   element={<ProductList />} />
      <Route path=":id"  element={<ProductForm />} />
      <Route path="new"  element={<ProductForm />} />
    </Routes>
  )
}
