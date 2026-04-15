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
  getBundle, createBundle, updateBundle, deleteBundle,
  getCountries
} from '../../api'
import { useAuth } from '../../context/AuthContext'
import GalleryPicker from '../../components/GalleryPicker'
import ImageUploader from '../../components/ImageUploader'
import Swal from 'sweetalert2'
import CreatableSelect from 'react-select/creatable'

// ── Constants ─────────────────────────────────────────────────
const getFlagEmoji = (countryCode) => {
  if (!countryCode) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

const TABS = ['Core', 'Fragrance', 'Media', 'SEO', 'Inventory', 'Bundle', 'Related']

const EMPTY = {
  fgd: '', barcode: '', slug: '', name_en: '', name_ar: '',
  description_en: '', description_ar: '',
  category_id: '', subcategory_id: null,
  is_active: true, is_featured: false,
  tags: '',
  size_id: '',
  label_id: '',
  maximum_order_quantity: 0
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
function CoreTab({ form, set, categories, sizes, labels, isEdit, prices, setPrices, configs, setConfigs, stocks, setStocks, qc, countries }) {
  const updateVisibility = (countryId, val) =>
    setConfigs(prev => prev.map(c => c.country_id === countryId ? { ...c, is_visible: val } : c))

  const updateStocks = (countryId, val) => setStocks(prev => prev.map(s => s.country_id === countryId ? { ...s, quantity: Number(val) } : s))

  const handleCreateSize = async (rawInputValue) => {
    const inputValue = rawInputValue.toLowerCase().trim();

    // Generate suggested Arabic text for various measurements
    const match = inputValue.match(/^([\d.]+)\s*([a-z]+)?$/i);
    let suggestedAr = inputValue;

    if (match) {
      const numberPart = match[1];
      const unitPart = match[2] || '';

      const digitMap = { '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤', '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩', '.': '٫' };
      const arNumber = numberPart.split('').map(d => digitMap[d] || d).join('');

      const unitMap = {
        'ml': 'مل', 'l': 'لتر', 'gm': 'جم', 'kg': 'كجم', 'mg': 'مجم',
        'oz': 'أونصة', 'pcs': 'قطع', 'piece': 'قطعة', 'cm': 'سم', 'm': 'م'
      };

      const unitKey = unitPart.toLowerCase();
      const arUnit = unitMap[unitKey] || unitKey; // fallback to english string if unknown

      suggestedAr = arUnit ? `${arNumber} ${arUnit}`.trim() : arNumber;
    }

    const { value: formValues, isConfirmed } = await Swal.fire({
      title: 'Create Product Size',
      html: `
        <div class="flex flex-col gap-4 text-left mt-2" style="font-family: inherit;">
          <div>
            <label class="block text-[11px] font-bold mb-1.5 uppercase tracking-wider" style="color: var(--text-subtle)">Size (English)</label>
            <input id="swal-size-en" class="w-full px-3 py-2 border rounded-lg focus:outline-none" style="border-color: var(--border); background: var(--surface-2); color: var(--text)" value="${inputValue}">
          </div>
          <div>
            <label class="block text-[11px] font-bold mb-1.5 uppercase tracking-wider" style="color: var(--text-subtle)">Size (Arabic)</label>
            <input id="swal-size-ar" class="w-full px-3 py-2 border rounded-lg focus:outline-none text-right font-medium" dir="rtl" style="border-color: var(--border); background: var(--surface-2); color: var(--text)" value="${suggestedAr}">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Create Size',
      confirmButtonColor: 'var(--color-brand)',
      background: 'var(--surface)',
      color: 'var(--text)',
      preConfirm: () => {
        return {
          label_en: document.getElementById('swal-size-en').value,
          label_ar: document.getElementById('swal-size-ar').value
        }
      }
    });

    if (!isConfirmed || !formValues) return;

    try {
      const res = await api.post('/sizes', formValues);
      const newSize = res.data?.data || res.data;
      if (newSize?.id) {
        toast.success(`Created size: ${newSize.label_en}`);
        qc.invalidateQueries({ queryKey: ['sizes'] });
        set('size_id', newSize.id);
      }
    } catch (err) {
      toast.error('Failed to create size');
    }
  }

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
          <Field label="Max Order Quantity" hint="0 = no limit">
            <input type="number" min="0" className="t-input" value={form.maximum_order_quantity || 0}
              onChange={e => set('maximum_order_quantity', parseInt(e.target.value) || 0)} />
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
          <div className="grid grid-cols-1 gap-3 mt-2">
            <Field label="Product Size">
              <CreatableSelect
                isClearable
                placeholder="— select or type to create —"
                options={sizes?.map(sz => ({ value: sz.id, label: `${sz.label_en} / ${sz.label_ar}` }))}
                value={form.size_id ? { value: form.size_id, label: sizes?.find(s => s.id == form.size_id) ? `${sizes.find(s => s.id == form.size_id).label_en} / ${sizes.find(s => s.id == form.size_id).label_ar}` : '' } : null}
                onChange={selected => set('size_id', selected ? selected.value : '')}
                onCreateOption={handleCreateSize}
                styles={{
                  control: (base) => ({
                    ...base,
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    minHeight: '42px',
                    borderRadius: '0.5rem',
                    boxShadow: 'none',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: 'var(--border)'
                    }
                  }),
                  singleValue: (base) => ({
                    ...base,
                    color: 'var(--text)',
                    fontSize: '14px'
                  }),
                  input: (base) => ({
                    ...base,
                    color: 'var(--text)',
                    fontSize: '14px'
                  }),
                  menu: (base) => ({
                    ...base,
                    backgroundColor: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    zIndex: 50
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused ? 'var(--color-brand)' : 'transparent',
                    color: state.isFocused ? 'white' : 'var(--text)',
                    fontSize: '13px',
                    cursor: 'pointer'
                  })
                }}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 mt-4">
            <Field label="Product Label" hint="Optional badge (e.g. Hot, New)">
              <select className="t-input" value={form.label_id || ''}
                onChange={e => set('label_id', e.target.value)}>
                <option value="">— none —</option>
                {labels?.map(lb => (
                  <option key={lb.id} value={lb.id}>{lb.name_en} / {lb.name_ar}</option>
                ))}
              </select>
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
            const country = countries?.find(co => co.id === c.country_id)
            return (
              <div key={c.country_id} className="flex flex-col gap-2 p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-soft)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getFlagEmoji(country?.code)}</span>
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
            const country = countries?.find(c => c.id === p.country_id)
            return (
              <Field key={p.country_id} label={`${country?.name_en} Price (${country?.currency_code})`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none" title={country?.name_en}>{getFlagEmoji(country?.code)}</span>
                  <input className="t-input w-full shadow-none" type="number"
                    step={country?.decimal_places === 3 ? '0.001' : '0.01'}
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
            const country = countries?.find(c => c.id === s.country_id)
            return (
              <Field key={s.country_id} label={`${country?.name_en} Stock`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl leading-none">{getFlagEmoji(country?.code)}</span>
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
    { key: 'top', label: 'Top Notes', accent: '#d97706', border: 'color-mix(in srgb, #d97706 30%, transparent)', bg: 'color-mix(in srgb, #d97706 8%, transparent)' },
    { key: 'heart', label: 'Heart Notes', accent: '#e11d48', border: 'color-mix(in srgb, #e11d48 30%, transparent)', bg: 'color-mix(in srgb, #e11d48 8%, transparent)' },
    { key: 'base', label: 'Base Notes', accent: 'var(--color-brand)', border: 'color-mix(in srgb, var(--color-brand) 30%, transparent)', bg: 'color-mix(in srgb, var(--color-brand) 8%, transparent)' },
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
function SEOTab({ configs, setConfigs, countries }) {
  const [expandedId, setExpandedId] = useState(null)

  const update = (countryId, field, val) =>
    setConfigs(prev => prev.map(c => c.country_id === countryId ? { ...c, [field]: val } : c))

  return (
    <div className="flex flex-col gap-2">
      {configs.map(c => {
        const country = countries?.find(co => co.id === c.country_id)
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
                  {getFlagEmoji(country?.code)}
                </div>
                <div>
                  <h4 className="text-[14px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                    {country?.name_en} <span className="text-[10px] opacity-30 ml-1 uppercase">{country?.code}</span>
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
function InventoryTab({ stocks, setStocks, countries }) {
  const update = (countryId, val) =>
    setStocks(prev => prev.map(s => s.country_id === countryId ? { ...s, quantity: Number(val) } : s))

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
      {stocks.map(s => {
        const country = countries?.find(c => c.id === s.country_id)
        return (
          <SectionCard key={s.country_id} title={`${country?.name_en} Stock`}>
            <Field label="Quantity in Hand" hint="units available">
              <div className="flex items-center gap-3">
                <span className="text-xl leading-none">{getFlagEmoji(country?.code)}</span>
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

// ── Tab: Bundle ───────────────────────────────────────────────
function BundleTab({ isBundle, setIsBundle, items, setItems }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeImageIdx, setActiveImageIdx] = useState(null)
  // Per-item search state (keyed by index) to avoid shared-search bugs
  const [searches, setSearches] = useState({})
  const [results, setResults] = useState({})
  const [loading, setLoadingMap] = useState({})

  const updateItem = (idx, field, val) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
    setSearches(prev => { const n = { ...prev }; delete n[idx]; return n })
    setResults(prev => { const n = { ...prev }; delete n[idx]; return n })
    setLoadingMap(prev => { const n = { ...prev }; delete n[idx]; return n })
  }

  const addLinked = () => setItems(prev => [...prev, { product_id: null, _type: 'linked', component_name_en: '', component_name_ar: '', component_image_url: null, qty: 1, sort_order: prev.length }])
  const addStandalone = () => setItems(prev => [...prev, { product_id: null, _type: 'standalone', component_name_en: '', component_name_ar: '', component_image_url: '', qty: 1, sort_order: prev.length }])

  const handleSearch = async (idx, val) => {
    setSearches(prev => ({ ...prev, [idx]: val }))
    if (!val || val.length < 2) { setResults(prev => ({ ...prev, [idx]: [] })); return }
    setLoadingMap(prev => ({ ...prev, [idx]: true }))
    try {
      const res = await api.get('/products', { params: { search: val, limit: 6, admin: 1 } })
      setResults(prev => ({ ...prev, [idx]: res.data || res || [] }))
    } catch { /* ignore */ }
    finally { setLoadingMap(prev => ({ ...prev, [idx]: false })) }
  }

  const selectProduct = (idx, prod) => {
    updateItem(idx, 'product_id', prod.id)
    updateItem(idx, 'component_name_en', prod.name_en)
    updateItem(idx, 'component_name_ar', prod.name_ar)
    updateItem(idx, 'component_image_url', null)   // linked products use their own image; no override
    setSearches(prev => ({ ...prev, [idx]: '' }))
    setResults(prev => ({ ...prev, [idx]: [] }))
  }

  const clearProduct = (idx) => {
    updateItem(idx, 'product_id', null)
    updateItem(idx, 'component_name_en', '')
    updateItem(idx, 'component_name_ar', '')
    setSearches(prev => ({ ...prev, [idx]: '' }))
    setResults(prev => ({ ...prev, [idx]: [] }))
  }

  // Derive type: prefer _type flag (set on add / hydration), fallback to product_id presence
  const getType = (item) => item._type || (item.product_id ? 'linked' : 'standalone')

  return (
    <div className="flex flex-col gap-6 h-screen">
      {/* ── Enable toggle ── */}
      <SectionCard title="Bundle Configuration">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>Enable Bundle</h4>
            <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>Turn this product into a bundle of multiple items</p>
          </div>
          <Toggle checked={isBundle} onChange={setIsBundle} label={isBundle ? 'Enabled' : 'Disabled'} />
        </div>
      </SectionCard>

      {isBundle && (
        <div className="flex flex-col gap-4">

          {/* ── Header row ── */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-subtle)' }}>Bundle Items</h3>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-subtle)', opacity: 0.5 }}>{items.length} item{items.length !== 1 ? 's' : ''} total</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={addLinked}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-bold transition-colors"
                style={{ backgroundColor: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(96,165,250,0.2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(96,165,250,0.12)'}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                + Linked Product
              </button>
              <button type="button" onClick={addStandalone}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-bold transition-colors"
                style={{ backgroundColor: 'rgba(251,191,36,0.12)', color: '#f59e0b', border: '1px solid rgba(251,191,36,0.25)' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.12)'}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                + Standalone
              </button>
            </div>
          </div>

          {/* ── Empty state ── */}
          {!items.length && (
            <div className="py-14 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed gap-3"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <svg className="w-5 h-5 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[13px] font-semibold" style={{ color: 'var(--text-subtle)' }}>No items yet</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-subtle)', opacity: 0.5 }}>Add a linked product or a standalone component above</p>
              </div>
            </div>
          )}

          {/* ── Item cards ── */}
          <div className="flex flex-col gap-3">
            {items.map((item, idx) => {
              const type = getType(item)
              const isLinked = type === 'linked'
              const itemSearch = searches[idx] || ''
              const itemResults = results[idx] || []
              const isSearching = loading[idx] || false

              return (
                <div key={idx} className="rounded-2xl"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>

                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-t-2xl"
                    style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-black opacity-30 tabular-nums">#{String(idx + 1).padStart(2, '0')}</span>
                      {isLinked ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ color: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)' }}>
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Linked Product
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ color: '#f59e0b', backgroundColor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          Standalone
                        </span>
                      )}
                    </div>
                    <button type="button" onClick={() => removeItem(idx)}
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-colors"
                      style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.06)' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.14)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)'}>
                      Remove
                    </button>
                  </div>

                  {/* Card body */}
                  <div className="p-4">
                    <div className="grid grid-cols-12 gap-4 items-end">

                      {/* ─── LINKED PRODUCT fields ─── */}
                      {isLinked && (
                        <>
                          {/* Product search / linked chip — col 1..5 */}
                          <div className="col-span-12 md:col-span-5">
                            <Field label="Linked Product" hint="Type to search by name or FGD">
                              {item.product_id ? (
                                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                                  style={{ backgroundColor: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.22)' }}>
                                  <svg className="w-3.5 h-3.5 shrink-0" style={{ color: '#60a5fa' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                  </svg>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>{item.component_name_en || `Product #${item.product_id}`}</p>
                                    <p className="text-[9px] font-mono opacity-40">ID: {item.product_id}</p>
                                  </div>
                                  <button type="button" onClick={() => clearProduct(idx)}
                                    className="shrink-0 text-[11px] font-bold opacity-30 hover:opacity-80 transition-opacity ml-1"
                                    title="Unlink product">✕</button>
                                </div>
                              ) : (
                                <div className="relative">
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <svg className="w-3.5 h-3.5 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                  </div>
                                  <input className="t-input text-[12px] pl-9"
                                    placeholder="Search products by name or FGD…"
                                    value={itemSearch}
                                    onChange={e => handleSearch(idx, e.target.value)}
                                    autoComplete="off"
                                  />
                                  {isSearching && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                      <div className="animate-spin h-3.5 w-3.5 border-2 rounded-full" style={{ borderColor: 'rgba(96,165,250,0.3)', borderTopColor: '#60a5fa' }} />
                                    </div>
                                  )}
                                  {itemResults.length > 0 && (
                                    <div className="absolute z-[100] left-0 right-0 mt-1 rounded-xl shadow-2xl border overflow-hidden"
                                      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                      {itemResults.map(p => (
                                        <div key={p.id} onClick={() => selectProduct(idx, p)}
                                          className="px-3 py-2.5 cursor-pointer transition-colors flex items-center justify-between border-b last:border-0"
                                          style={{ borderColor: 'var(--border)' }}
                                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(96,165,250,0.06)'}
                                          onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                                          <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--text)' }}>{p.name_en}</span>
                                          <span className="text-[10px] font-mono shrink-0 ml-3 opacity-30">{p.fgd}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </Field>
                          </div>

                          {/* Name EN — readonly autofill, col 6..8 */}
                          <div className="col-span-6 md:col-span-3">
                            <Field label="Name (EN)" hint="Autofilled">
                              <input className="t-input text-[12px]" readOnly
                                value={item.component_name_en}
                                placeholder="Auto from product"
                                style={{ opacity: 0.55, cursor: 'not-allowed' }}
                              />
                            </Field>
                          </div>

                          {/* Name AR — readonly autofill, col 9..10 */}
                          <div className="col-span-6 md:col-span-2">
                            <Field label="Name (AR)" hint="Autofilled">
                              <input className="t-input text-[12px] text-right" dir="rtl" readOnly
                                value={item.component_name_ar}
                                placeholder="تلقائي"
                                style={{ opacity: 0.55, cursor: 'not-allowed' }}
                              />
                            </Field>
                          </div>
                        </>
                      )}

                      {/* ─── STANDALONE fields ─── */}
                      {!isLinked && (
                        <>
                          {/* Image picker — col 1..2 */}
                          <div className="col-span-4 md:col-span-2">
                            <Field label="Image" hint="optional">
                              <div className="relative aspect-square rounded-xl overflow-hidden border cursor-pointer group"
                                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}
                                onClick={() => { setActiveImageIdx(idx); setPickerOpen(true) }}>
                                {item.component_image_url ? (
                                  <img src={resolveUrl(item.component_image_url)} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                    <svg className="w-5 h-5 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="text-[8px] font-bold uppercase opacity-20">Pick</span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-[9px] font-bold uppercase text-white">Change</span>
                                </div>
                              </div>
                            </Field>
                          </div>

                          {/* Name EN — col 3..6 */}
                          <div className="col-span-8 md:col-span-4">
                            <Field label="Name (EN)">
                              <input className="t-input text-[12px]"
                                value={item.component_name_en}
                                onChange={e => updateItem(idx, 'component_name_en', e.target.value)}
                                placeholder="e.g. Body Oil"
                              />
                            </Field>
                          </div>

                          {/* Name AR — col 7..10 */}
                          <div className="col-span-12 md:col-span-4">
                            <Field label="Name (AR)">
                              <input className="t-input text-[12px] text-right" dir="rtl"
                                value={item.component_name_ar}
                                onChange={e => updateItem(idx, 'component_name_ar', e.target.value)}
                                placeholder="زيت الجسم"
                              />
                            </Field>
                          </div>
                        </>
                      )}

                      {/* ─── Qty + Sort — always last 2 cols ─── */}
                      <div className="col-span-12 md:col-span-2 grid grid-cols-2 gap-3">
                        <Field label="Qty">
                          <input type="number" className="t-input text-[12px] font-bold text-center" min="1"
                            value={item.qty}
                            onChange={e => updateItem(idx, 'qty', Number(e.target.value))}
                          />
                        </Field>
                        <Field label="Sort">
                          <input type="number" className="t-input text-[12px] text-center"
                            value={item.sort_order}
                            onChange={e => updateItem(idx, 'sort_order', Number(e.target.value))}
                          />
                        </Field>
                      </div>

                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <GalleryPicker open={pickerOpen} onClose={() => setPickerOpen(false)} multiple={false}
        onSelect={(path) => {
          if (activeImageIdx !== null) {
            updateItem(activeImageIdx, 'component_image_url', path.startsWith('/') ? path : `/gallery/${path}`)
          }
          setActiveImageIdx(null)
        }}
      />
    </div>
  )
}

// ── Tab: Related Products ────────────────────────────────────────────
function RelatedTab({ items, setItems }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (val) => {
    setSearchTerm(val)
    if (!val || val.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res = await api.get('/products', { params: { search: val, limit: 10, admin: 1 } })
      setResults(res.data?.data || res.data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const addProduct = (prod) => {
    if (!items.find(i => i.related_product_id === prod.id)) {
      setItems(prev => [...prev, { related_product_id: prod.id, name_en: prod.name_en, fgd: prod.fgd }])
    }
    setSearchTerm('')
    setResults([])
  }

  const removeProduct = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col gap-6 h-screen">
      <SectionCard title="Manual Related Products">
        <p className="text-[11px] mb-2" style={{ color: 'var(--text-subtle)' }}>
          If left empty, the storefront will automatically suggest 4 active products from the same category.
        </p>

        <div className="relative mb-4">
          <input className="t-input w-full"
            placeholder="Search products by name or FGD to add..."
            value={searchTerm}
            onChange={e => handleSearch(e.target.value)}
          />
          {loading && <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-3.5 w-3.5 border-2 rounded-full border-t-transparent" style={{ borderColor: 'rgba(96,165,250,0.3)', borderTopColor: '#60a5fa' }} />
          </div>}
          {results.length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl shadow-2xl border overflow-hidden max-h-60 overflow-y-auto" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
              {results.map(p => (
                <div key={p.id} onClick={() => addProduct(p)}
                  className="px-4 py-3 cursor-pointer transition-colors border-b last:border-0 hover:bg-black/5 flex justify-between items-center"
                  style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>{p.name_en}</span>
                  <span className="text-[10px] font-mono opacity-50" style={{ color: 'var(--text-subtle)' }}>{p.fgd}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item, idx) => (
            <div key={item.related_product_id || idx} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-2)' }}>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black opacity-30 w-6">#{idx + 1}</span>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{item.name_en}</span>
                <span className="text-[10px] font-mono opacity-50" style={{ color: 'var(--text-subtle)' }}>{item.fgd}</span>
              </div>
              <button type="button" onClick={() => removeProduct(idx)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-8 text-[12px] border border-dashed rounded-xl" style={{ borderColor: 'var(--border)', color: 'var(--text-subtle)' }}>
              No manual related products selected.
            </div>
          )}
        </div>
      </SectionCard>
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
  const [resetKey, setResetKey] = useState(0) // Forces hydration logic to re-run on discard

  const [tab, setTab] = useState(availableTabs[0] || 'Core')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY, attributes: [] })
  const [notes, setNotes] = useState({ top: { ...EMPTY_NOTE }, heart: { ...EMPTY_NOTE }, base: { ...EMPTY_NOTE } })
  const [mediaList, setMediaList] = useState([])
  const [configs, setConfigs] = useState([])
  const [prices, setPrices] = useState([])
  const [stocks, setStocks] = useState([])

  const [isBundle, setIsBundle] = useState(false)
  const [bundleItems, setBundleItems] = useState([])
  const [originalBundleId, setOriginalBundleId] = useState(null)

  const [relatedItems, setRelatedItems] = useState([])


  // Dirty tracking via ref (no extra state = no re-render loops)
  const savedRef = useRef(null)
  const snap = (f, n, c, p, s, ib, bi, ri) => JSON.stringify({ f, n, c, p, s, ib, bi, ri })
  const isDirty = savedRef.current !== null && savedRef.current !== snap(form, notes, configs, prices, stocks, isBundle, bundleItems, relatedItems)
  const markClean = () => { savedRef.current = snap(form, notes, configs, prices, stocks, isBundle, bundleItems, relatedItems) }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Fetch categories
  const { data: catData } = useQuery({
    queryKey: ['categories-admin'],
    queryFn: () => api.get('/categories?admin=1'),
    select: res => res.data?.data || res.data || [],
  })

  // Fetch countries
  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: getCountries,
    select: res => res.data?.data || res.data || [],
  })

  // Populate regional defaults when countries arrive (for new products)
  useEffect(() => {
    if (!isEdit && countries?.length && !configs.length) {
      setConfigs(countries.map(c => ({ country_id: c.id, is_visible: 1, slug_override: '', meta_title_en: '', meta_title_ar: '', meta_desc_en: '', meta_desc_ar: '', sort_order: 0 })))
      setPrices(countries.map(c => ({ country_id: c.id, currency_id: c.currency_id, regular_price: '' })))
      setStocks(countries.map(c => ({ country_id: c.id, quantity: 0 })))
    }
  }, [countries, isEdit, configs.length])

  // Fetch sizes
  const { data: sizes } = useQuery({
    queryKey: ['sizes'],
    queryFn: () => api.get('/sizes'),
    select: res => res?.data || res || [],
  })

  // Fetch labels
  const { data: labels } = useQuery({
    queryKey: ['labels'],
    queryFn: () => api.get('/labels'),
    select: res => res?.data || res || [],
  })

  // Fetch product on edit
  const { data: productData, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
    enabled: !!isEdit,
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
      size_id: p.size_id || '',
      label_id: p.label_id || '',
      maximum_order_quantity: p.maximum_order_quantity || 0,
      tags: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
      attributes: p.attributes ? Object.entries(p.attributes).map(([k, v]) => ({ key: k, value: String(v) })) : [],
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
    // Hydrate manual related products
    if (p.related_products?.length) {
      setRelatedItems(p.related_products)
    } else {
      setRelatedItems([])
    }
    // Snapshot will be set once configs+prices effects also fire (see combined effect)
  }, [productData, resetKey])

  // Fetch country configs
  const { data: ccData } = useQuery({
    queryKey: ['product-countries', id],
    queryFn: () => getCountryConfigs(id),
    enabled: !!isEdit,
    select: r => r?.data || r || [],
  })
  useEffect(() => {
    if (!countries?.length || !ccData) return
    setConfigs(countries.map(c => {
      const saved = Array.isArray(ccData) ? ccData.find(x => x.country_id === c.id) : null
      return saved ? { ...saved } : { country_id: c.id, is_visible: 1, slug_override: '', meta_title_en: '', meta_title_ar: '', meta_desc_en: '', meta_desc_ar: '', sort_order: 0 }
    }))
  }, [ccData, resetKey, countries])

  // Fetch pricing
  const { data: pricingData } = useQuery({
    queryKey: ['pricing', id],
    queryFn: () => getPricing(id),
    enabled: !!isEdit,
    select: r => r?.data || r || [],
  })
  useEffect(() => {
    if (!countries?.length || !pricingData) return
    setPrices(countries.map(c => {
      const saved = Array.isArray(pricingData) ? pricingData.find(p => p.country_id === c.id) : null
      return saved
        ? { country_id: c.id, currency_id: c.currency_id, regular_price: saved.regular_price }
        : { country_id: c.id, currency_id: c.currency_id, regular_price: '' }
    }))
  }, [pricingData, resetKey, countries])

  // Fetch stock
  const { data: stockData } = useQuery({
    queryKey: ['stock', id],
    queryFn: () => getProductStock(id),
    enabled: !!isEdit,
    select: r => r?.data || r || [],
  })
  useEffect(() => {
    if (!countries?.length || !stockData) return
    setStocks(countries.map(c => {
      const saved = Array.isArray(stockData) ? stockData.find(s => s.country_id === c.id) : null
      return saved ? { country_id: c.id, quantity: saved.quantity } : { country_id: c.id, quantity: 0 }
    }))
  }, [stockData, resetKey, countries])

  // Fetch bundle
  const { data: bundleData } = useQuery({
    queryKey: ['bundle', id],
    queryFn: () => getBundle(id),
    enabled: !!isEdit,
    select: r => r?.data || r || null,
  })
  useEffect(() => {
    if (!bundleData) {
      setIsBundle(false)
      setBundleItems([])
      setOriginalBundleId(null)
      return
    }
    setIsBundle(true)
    setOriginalBundleId(bundleData.bundle_id)
    // Stamp _type so BundleTab renders the correct fields for each item
    setBundleItems((bundleData.items || []).map(item => ({
      ...item,
      _type: item.product_id ? 'linked' : 'standalone',
    })))
  }, [bundleData, resetKey])

  // Tracker for the latest state to avoid closure bugs in the timeout snapshot
  const latestState = useRef()
  latestState.current = { form, notes, configs, prices, stocks, isBundle, bundleItems, relatedItems }

  // Mark clean snapshot once all data is in state
  // For new products: immediately after mount
  useEffect(() => {
    if (isEdit) return
    savedRef.current = snap(
      { ...EMPTY, attributes: [] },
      { top: { ...EMPTY_NOTE }, heart: { ...EMPTY_NOTE }, base: { ...EMPTY_NOTE } },
      countries.map(c => ({ country_id: c.id, is_visible: 1, slug_override: '', meta_title_en: '', meta_title_ar: '', meta_desc_en: '', meta_desc_ar: '', sort_order: 0 })),
      countries.map(c => ({ country_id: c.id, currency_id: c.currency_id, regular_price: '' })),
      countries.map(c => ({ country_id: c.id, quantity: 0 })),
      false,
      [],
      []
    )
  }, [isEdit])

  // For edit products: wait for all data dependencies to arrive before marking clean
  useEffect(() => {
    if (!isEdit || !productData || !ccData || !pricingData) return
    const t = setTimeout(() => {
      if (savedRef.current === null) {
        const { form, notes, configs, prices, stocks, isBundle, bundleItems, relatedItems } = latestState.current
        savedRef.current = snap(form, notes, configs, prices, stocks, isBundle, bundleItems, relatedItems)
      }
    }, 250) // Increased to guarantee all data including bundle is in
    return () => clearTimeout(t)
  }, [isEdit, productData, ccData, pricingData, stockData, bundleData, resetKey])

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
        category_id: Number(form.category_id),
        subcategory_id: form.subcategory_id ? Number(form.subcategory_id) : null,
        is_active: form.is_active ? 1 : 0,
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
        api.put(`/products/${finalProductId}/stock`, { stocks }),

        // Handle Bundle saving
        (async () => {
          if (isBundle) {
            if (originalBundleId) {
              await updateBundle(originalBundleId, bundleItems)
            } else {
              await createBundle({ product_id: finalProductId, items: bundleItems })
            }
          } else if (originalBundleId) {
            await deleteBundle(finalProductId)
          }
        })(),
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
        api.put(`/products/${finalProductId}/related`, { related_products: relatedItems }),
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
      setStocks((countries || []).map(c => ({ country_id: c.id, quantity: 0 })))
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
        {tab === 'Core' && <CoreTab form={form} set={set} categories={catData} sizes={sizes} labels={labels} isEdit={isEdit} prices={prices} setPrices={setPrices} configs={configs} setConfigs={setConfigs} stocks={stocks} setStocks={setStocks} qc={qc} countries={countries} />}
        {tab === 'Fragrance' && <FragranceTab notes={notes} setNotes={setNotes} />}
        {tab === 'Media' && <MediaTab mediaList={mediaList} setMediaList={setMediaList} productId={isEdit ? id : createdId} setPrimaryMedia={setPrimaryMedia} deleteMedia={deleteMedia} />}
        {tab === 'SEO' && <SEOTab configs={configs} setConfigs={setConfigs} countries={countries} />}
        {tab === 'Inventory' && <InventoryTab stocks={stocks} setStocks={setStocks} countries={countries} />}
        {tab === 'Bundle' && <BundleTab isBundle={isBundle} setIsBundle={setIsBundle} items={bundleItems} setItems={setBundleItems} />}
        {tab === 'Related' && <RelatedTab items={relatedItems} setItems={setRelatedItems} />}

      </div>
    </div>
  )
}
