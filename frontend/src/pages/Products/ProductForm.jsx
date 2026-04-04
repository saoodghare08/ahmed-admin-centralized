import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../api/client'
import {
  getProduct, createProduct, updateProduct,
  updateAllPrices, getPricing,
  getCountryConfigs, updateVisibility, updateSEO,
  deleteMedia, setPrimaryMedia,
  getProductStock, updateProductStock,
} from '../../api'
import { useAuth } from '../../context/AuthContext'
import GalleryPicker from '../../components/GalleryPicker'
import ImageUploader from '../../components/ImageUploader'
import Swal from 'sweetalert2'

// ── Constants ─────────────────────────────────────────────────
const COUNTRIES = [
  { id: 1, code: 'AE', name: 'UAE',     currency_id: 1, currency: 'AED', flag: '🇦🇪', decimals: 2 },
  { id: 2, code: 'SA', name: 'KSA',     currency_id: 2, currency: 'SAR', flag: '🇸🇦', decimals: 2 },
  { id: 3, code: 'QA', name: 'Qatar',   currency_id: 3, currency: 'QAR', flag: '🇶🇦', decimals: 2 },
  { id: 4, code: 'BH', name: 'Bahrain', currency_id: 4, currency: 'BHD', flag: '🇧🇭', decimals: 3 },
  { id: 5, code: 'KW', name: 'Kuwait',  currency_id: 5, currency: 'KWD', flag: '🇰🇼', decimals: 3 },
  { id: 6, code: 'OM', name: 'Oman',    currency_id: 6, currency: 'OMR', flag: '🇴🇲', decimals: 3 },
]

const TABS = ['Core', 'Fragrance', 'Media', 'SEO', 'Inventory']

const EMPTY = {
  fgd: '', barcode: '', slug: '', name_en: '', name_ar: '',
  description_en: '', description_ar: '',
  category_id: '', subcategory_id: null,
  is_active: true, is_featured: false,
  tags: '',
  size_label_en: '', size_label_ar: ''
}

const EMPTY_NOTE = { ingredients_en: '', ingredients_ar: '', description_en: '', description_ar: '', image_url: '' }

// ── Helpers ───────────────────────────────────────────────────
const toSlug = (str) =>
  str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/--+/g, '-')


// ── Primitive helpers ─────────────────────────────────────────
function Field({ label, hint, children, required }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-subtle)' }}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="normal-case font-normal ml-1.5" style={{ color: 'var(--text-subtle)' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className="relative w-10 h-5 rounded-full transition-colors duration-200"
        style={{ backgroundColor: checked ? 'var(--color-brand)' : 'var(--border)' }}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
      </div>
      <span className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </label>
  )
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      {title && <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-subtle)' }}>{title}</h3>}
      {children}
    </div>
  )
}

const resolveUrl = (src) => {
  const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')
  if (!src) return null
  if (src.startsWith('http') || src.startsWith('data:')) return src
  return `${API_ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`
}

// ── Tab: Core Info ────────────────────────────────────────────
function CoreTab({ form, set, categories, isEdit, prices, setPrices, configs, setConfigs, stocks, setStocks }) {
  const updateVisibility = (countryId, val) =>
    setConfigs(prev => prev.map(c => c.country_id === countryId ? { ...c, is_visible: val } : c))

  const updateStocks = (countryId, val) =>
    setStocks(prev => prev.map(s => s.country_id === countryId ? { ...s, quantity: Number(val) } : s))

  const selectedCat = categories?.find(c => c.id === Number(form.category_id))
  return (
    <div className="grid grid-cols-1 gap-5">
      

      <div className="grid grid-cols-2 gap-5">
        <SectionCard title="Identification">
          <Field label="FGD Code" required>
            <input className="t-input font-mono" value={form.fgd}
              onChange={e => {
                const val = e.target.value.toUpperCase()
                set('fgd', val)
                // Auto-fill barcode only if it hasn't been manually changed
                if (!isEdit || form.barcode === form.fgd || !form.barcode) set('barcode', val)
              }} placeholder="e.g. FGD-1001" />
          </Field>
          <Field label="Barcode" hint="auto-filled from FGD">
            <input className="t-input font-mono" value={form.barcode || ''}
              onChange={e => set('barcode', e.target.value.toUpperCase())} placeholder="e.g. FGD-1001" />
          </Field>
          <Field label="URL Slug" required>
            <input className="t-input font-mono text-[12px]" value={form.slug}
              onChange={e => set('slug', toSlug(e.target.value))} placeholder="auto-generated" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Toggle checked={form.is_active} onChange={v => set('is_active', v)} label="Active" />
            <Toggle checked={form.is_featured} onChange={v => set('is_featured', v)} label="Featured" />
          </div>
        </SectionCard>

        <SectionCard title="Classification">
          <Field label="Category" required>
            <select className="t-input" value={form.category_id || ''}
              onChange={e => { set('category_id', e.target.value); set('subcategory_id', null) }}>
              <option value="">— select —</option>
              {categories?.map(c => <option key={c.id} value={c.id}>{c.name_en}</option>)}
            </select>
          </Field>
          <Field label="Subcategory">
            <select className="t-input" value={form.subcategory_id || ''}
              onChange={e => set('subcategory_id', e.target.value || null)}
              disabled={!selectedCat?.subcategories?.length}>
              <option value="">— none —</option>
              {selectedCat?.subcategories?.map(s => <option key={s.id} value={s.id}>{s.name_en}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <Field label="Size Label (EN)">
              <input className="t-input" value={form.size_label_en || ''}
                onChange={e => set('size_label_en', e.target.value)} placeholder="e.g. 50ML" />
            </Field>
            <Field label="Size Label (AR)">
              <input className="t-input text-right" dir="rtl" value={form.size_label_ar || ''}
                onChange={e => set('size_label_ar', e.target.value)} placeholder="٥٠ مل" />
            </Field>
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Names">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name (English)" required>
            <input className="t-input" value={form.name_en}
              onChange={e => { set('name_en', e.target.value); if (!isEdit) set('slug', toSlug(e.target.value)) }}
              placeholder="Product name in English" />
          </Field>
          <Field label="Name (Arabic)">
            <input className="t-input text-right" dir="rtl" value={form.name_ar}
              onChange={e => set('name_ar', e.target.value)} placeholder="اسم المنتج بالعربي" />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Descriptions">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Description (English)">
            <textarea className="t-input h-32 leading-relaxed" 
              value={form.description_en || ''} 
              onChange={e => set('description_en', e.target.value)} 
              placeholder="Full product story and features in English..." />
          </Field>
          <Field label="Description (Arabic)">
            <textarea className="t-input h-32 leading-relaxed text-right" dir="rtl"
              value={form.description_ar || ''} 
              onChange={e => set('description_ar', e.target.value)} 
              placeholder="وصف المنتج وتفاصيله بالعربي..." />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Regional Visibility">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {configs.map(c => {
            const country = COUNTRIES.find(co => co.id === c.country_id)
            return (
              <div key={c.country_id} className="flex flex-col gap-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{country?.flag}</span>
                  <span className="text-[11px] font-bold">{country?.code}</span>
                </div>
                <Toggle checked={!!c.is_visible} onChange={v => updateVisibility(c.country_id, v ? 1 : 0)} label="Visible" />
              </div>
            )
          })}
        </div>
      </SectionCard>

      

      <SectionCard title="Tags & Attributes">
        <div className="flex flex-col gap-5">
          <Field label="Tags" hint="comma-separated">
            <input className="t-input" value={form.tags ?? ''} onChange={e => set('tags', e.target.value)}
              placeholder="oud, woody, luxury" />
          </Field>
          
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-subtle)' }}>
              Product Attributes (Key/Value)
            </label>
            <div className="flex flex-col gap-2">
              {form.attributes?.map((attr, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="t-input shadow-none flex-1" value={attr.key} 
                    onChange={e => {
                      const newAttrs = [...form.attributes]; newAttrs[i].key = e.target.value; set('attributes', newAttrs)
                    }} placeholder="Key e.g. Gender" />
                  <input className="t-input shadow-none flex-1" value={attr.value} 
                    onChange={e => {
                      const newAttrs = [...form.attributes]; newAttrs[i].value = e.target.value; set('attributes', newAttrs)
                    }} placeholder="Value e.g. Unisex" />
                  <button type="button" onClick={() => set('attributes', form.attributes.filter((_, idx) => idx !== i))}
                    className="p-2 transition-colors hover:text-red-400" style={{ color: 'var(--text-subtle)' }}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => set('attributes', [...(form.attributes || []), { key: '', value: '' }])}
                className="self-start text-[12px] font-semibold transition-colors mt-1" style={{ color: 'var(--color-brand)' }}>
                + Add Attribute
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Pricing">
        <div className="grid grid-cols-3 gap-5">
          {prices.map(p => {
            const country = COUNTRIES.find(c => c.id === p.country_id)
            return (
              <Field key={p.country_id} label={`${country?.name} Price (${country?.currency})`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none" title={country?.name}>{country?.flag}</span>
                  <input className="t-input w-full shadow-none" type="number"
                    step={country?.decimals === 3 ? '0.001' : '0.01'}
                    value={p.regular_price || ''} min="0"
                    onChange={e => setPrices(prev => prev.map(x => x.country_id === p.country_id ? { ...x, regular_price: e.target.value } : x))}
                    placeholder="0.00" />
                </div>
              </Field>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard title="Stock Management">
        <div className="grid grid-cols-3 gap-5">
          {stocks.map(s => {
            const country = COUNTRIES.find(c => c.id === s.country_id)
            return (
              <Field key={s.country_id} label={`${country?.name} Stock`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none">{country?.flag}</span>
                  <input className="t-input w-full shadow-none font-bold" type="number"
                    value={s.quantity ?? ''} min="0"
                    onChange={e => updateStocks(s.country_id, e.target.value)}
                    placeholder="0" />
                </div>
              </Field>
            )
          })}
        </div>
      </SectionCard>

    </div>
  )
}

// ── Tab: Media ────────────────────────────────────────────────
function MediaTab({ mediaList, setMediaList, productId, setPrimaryMedia, deleteMedia }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Product Images" hint="Manage visual assets">
        <div className="flex flex-col gap-5">
          {mediaList.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {mediaList.map((item, idx) => (
                <div key={item.id ?? idx}
                  className="group relative rounded-2xl overflow-hidden aspect-square cursor-pointer border transition-all duration-300"
                  style={{ 
                    borderColor: item.is_primary ? 'var(--color-brand)' : 'var(--border)', 
                    backgroundColor: 'var(--surface-2)',
                    boxShadow: item.is_primary ? '0 10px 20px -10px rgba(var(--color-brand-rgb), 0.3)' : 'none'
                  }}>
                  <img src={resolveUrl(item.url)} alt="" className="w-full h-full object-cover" />
                  {item.is_primary && (
                    <div className="absolute top-2 left-2 text-white text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest shadow-lg"
                      style={{ backgroundColor: 'var(--color-brand)' }}>Primary</div>
                  )}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2 px-2"
                    style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
                    {!item.is_primary && (
                      <button type="button"
                        onClick={async () => {
                          if (item.id) { try { await setPrimaryMedia(item.id) } catch { /* ignore */ } }
                          setMediaList(prev => prev.map((m, i) => ({ ...m, is_primary: i === idx ? 1 : 0 })))
                        }}
                        className="w-full text-[10px] font-black text-white px-3 py-1.5 rounded-full uppercase tracking-tighter"
                        style={{ backgroundColor: 'var(--color-brand)' }}>Set Primary</button>
                    )}
                    <button type="button"
                      onClick={async () => {
                        if (item.id) { try { await deleteMedia(item.id) } catch { /* ignore */ } }
                        setMediaList(prev => prev.filter((_, i) => i !== idx))
                      }}
                      className="w-full text-[10px] font-black text-white px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-400 uppercase tracking-tighter">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button type="button" onClick={() => setPickerOpen(true)}
            className="w-full rounded-2xl flex flex-col items-center justify-center gap-3 py-10 transition-all duration-300 hover:shadow-xl group"
            style={{ border: '2px dashed var(--border)', backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.color = 'var(--color-brand)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center group-hover:bg-brand/10 transition-colors" style={{ backgroundColor: 'var(--surface-2)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[14px] font-bold tracking-tight">Add from Gallery</span>
              <span className="text-[10px] uppercase font-black tracking-widest opacity-30">Multi-select enabled</span>
            </div>
          </button>
        </div>
        
        <GalleryPicker open={pickerOpen} onClose={() => setPickerOpen(false)} multiple={true}
          onSelect={async (paths) => {
            const arr = Array.isArray(paths) ? paths : [paths]
            const newItems = []
            for (let i = 0; i < arr.length; i++) {
              const rawPath = arr[i]
              const url = rawPath.startsWith('/') ? rawPath : `/gallery/${rawPath}`
              const isPrimary = mediaList.length === 0 && i === 0 ? 1 : 0
              if (productId) {
                try {
                  const r = await api.post('/media/link', { product_id: productId, url, is_primary: isPrimary, sort_order: mediaList.length + i })
                  newItems.push({ id: r.data?.id, url, is_primary: isPrimary, media_type: 'image' })
                } catch {
                  newItems.push({ url, is_primary: isPrimary, media_type: 'image' })
                }
              } else {

                newItems.push({ url, is_primary: isPrimary, media_type: 'image' })
              }
            }
            setMediaList(prev => [...prev, ...newItems])
          }} />
      </SectionCard>
    </div>
  )
}

// ── Tab: Fragrance Notes ──────────────────────────────────────
function FragranceTab({ notes, setNotes }) {
  const NOTE_TYPES = [
    { key: 'top',   label: 'Top Notes',   accent: '#d97706', border: 'color-mix(in srgb, #d97706 30%, transparent)', bg: 'color-mix(in srgb, #d97706 8%, transparent)' },
    { key: 'heart', label: 'Heart Notes', accent: '#e11d48', border: 'color-mix(in srgb, #e11d48 30%, transparent)', bg: 'color-mix(in srgb, #e11d48 8%, transparent)' },
    { key: 'base',  label: 'Base Notes',  accent: 'var(--color-brand)', border: 'color-mix(in srgb, var(--color-brand) 30%, transparent)', bg: 'color-mix(in srgb, var(--color-brand) 8%, transparent)' },
  ]

  const update = (type, field, val) =>
    setNotes(prev => ({ ...prev, [type]: { ...(prev[type] || EMPTY_NOTE), [field]: val } }))

  return (
    <div className="flex flex-col gap-5">
      {NOTE_TYPES.map(nt => {
        const note = notes[nt.key] || EMPTY_NOTE
        return (
          <div key={nt.key} className="rounded-xl p-5 flex flex-col gap-4"
            style={{ backgroundColor: nt.bg, border: `1px solid ${nt.border}` }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: nt.accent }} />
              <h3 className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>{nt.label}</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ingredients (EN)" hint="comma-separated">
                    <textarea className="t-input resize-none h-20"
                      value={note.ingredients_en}
                      onChange={e => update(nt.key, 'ingredients_en', e.target.value)}
                      placeholder="rose, bergamot, jasmine" />
                  </Field>
                  <Field label="Ingredients (AR)" hint="comma-separated">
                    <textarea className="t-input resize-none h-20 text-right" dir="rtl"
                      value={note.ingredients_ar}
                      onChange={e => update(nt.key, 'ingredients_ar', e.target.value)}
                      placeholder="ورد، برغموت، ياسمين" />
                  </Field>
                </div>
                <Field label="Description (EN)">
                  <input className="t-input" value={note.description_en}
                    onChange={e => update(nt.key, 'description_en', e.target.value)}
                    placeholder="Opening notes…" />
                </Field>
                <Field label="Description (AR)">
                  <input className="t-input text-right" dir="rtl" value={note.description_ar}
                    onChange={e => update(nt.key, 'description_ar', e.target.value)}
                    placeholder="روائح البداية…" />
                </Field>
              </div>
              <Field label="Note Image" hint="optional">
                <ImageUploader
                  value={note.image_url}
                  onChange={url => update(nt.key, 'image_url', url)}
                  uploadType="category"
                  maxSizeMB={5}
                />
              </Field>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: SEO ──────────────────────────────────────────────────
function SEOTab({ configs, setConfigs }) {
  const [expandedId, setExpandedId] = useState(null)
  
  const update = (countryId, field, val) =>
    setConfigs(prev => prev.map(c => c.country_id === countryId ? { ...c, [field]: val } : c))

  return (
    <div className="flex flex-col gap-2">
      {configs.map(c => {
        const country = COUNTRIES.find(co => co.id === c.country_id)
        const isExpanded = expandedId === c.country_id
        const hasData = c.slug_override || c.meta_title_en || c.meta_desc_en
        
        return (
          <div key={c.country_id} 
            className="rounded-2xl border transition-all duration-300 overflow-hidden" 
            style={{ 
              borderColor: isExpanded ? 'var(--color-brand)' : 'var(--border)', 
              backgroundColor: isExpanded ? 'rgba(var(--color-brand-rgb), 0.02)' : 'var(--surface)',
              boxShadow: isExpanded ? '0 10px 30px -15px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            {/* Accordion Header */}
            <div 
              onClick={() => setExpandedId(isExpanded ? null : c.country_id)}
              className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-black/2 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner" style={{ backgroundColor: 'var(--surface-2)' }}>
                  {country?.flag}
                </div>
                <div>
                  <h4 className="text-[14px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                    {country?.name} <span className="text-[10px] opacity-30 ml-1 uppercase">{country?.code}</span>
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    {hasData ? (
                      <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" /> Configured
                      </span>
                    ) : (
                      <span className="text-[9px] font-black opacity-20 uppercase tracking-widest">Incomplete</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                 <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <svg className="w-5 h-5 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                 </div>
              </div>
            </div>

            {/* Accordion Content */}
            <div 
              className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100 border-t' : 'max-h-0 opacity-0 pointers-events-none'}`} 
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="p-6 flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-5">
                   <Field label="Regional URL Slug" hint="Leave blank to use global slug">
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black opacity-20 uppercase tracking-tighter">URL /</div>
                        <input className="t-input font-mono text-[12px] pl-14" value={c.slug_override || ''}
                          onChange={e => update(c.country_id, 'slug_override', e.target.value)} placeholder="localized-slug-here" />
                      </div>
                   </Field>
                   <Field label="Display Sort Order" hint="Ranking in list">
                      <input className="t-input font-bold" type="number" value={c.sort_order || 0}
                        onChange={e => update(c.country_id, 'sort_order', Number(e.target.value))} />
                   </Field>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <Field label="Meta Title (English)">
                    <input className="t-input" value={c.meta_title_en || ''} 
                      onChange={e => update(c.country_id, 'meta_title_en', e.target.value)} placeholder="SEO head title..." />
                  </Field>
                  <Field label="Meta Title (Arabic)">
                    <input className="t-input text-right font-medium" dir="rtl" value={c.meta_title_ar || ''} 
                      onChange={e => update(c.country_id, 'meta_title_ar', e.target.value)} placeholder="عنوان الصفحة..." />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <Field label="Meta Description (English)">
                    <textarea className="t-input resize-none h-24 leading-relaxed" value={c.meta_desc_en || ''} 
                      onChange={e => update(c.country_id, 'meta_desc_en', e.target.value)} placeholder="Short summary for Google..." />
                  </Field>
                  <Field label="Meta Description (Arabic)">
                    <textarea className="t-input resize-none h-24 text-right leading-relaxed font-medium" dir="rtl" value={c.meta_desc_ar || ''} 
                      onChange={e => update(c.country_id, 'meta_desc_ar', e.target.value)} placeholder="وصف الميتا..." />
                  </Field>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Inventory ────────────────────────────────────────────
function InventoryTab({ stocks, setStocks }) {
  const update = (countryId, val) =>
    setStocks(prev => prev.map(s => s.country_id === countryId ? { ...s, quantity: Number(val) } : s))

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
      {stocks.map(s => {
        const country = COUNTRIES.find(c => c.id === s.country_id)
        return (
          <SectionCard key={s.country_id} title={`${country?.name} Stock`}>
             <Field label="Quantity in Hand" hint="units available">
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none">{country?.flag}</span>
                  <input 
                    type="number" 
                    className="t-input font-bold" 
                    value={s.quantity ?? ''} 
                    onChange={e => update(s.country_id, e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>
             </Field>
          </SectionCard>
        )
      })}
    </div>
  )
}

// ── Main ProductForm ────────────────────────────────────────────
export default function ProductForm() {
  const { hasPermission, user } = useAuth()
  
  // Conditionally render tabs based on granular permissions (or fallback to full access if only broad 'products' is assigned)
  const availableTabs = TABS.filter(t => {
    if (user?.role === 'admin') return true;
    const permKey = `products.${t.toLowerCase()}`;
    if (hasPermission(permKey)) return true;
    const hasAnySubPerm = user?.permissions?.some(p => p.startsWith('products.'));
    if (!hasAnySubPerm && hasPermission('products')) return true;
    return false;
  })

  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isEdit = id && id !== 'new'
  const [createdId, setCreatedId] = useState(null) // Rescues state if a new product fails mid-save
  const [resetKey, setResetKey]   = useState(0) // Forces hydration logic to re-run on discard

  const [tab, setTab]         = useState(availableTabs[0] || 'Core')
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({ ...EMPTY, attributes: [] })
  const [notes, setNotes]     = useState({ top: { ...EMPTY_NOTE }, heart: { ...EMPTY_NOTE }, base: { ...EMPTY_NOTE } })
  const [mediaList, setMediaList] = useState([])
  const [configs, setConfigs] = useState(COUNTRIES.map(c => ({ country_id: c.id, is_visible: 1, slug_override: '', meta_title_en: '', meta_title_ar: '', meta_desc_en: '', meta_desc_ar: '', sort_order: 0 })))
  const [prices, setPrices]   = useState(COUNTRIES.map(c => ({ country_id: c.id, currency_id: c.currency_id, regular_price: '' })))
  const [stocks, setStocks]   = useState(COUNTRIES.map(c => ({ country_id: c.id, quantity: 0 })))

  // Dirty tracking via ref (no extra state = no re-render loops)
  const savedRef  = useRef(null)
  const snap      = (f, n, c, p, s) => JSON.stringify({ f, n, c, p, s })
  const isDirty   = savedRef.current !== null && savedRef.current !== snap(form, notes, configs, prices, stocks)
  const markClean = () => { savedRef.current = snap(form, notes, configs, prices, stocks) }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Fetch categories
  const { data: catData } = useQuery({
    queryKey: ['categories-admin'],
    queryFn:  () => api.get('/categories?admin=1'),
    select:   res => res.data?.data || res.data || [],
  })

  // Fetch product on edit
  const { data: productData, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn:  () => getProduct(id),
    enabled:  !!isEdit,
  })

  // Keep tab updated if availableTabs shrinks (e.g., auth check completes)
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(tab)) {
      setTab(availableTabs[0])
    }
  }, [user, tab]) // eslint-disable-line

  useEffect(() => {
    const p = productData?.data
    if (!p) return
    const f = {
      fgd: p.fgd || '', barcode: p.barcode || p.fgd || '', slug: p.slug || '',
      name_en: p.name_en || '', name_ar: p.name_ar || '',
      description_en: p.description_en || '', description_ar: p.description_ar || '',
      category_id: p.category_id || '', subcategory_id: p.subcategory_id || null,
      is_active: !!p.is_active, is_featured: !!p.is_featured,
      size_label_en: p.size_label_en || '', size_label_ar: p.size_label_ar || '',
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
      attributes: p.attributes ? Object.entries(p.attributes).map(([k,v]) => ({ key: k, value: String(v) })) : [],
    }
    const n = { top: { ...EMPTY_NOTE }, heart: { ...EMPTY_NOTE }, base: { ...EMPTY_NOTE } }
    if (p.fragrance_notes?.length) {
      p.fragrance_notes.forEach(note => {
        n[note.note_type] = {
          ingredients_en: Array.isArray(note.ingredients_en) ? note.ingredients_en.join(', ') : (note.ingredients_en || ''),
          ingredients_ar: Array.isArray(note.ingredients_ar) ? note.ingredients_ar.join(', ') : (note.ingredients_ar || ''),
          description_en: note.description_en || '',
          description_ar: note.description_ar || '',
          image_url: note.image_url || '',
        }
      })
    }
    setForm(f)
    setNotes(n)
    // Hydrate mediaList from real product_media rows
    setMediaList(p.media?.length ? p.media : [])
    // Snapshot will be set once configs+prices effects also fire (see combined effect)
  }, [productData, resetKey])

  // Fetch country configs
  const { data: ccData } = useQuery({
    queryKey: ['product-countries', id],
    queryFn:  () => getCountryConfigs(id),
    enabled:  !!isEdit,
    select:   r => r?.data || r || [],
  })
  useEffect(() => {
    if (!Array.isArray(ccData) || !ccData.length) return
    setConfigs(COUNTRIES.map(c => {
      const saved = ccData.find(x => x.country_id === c.id)
      return saved ? { ...saved } : { country_id: c.id, is_visible: 1, slug_override: '', meta_title_en: '', meta_title_ar: '', meta_desc_en: '', meta_desc_ar: '', sort_order: 0 }
    }))
  }, [ccData, resetKey])

  // Fetch pricing
  const { data: pricingData } = useQuery({
    queryKey: ['pricing', id],
    queryFn:  () => getPricing(id),
    enabled:  !!isEdit,
    select:   r => r?.data || r || [],
  })
  useEffect(() => {
    if (!Array.isArray(pricingData) || !pricingData.length) return
    setPrices(COUNTRIES.map(c => {
      const saved = pricingData.find(p => p.country_id === c.id)
      return saved
        ? { country_id: c.id, currency_id: c.currency_id, regular_price: saved.regular_price }
        : { country_id: c.id, currency_id: c.currency_id, regular_price: '' }
    }))
  }, [pricingData, resetKey])

  // Fetch stock
  const { data: stockData } = useQuery({
    queryKey: ['stock', id],
    queryFn:  () => getProductStock(id),
    enabled:  !!isEdit,
    select:   r => r?.data || r || [],
  })
  useEffect(() => {
    if (!Array.isArray(stockData) || !stockData.length) return
    setStocks(COUNTRIES.map(c => {
      const saved = stockData.find(s => s.country_id === c.id)
      return saved ? { country_id: c.id, quantity: saved.quantity } : { country_id: c.id, quantity: 0 }
    }))
  }, [stockData, resetKey])

  // Tracker for the latest state to avoid closure bugs in the timeout snapshot
  const latestState = useRef()
  latestState.current = { form, notes, configs, prices, stocks }

  // Mark clean snapshot once all data is in state
  // For new products: immediately after mount
  useEffect(() => {
    if (isEdit) return
    savedRef.current = snap(
      { ...EMPTY, attributes: [] },
      { top: { ...EMPTY_NOTE }, heart: { ...EMPTY_NOTE }, base: { ...EMPTY_NOTE } },
      COUNTRIES.map(c => ({ country_id: c.id, is_visible: 1, slug_override: '', meta_title_en: '', meta_title_ar: '', meta_desc_en: '', meta_desc_ar: '', sort_order: 0 })),
      COUNTRIES.map(c => ({ country_id: c.id, currency_id: c.currency_id, regular_price: '' })),
      COUNTRIES.map(c => ({ country_id: c.id, quantity: 0 }))
    )
  }, [isEdit])

  // For edit products: wait for all data dependencies to arrive before marking clean
  useEffect(() => {
    if (!isEdit || !productData || !ccData || !pricingData) return
    const t = setTimeout(() => {
      if (savedRef.current === null) {
        const { form, notes, configs, prices, stocks } = latestState.current
        savedRef.current = snap(form, notes, configs, prices, stocks)
      }
    }, 150) // Increased slightly to guarantee all tab mapping effects have flushed to DOM
    return () => clearTimeout(t)
  }, [isEdit, productData, ccData, pricingData, stockData, resetKey])

  // Beforeunload guard
  useEffect(() => {
    const handler = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Save
  const handleSave = async () => {
    if (!form.name_en || !form.slug || !form.fgd || !form.category_id) {
      toast.error('FGD, Name (EN), Slug, and Category are required'); return
    }
    setSaving(true)
    try {
      const tagsArr = form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : null
      const attrObj = {}
      if (form.attributes?.length) {
        form.attributes.forEach(a => { if (a.key.trim() && a.value.trim()) attrObj[a.key.trim()] = a.value.trim() })
      }

      const payload = {
        ...form,
        category_id:    Number(form.category_id),
        subcategory_id: form.subcategory_id ? Number(form.subcategory_id) : null,
        is_active:   form.is_active ? 1 : 0,
        is_featured: form.is_featured ? 1 : 0,
        tags: tagsArr,
        attributes: Object.keys(attrObj).length > 0 ? attrObj : null,
      }

      const activeId = isEdit ? id : createdId
      let finalProductId = activeId

      if (activeId) { 
        await updateProduct(activeId, payload); 
        toast.success('Core data updated') 
      } else { 
        const res = await createProduct(payload); 
        // The backend `res.status(201).json({ data: { id: productId } })` 
        // Axios wraps this in `res.data`. So the id is `res.data.data.id`
        finalProductId = res.data?.data?.id || res.data?.id || res?.id; 
        
        if (!finalProductId) throw new Error("Backend did not return a valid Product ID")
        
        setCreatedId(finalProductId);
        toast.success('Product created') 
      }

      // Sync stock on save
      await updateProductStock(finalProductId, stocks)

      // After create/update: persist any pending media (not yet in DB) to product_media table
      const pendingMedia = mediaList.filter(m => !m.id)
      if (pendingMedia.length && finalProductId) {
        const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api')
        const savedMedia = []
        for (let i = 0; i < pendingMedia.length; i++) {
          try {
            const r = await fetch(`${API_BASE}/media/link`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                product_id: finalProductId,
                url: pendingMedia[i].url,
                is_primary: pendingMedia[i].is_primary ?? 0,
                sort_order: mediaList.findIndex(m => m === pendingMedia[i]),
              }),
            }).then(res => res.json())
            savedMedia.push({ ...pendingMedia[i], id: r.data?.id })
          } catch { savedMedia.push(pendingMedia[i]) }
        }
        setMediaList(prev => [
          ...prev.filter(m => m.id),
          ...savedMedia,
        ])
      }

      await Promise.allSettled([
        api.put(`/products/${finalProductId}/notes`, {
          notes: ['top', 'heart', 'base'].map(type => ({
            note_type: type,
            ingredients_en: (notes[type]?.ingredients_en || '').split(',').map(i => i.trim()).filter(Boolean),
            ingredients_ar: (notes[type]?.ingredients_ar || '').split(',').map(i => i.trim()).filter(Boolean),
            description_en: notes[type]?.description_en || null,
            description_ar: notes[type]?.description_ar || null,
            image_url: notes[type]?.image_url || null,
          }))
        }),
        updateVisibility(finalProductId, configs.map(c => ({ country_id: c.country_id, is_visible: c.is_visible }))),
        updateSEO(finalProductId, configs.map(c => ({
          country_id: c.country_id, 
          slug_override: c.slug_override,
          meta_title_en: c.meta_title_en,
          meta_title_ar: c.meta_title_ar,
          meta_desc_en: c.meta_desc_en,
          meta_desc_ar: c.meta_desc_ar,
          sort_order: c.sort_order
        }))),
        updateAllPrices(finalProductId, prices.filter(p => p.regular_price).map(p => ({
          ...p, regular_price: Number(p.regular_price)
        }))),
      ])

      // Mark clean after successful save
      markClean()

      qc.invalidateQueries({ queryKey: ['products'] })
      if (!isEdit && finalProductId) navigate(`/products/${finalProductId}`, { replace: true })
    } catch (e) {
      toast.error(e?.response?.data?.error || e.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  // Discard: reset to snapshot values by refetching
  const handleDiscard = async () => {
    const res = await Swal.fire({
      title: 'Discard changes?',
      text: "You will lose any unsaved edits.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, discard'
    })
    if (!res.isConfirmed) return

    savedRef.current = null  // reset so snapshot re-captures after refetch
    qc.invalidateQueries({ queryKey: ['product', id] })
    qc.invalidateQueries({ queryKey: ['product-countries', id] })
    qc.invalidateQueries({ queryKey: ['pricing', id] })
    if (!isEdit) {
      setForm({ ...EMPTY, attributes: [] })
      setNotes({ top: { ...EMPTY_NOTE }, heart: { ...EMPTY_NOTE }, base: { ...EMPTY_NOTE } })
      setStocks(COUNTRIES.map(c => ({ country_id: c.id, quantity: 0 })))
      savedRef.current = snap({ ...EMPTY, attributes: [] }, { top: { ...EMPTY_NOTE }, heart: { ...EMPTY_NOTE }, base: { ...EMPTY_NOTE } }, configs, prices, stocks)
    } else {
      setResetKey(k => k + 1)
    }
  }

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-64">
        <p className="text-sm animate-pulse" style={{ color: 'var(--text-subtle)' }}>Loading product…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full pt-6" style={{ backgroundColor: 'var(--bg)' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-3 fixed top-0 left-56 right-0 z-50 backdrop-blur"
        style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 90%, transparent)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-4">
          <button
            onClick={async () => {
              if (isDirty) {
                const res = await Swal.fire({
                  title: 'Leave without saving?',
                  text: "You have unsaved changes that will be lost.",
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonColor: '#f59e0b',
                  cancelButtonColor: '#6b7280',
                  confirmButtonText: 'Leave anyway'
                })
                if (!res.isConfirmed) return
              }
              navigate('/products')
            }}
            className="flex items-center gap-2 text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-colors group"
            style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--border)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-x-0.5"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
            Back
          </button>
          
          <div className="w-px h-5" style={{ backgroundColor: 'var(--border)' }}></div>
          
          <h1 className="text-[16px] font-bold" style={{ color: 'var(--text)' }}>
            {isEdit ? `Edit: ${form.name_en || `Product #${id}`}` : 'New Product'}
          </h1>
          {isEdit && (
            <span className="font-mono text-[11px] px-2 py-0.5 rounded"
              style={{ backgroundColor: 'var(--surface-2)', color: 'var(--color-brand)', border: '1px solid var(--border)' }}>
              {form.fgd || id}
            </span>
          )}
          {isDirty && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, #f59e0b 12%, transparent)', color: '#f59e0b', border: '1px solid color-mix(in srgb, #f59e0b 35%, transparent)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* <Toggle checked={form.is_active} onChange={v => set('is_active', v)} label="Active" /> */}
          {isDirty && (
            <button onClick={handleDiscard} className="t-btn-ghost text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Discard
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="t-btn-primary" style={saving ? { opacity: 0.6, cursor: 'not-allowed' } : {}}>
            {saving ? (
              <><span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Saving…</>
            ) : (
              isEdit ? 'Save Changes' : 'Create Product'
            )}
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0.5 px-8 pt-4 pb-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {availableTabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-[13px] font-semibold rounded-t-lg transition-all duration-150"
            style={tab === t
              ? { backgroundColor: 'var(--surface)', color: 'var(--text)', borderBottom: `2px solid var(--color-brand)` }
              : { color: 'var(--text-muted)' }
            }
            onMouseEnter={e => { if (tab !== t) e.currentTarget.style.backgroundColor = 'var(--surface-2)' }}
            onMouseLeave={e => { if (tab !== t) e.currentTarget.style.backgroundColor = '' }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {tab === 'Core'      && <CoreTab form={form} set={set} categories={catData} isEdit={isEdit} prices={prices} setPrices={setPrices} configs={configs} setConfigs={setConfigs} stocks={stocks} setStocks={setStocks} />}
        {tab === 'Fragrance' && <FragranceTab notes={notes} setNotes={setNotes} />}
        {tab === 'Media'     && <MediaTab mediaList={mediaList} setMediaList={setMediaList} productId={isEdit ? id : createdId} setPrimaryMedia={setPrimaryMedia} deleteMedia={deleteMedia} />}
        {tab === 'SEO'       && <SEOTab configs={configs} setConfigs={setConfigs} />}
        {tab === 'Inventory' && <InventoryTab stocks={stocks} setStocks={setStocks} />}
      </div>
    </div>
  )
}
