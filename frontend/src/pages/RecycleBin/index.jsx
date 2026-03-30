import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import { 
  getProducts, restoreProduct, hardDeleteProduct,
  getCategories, restoreCategory, hardDeleteCategory, restoreSubcategory, hardDeleteSubcategory,
  getCampaigns, restoreCampaign, hardDeleteCampaign
} from '../../api'

export default function RecycleBin() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('products') // products | categories | campaigns
  const [selectedCampaignIds, setSelectedCampaignIds] = useState(() => new Set())
  const [bulkLoading, setBulkLoading] = useState(false)

  const clearSelection = () => {
    setSelectedCampaignIds(new Set())
    setBulkLoading(false)
  }

  // ── Data Fetching ────────────────────────────────────────────────────────
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ['recycle-bin-products'],
    queryFn: () => getProducts({ status: 'bin', admin: true, limit: 1000 }),
    enabled: tab === 'products'
  })

  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ['recycle-bin-categories'],
    queryFn: () => getCategories({ status: 'bin', admin: true }),
    enabled: tab === 'categories'
  })

  const { data: campaignsData, isLoading: loadingCampaigns } = useQuery({
    queryKey: ['recycle-bin-campaigns'],
    queryFn: () => getCampaigns({ deleted_status: 'bin', limit: 1000 }),
    enabled: tab === 'campaigns'
  })

  const refresh = () => qc.invalidateQueries({ queryKey: [`recycle-bin-${tab}`] })

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleRestore = async (id, type) => {
    try {
      if (type === 'product') await restoreProduct(id)
      else if (type === 'category') await restoreCategory(id)
      else if (type === 'subcategory') await restoreSubcategory(id)
      else if (type === 'campaign') await restoreCampaign(id)
      
      toast.success(`${type} restored successfully`)
      refresh()
    } catch (err) {
      toast.error(err?.response?.data?.error || `Failed to restore ${type}`)
    }
  }

  const handleHardDelete = async (id, type, name) => {
    const res = await Swal.fire({
      title: 'Permanently Delete?',
      text: `Are you sure you want to permanently delete "${name || 'this item'}"? This action cannot be undone and will erase it from the database forever.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, delete forever!'
    })
    
    if (res.isConfirmed) {
      try {
        if (type === 'product') await hardDeleteProduct(id)
        else if (type === 'category') await hardDeleteCategory(id)
        else if (type === 'subcategory') await hardDeleteSubcategory(id)
        else if (type === 'campaign') await hardDeleteCampaign(id)
        
        toast.success(`${type} permanently deleted`)
        refresh()
      } catch (err) {
        toast.error(err?.response?.data?.error || `Failed to delete ${type}`)
      }
    }
  }

  // ── Render Helpers ───────────────────────────────────────────────────────
  const renderActions = (id, type, name) => (
    <div className="flex items-center justify-end gap-2">
      <button 
        onClick={() => handleRestore(id, type)}
        title="Restore"
        className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all border border-emerald-200"
      >
        Restore
      </button>
      <button 
        onClick={() => handleHardDelete(id, type, name)}
        title="Delete Permanently"
        className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-all border border-red-200"
      >
        Delete Forever
      </button>
    </div>
  )

  // Campaigns bulk actions helpers (only for campaigns tab)
  const visibleCampaignIds = (campaignsData?.data || []).map(c => c.id)
  const allVisibleCampaignSelected = visibleCampaignIds.length > 0 && visibleCampaignIds.every(id => selectedCampaignIds.has(id))
  const toggleSelectedCampaign = (id) => {
    setSelectedCampaignIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const handleSelectAllVisibleCampaigns = () => {
    setSelectedCampaignIds(prev => {
      const next = new Set(prev)
      if (allVisibleCampaignSelected) {
        visibleCampaignIds.forEach(id => next.delete(id))
      } else {
        visibleCampaignIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  const bulkRestoreCampaigns = async () => {
    const ids = Array.from(selectedCampaignIds)
    if (!ids.length) return

    const res = await Swal.fire({
      title: 'Restore selected campaigns?',
      text: 'Selected campaigns will be restored from the recycle bin.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, restore!'
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

  const bulkHardDeleteCampaigns = async () => {
    const ids = Array.from(selectedCampaignIds)
    if (!ids.length) return

    const res = await Swal.fire({
      title: 'Permanently delete selected campaigns?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: 'var(--surface-2)',
      confirmButtonText: 'Yes, delete forever!'
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

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-20 opacity-50">
      <svg className="w-12 h-12 mb-4 text-black/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
      <p className="text-[13px] font-medium">Recycle bin is empty</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex flex-col gap-1">
         <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            Recycle Bin
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 uppercase tracking-widest leading-none">
              Deleted Items
            </span>
         </h1>
         <p className="text-[12px] font-medium opacity-40">Restore or permanently purge items deleted from your modules.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-black/5 w-fit">
        <button
          onClick={() => { clearSelection(); setTab('products') }}
          className={`px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${tab === 'products' ? 'bg-white text-black shadow-sm' : 'text-black/50 hover:text-black/70'}`}
        >
          Products
        </button>
        <button
          onClick={() => { clearSelection(); setTab('categories') }}
          className={`px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${tab === 'categories' ? 'bg-white text-black shadow-sm' : 'text-black/50 hover:text-black/70'}`}
        >
          Categories
        </button>
        <button
          onClick={() => { clearSelection(); setTab('campaigns') }}
          className={`px-4 py-2 text-[12px] font-bold rounded-lg transition-all ${tab === 'campaigns' ? 'bg-white text-black shadow-sm' : 'text-black/50 hover:text-black/70'}`}
        >
          Campaigns
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-col rounded-xl overflow-hidden border bg-white shadow-sm" style={{ borderColor: 'var(--border)' }}>
        
        {/* PRODUCTS */}
        {tab === 'products' && (
          loadingProducts ? <div className="p-10 text-center opacity-50">Loading...</div> : 
          !productsData?.data?.length ? emptyState : (
            <div className="overflow-x-auto">
              <div className="grid grid-cols-12 gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b bg-black/1" style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}>
                <div className="col-span-2">ID / FGD</div>
                <div className="col-span-6">Product Name (EN)</div>
                <div className="col-span-4 text-right">Actions</div>
              </div>
              {productsData.data.map(p => (
                <div key={p.id} className="grid grid-cols-12 gap-3 px-4 py-4 items-center border-b last:border-0 hover:bg-black/2" style={{ borderColor: 'var(--border)' }}>
                  <div className="col-span-2 text-[11px] font-mono font-bold opacity-60">#{p.id} · {p.fgd}</div>
                  <div className="col-span-6 text-[12px] font-bold">{p.name_en}</div>
                  <div className="col-span-4">{renderActions(p.id, 'product', p.name_en)}</div>
                </div>
              ))}
            </div>
          )
        )}

        {/* CATEGORIES */}
        {tab === 'categories' && (
          loadingCategories ? <div className="p-10 text-center opacity-50">Loading...</div> : 
          !categoriesData?.length ? emptyState : (
            <div className="overflow-x-auto">
              {categoriesData.map(c => (
                <div key={c.id} className="flex flex-col border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between p-4 bg-black/2">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-black text-white rounded uppercase">Category</span>
                      <span className="text-[13px] font-bold">{c.name_en}</span>
                    </div>
                    {renderActions(c.id, 'category', c.name_en)}
                  </div>
                  {/* SUBCATEGORIES if any in bin */}
                  {c.subcategories?.filter(s => s.deleted_status === 'bin')?.length > 0 && (
                    <div className="pl-12 pr-4 py-2 bg-red-50/30 flex flex-col gap-2">
                       {c.subcategories.filter(s => s.deleted_status === 'bin').map(sub => (
                         <div key={sub.id} className="flex items-center justify-between py-2 border-b border-black/5 last:border-0">
                           <div className="flex items-center gap-2">
                             <span className="text-[9px] font-bold px-2 py-0.5 bg-black/10 rounded uppercase">Subcategory</span>
                             <span className="text-[12px] font-bold opacity-80">{sub.name_en}</span>
                           </div>
                           {renderActions(sub.id, 'subcategory', sub.name_en)}
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* CAMPAIGNS */}
        {tab === 'campaigns' && (
          loadingCampaigns ? <div className="p-10 text-center opacity-50">Loading...</div> : 
          !campaignsData?.data?.length ? emptyState : (
            <div className="overflow-x-auto">
              {selectedCampaignIds.size > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b bg-black/1" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                  <div className="text-[12px] font-medium opacity-70">
                    Selected <span style={{ color: 'var(--text)', fontWeight: 800 }}>{selectedCampaignIds.size}</span> campaign(s)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={bulkLoading}
                      onClick={bulkRestoreCampaigns}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-50"
                    >
                      {bulkLoading ? 'Restoring...' : 'Restore'}
                    </button>
                    <button
                      disabled={bulkLoading}
                      onClick={bulkHardDeleteCampaigns}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50"
                    >
                      {bulkLoading ? 'Deleting...' : 'Delete Forever'}
                    </button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-12 gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-widest border-b bg-black/1" style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}>
                <div className="col-span-1 flex items-center justify-start">
                  <input
                    type="checkbox"
                    checked={allVisibleCampaignSelected}
                    onChange={handleSelectAllVisibleCampaigns}
                    disabled={bulkLoading || visibleCampaignIds.length === 0}
                    aria-label="Select all campaigns in recycle bin"
                    style={{ accentColor: 'var(--color-brand)' }}
                  />
                </div>
                <div className="col-span-2">Type</div>
                <div className="col-span-5">Campaign Name</div>
                <div className="col-span-4 text-right">Actions</div>
              </div>
              {campaignsData.data.map(c => (
                <div key={c.id} className="grid grid-cols-12 gap-3 px-4 py-4 items-center border-b last:border-0 hover:bg-black/2" style={{ borderColor: 'var(--border)' }}>
                  <div className="col-span-1 flex items-center justify-start">
                    <input
                      type="checkbox"
                      checked={selectedCampaignIds.has(c.id)}
                      onChange={() => toggleSelectedCampaign(c.id)}
                      disabled={bulkLoading}
                      aria-label={`Select campaign ${c.name_en}`}
                      style={{ accentColor: 'var(--color-brand)' }}
                    />
                  </div>
                  <div className="col-span-2 text-[10px] font-bold uppercase tracking-wider opacity-50">{c.type}</div>
                  <div className="col-span-5 text-[12px] font-bold">{c.name_en}</div>
                  <div className="col-span-4">{renderActions(c.id, 'campaign', c.name_en)}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
