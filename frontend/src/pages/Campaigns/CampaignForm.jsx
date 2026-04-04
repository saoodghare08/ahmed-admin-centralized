import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    getCampaign, createCampaign, updateCampaign,
    getCountries, searchCampaignProducts, previewCampaign
} from '../../api'
import toast from 'react-hot-toast'

const INITIAL_STATE = {
    name_en: '',
    name_ar: '',
    type: 'discount',
    priority: 100,
    start_at: new Date().toISOString().slice(0, 16),
    end_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    is_all_products: 1, // Defaulting to 'All Products'
    is_stackable: 0,
    notes: '',
    countries: [1], // Default to UAE
    base_discount: {
        discount_type: 'percentage',
        discount_value: 0,
        min_price_floor: 0
    },
    items: []
}

const STATUS_COLORS = {
    active: 'bg-green-500/10 text-green-500 border-green-500/20',
    scheduled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    paused: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    expired: 'bg-red-500/10 text-red-500 border-red-500/20',
    archived: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
}

export default function CampaignForm() {
    const { id } = useParams()
    const navigate = useNavigate()
    const qc = useQueryClient()
    const isEdit = !!id

    const [formData, setFormData] = useState(INITIAL_STATE)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [isSaving, setIsSaving] = useState(false)

    // Global Tool state for Individual Mode
    const [globalVal, setGlobalVal] = useState('')
    const [globalType, setGlobalType] = useState('percentage')

    // Step Management
    const [step, setStep] = useState(1) // 1: Configure, 2: Preview
    const [previewLoading, setPreviewLoading] = useState(false)
    const [previewData, setPreviewData] = useState([])
    const [previewSearch, setPreviewSearch] = useState('')
    const [selectedPreviewCountry, setSelectedPreviewCountry] = useState('ALL')

    // Effective Status Calculation
    const getEffectiveStatus = () => {
        if (formData.status === 'archived') return 'archived';
        if (formData.status === 'draft' || !formData.status) return 'draft';
        
        const now = new Date();
        const start = new Date(formData.start_at);
        const end = new Date(formData.end_at);

        if (now < start) return 'scheduled';
        if (now > end) return 'expired';
        return 'active';
    }
    const effectiveStatus = getEffectiveStatus();

    // Data fetching
    const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: getCountries })
    const { data: campaignDetails, isLoading: isFetching } = useQuery({
        queryKey: ['campaign', id],
        queryFn: () => getCampaign(id),
        enabled: isEdit,
    })

    useEffect(() => {
        if (campaignDetails?.data) {
            const d = campaignDetails.data;
            setFormData({
                ...INITIAL_STATE,
                ...d,
                start_at: new Date(d.start_at).toISOString().slice(0, 16),
                end_at: new Date(d.end_at).toISOString().slice(0, 16),
                base_discount: d.base_discount || INITIAL_STATE.base_discount,
                items: d.items || []
            });
        }
    }, [campaignDetails])

    const handleSearch = async (q) => {
        setSearchQuery(q)
        if (q.length < 2) return setSearchResults([])
        const res = await searchCampaignProducts({ q })
        setSearchResults(res.data || [])
    }

    const addItem = (p) => {
        if (formData.items.find(i => i.product_id === p.id)) return
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, {
                product_id: p.id,
                product_name: p.name_en,
                product_fgd: p.fgd,
                discount_type: prev.is_all_products ? null : 'percentage',
                discount_value: prev.is_all_products ? null : 0,
                is_excluded: 0
            }]
        }))
        setSearchQuery('')
        setSearchResults([])
    }

    const removeItem = (pid) => {
        setFormData(prev => ({ ...prev, items: prev.items.filter(i => i.product_id !== pid) }))
    }

    const updateItem = (pid, key, val) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.map(i => i.product_id === pid ? { ...i, [key]: val } : i)
        }))
    }

    const applyGlobalTool = () => {
        if (globalVal === '') return toast.error('Set a value first')
        setFormData(prev => ({
            ...prev,
            items: prev.items.map(i => ({
                ...i,
                discount_type: globalType,
                discount_value: parseFloat(globalVal) || 0,
                is_excluded: 0
            }))
        }))
        toast.success(`Set ${globalVal}${globalType === 'percentage' ? '%' : ''} for all items`)
    }

    const handleNext = async () => {
        if (!formData.name_en || !formData.countries.length) return toast.error('Missing required fields')
        setPreviewLoading(true)
        try {
            const res = await previewCampaign(formData)
            setPreviewData(res.data || [])
            setStep(2)
            window.scrollTo(0, 0)
        } catch (err) {
            toast.error(err.error || 'Failed to fetch preview')
        } finally {
            setPreviewLoading(false)
        }
    }

    const hasPriceError = previewData.some(d => d.discounted_price < 0)

    const save = async (activate = false) => {
        if (!formData.name_en || !formData.countries.length) return toast.error('Missing required fields')
        setIsSaving(true)
        try {
            const payload = { ...formData, activate }
            if (isEdit) await updateCampaign(id, payload)
            else await createCampaign(payload)
            toast.success(isEdit ? 'Campaign updated' : 'Campaign created')
            qc.invalidateQueries(['campaigns'])
            navigate('/campaigns')
        } catch (err) {
            toast.error(err.error || 'Failed to save')
        } finally {
            setIsSaving(false)
        }
    }

    if (isFetching) return <div className="p-20 text-center opacity-50 font-black">Loading campaign...</div>

    return (
        <div className="max-w-4xl mx-auto pb-20 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 border-border/50">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/campaigns')} className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center hover:bg-surface transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-xl font-black tracking-tight">{isEdit ? 'Edit' : 'Create'} Campaign</h1>
                </div>
                <div className="flex gap-2 items-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mr-2 ${STATUS_COLORS[effectiveStatus]}`}>
                        {effectiveStatus}
                    </span>
                    {step === 1 ? (
                        <button 
                            onClick={handleNext} 
                            disabled={previewLoading} 
                            className="t-btn-primary px-8 h-10 font-bold shadow-lg shadow-brand/10 text-[13px] flex items-center gap-2"
                        >
                            {previewLoading ? 'Calculating...' : 'Next: Preview Impact'}
                            {!previewLoading && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>}
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => setStep(1)} className="status-badge-gray px-5 cursor-pointer flex items-center gap-2">
                                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                                Back
                            </button>
                            <button 
                                onClick={() => save(false)} 
                                disabled={isSaving || hasPriceError} 
                                title={hasPriceError ? "Cannot save: Some prices are below 0" : ""}
                                className={`px-6 h-10 border border-border rounded-xl text-[13px] font-black transition-colors ${hasPriceError ? 'opacity-30 cursor-not-allowed bg-red-50 text-red-400 border-red-100' : 'text-text-muted hover:bg-surface'}`}
                            >
                                Save as Draft
                            </button>
                            <button 
                                onClick={() => save(true)} 
                                disabled={isSaving || hasPriceError} 
                                className={`t-btn-primary px-8 h-10 font-bold shadow-lg text-[13px] ${hasPriceError ? 'opacity-30 cursor-not-allowed bg-gray-400 shadow-none' : 'shadow-brand/10'}`}
                            >
                                Activate Campaign
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {hasPriceError && step === 2 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-1">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <p className="text-[12px] font-black">VALIDATION ERROR: Some products have a discounted price below 0. Please adjust your discount amount.</p>
                </div>
            )}

            {step === 1 && (
                <div className="space-y-8">
                    {/* Basic Info */}
                    <div className="t-card p-6 grid grid-cols-2 gap-6">
                        <div className="col-span-2 flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-6 bg-brand rounded-full" />
                            <h2 className="text-[11px] font-black uppercase tracking-widest text-text-muted">Campaign Details</h2>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-text-muted opacity-50">Campaign Name (English) *</label>
                            <input type="text" className="t-input h-10 text-[13px] font-bold" value={formData.name_en} onChange={e => setFormData({ ...formData, name_en: e.target.value })} />
                        </div>
                        <div className="space-y-1.5" dir="rtl">
                            <label className="text-[10px] font-black uppercase text-text-muted opacity-50 block text-right">اسم الحملة (عربي)</label>
                            <input type="text" className="t-input h-10 text-[13px] font-bold text-right" value={formData.name_ar} onChange={e => setFormData({ ...formData, name_ar: e.target.value })} />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-text-muted opacity-50">Start Date</label>
                            <input type="datetime-local" className="t-input h-10 text-[12px] font-bold" value={formData.start_at} onChange={e => setFormData({ ...formData, start_at: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-text-muted opacity-50">End Date</label>
                            <input type="datetime-local" className="t-input h-10 text-[12px] font-bold" value={formData.end_at} onChange={e => setFormData({ ...formData, end_at: e.target.value })} />
                        </div>

                        <div className="space-y-1.5 col-span-2">
                            <label className="text-[10px] font-black uppercase text-text-muted opacity-50">Target Countries</label>
                            <div className="flex flex-wrap gap-1.5">
                                {countries?.data?.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => {
                                            const exist = formData.countries.includes(c.id)
                                            setFormData({ ...formData, countries: exist ? formData.countries.filter(id => id !== c.id) : [...formData.countries, c.id] })
                                        }}
                                        className={`px-4 py-1.5 rounded-lg border text-[11px] font-black transition-all ${formData.countries.includes(c.id) ? 'bg-brand text-white border-brand' : 'bg-surface-2 border-border text-text-muted hover:border-brand/30'}`}
                                    >
                                        {c.code}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Campaign Logic Selectors */}
                    <div className="t-card p-6 grid grid-cols-2 gap-8 bg-surface-2/30">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-text-muted opacity-50">Campaign Type</label>
                            <select
                                className="t-input h-10 text-[13px] font-bold bg-white"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="discount">Discount Campaign (Fixed/%)</option>
                                <option value="bxgy" disabled>Buy X Get Y (Coming Soon)</option>
                                <option value="foc" disabled>Free of Charge (Coming Soon)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-text-muted opacity-50">Applies To</label>
                            <select
                                className="t-input h-10 text-[13px] font-bold bg-white"
                                value={formData.is_all_products ? 'all' : 'individual'}
                                onChange={e => {
                                    const isAll = e.target.value === 'all';
                                    setFormData({
                                        ...formData,
                                        is_all_products: isAll ? 1 : 0,
                                        items: formData.items.map(it => ({
                                            ...it,
                                            discount_type: isAll ? null : (it.discount_type || 'percentage'),
                                            discount_value: isAll ? null : (it.discount_value || 0)
                                        }))
                                    })
                                }}
                            >
                                <option value="all">Global (All Products)</option>
                                <option value="individual">Selection (Individual Products)</option>
                            </select>
                        </div>
                    </div>

                    {/* CONDITIONAL LAYOUTS */}
                    {formData.is_all_products ? (
                        /* CASE: ALL PRODUCTS */
                        <div className="space-y-6">
                            <div className="t-card p-8 border-l-4 border-l-brand flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black">Global Discount Rule</h3>
                                    <p className="text-[11px] text-text-muted font-bold opacity-60">Applied to every product by default</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <select
                                        className="t-input h-10 w-32 text-[12px] font-black"
                                        value={formData.base_discount.discount_type}
                                        onChange={e => setFormData({ ...formData, base_discount: { ...formData.base_discount, discount_type: e.target.value } })}
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="fixed">Fixed Price</option>
                                    </select>
                                    <div className="relative">
                                        <input
                                            type="number" className="t-input h-10 w-24 text-center font-black"
                                            value={formData.base_discount.discount_value}
                                            onChange={e => setFormData({ ...formData, base_discount: { ...formData.base_discount, discount_value: parseFloat(e.target.value) || 0 } })}
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-30">{formData.base_discount.discount_type === 'percentage' ? '%' : ''}</span>
                                    </div>
                                </div>
                            </div>

                            {/* All Products: Overrides / Exclusions */}
                            <div className="t-card p-2">
                                <div className="p-4 flex items-center justify-between bg-surface-2/50 rounded-t-xl mb-1">
                                    <span className="text-[11px] font-black uppercase text-text-muted tracking-widest">Override specific products</span>
                                    <div className="relative w-64">
                                        <input
                                            type="text" className="t-input h-9 pl-9 text-[11px] font-bold" placeholder="Search product to override..."
                                            value={searchQuery} onChange={e => handleSearch(e.target.value)}
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                                        {searchResults.length > 0 && <SearchResults results={searchResults} onSelect={addItem} />}
                                    </div>
                                </div>
                                <ItemTable
                                    items={formData.items}
                                    isAllMode={true}
                                    onUpdate={updateItem}
                                    onRemove={removeItem}
                                    baseType={formData.base_discount.discount_type}
                                />
                            </div>
                        </div>
                    ) : (
                        /* CASE: INDIVIDUAL PRODUCTS */
                        <div className="space-y-6">
                            <div className="t-card p-4 flex flex-col gap-4">
                                <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                                    <div className="relative flex-1">
                                        <input
                                            type="text" className="t-input h-11 pl-11 text-sm font-bold border-brand/20 bg-brand/5" placeholder="Search and add products to this campaign..."
                                            value={searchQuery} onChange={e => handleSearch(e.target.value)}
                                        />
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-30">📦</span>
                                        {searchResults.length > 0 && <SearchResults results={searchResults} onSelect={addItem} />}
                                    </div>

                                    {/* Global Tool */}
                                    <div className="flex items-center gap-2 bg-surface-2 p-2 rounded-xl border border-border">
                                        <span className="text-[10px] font-black uppercase text-text-muted whitespace-nowrap ml-1">Batch Apply:</span>
                                        <select
                                            className="h-8 text-[11px] font-black rounded-lg border-border border px-1"
                                            value={globalType} onChange={e => setGlobalType(e.target.value)}
                                        >
                                            <option value="percentage">%</option>
                                            <option value="fixed">Amt</option>
                                        </select>
                                        <input
                                            type="number" className="h-8 w-16 text-center text-[11px] font-black rounded-lg border-border border"
                                            placeholder="Val" value={globalVal} onChange={e => setGlobalVal(e.target.value)}
                                        />
                                        <button onClick={applyGlobalTool} className="h-8 px-3 bg-brand text-white rounded-lg text-[10px] font-black">Set All</button>
                                    </div>
                                </div>

                                <ItemTable
                                    items={formData.items}
                                    isAllMode={false}
                                    onUpdate={updateItem}
                                    onRemove={removeItem}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {step === 2 && (
                <div className="space-y-6">
                    <div className="t-card p-6 flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-brand rounded-full" />
                                <h2 className="text-[11px] font-black uppercase tracking-widest text-text-muted">Price Impact Preview</h2>
                            </div>
                            <div className="flex items-center gap-2 bg-surface-2 p-1 rounded-lg border border-border">
                                {['ALL', ...new Set(previewData.map(d => d.country_code))].map(code => (
                                    <button
                                        key={code}
                                        onClick={() => setSelectedPreviewCountry(code)}
                                        className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${selectedPreviewCountry === code ? 'bg-white shadow-sm border border-border' : 'text-text-muted hover:text-brand'}`}
                                    >
                                        {code}
                                    </button>
                                ))}
                            </div>
                            <div className="relative w-64">
                                <input 
                                    type="text" className="t-input h-9 text-[12px] pl-8" 
                                    placeholder="Search preview list..." 
                                    value={previewSearch} 
                                    onChange={e => setPreviewSearch(e.target.value)}
                                />
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-30 text-[12px]">🔍</span>
                            </div>
                        </div>

                        <PreviewTable 
                            data={previewData.filter(d => {
                                const matchesSearch = d.product_name.toLowerCase().includes(previewSearch.toLowerCase()) || d.fgd.includes(previewSearch);
                                const matchesCountry = selectedPreviewCountry === 'ALL' || d.country_code === selectedPreviewCountry;
                                return matchesSearch && matchesCountry;
                            })} 
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

function SearchResults({ results, onSelect }) {
    return (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
            {results.map(p => (
                <div key={p.id} onClick={() => onSelect(p)} className="p-3 hover:bg-surface-2 cursor-pointer flex items-center justify-between border-b last:border-0 group">
                    <div className="flex flex-col">
                        <span className="text-[13px] font-black group-hover:text-brand">{p.name_en}</span>
                        <span className="text-[10px] font-mono opacity-40">#{p.fgd}</span>
                    </div>
                    {p.active_campaign_name ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[9px] font-black border border-amber-200">IN ACTIVE: {p.active_campaign_name}</span>
                    ) : (
                        <span className="text-[10px] font-black text-brand opacity-0 group-hover:opacity-100">+ Add</span>
                    )}
                </div>
            ))}
        </div>
    )
}

function ItemTable({ items, isAllMode, onUpdate, onRemove, baseType }) {
    if (items.length === 0) return (
        <div className="p-20 text-center opacity-30">
            <p className="text-[11px] font-black uppercase tracking-widest">{isAllMode ? 'No overrides set (all follow base rule)' : 'No products selected yet'}</p>
        </div>
    )

    return (
        <table className="w-full text-[12px]">
            <thead className="bg-surface-2/20 text-text-muted font-black border-b border-border">
                <tr>
                    <th className="p-3 text-left w-1/2">Product Name</th>
                    <th className="p-3 text-center">Discount Logic</th>
                    <th className="p-3 text-center">Amount</th>
                    <th className="p-3 text-right">Action</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
                {items.map(it => (
                    <tr key={it.product_id} className={`group hover:bg-surface-2/20 transition-colors ${it.is_excluded ? 'opacity-40 grayscale-60' : ''}`}>
                        <td className="p-3">
                            <div className="flex flex-col">
                                <span className="font-bold">{it.product_name}</span>
                                <span className="text-[9px] font-mono opacity-40">#{it.product_fgd}</span>
                            </div>
                        </td>
                        <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <select
                                    className="h-7 text-[10px] font-black rounded border border-border px-1 bg-white outline-none"
                                    value={it.is_excluded ? 'exclude' : (it.discount_type === null ? 'inherit' : 'custom')}
                                    onChange={e => {
                                        const v = e.target.value;
                                        if (v === 'exclude') onUpdate(it.product_id, 'is_excluded', 1)
                                        else if (v === 'inherit') {
                                            onUpdate(it.product_id, 'is_excluded', 0)
                                            onUpdate(it.product_id, 'discount_type', null)
                                        } else {
                                            onUpdate(it.product_id, 'is_excluded', 0)
                                            onUpdate(it.product_id, 'discount_type', 'percentage')
                                            onUpdate(it.product_id, 'discount_value', 0)
                                        }
                                    }}
                                >
                                    {isAllMode && <option value="inherit">Inherit Base Rule</option>}
                                    <option value="custom">Product Override</option>
                                    <option value="exclude">Exclude (Regular Price)</option>
                                </select>
                            </div>
                        </td>
                        <td className="p-3 text-center">
                            {!it.is_excluded && it.discount_type !== null && (
                                <div className="flex items-center justify-center gap-2">
                                    <select
                                        className="h-7 text-[10px] font-black rounded border border-border px-1 bg-white outline-none"
                                        value={it.discount_type}
                                        onChange={e => onUpdate(it.product_id, 'discount_type', e.target.value)}
                                    >
                                        <option value="percentage">%</option>
                                        <option value="fixed">Amt</option>
                                    </select>
                                    <input
                                        type="number" className="h-7 w-16 text-center text-[11px] font-black rounded border border-border bg-white"
                                        value={it.discount_value}
                                        onChange={e => onUpdate(it.product_id, 'discount_value', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            )}
                            {!it.is_excluded && it.discount_type === null && (
                                <span className="text-[10px] font-black text-brand italic">Following Base Rule</span>
                            )}
                        </td>
                        <td className="p-3 text-right">
                            <button onClick={() => onRemove(it.product_id)} className="text-red-400 hover:text-red-600 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function PreviewTable({ data }) {
    if (!data.length) return <div className="p-20 text-center opacity-30 font-black text-[12px]">No data to preview</div>

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
                <thead className="bg-surface-2/20 text-text-muted font-black border-b border-border">
                    <tr>
                        <th className="p-3 text-left">Product</th>
                        <th className="p-3 text-center">Country</th>
                        <th className="p-3 text-right">Original Price</th>
                        <th className="p-3 text-center">Discount</th>
                        <th className="p-3 text-right">Final Price</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                    {data.map((row, idx) => (
                        <tr key={idx} className={`hover:bg-surface-2/10 ${row.is_excluded ? 'opacity-40 grayscale' : ''}`}>
                            <td className="p-3">
                                <div className="flex flex-col">
                                    <span className="font-bold">{row.product_name}</span>
                                    <span className="text-[9px] font-mono opacity-40">#{row.fgd}</span>
                                </div>
                            </td>
                            <td className="p-3 text-center">
                                <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-[9px] font-black">{row.country_code}</span>
                            </td>
                            <td className="p-3 text-right font-medium opacity-50">
                                {parseFloat(row.original_price).toFixed(2)} {row.currency_symbol}
                            </td>
                            <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${row.is_excluded ? 'bg-gray-100 text-gray-400' : 'bg-brand/10 text-brand'}`}>
                                    {row.discount_label}
                                </span>
                            </td>
                            <td className="p-3 text-right font-black text-brand">
                                {parseFloat(row.discounted_price).toFixed(2)} {row.currency_symbol}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
