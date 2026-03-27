import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  getCampaign, createCampaign, updateCampaign, validateCampaign, 
  getCategories, getCountries, searchCampaignProducts 
} from '../../api'
import toast from 'react-hot-toast'
import CampaignPreview from './CampaignPreview'

const FLAGS = { AE:'🇦🇪', SA:'🇸🇦', QA:'🇶🇦', BH:'🇧🇭', KW:'🇰🇼', OM:'🇴🇲' }

const INITIAL_STATE = {
  name_en: '',
  name_ar: '',
  type: 'discount',
  priority: 100,
  start_at: new Date().toISOString().split('T')[0] + 'T00:00',
  end_at: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] + 'T23:59',
  is_stackable: false,
  max_uses: '',
  notes: '',
  countries: [1], // Default to UAE
  scope: [],
  discount_rules: {
    discount_type: 'percentage',
    discount_value: 0,
    min_price: 0
  },
  product_overrides: [],
  bxgy_rules: {
    buy_qty: 2,
    get_qty: 1,
    get_discount_type: 'free',
    get_discount_value: 0,
    is_repeatable: false,
    max_repeats: '',
    allow_overlap: false
  },
  bxgy_products: { buy: [], get: [] },
  foc_rules: {
    cart_min: 0,
    cart_max: '',
    selection_mode: 'auto',
    max_free_items: 1
  },
  foc_products: []
}

export default function CampaignForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = !!id

  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState(INITIAL_STATE)
  const [validation, setValidation] = useState({ valid: true, errors: [], warnings: [] })
  const [isValidating, setIsValidating] = useState(false)
  
  // Local product search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [overrideQuery, setOverrideQuery] = useState('')
  const [overrideResults, setOverrideResults] = useState([])

  // Data fetching
  const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: getCountries })
  const { data: categories } = useQuery({ queryKey: ['categories-admin'], queryFn: () => getCategories({ admin: true }) })
  
  const { data: campaignDetails, isLoading: isFetching } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => getCampaign(id),
    enabled: isEdit,
  })

  useEffect(() => {
    if (campaignDetails?.data) {
      const d = campaignDetails.data
      setFormData({
        ...INITIAL_STATE,
        ...d,
        countries: d.countries.map(c => c.id),
        start_at: new Date(d.start_at).toISOString().slice(0, 16),
        end_at: new Date(d.end_at).toISOString().slice(0, 16),
        max_uses: d.max_uses || '',
        discount_rules: d.discount_rules || INITIAL_STATE.discount_rules,
        bxgy_rules: d.bxgy_rules || INITIAL_STATE.bxgy_rules,
        foc_rules: d.foc_rules || INITIAL_STATE.foc_rules,
        product_overrides: d.product_overrides?.map(o => ({
            ...o,
            _label: o.product_name,
            _fgd: o.product_fgd
        })) || [],
        bxgy_products: {
            buy: d.bxgy_products?.buy?.map(p => p.product_id) || [],
            get: d.bxgy_products?.get?.map(p => p.product_id) || []
        },
        foc_products: d.foc_products?.map(p => p.product_id) || []
      })
    }
  }, [campaignDetails])

  const handleSearch = async (q) => {
    setSearchQuery(q)
    if (q.length < 2) return setSearchResults([])
    const res = await searchCampaignProducts({ q })
    setSearchResults(res.data || [])
  }

  const handleScopeAdd = (type, refId, label) => {
    if (formData.scope.some(s => s.scope_type === type && s.scope_ref_id === refId)) return
    setFormData(prev => ({
      ...prev,
      scope: [...prev.scope, { scope_type: type, scope_ref_id: refId, _label: label }]
    }))
  }

  const removeScope = (index) => {
    setFormData(prev => ({
      ...prev,
      scope: prev.scope.filter((_, i) => i !== index)
    }))
  }

  const handleOverrideAdd = (p) => {
    if (formData.product_overrides.some(o => o.product_id === p.id)) return
    setFormData(prev => ({
      ...prev,
      product_overrides: [...prev.product_overrides, {
        product_id: p.id,
        _label: p.name_en,
        _fgd: p.fgd,
        discount_type: prev.discount_rules.discount_type,
        discount_value: prev.discount_rules.discount_value
      }]
    }))
  }

  const removeOverride = (index) => {
    setFormData(prev => ({
      ...prev,
      product_overrides: prev.product_overrides.filter((_, i) => i !== index)
    }))
  }

  const handleOverrideSearch = async (q) => {
    setOverrideQuery(q)
    if (q.length < 2) return setOverrideResults([])
    const res = await searchCampaignProducts({ q })
    setOverrideResults(res.data || [])
  }

  const validate = async () => {
    setIsValidating(true)
    try {
      const res = await validateCampaign({
        ...formData,
        id: isEdit ? id : undefined,
        countries: formData.countries
      })
      setValidation(res)
      return res.valid
    } catch {
      toast.error('Validation failed')
      return false
    } finally {
      setIsValidating(false)
    }
  }

  const nextStep = async () => {
    if (step === 1) {
      if (!formData.name_en || !formData.start_at || !formData.end_at || !formData.countries.length) {
        return toast.error('Please fill required fields')
      }
      setStep(2)
    } else if (step === 2) {
      const ok = await validate()
      if (ok) setStep(3)
    }
  }

  const save = async (activate = false) => {
    const payload = { ...formData, activate }
    try {
      if (isEdit) await updateCampaign(id, payload)
      else await createCampaign(payload)
      toast.success(isEdit ? 'Campaign updated' : 'Campaign created')
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      navigate('/campaigns')
    } catch (err) {
      toast.error(err.error || 'Failed to save')
    }
  }

  if (isFetching) return <div className="p-20 text-center animate-pulse opacity-50 font-bold">Loading campaign...</div>

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Stepper Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/campaigns')} className="t-btn-ghost text-[11px] font-bold">← Back</button>
        <div className="flex items-center gap-8">
           {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                 <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-black transition-all ${step >= s ? 'bg-brand text-white' : 'bg-surface-2 text-text-subtle border border-border'}`}>
                    {s}
                 </div>
                 <span className={`text-[11px] font-bold uppercase tracking-widest ${step === s ? 'text-brand' : 'text-text-subtle'}`}>
                    {s === 1 ? 'Details' : s === 2 ? 'Rules' : 'Review'}
                 </span>
                 {s < 3 && <div className={`w-12 h-0.5 rounded ${step > s ? 'bg-brand' : 'bg-border'}`} />}
              </div>
           ))}
        </div>
        <div className="w-20" /> {/* Spacer */}
      </div>

      <div className="t-card overflow-hidden">
        {/* STEP 1: BASIC DETAILS */}
        {step === 1 && (
          <div className="p-8 flex flex-col gap-8">
            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Campaign Name (EN) *</label>
                  <input type="text" className="t-input font-bold" value={formData.name_en} onChange={e => setFormData({...formData, name_en: e.target.value})} placeholder="e.g. Ramadan Special 20%" />
               </div>
               <div className="space-y-1.5" dir="rtl">
                  <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">اسم الحملة (AR)</label>
                  <input type="text" className="t-input font-bold" value={formData.name_ar} onChange={e => setFormData({...formData, name_ar: e.target.value})} placeholder="مثال: خصم رمضان 20%" />
               </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
               <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Promotion Type</label>
                  <div className="flex flex-col gap-2">
                     {['discount', 'bxgy', 'foc'].map(t => (
                        <label key={t} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.type === t ? 't-border-brand bg-brand/5' : 'hover:bg-surface-2'}`}>
                           <input type="radio" className="hidden" name="type" checked={formData.type === t} onChange={() => setFormData({...formData, type: t})} />
                           <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.type === t ? 'border-brand' : 'border-border'}`}>
                              {formData.type === t && <div className="w-2 h-2 rounded-full bg-brand" />}
                           </div>
                           <span className="text-[12px] font-bold capitalize">{t === 'bxgy' ? 'Buy X Get Y' : t === 'foc' ? 'Free Gift (FOC)' : t}</span>
                        </label>
                     ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Start Date *</label>
                    <input type="datetime-local" className="t-input" value={formData.start_at} onChange={e => setFormData({...formData, start_at: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">End Date *</label>
                    <input type="datetime-local" className="t-input" value={formData.end_at} onChange={e => setFormData({...formData, end_at: e.target.value})} />
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Priority (Lower = Higher)</label>
                    <input type="number" className="t-input" value={formData.priority} onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})} />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={formData.is_stackable} onChange={e => setFormData({...formData, is_stackable: e.target.checked})} className="rounded border-border text-brand focus:ring-brand" />
                    <span className="text-[12px] font-bold">Allow stacking with other campaigns</span>
                  </label>
               </div>
            </div>

            <div className="space-y-1.5">
               <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Target Countries *</label>
               <div className="flex flex-wrap gap-2">
                  {countries?.data?.map(c => (
                     <button key={c.id} onClick={() => {
                        const exists = formData.countries.includes(c.id)
                        setFormData({...formData, countries: exists ? formData.countries.filter(id => id !== c.id) : [...formData.countries, c.id]})
                     }} className={`px-4 py-2 rounded-xl text-[12px] font-bold border transition-all ${formData.countries.includes(c.id) ? 'bg-brand text-white border-brand' : 'bg-surface-2 border-border text-text-muted'}`}>
                        {FLAGS[c.code]} {c.code}
                     </button>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* STEP 2: CONFIGURATION */}
        {step === 2 && (
          <div className="p-8 flex flex-col gap-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-brand">Configure {formData.type === 'discount' ? 'Discount Rules' : formData.type === 'bxgy' ? 'Buy X Get Y' : 'Free Gift'}</h2>
            
            {/* Scope Selection (Common for most) */}
            <div className="space-y-4">
               <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Campaign Scope (What products?)</label>
               <div className="flex gap-2">
                  <button onClick={() => handleScopeAdd('all', null, 'All Products')} className="t-btn-ghost text-[11px]">All Products</button>
                  <select className="t-btn-ghost text-[11px] outline-none" onChange={e => {
                      const id = parseInt(e.target.value); if(!id) return;
                      const cat = categories?.data?.find(c => c.id === id)
                      handleScopeAdd('category', id, `Category: ${cat.name_en}`)
                      e.target.value = ""
                  }}>
                     <option value="">+ Add Category</option>
                     {categories?.data?.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
                  </select>
                  <div className="relative flex-1">
                     <input type="text" value={searchQuery} onChange={e => handleSearch(e.target.value)} placeholder="Search products..." className="t-input" />
                     {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl z-50 max-h-60 overflow-auto">
                           {searchResults.map(p => (
                              <div key={p.id} onClick={() => { handleScopeAdd('product', p.id, p.name_en); setSearchResults([]); setSearchQuery('') }} className="px-4 py-2 hover:bg-surface-2 cursor-pointer border-b last:border-0 flex items-center justify-between">
                                 <span className="text-[12px] font-bold">{p.name_en}</span>
                                 <span className="text-[10px] opacity-40">#{p.fgd}</span>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
               <div className="flex flex-wrap gap-2 min-h-12 p-3 bg-surface-2 rounded-xl border border-dashed border-border">
                  {formData.scope.map((s, i) => (
                     <div key={i} className="flex items-center gap-2 px-3 py-1 bg-white border border-border rounded-lg text-[11px] font-bold">
                        {s._label || `${s.scope_type}: ${s.scope_ref_id}`}
                        <button onClick={() => removeScope(i)} className="text-red-500 hover:scale-125 transition-transform">×</button>
                     </div>
                  ))}
                  {formData.scope.length === 0 && <span className="text-[11px] italic opacity-30 mt-1">No scope items added. Defaults to All Products if empty? (Better to be explicit)</span>}
               </div>
            </div>

            {/* DISCOUNT SPECIFIC */}
            {formData.type === 'discount' && (
              <div className="flex flex-col gap-8">
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Promotion Value</label>
                       <div className="flex gap-2">
                          <button onClick={() => setFormData({...formData, discount_rules: {...formData.discount_rules, discount_type: 'percentage'}})} className={`flex-1 py-3 rounded-xl border font-black text-[14px] transition-all ${formData.discount_rules.discount_type === 'percentage' ? 'border-brand bg-brand/5 text-brand' : 'bg-surface-2'}`}>% Percentage</button>
                          <button onClick={() => setFormData({...formData, discount_rules: {...formData.discount_rules, discount_type: 'fixed'}})} className={`flex-1 py-3 rounded-xl border font-black text-[14px] transition-all ${formData.discount_rules.discount_type === 'fixed' ? 'border-brand bg-brand/5 text-brand' : 'bg-surface-2'}`}>Fixed Amount</button>
                       </div>
                       <div className="relative">
                          <input type="number" className="t-input text-lg font-black" value={formData.discount_rules.discount_value} onChange={e => setFormData({...formData, discount_rules: {...formData.discount_rules, discount_value: parseFloat(e.target.value) || 0}})} />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-text-subtle">{formData.discount_rules.discount_type === 'percentage' ? '%' : 'AED/Local'}</span>
                       </div>
                    </div>
                    <div className="space-y-4">
                       <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Advanced Constraints</label>
                       <div className="space-y-1.5">
                          <span className="text-[10px] font-bold opacity-40">Minimum Price Floor</span>
                          <input type="number" className="t-input" value={formData.discount_rules.min_price} onChange={e => setFormData({...formData, discount_rules: {...formData.discount_rules, min_price: parseFloat(e.target.value) || 0}})} placeholder="No product will go below this" />
                       </div>
                    </div>
                 </div>

                 {/* Overrides Section */}
                 <div className="space-y-6 pt-8 border-t" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-[11px] font-black uppercase tracking-widest text-brand">Product Specific Overrides</h3>
                      <p className="text-[10px] opacity-40">Set custom discount values for specific products, ignoring global rules.</p>
                    </div>
                    
                    <div className="relative">
                      <div className="flex items-center gap-2">
                         <div className="relative flex-1">
                            <input type="text" value={overrideQuery} onChange={e => handleOverrideSearch(e.target.value)} placeholder="Search product to override..." className="t-input border-brand/20 bg-brand/5" />
                            {overrideResults.length > 0 && (
                               <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-brand/20 rounded-xl shadow-xl z-50 max-h-60 overflow-auto">
                                  {overrideResults.map(p => (
                                     <div key={p.id} onClick={() => { handleOverrideAdd(p); setOverrideResults([]); setOverrideQuery('') }} className="px-4 py-3 hover:bg-brand/5 cursor-pointer border-b last:border-0 flex items-center justify-between transition-colors">
                                        <div className="flex flex-col">
                                           <span className="text-[12px] font-bold">{p.name_en}</span>
                                           <span className="text-[10px] opacity-40 font-mono">#{p.fgd}</span>
                                        </div>
                                        <span className="text-[10px] font-black text-brand uppercase">+ Add Override</span>
                                     </div>
                                  ))}
                               </div>
                            )}
                         </div>
                      </div>
                    </div>

                    {formData.product_overrides.length > 0 && (
                      <div className="space-y-2">
                         {formData.product_overrides.map((o, idx) => (
                            <div key={o.product_id} className="flex items-center gap-4 p-3 bg-surface-2 rounded-xl border border-border/50 group hover:border-brand/30 transition-all">
                               <div className="flex-1 flex flex-col">
                                  <span className="text-[12px] font-bold">{o._label}</span>
                                  <span className="text-[10px] opacity-40 font-mono">#{o._fgd}</span>
                               </div>
                               
                               <div className="flex items-center gap-2">
                                  <select 
                                    value={o.discount_type} 
                                    onChange={e => {
                                      const newOverrides = [...formData.product_overrides]
                                      newOverrides[idx].discount_type = e.target.value
                                      setFormData({ ...formData, product_overrides: newOverrides })
                                    }}
                                    className="text-[11px] font-bold bg-white border border-border rounded-lg px-2 py-1 outline-none"
                                  >
                                     <option value="percentage">%</option>
                                     <option value="fixed">Fixed</option>
                                  </select>
                                  <div className="relative w-24">
                                     <input 
                                       type="number" 
                                       value={o.discount_value} 
                                       onChange={e => {
                                          const newOverrides = [...formData.product_overrides]
                                          newOverrides[idx].discount_value = parseFloat(e.target.value) || 0
                                          setFormData({ ...formData, product_overrides: newOverrides })
                                       }}
                                       className="t-input h-8 text-[12px] font-black pl-2 pr-6" 
                                     />
                                     <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30">
                                        {o.discount_type === 'percentage' ? '%' : 'AED'}
                                     </span>
                                  </div>
                                  <button onClick={() => removeOverride(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                               </div>
                            </div>
                         ))}
                      </div>
                    )}
                 </div>
              </div>
            )}

            {/* BXGY SPECIFIC */}
            {formData.type === 'bxgy' && (
              <div className="space-y-8">
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Customer Buys (X)</label>
                       <div className="flex items-center gap-4">
                          <input type="number" className="t-input w-24 text-center font-black text-lg" value={formData.bxgy_rules.buy_qty} onChange={e => setFormData({...formData, bxgy_rules: {...formData.bxgy_rules, buy_qty: parseInt(e.target.value) || 1}})} />
                          <span className="text-sm font-bold opacity-40">Item(s) from selected "Buy" list</span>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Customer Gets (Y)</label>
                       <div className="flex items-center gap-4">
                          <input type="number" className="t-input w-24 text-center font-black text-lg" value={formData.bxgy_rules.get_qty} onChange={e => setFormData({...formData, bxgy_rules: {...formData.bxgy_rules, get_qty: parseInt(e.target.value) || 1}})} />
                          <select className="t-input flex-1" value={formData.bxgy_rules.get_discount_type} onChange={e => setFormData({...formData, bxgy_rules: {...formData.bxgy_rules, get_discount_type: e.target.value}})}>
                             <option value="free">For Free</option>
                             <option value="percentage">% Discounted</option>
                             <option value="fixed">Fixed Price Each</option>
                          </select>
                       </div>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-border cursor-pointer hover:bg-surface-2 transition-all">
                       <input type="checkbox" checked={formData.bxgy_rules.is_repeatable} onChange={e => setFormData({...formData, bxgy_rules: {...formData.bxgy_rules, is_repeatable: e.target.checked}})} className="rounded text-brand" />
                       <div className="flex flex-col">
                          <span className="text-[12px] font-bold">Repeatable Offer</span>
                          <span className="text-[10px] opacity-40">Buy 4 Get 2, Buy 6 Get 3, etc.</span>
                       </div>
                    </label>
                    <label className="flex items-center gap-3 p-4 rounded-xl border border-border cursor-pointer hover:bg-surface-2 transition-all">
                       <input type="checkbox" checked={formData.bxgy_rules.allow_overlap} onChange={e => setFormData({...formData, bxgy_rules: {...formData.bxgy_rules, allow_overlap: e.target.checked}})} className="rounded text-brand" />
                       <div className="flex flex-col">
                          <span className="text-[12px] font-bold">Allow X and Y to overlap</span>
                          <span className="text-[10px] opacity-40">Items used for X can also count as Y</span>
                       </div>
                    </label>
                 </div>
              </div>
            )}

            {/* FOC SPECIFIC */}
            {formData.type === 'foc' && (
              <div className="space-y-8">
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Cart Threshold</label>
                       <div className="flex items-center gap-2">
                          <input type="number" className="t-input font-black" placeholder="Min Cart Value" value={formData.foc_rules.cart_min} onChange={e => setFormData({...formData, foc_rules: {...formData.foc_rules, cart_min: parseFloat(e.target.value) || 0}})} />
                          <span className="text-text-subtle font-bold">↔</span>
                          <input type="number" className="t-input font-black" placeholder="Max (Optional)" value={formData.foc_rules.cart_max} onChange={e => setFormData({...formData, foc_rules: {...formData.foc_rules, cart_max: e.target.value}})} />
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[11px] font-black uppercase tracking-wider text-text-muted">Selection Mode</label>
                       <select className="t-input" value={formData.foc_rules.selection_mode} onChange={e => setFormData({...formData, foc_rules: {...formData.foc_rules, selection_mode: e.target.value}})}>
                          <option value="auto">Auto-add (Cheapest of list)</option>
                          <option value="choose">User chooses from list</option>
                       </select>
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: PREVIEW & REVIEW */}
        {step === 3 && (
          <div className="p-8 flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-widest text-brand">Final Review & Impact</h2>
                {validation.warnings.length > 0 && (
                   <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black animate-pulse border border-amber-200">
                      ⚠️ {validation.warnings.length} Warnings Detected
                   </span>
                )}
            </div>

            <div className="grid grid-cols-4 gap-4">
               {[
                 { label: 'Name', val: formData.name_en },
                 { label: 'Type', val: formData.type.toUpperCase() },
                 { label: 'Priority', val: formData.priority },
                 { label: 'Stackable', val: formData.is_stackable ? 'Yes' : 'No' }
               ].map(item => (
                  <div key={item.label} className="p-4 rounded-xl bg-surface-2 border border-border">
                     <span className="text-[10px] font-black uppercase opacity-40 block mb-1">{item.label}</span>
                     <span className="text-[13px] font-black">{item.val}</span>
                  </div>
               ))}
            </div>

            {/* Component for Price impact preview */}
            <CampaignPreview 
               campaignId={id} 
               tempState={formData} 
               countries={countries?.data || []} 
            />

            {validation.errors.length > 0 && (
               <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2">
                  <p className="text-[11px] font-black text-red-600 uppercase tracking-widest">Errors Blocking Save</p>
                  {validation.errors.map((e, i) => (
                     <p key={i} className="text-[12px] font-medium text-red-700">• {e.message}</p>
                  ))}
               </div>
            )}
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="p-6 border-t flex items-center justify-between bg-surface-2/50" style={{ borderColor: 'var(--border)' }}>
          <div>
            {step > 1 && (
               <button onClick={() => setStep(step - 1)} className="t-btn-ghost font-black px-6">Previous Step</button>
            )}
          </div>
          <div className="flex gap-3">
             {step < 3 ? (
                <button onClick={nextStep} disabled={isValidating} className="t-btn-primary font-black px-8 h-11">
                   {isValidating ? 'Validating...' : 'Next Step →'}
                </button>
             ) : (
                <>
                   <button onClick={() => save(false)} disabled={validation.errors.length > 0} className="t-btn-ghost font-black px-8 h-11 bg-white">Save as Draft</button>
                   <button onClick={() => save(true)} disabled={validation.errors.length > 0} className="t-btn-primary font-black px-10 h-11">Save & Activate</button>
                </>
             )}
          </div>
        </div>
      </div>
    </div>
  )
}
