import { Routes, Route, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getProducts, toggleProduct, deleteProduct } from '../../api'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import { useState } from 'react'
import { useDebounce } from 'use-debounce'
import ProductForm from './ProductForm'
import ImportModal from './ImportModal'

const COUNTRIES = ['AE','SA','QA','BH','KW','OM']
const FLAGS     = { AE:'🇦🇪', SA:'🇸🇦', QA:'🇶🇦', BH:'🇧🇭', KW:'🇰🇼', OM:'🇴🇲' }

function StatusBadge({ active }) {
  return active
    ? <span className="t-badge-active"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active</span>
    : <span className="t-badge-inactive"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Inactive</span>
}

function ProductList() {
  const qc = useQueryClient()
  const [country, setCountry] = useState('AE')
  const [page, setPage]       = useState(1)
  const [search, setSearch]   = useState('')
  const [debouncedSearch] = useDebounce(search, 500)
  const [showImport, setShowImport] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['products', country, page, debouncedSearch],
    queryFn:  () => getProducts({ country, page, limit: 20, search: debouncedSearch, admin: true }),
  })

  // Prevent multiple refetches by using QC invalidate
  const refresh = () => qc.invalidateQueries({ queryKey: ['products'] })

  const handleToggle = async (id) => { 
    await toggleProduct(id, country)
    toast.success(`${country} visibility toggled`)
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
        toast.success('Product deleted')
        refresh()
      } catch {
        toast.error('Failed to delete product')
      }
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-0">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Products</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {data?.data?.meta?.total ?? data?.meta?.total ?? '—'} total · showing {FLAGS[country]} {country}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Country selector */}
          <div className="flex gap-1.5 p-1.5 rounded-xl transition-all" style={{ backgroundColor: 'var(--surface)' }}>
            {COUNTRIES.map(c => (
              <button
                key={c}
                onClick={() => { setCountry(c); setPage(1) }}
                className="text-[12px] px-3.5 py-1.5 rounded-lg font-bold tracking-wide transition-all shadow-sm"
                style={country === c
                  ? { backgroundColor: 'var(--color-brand)', color: '#fff', transform: 'translateY(-1px)' }
                  : { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }
                }
              >
                {FLAGS[c]} <span className="ml-1">{c}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--surface)'}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Import Excel
          </button>
          <Link to="/products/new" className="t-btn-primary">
            <span className="text-lg leading-none">+</span> New Product
          </Link>
        </div>
      </div>
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}

      <div className="flex items-center justify-between mb-4 gap-4">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <input
            type="search"
            placeholder="Search by name or FGD code..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-[13px] outline-none transition-all placeholder:text-gray-400"
            style={{ 
              backgroundColor: 'var(--surface)', 
              border: '1px solid var(--border)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
            }}
          />
        </div>
        
        <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
          {data?.data?.length || 0} items on this page
        </p>
      </div>

      {/* Grid Layout */}
      <div className="flex flex-col gap-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm rounded-xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>Loading products…</div>
        ) : !data?.data?.length ? (
          <div className="flex flex-col items-center justify-center h-40 rounded-xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
            <p className="text-[14px]">No products found for {FLAGS[country]} {country}</p>
          </div>
        ) : (
          <>
            {/* Header Row (Hidden on very small screens, acts as grid guide) */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>
              <div className="col-span-1">FGD</div>
              <div className="col-span-4">Product</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2">Price</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {/* Product Cards */}
            {data.data.map(p => (
              <div key={p.id} className="group grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-xl transition-all duration-200"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--border-soft)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.05)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                
                {/* FGD Code */}
                <div className="col-span-1 flex items-center">
                  <span className="font-mono text-[11px] px-2 py-1 rounded-md font-bold tracking-wide"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand) 8%, transparent)', color: 'var(--color-brand)' }}>
                    {p.fgd}
                  </span>
                </div>

                {/* Name */}
                <div className="col-span-4 flex flex-col justify-center">
                  <p className="font-bold text-[14px] leading-tight mb-1" style={{ color: 'var(--text)' }}>{p.name_en}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[12px] font-medium" dir="rtl" style={{ color: 'var(--text-muted)' }}>{p.name_ar}</p>
                    {p.is_featured === 1 && (
                       <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                         style={{ backgroundColor: 'color-mix(in srgb, #f59e0b 15%, transparent)', color: '#d97706' }}>
                         Featured
                       </span>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div className="col-span-2 flex flex-col justify-center">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{p.category_name_en || '—'}</p>
                  {p.sub_name_en && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>↳ {p.sub_name_en}</p>}
                </div>

                {/* Price */}
                <div className="col-span-2 flex items-center">
                  {p.price ? (
                    <div className="flex flex-col">
                      <span className="font-bold text-[14px]" style={{ color: 'var(--text)' }}>
                        {Number(p.price.regular_price).toLocaleString(undefined, { minimumFractionDigits: p.price.decimal_places, maximumFractionDigits: p.price.decimal_places })}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        {p.price.currency_code}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold px-2 py-1 rounded-md"
                      style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-subtle)' }}>
                      Not Priced
                    </span>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-2 flex items-center">
                   <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wider font-bold transition-colors"
                     style={(p.is_active && (p.country_visibility === null || p.country_visibility))
                       ? { backgroundColor: 'color-mix(in srgb, #10b981 10%, transparent)', color: '#10b981' }
                       : { backgroundColor: 'var(--surface-2)', color: 'var(--text-subtle)' }
                     }>
                     <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: (p.is_active && (p.country_visibility === null || p.country_visibility)) ? '#10b981' : 'var(--border)' }} />
                     {!p.is_active ? 'Disabled (Core)' : p.country_visibility === 0 ? 'Hidden (Local)' : 'Active'}
                   </span>
                </div>

                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/products/${p.id}`} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors" title="Edit Product">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </Link>
                  <button onClick={() => handleToggle(p.id)} className="p-1.5 rounded-lg hover:bg-black/5 transition-colors" title="Toggle Visibility">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {data?.meta && data.meta.pages > 1 && (
        <div className="flex items-center justify-between mt-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--surface)' }}>
          <p className="text-[13px] font-medium" style={{ color: 'var(--text-muted)' }}>
            Page <span className="font-bold text-[14px]" style={{ color: 'var(--text)' }}>{page}</span> of {data.meta.pages}
          </p>
          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)} 
              className="text-[12px] px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-40"
              style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)' }}
            >
              ← Previous
            </button>
            <button 
              disabled={page >= data.meta.pages} 
              onClick={() => setPage(p => p + 1)} 
              className="text-[12px] px-4 py-2 rounded-lg font-bold transition-all disabled:opacity-40"
              style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
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
