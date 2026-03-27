import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getBundles, deleteBundle } from '../../api'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'

export default function Bundles() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expandedRow, setExpandedRow] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1) 
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const { data: res, isLoading, refetch } = useQuery({ 
    queryKey: ['bundles', debouncedSearch, page], 
    queryFn: () => getBundles({ q: debouncedSearch, page, limit: 10 }),
    keepPreviousData: true
  })

  const bundles = res?.data || []
  const pagination = res?.pagination || { total: 0, page: 1, limit: 10, pages: 1 }

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
    } catch {
      toast.error('Failed to remove bundle')
    }
  }

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id)
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800">Bundles & Gift-Sets</h1>
          <p className="text-slate-500 font-medium mt-1">Manage grouped products and their components in a single view.</p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
        <div className="relative flex-1 group">
          <input 
            type="text" 
            placeholder="Search bundles by name or FGD code..." 
            className="w-full h-11 pl-12 pr-4 rounded-xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all font-medium text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-brand transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-[12px] font-bold uppercase tracking-widest whitespace-nowrap">
           Showing {bundles.length} of {pagination.total} results
        </div>
      </div>

      {/* Main List Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden min-h-[400px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
               <th className="w-16 p-4"></th>
               <th className="p-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Bundle Product</th>
               <th className="p-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">FGD Code</th>
               <th className="p-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Components</th>
               <th className="p-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
               <tr><td colSpan="5" className="p-20 text-center text-slate-300 animate-pulse font-bold italic">Loading bundle data...</td></tr>
            ) : bundles.length === 0 ? (
               <tr><td colSpan="5" className="p-20 text-center text-slate-300 font-bold">No bundles found matching your criteria.</td></tr>
            ) : bundles.map(bundle => (
              <>
                <tr 
                  key={bundle.bundle_id} 
                  className={`group cursor-pointer transition-colors ${expandedRow === bundle.bundle_id ? 'bg-brand/5' : 'hover:bg-slate-50/80'}`}
                  onClick={() => toggleRow(bundle.bundle_id)}
                >
                  <td className="p-4 text-center">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${expandedRow === bundle.bundle_id ? 'bg-brand text-white rotate-180' : 'bg-slate-100 text-slate-400'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl shadow-inner border border-white">🎁</div>
                       <div>
                          <p className="text-sm font-black text-slate-800 group-hover:text-brand transition-colors">{bundle.name_en}</p>
                          <p className="text-[11px] text-slate-400 font-medium" dir="rtl">{bundle.name_ar}</p>
                       </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-[11px] px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-bold border border-slate-200">
                       {bundle.fgd}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                       <span className="text-sm font-black text-slate-700">{bundle.items?.length || 0}</span>
                       <span className="text-[11px] font-bold text-slate-400 uppercase">items</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                       <button 
                         onClick={() => handleDelete(bundle.product_id)}
                         className="w-9 h-9 flex items-center justify-center rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-all border border-transparent hover:border-red-100"
                       >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                       </button>
                    </div>
                  </td>
                </tr>
                {/* Expanded Row */}
                {expandedRow === bundle.bundle_id && (
                  <tr>
                    <td colSpan="5" className="p-0 border-b border-slate-100">
                       <div className="p-8 bg-slate-50/50 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
                          <div className="flex items-center justify-between">
                             <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Bundle Composition</h4>
                             <span className="text-[10px] font-bold text-slate-300">#{bundle.bundle_id}</span>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                             {bundle.items?.map((item, idx) => (
                                <div key={item.id} className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                   <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[11px] font-black text-slate-300">
                                      {idx + 1}
                                   </div>
                                   <div className="flex-1">
                                      <p className="text-[13px] font-black text-slate-700">{item.product_id ? item.product_name_en : item.component_name_en}</p>
                                      {item.product_fgd && <span className="text-[10px] font-mono text-slate-400">#{item.product_fgd}</span>}
                                   </div>
                                   <div className="px-4 py-1.5 rounded-xl bg-brand/5 border border-brand/10">
                                      <span className="text-[12px] font-black text-brand">× {item.qty}</span>
                                   </div>
                                   <div className="w-24">
                                      {item.product_id ? (
                                        <span className="text-[9px] font-black uppercase tracking-tighter text-blue-500 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">Linked</span>
                                      ) : (
                                        <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">Standalone</span>
                                      )}
                                   </div>
                                </div>
                             ))}
                             {!bundle.items?.length && (
                                <div className="p-8 text-center text-slate-300 font-bold italic text-sm">No items configured for this bundle.</div>
                             )}
                          </div>
                       </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
           <button 
             disabled={page === 1}
             onClick={() => setPage(p => Math.max(1, p - 1))}
             className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 disabled:opacity-30 hover:border-brand hover:text-brand transition-all shadow-sm"
           >
              ←
           </button>
           {[...Array(pagination.pages)].map((_, i) => (
             <button 
               key={i+1}
               onClick={() => setPage(i + 1)}
               className={`w-10 h-10 rounded-xl font-black text-sm transition-all shadow-sm ${page === i + 1 ? 'bg-brand text-white scale-110 shadow-lg shadow-brand/20' : 'border border-slate-200 bg-white text-slate-400 hover:bg-slate-50'}`}
             >
               {i + 1}
             </button>
           ))}
           <button 
             disabled={page === pagination.pages}
             onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
             className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 disabled:opacity-30 hover:border-brand hover:text-brand transition-all shadow-sm"
           >
              →
           </button>
        </div>
      )}
    </div>
  )
}

