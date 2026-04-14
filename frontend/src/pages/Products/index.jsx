import { Routes, Route, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getProducts, toggleProduct, deleteProduct, getCountries, getCategories } from '../../api'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import { useState, useEffect } from 'react'
import { useDebounce } from 'use-debounce'
import ProductForm from './ProductForm'
import ImportModal from './ImportModal'

const getFlagEmoji = (countryCode) => {
  if (!countryCode) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const FILTER_KEY = 'ahmed_product_filters'

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

  const [country, setCountry] = useState(() => searchParams.get('country') || filters?.country || 'AE')
  const [page, setPage]       = useState(() => Number(searchParams.get('page')) || filters?.page || 1)
  const [search, setSearch]   = useState(() => searchParams.get('search') || filters?.search || '')
  const [debouncedSearch]     = useDebounce(search, 500)
  const [showImport, setShowImport] = useState(false)
  const [selectedProductIds, setSelectedProductIds] = useState(() => new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  
  const [catId, setCatId]         = useState(() => searchParams.get('catId') || filters?.catId || '')
  const [subId, setSubId]         = useState(() => searchParams.get('subId') || filters?.subId || '')
  const [sortBy, setSortBy]       = useState(() => searchParams.get('sortBy') || filters?.sortBy || 'id')
  const [sortOrder, setSortOrder] = useState(() => searchParams.get('sortOrder') || filters?.sortOrder || 'DESC')
  const [limit, setLimit]         = useState(() => Number(searchParams.get('limit')) || filters?.limit || 10)

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
    localStorage.setItem(FILTER_KEY, JSON.stringify({ country, page, search, catId, subId, sortBy, sortOrder, limit }))
  }, [country, page, search, catId, subId, sortBy, sortOrder, limit, setSearchParams])

  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn:  getCountries,
    select:   res => res.data?.data || res.data || [],
  })

  const { data: catData } = useQuery({
    queryKey: ['categories-admin'],
    queryFn:  () => getCategories({ admin: true }),
    select:   res => res.data?.data || res.data || [],
  })

  const { data, isLoading } = useQuery({
    queryKey: ['products', country, page, debouncedSearch, catId, subId, sortBy, sortOrder, limit],
    queryFn:  () => getProducts({ 
      country, page, limit, search: debouncedSearch, 
      category: catId, subcategory: subId, sort: sortBy, order: sortOrder, admin: true 
    }),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['products'] })
  const clearSelection = () => { setSelectedProductIds(new Set()); setBulkLoading(false); }

  const handleToggle = async (id) => { 
    try {
      await toggleProduct(id, country)
      toast.success(`${country} visibility updated`)
      refresh()
    } catch { toast.error('Failed to update visibility') }
  }

  const handleDelete = async (id) => {
    const res = await Swal.fire({
      title: 'Delete Product Permanently?',
      text: 'This will remove the product and its data from all bundles and campaigns. This action is irreversible.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, delete forever'
    })
    
    if (res.isConfirmed) {
      try {
        await deleteProduct(id)
        toast.success('Product deleted')
        refresh()
      } catch { toast.error('Failed to delete product') }
    }
  }

  const bulkDelete = async () => {
    const ids = Array.from(selectedProductIds)
    if (!ids.length) return
    const res = await Swal.fire({
      title: 'Delete Selected Products?',
      text: `Are you sure you want to permanently delete ${ids.length} products?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete them'
    })
    if (!res.isConfirmed) return
    setBulkLoading(true)
    const results = await Promise.allSettled(ids.map(id => deleteProduct(id)))
    setBulkLoading(false)
    const ok = results.filter(r => r.status === 'fulfilled').length
    if (ok) toast.success(`Deleted ${ok} products`)
    clearSelection()
    refresh()
  }

  const handleSort = (key) => {
    if (sortBy === key) setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')
    else { setSortBy(key); setSortOrder('DESC'); }
    clearSelection(); setPage(1);
  }

  const selectedCat = catData?.find(c => String(c.id) === String(catId))
  const visibleProductIds = (data?.data || []).map(p => p.id)
  const allVisibleSelected = visibleProductIds.length > 0 && visibleProductIds.every(id => selectedProductIds.has(id))
  
  const toggleSelected = (id) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev); 
      if (next.has(id)) next.delete(id); else next.add(id); 
      return next;
    })
  }
  const handleSelectAllVisible = () => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleProductIds.forEach(id => next.delete(id))
      else visibleProductIds.forEach(id => next.add(id))
      return next;
    })
  }

  const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')
  const resolveUrl = (src) => {
    if (!src) return null
    if (src.startsWith('http') || src.startsWith('data:')) return src
    return `${API_ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`
  }

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              Products <span className="t-badge-gray text-[11px] uppercase tracking-wider">Inventory</span>
            </h1>
            <p className="text-[14px] font-medium opacity-60">Manage global catalog, pricing, and visibility</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)} className="t-btn-surface">Import</button>
            <Link to="/products/new" className="t-btn-dark">+ Add Product</Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl t-toolbar">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <input
                type="search"
                placeholder="Search SKU or Name..."
                value={search}
                onChange={(e) => { clearSelection(); setSearch(e.target.value); setPage(1); }}
                className="t-search-input pl-4 pr-4"
              />
            </div>
            <div className="flex items-center gap-2">
              <select value={catId} onChange={(e) => { clearSelection(); setCatId(e.target.value); setSubId(''); setPage(1); }} className="t-select">
                <option value="">All Categories</option>
                {catData?.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
              </select>
              <select value={subId} disabled={!selectedCat?.subcategories?.length} onChange={(e) => { clearSelection(); setSubId(e.target.value); setPage(1); }} className="t-select disabled:opacity-30">
                <option value="">All Subcategories</option>
                {selectedCat?.subcategories?.map(s => <option key={s.id} value={s.id}>{s.name_en}</option>)}
              </select>
            </div>
          </div>
          <div className="t-pill-group">
            {countriesData?.map(c => (
              <button key={c.code} onClick={() => { clearSelection(); setCountry(c.code); setPage(1) }} className={country === c.code ? 'active' : ''}>
                <span className="mr-1.5">{getFlagEmoji(c.code)}</span> {c.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}

      <div className="flex flex-col rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
          <div className="text-[12px] font-bold uppercase tracking-widest opacity-60">
            Displaying <span className="opacity-100">{data?.data?.length || 0}</span> of {data?.meta?.total || 0} Products
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold uppercase tracking-widest opacity-60">Show</span>
            <select value={limit} onChange={(e) => { clearSelection(); setLimit(Number(e.target.value)); setPage(1); }} className="t-select py-1 px-2 text-[12px]">
              {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {selectedProductIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
            <div className="text-[13px] font-medium opacity-70">
              Selected <strong>{selectedProductIds.size}</strong> product(s)
            </div>
            <button disabled={bulkLoading} onClick={bulkDelete} className="t-bulk-delete">
              {bulkLoading ? 'Deleting...' : 'Delete Selected'}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="p-10 text-center opacity-50">Loading products...</div>
        ) : !data?.data?.length ? (
          <div className="py-20 text-center opacity-50">No products found</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-widest border-b opacity-60 bg-surface-2" style={{ borderColor: 'var(--border)' }}>
              <div className="col-span-1 flex items-center gap-2">
                <input type="checkbox" checked={allVisibleSelected} onChange={handleSelectAllVisible} /> ID
              </div>
              <div className="col-span-1 cursor-pointer" onClick={() => handleSort('fgd')}>FGD <SortIcon sortBy={sortBy} col="fgd" sortOrder={sortOrder} /></div>
              <div className="col-span-1">Img</div>
              <div className="col-span-3 cursor-pointer" onClick={() => handleSort('name_en')}>Product <SortIcon sortBy={sortBy} col="name_en" sortOrder={sortOrder} /></div>
              <div className="col-span-3">Category</div>
              <div className="col-span-1 cursor-pointer" onClick={() => handleSort('price')}>Price <SortIcon sortBy={sortBy} col="price" sortOrder={sortOrder} /></div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {data.data.map(p => {
              const primaryImg = p.media?.find(m => m.is_primary)?.url || p.media?.[0]?.url
              const isActiveLocal = p.is_active && (p.country_visibility === null || p.country_visibility)
              return (
                <div key={p.id} onClick={() => navigate(`/products/${p.id}`)} className="grid grid-cols-12 gap-3 px-4 py-4 items-center border-b last:border-0 hover:bg-surface-2 cursor-pointer transition-colors" style={{ borderColor: 'var(--border)' }}>
                  <div className="col-span-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedProductIds.has(p.id)} onChange={() => toggleSelected(p.id)} />
                    <span className="text-[13px] font-bold opacity-60">#{p.id}</span>
                  </div>
                  <div className="col-span-1 font-mono text-[11px] opacity-60">{p.fgd}</div>
                  <div className="col-span-1">
                    <div className="w-9 h-9 rounded-lg border bg-surface-2 overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                      {primaryImg ? <img src={resolveUrl(primaryImg)} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] opacity-40">N/A</div>}
                    </div>
                  </div>
                  <div className="col-span-3">
                    <p className="font-bold text-[14px] truncate">{p.name_en}</p>
                    <p className="text-[12px] opacity-60 truncate" dir="rtl">{p.name_ar}</p>
                  </div>
                  <div className="col-span-3 truncate text-[13px]">
                    <p className="font-semibold">{p.category_name_en}</p>
                    {p.sub_name_en && <p className="text-[11px] opacity-60">↳ {p.sub_name_en}</p>}
                  </div>
                  <div className="col-span-1">
                    {p.price ? (
                      <div>
                        <p className="font-bold text-[14px]">{Number(p.price.regular_price).toLocaleString(undefined, { minimumFractionDigits: p.price.decimal_places })}</p>
                        <p className="text-[10px] font-bold uppercase opacity-60">{p.price.currency_code}</p>
                      </div>
                    ) : <span className="text-[11px] italic opacity-40">No Price</span>}
                  </div>
                  <div className="col-span-1">
                    {isActiveLocal ? <span className="t-badge-green text-[10px]">Active</span> : <span className="t-badge-gray text-[10px]">Hidden</span>}
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleToggle(p.id)} className={`p-1.5 rounded-lg transition-colors ${isActiveLocal ? 'hover:bg-amber-100 text-amber-600' : 'hover:bg-emerald-100 text-emerald-600'}`}>
                      {isActiveLocal ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                    <Link to={`/products/${p.id}`} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </Link>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {data?.meta && (
          <div className="flex flex-wrap items-center justify-between p-3 border-t gap-4 bg-surface-2" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[12px] opacity-60">Page <strong>{page}</strong> of {data.meta.pages}</p>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => { clearSelection(); setPage(p => p - 1) }} className="t-page-btn">← Prev</button>
              {[...Array(Math.min(5, data.meta.pages))].map((_, i) => {
                let pNum = i + 1;
                if (data.meta.pages > 5) {
                  if (page > 3) pNum = page - 2 + i;
                  if (page > data.meta.pages - 2) pNum = data.meta.pages - 4 + i;
                }
                if (pNum < 1 || pNum > data.meta.pages) return null;
                return (
                  <button key={pNum} onClick={() => { clearSelection(); setPage(pNum) }} className={`t-page-num ${page === pNum ? 'active' : ''}`}>{pNum}</button>
                )
              })}
              <button disabled={page >= data.meta.pages} onClick={() => { clearSelection(); setPage(p => p + 1) }} className="t-page-btn">Next →</button>
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
      <Route index element={<ProductList />} />
      <Route path=":id" element={<ProductForm />} />
      <Route path="new" element={<ProductForm />} />
    </Routes>
  )
}
