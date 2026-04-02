import { useState, useEffect } from 'react'
import { getProducts, createBundle, updateBundle } from '../../api'
import { useDebounce } from 'use-debounce'
import toast from 'react-hot-toast'

export default function BundleForm({ bundle, onClose, onRefresh }) {
  const isEditing = !!bundle
  const [loading, setLoading] = useState(false)
  const [searchingParent, setSearchingParent] = useState(false)
  const [searchingItem, setSearchingItem] = useState(false)
  
  // Parent Product State
  const [parentSearch, setParentSearch] = useState('')
  const [debouncedParentSearch] = useDebounce(parentSearch, 400)
  const [parentResults, setParentResults] = useState([])
  const [selectedParent, setSelectedParent] = useState(bundle ? { id: bundle.product_id, name_en: bundle.name_en, fgd: bundle.fgd } : null)

  // Bundle Items State
  const [items, setItems] = useState(bundle?.items?.map(it => ({
    id: it.id,
    product_id: it.product_id,
    component_name_en: it.component_name_en || '',
    component_name_ar: it.component_name_ar || '',
    qty: it.qty,
    sort_order: it.sort_order,
    _temp_name: it.product_id ? it.product_name_en : it.component_name_en,
    _temp_fgd: it.product_fgd
  })) || [])

  // Item Search State
  const [itemSearch, setItemSearch] = useState('')
  const [debouncedItemSearch] = useDebounce(itemSearch, 400)
  const [itemResults, setItemResults] = useState([])

  // Search Parents Logic
  useEffect(() => {
    if (debouncedParentSearch.length < 2 || selectedParent) { setParentResults([]); setSearchingParent(false); return }
    const fetchParents = async () => {
      setSearchingParent(true)
      try {
        const response = await getProducts({ search: debouncedParentSearch, limit: 10, admin: true })
        setParentResults(response?.data || [])
      } catch (e) {
      } finally {
        setSearchingParent(false)
      }
    }
    fetchParents()
  }, [debouncedParentSearch, selectedParent])

  // Search Items Logic
  useEffect(() => {
    if (debouncedItemSearch.length < 2) { setItemResults([]); setSearchingItem(false); return }
    const fetchItems = async () => {
      setSearchingItem(true)
      try {
        const response = await getProducts({ search: debouncedItemSearch, limit: 10, admin: true })
        setItemResults(response?.data || [])
      } catch (e) {
      } finally {
        setSearchingItem(false)
      }
    }
    fetchItems()
  }, [debouncedItemSearch])

  const addItem = (product = null) => {
    const newItem = {
      product_id: product?.id || null,
      component_name_en: product?.name_en || '',
      component_name_ar: product?.name_ar || '',
      qty: 1,
      sort_order: items.length,
      _temp_name: product?.name_en || '',
      _temp_fgd: product?.fgd || ''
    }
    setItems([...items, newItem])
    setItemSearch('')
    setItemResults([])
  }

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!selectedParent) { toast.error('Parent product required'); return }
    if (items.length === 0) { toast.error('At least one item required'); return }

    setLoading(true)
    try {
      if (isEditing) {
        await updateBundle(bundle.bundle_id, items)
        toast.success('Bundle updated')
      } else {
        await createBundle({ product_id: selectedParent.id, items })
        toast.success('Bundle created')
      }
      onRefresh()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save bundle')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[1px] animate-in fade-in duration-150">
      <div className="w-full max-w-4xl rounded-xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border" 
           style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        
        {/* Official Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b bg-black/[0.02]" 
             style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-base font-bold uppercase tracking-tight" style={{ color: 'var(--text)' }}>
              {isEditing ? 'Management: Bundle Definition' : 'Administration: New Bundle Entry'}
            </h2>
            <p className="text-[10px] font-medium opacity-40 uppercase tracking-widest" style={{ color: 'var(--text)' }}>
              {isEditing ? `System Reference ID: #${bundle.bundle_id}` : 'Link a product to a set of components'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-black/5 transition-colors" style={{ color: 'var(--text-muted)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section: Parent Selection */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-4">
              <label className="text-[10px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--text-muted)' }}>Parent Product</label>
              <p className="text-[11px] opacity-40 leading-relaxed">Select the product that represents this bundle in the catalog.</p>
            </div>
            <div className="col-span-8">
              {isEditing ? (
                <div className="p-3 rounded border flex items-center justify-between bg-black/[0.01]" style={{ borderColor: 'var(--border-soft)' }}>
                  <div>
                    <span className="text-[12px] font-bold" style={{ color: 'var(--text)' }}>{selectedParent.name_en}</span>
                    <span className="ml-2 font-mono text-[10px] opacity-40">[{selectedParent.fgd}]</span>
                  </div>
                  <span className="text-[9px] font-black opacity-20 uppercase tracking-tighter">Fixed Reference</span>
                </div>
              ) : (
                <div className="relative">
                  <input
                  type="text"
                  placeholder={searchingParent ? "Searching..." : "Search parent product by name or FGD..."}
                  value={selectedParent ? selectedParent.name_en : parentSearch}
                  onChange={(e) => { 
                    setParentSearch(e.target.value)
                    if (selectedParent) setSelectedParent(null)
                  }}
                  className="w-full px-3 py-2 rounded border text-[12px] font-medium outline-none focus:border-brand transition-all"
                  style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-soft)', color: 'var(--text)' }}
                />
                {searchingParent && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                {!selectedParent && parentResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-[100] mt-1 border rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto translate-z-0" 
                       style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                    {parentResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedParent(p); setParentResults([]); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-black/5 transition-colors border-b last:border-0 text-[12px] flex items-center justify-between"
                        style={{ borderColor: 'var(--border-soft)' }}
                      >
                        <div className="flex-1">
                          <p className="font-bold" style={{ color: 'var(--text)' }}>{p.name_en}</p>
                          <p className="font-mono text-[9px] opacity-40" style={{ color: 'var(--text)' }}>{p.fgd}</p>
                        </div>
                        <span className="text-[9px] font-black opacity-20 uppercase">Select</span>
                      </button>
                    ))}
                  </div>
                )}
                </div>
              )}
            </div>
          </div>

          <hr style={{ borderColor: 'var(--border-soft)' }} />

          {/* Section: Component Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Bundle Components</label>
              <span className="text-[10px] font-mono opacity-30 uppercase tracking-widest">{items.length} Record(s)</span>
            </div>

            <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--border-soft)' }}>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-black/[0.02] text-[9px] font-black uppercase tracking-widest opacity-40 text-left border-b" style={{ borderColor: 'var(--border-soft)' }}>
                    <th className="px-4 py-2 w-10">Pos</th>
                    <th className="px-4 py-2">Component Description</th>
                    <th className="px-4 py-2 w-24">Reference</th>
                    <th className="px-4 py-2 w-20">Qty</th>
                    <th className="px-4 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-black/[0.01] transition-colors" style={{ borderColor: 'var(--border-soft)' }}>
                      <td className="px-4 py-2 text-[10px] font-mono opacity-30">{idx + 1}</td>
                      <td className="px-4 py-2">
                        {item.product_id ? (
                          <div className="text-[12px] font-bold" style={{ color: 'var(--text)' }}>{item._temp_name}</div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={item.component_name_en}
                              onChange={(e) => updateItem(idx, 'component_name_en', e.target.value)}
                              placeholder="English Name"
                              className="bg-transparent border-b outline-none text-[12px] font-bold w-1/2"
                              style={{ borderColor: 'var(--border-soft)', color: 'var(--text)' }}
                            />
                            <input
                              type="text"
                              dir="rtl"
                              value={item.component_name_ar}
                              onChange={(e) => updateItem(idx, 'component_name_ar', e.target.value)}
                              placeholder="الاسم بالعربي"
                              className="bg-transparent border-b outline-none text-[11px] w-1/2"
                              style={{ borderColor: 'var(--border-soft)', color: 'var(--text)' }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${item.product_id ? 'bg-blue-50 text-blue-600' : 'bg-zinc-100 text-zinc-500'}`}>
                          {item.product_id ? (item._temp_fgd || 'LINKED') : 'MANUAL'}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                           type="number"
                           min="1"
                           value={item.qty}
                           onChange={(e) => updateItem(idx, 'qty', parseInt(e.target.value) || 1)}
                           className="w-full bg-black/5 rounded px-2 py-1 text-[11px] font-bold outline-none border-none focus:ring-1 ring-brand"
                           style={{ color: 'var(--text)' }}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-[11px] opacity-30 italic">Registration required: Add items below</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Compact Search & Add */}
            <div className="relative pt-2">
              <input
                type="text"
                placeholder={searchingItem ? "Searching catalog..." : "Search catalog to link product, or press [ENTER] for manual component..."}
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !itemResults.length) {
                    e.preventDefault()
                    addItem()
                  }
                }}
                className="w-full px-4 py-2.5 rounded border text-[11px] font-medium outline-none focus:border-brand transition-all"
                style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border-soft)', color: 'var(--text)' }}
              />
              {searchingItem && (
                <div className="absolute right-4 top-1/2 mb-[-1.25rem] -translate-y-1/2">
                   <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              
              {itemResults.length > 0 && (
                <div className="absolute bottom-full left-0 right-0 z-[100] mb-2 border rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto" 
                     style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                  {itemResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addItem(p)}
                      className="w-full px-4 py-2.5 text-left hover:bg-black/5 transition-colors border-b last:border-0 flex items-center justify-between text-[11px]"
                      style={{ borderColor: 'var(--border-soft)' }}
                    >
                      <div>
                        <p className="font-bold" style={{ color: 'var(--text)' }}>{p.name_en}</p>
                        <p className="font-mono text-[9px] opacity-40" style={{ color: 'var(--text)' }}>{p.fgd}</p>
                      </div>
                      <span className="text-[9px] font-black text-brand uppercase tracking-tighter">Link Product</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addItem()}
                    className="w-full px-4 py-2.5 text-center bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800"
                  >
                    Add Custom Text Entry
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Compact Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3 bg-black/[0.02]" 
             style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded text-[11px] font-bold hover:bg-black/5 transition-colors uppercase tracking-widest text-text-muted"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-8 py-2 rounded bg-black text-white text-[11px] font-black uppercase tracking-widest shadow-md hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : isEditing ? 'Commit Changes' : 'Register Bundle'}
          </button>
        </div>
      </div>
    </div>
  )
}
