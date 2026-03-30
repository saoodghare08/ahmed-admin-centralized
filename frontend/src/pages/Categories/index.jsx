import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createCategory, updateCategory, deleteCategory, restoreCategory, hardDeleteCategory,
         createSubcategory, updateSubcategory, restoreSubcategory, hardDeleteSubcategory,
         reorderCategories, reorderSubcategories, importCategories } from '../../api'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import toast from 'react-hot-toast'
import { useState, useRef } from 'react'
import ImageUploader from '../../components/ImageUploader'
import Swal from 'sweetalert2'

// ── Helper: auto-generate slug from English name ────────────
const toSlug = (str) =>
  str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').trim()

// ── API helpers that need direct client access ───────────────
import api from '../../api/client'
const getAdminCategories = (status) => api.get(`/categories?admin=1${status === 'bin' ? '&status=bin' : ''}`)
const deleteSubcategoryAction  = (subId) => api.delete(`/categories/subcategories/${subId}`)


// ── Input Component ──────────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-subtle)' }}>
        {label}{required && <span className="text-red-400 ml-1">*</span>}
        {hint && <span className="ml-2 normal-case font-normal tracking-normal" style={{ color: 'var(--text-subtle)' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 't-input'

// ── Slide-over Drawer ────────────────────────────────────────
function Drawer({ open, onClose, title, subtitle, children, onSave, saving }) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-30 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 w-[480px] z-40 flex flex-col" style={{ backgroundColor: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-bold text-[16px]" style={{ color: 'var(--text)' }}>{title}</h2>
            {subtitle && <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--text-muted)' }}
          >×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">{children}</div>
        <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="t-btn-ghost flex-1 justify-center py-2.5">Cancel</button>
          <button onClick={onSave} disabled={saving} className="t-btn-primary flex-1 justify-center py-2.5" style={saving ? { opacity: 0.5 } : {}}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Category Form ────────────────────────────────────────────
const EMPTY_CAT = { name_en: '', name_ar: '', slug: '', image_url: '', sort_order: 0, is_active: true }

function CategoryDrawer({ open, onClose, initial, onDone }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(() => initial ? { ...EMPTY_CAT, ...initial } : { ...EMPTY_CAT })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleNameEn = (v) => {
    set('name_en', v)
    if (!isEdit) set('slug', toSlug(v))
  }

  const handleClose = () => {
    setForm({ ...EMPTY_CAT })
    setSaving(false)
    onClose()
  }

  const handleSave = async () => {
    if (!form.name_en || !form.slug) { toast.error('Name (EN) and slug are required'); return }
    setSaving(true)
    try {
      if (isEdit) {
        await updateCategory(initial.id, form)
        toast.success('Category updated')
      } else {
        await createCategory(form)
        toast.success('Category created')
      }
      onDone()
      handleClose()
    } catch (e) {
      toast.error(e.error || e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Edit Category' : 'New Category'}
      subtitle={isEdit ? `ID: ${initial.id}` : 'Creates a top-level product category'}
      onSave={handleSave}
      saving={saving}
    >
      <Field label="Name (English)" required>
        <input className={inputCls} value={form.name_en} onChange={e => handleNameEn(e.target.value)} placeholder="e.g. Perfumes" />
      </Field>

      <Field label="Name (Arabic)" required>
        <input className={`${inputCls} text-right`} dir="rtl" value={form.name_ar} onChange={e => set('name_ar', e.target.value)} placeholder="العطور" />
      </Field>

      <Field label="Slug" required hint="URL-safe identifier, auto-generated from EN name">
        <input className={`${inputCls} font-mono text-[12px]`} value={form.slug} onChange={e => set('slug', toSlug(e.target.value))} placeholder="e.g. perfumes" />
      </Field>

      <Field label="Image" hint="optional">
        <ImageUploader
          value={form.image_url}
          onChange={(url) => set('image_url', url)}
          uploadType="category"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Sort Order">
          <input className={inputCls} type="number" value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} />
        </Field>
        <Field label="Status">
          <select className={inputCls} value={form.is_active ? '1' : '0'} onChange={e => set('is_active', e.target.value === '1')}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </Field>
      </div>
    </Drawer>
  )
}

// ── Subcategory Form ─────────────────────────────────────────
const EMPTY_SUB = { name_en: '', name_ar: '', slug: '', image_url: '', sort_order: 0, is_active: true }

function SubcategoryDrawer({ open, onClose, initial, categoryId, categoryName, onDone }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(() => initial ? { ...EMPTY_SUB, ...initial } : { ...EMPTY_SUB })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleNameEn = (v) => {
    set('name_en', v)
    if (!isEdit) set('slug', toSlug(v))
  }

  const handleClose = () => {
    setForm({ ...EMPTY_SUB })
    setSaving(false)
    onClose()
  }

  const handleSave = async () => {
    if (!form.name_en || !form.slug) { toast.error('Name (EN) and slug are required'); return }
    setSaving(true)
    try {
      if (isEdit) {
        await updateSubcategory(initial.id, form)
        toast.success('Subcategory updated')
      } else {
        await createSubcategory(categoryId, form)
        toast.success('Subcategory created')
      }
      onDone()
      handleClose()
    } catch (e) {
      toast.error(e.error || e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Edit Subcategory' : 'New Subcategory'}
      subtitle={`Under: ${categoryName}`}
      onSave={handleSave}
      saving={saving}
    >
      <Field label="Name (English)" required>
        <input className={inputCls} value={form.name_en} onChange={e => handleNameEn(e.target.value)} placeholder="e.g. Oud Perfumes" />
      </Field>

      <Field label="Name (Arabic)" required>
        <input className={`${inputCls} text-right`} dir="rtl" value={form.name_ar} onChange={e => set('name_ar', e.target.value)} placeholder="مثال: عطور العود" />
      </Field>

      <Field label="Slug" required hint="auto-generated from EN name">
        <input className={`${inputCls} font-mono text-[12px]`} value={form.slug} onChange={e => set('slug', toSlug(e.target.value))} placeholder="e.g. oud-perfumes" />
      </Field>

      <Field label="Image" hint="optional">
        <ImageUploader
          value={form.image_url}
          onChange={(url) => set('image_url', url)}
          uploadType="category"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Sort Order">
          <input className={inputCls} type="number" value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} />
        </Field>
        <Field label="Status">
          <select className={inputCls} value={form.is_active ? '1' : '0'} onChange={e => set('is_active', e.target.value === '1')}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </Field>
      </div>
    </Drawer>
  )
}

// ── Main Page ────────────────────────────────────────────────
export default function Categories() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState([])

  const [catDrawer, setCatDrawer]   = useState({ open: false, data: null })
  const [subDrawer, setSubDrawer]   = useState({ open: false, data: null, catId: null, catName: '' })
  const [showBin, setShowBin]       = useState(false)

  const fileInputRef = useRef(null)
  const [importing, setImporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['categories-admin', showBin],
    queryFn:  () => getAdminCategories(showBin ? 'bin' : undefined),
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['categories-admin'] })

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await importCategories(formData)
      toast.success(`Imported ${res.imported} rows successfully!`)
      refresh()
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Import failed')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteCat = async (id) => {
    const res = await Swal.fire({
      title: 'Delete Category?',
      text: 'All subcategories will also be removed. This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    })
    if (!res.isConfirmed) return
    try {
      await deleteCategory(id); toast.success('Category deleted'); refresh()
    } catch { toast.error('Cannot delete — products may be linked to this category') }
  }

  const handleDeleteSub = async (id, e) => {
    e.stopPropagation()
    const res = await Swal.fire({
      title: 'Delete Subcategory?',
      text: 'Are you sure you want to delete this subcategory?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    })
    if (!res.isConfirmed) return
    try {
      await deleteSubcategoryAction(id); toast.success('Subcategory deleted'); refresh()
    } catch { toast.error('Cannot delete — products may be linked') }
  }

  const handleRestoreCat = async (id) => {
    try { await restoreCategory(id); toast.success('Category restored'); refresh() }
    catch { toast.error('Failed to restore category') }
  }

  const handleHardDeleteCat = async (id) => {
    const res = await Swal.fire({ title: 'Permanently Delete?', text: 'This action cannot be undone and will erase it from the database forever.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, delete forever!' })
    if (res.isConfirmed) {
      try { await hardDeleteCategory(id); toast.success('Permanently deleted'); refresh() }
      catch { toast.error('Failed to delete permanently') }
    }
  }

  const handleRestoreSub = async (id) => {
    try { await restoreSubcategory(id); toast.success('Subcategory restored'); refresh() }
    catch { toast.error('Failed to restore subcategory') }
  }

  const handleHardDeleteSub = async (id) => {
    const res = await Swal.fire({ title: 'Permanently Delete?', text: 'This action cannot be undone.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Yes, delete forever!' })
    if (res.isConfirmed) {
      try { await hardDeleteSubcategory(id); toast.success('Permanently deleted'); refresh() }
      catch { toast.error('Failed to delete permanently') }
    }
  }

  const openAddSub = (cat, e) => {
    e.stopPropagation()
    setSubDrawer({ open: true, data: null, catId: cat.id, catName: cat.name_en })
  }

  const openEditSub = (sub, cat, e) => {
    e.stopPropagation()
    setSubDrawer({ open: true, data: sub, catId: cat.id, catName: cat.name_en })
  }

  // Build rows from data
  const categories = data?.data || []

  const onDragEnd = async (result) => {
    const { source, destination, type } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const oldData = qc.getQueryData(['categories-admin'])
    const newCategories = Array.from(oldData?.data || [])

    if (type === 'category') {
      const [moved] = newCategories.splice(source.index, 1)
      newCategories.splice(destination.index, 0, moved)
      const newOrder = newCategories.map((c, i) => ({ id: c.id, sort_order: i }))
      
      qc.setQueryData(['categories-admin'], { ...oldData, data: newCategories })
      try { await reorderCategories(newOrder); refresh() }
      catch { toast.error('Failed to sort categories'); refresh() }
    } else if (type === 'subcategory') {
      const sourceCatIdx = newCategories.findIndex(c => String(c.id) === source.droppableId)
      const destCatIdx = newCategories.findIndex(c => String(c.id) === destination.droppableId)
      const sourceCat = newCategories[sourceCatIdx]
      const destCat = newCategories[destCatIdx]
      
      const sourceSubs = Array.from(sourceCat.subcategories || [])
      const destSubs = source.droppableId === destination.droppableId ? sourceSubs : Array.from(destCat.subcategories || [])
      
      const [movedSub] = sourceSubs.splice(source.index, 1)
      movedSub.category_id = destCat.id
      destSubs.splice(destination.index, 0, movedSub)
      
      newCategories[sourceCatIdx] = { ...sourceCat, subcategories: sourceSubs }
      newCategories[destCatIdx] = { ...destCat, subcategories: destSubs }
      
      const newOrder = destSubs.map((s, i) => ({ id: s.id, sort_order: i, category_id: destCat.id }))
      qc.setQueryData(['categories-admin'], { ...oldData, data: newCategories })
      try { await reorderSubcategories(newOrder); refresh() }
      catch { toast.error('Failed to move subcategory'); refresh() }
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            Categories
            {showBin ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 uppercase tracking-widest leading-none flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                Recycle Bin
              </span>
            ) : null}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {categories.length} categories · Click row to expand subcategories
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
             onClick={() => setShowBin(!showBin)}
             className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-bold transition-all shadow-sm border ${showBin ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white text-black/60 border-black/10 hover:bg-black/5 active:scale-95'}`}
           >
             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
             {showBin ? 'Exit Bin' : 'View Bin'}
          </button>
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImport} 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="text-[13px] px-4 py-2 rounded-lg font-medium transition-all hover:bg-(--border)"
            style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)', opacity: importing ? 0.6 : 1 }}
          >
            {importing ? 'Importing...' : '↓ Excel Import'}
          </button>
          <button
            onClick={() => setCatDrawer({ open: true, data: null })}
            className="t-btn-primary"
          >
            <span className="text-lg leading-none">+</span> New Category
          </button>
        </div>
      </div>

      {/* Premium Tree View */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--text-subtle)' }}>Loading…</div>
          ) : !categories.length ? (
            <div className="flex flex-col items-center justify-center h-40 rounded-xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
              <p className="text-[14px]">No categories yet</p>
            </div>
          ) : (
            <Droppable droppableId="categoriesRoot" type="category" isDropDisabled={showBin}>
              {(providedRoot) => (
                <div ref={providedRoot.innerRef} {...providedRoot.droppableProps} className="flex flex-col gap-3">
                  {categories.map((cat, index) => (
                    <Draggable key={String(cat.id)} draggableId={String(cat.id)} index={index}>
                      {(provCat, snapCat) => (
                        <div ref={provCat.innerRef} {...provCat.draggableProps} className={`rounded-xl overflow-hidden transition-all duration-200 ${snapCat.isDragging ? 'shadow-2xl border-brand' : ''}`}
                          style={{
                            ...provCat.draggableProps.style,
                            backgroundColor: 'var(--surface)',
                            border: expanded.includes(cat.id) ? '1px solid var(--color-brand)' : '1px solid var(--border)',
                            boxShadow: snapCat.isDragging ? '0 10px 30px rgba(0,0,0,0.1)' : (expanded.includes(cat.id) ? '0 4px 20px rgba(0,0,0,0.05)' : 'none'),
                            zIndex: snapCat.isDragging ? 50 : 'auto'
                          }}>
                          
                          {/* Category Header Bar */}
                          <div 
                            onClick={() => setExpanded(prev => prev.includes(cat.id) ? prev.filter(x => x !== cat.id) : [...prev, cat.id])}
                            className={`flex items-center justify-between p-4 cursor-pointer group transition-colors ${snapCat.isDragging ? 'bg-(--surface-2)' : 'hover:bg-(--surface-2)'}`}
                          >
                            <div className="flex items-center gap-4">
                              <div {...provCat.dragHandleProps} className="cursor-grab text-gray-400 hover:text-gray-600 px-1 py-1 -ml-2 rounded hover:bg-black/5 transition-colors" onClick={e => e.stopPropagation()}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>
                              </div>
                              <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${expanded.includes(cat.id) ? 'bg-brand text-white' : 'bg-(--surface-2) text-(--text-muted)'}`}>
                                {expanded.includes(cat.id) ? '▾' : '▸'}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                  <h3 className="font-bold text-[16px] tracking-tight" style={{ color: 'var(--text)' }}>
                                    {cat.name_en}
                                  </h3>
                                  <span className="text-[14px] font-medium" style={{ color: 'var(--text-muted)' }} dir="rtl">
                                    {cat.name_ar}
                                  </span>
                                  <span className={`ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold`}
                                    style={cat.is_active
                                      ? { backgroundColor: 'color-mix(in srgb, #10b981 10%, transparent)', color: '#10b981' }
                                      : { backgroundColor: 'var(--surface-2)', color: 'var(--text-subtle)' }
                                    }>
                                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: cat.is_active ? '#10b981' : 'var(--border)' }} />
                                    {cat.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--text-subtle)' }}>
                                  <span className="font-mono text-[10px] bg-(--surface-2) px-1.5 py-0.5 rounded border border-(--border-soft)">/{cat.slug}</span>
                                  <span>•</span>
                                  <span>{cat.subcategories?.length || 0} Subcategories</span>
                                  <span>•</span>
                                  <span>Sort: {cat.sort_order}</span>
                                </div>
                              </div>
                            </div>
            
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {showBin ? (
                                <>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleRestoreCat(cat.id) }}
                                    className="text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                                    style={{ backgroundColor: 'color-mix(in srgb, #10b981 10%, transparent)', color: '#10b981' }}
                                  >Restore</button>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleHardDeleteCat(cat.id) }}
                                    className="text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                                    style={{ backgroundColor: '#ef4444', color: 'white' }}
                                  >Delete Forever</button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={e => { e.stopPropagation(); openAddSub(cat, e) }}
                                    className="text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                                    style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand) 10%, transparent)', color: 'var(--color-brand)' }}
                                  >+ Add Sub</button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setCatDrawer({ open: true, data: cat }) }}
                                    className="text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all hover:bg-(--border)"
                                    style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)' }}
                                  >Edit</button>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleDeleteCat(cat.id) }}
                                    className="text-[12px] px-3 py-1.5 rounded-lg font-medium transition-all hover:scale-105"
                                    style={{ backgroundColor: '#ef4444', color: 'white' }}
                                  >Delete</button>
                                </>
                              )}
                            </div>
                          </div>
            
                          {/* Subcategories Container */}
                          {expanded.includes(cat.id) && (
                            <Droppable droppableId={String(cat.id)} type="subcategory" isDropDisabled={showBin}>
                              {(provSubDrop, snapSubDrop) => (
                                <div className="p-4 pt-0" style={{ backgroundColor: 'var(--surface)' }}>
                                  <div ref={provSubDrop.innerRef} {...provSubDrop.droppableProps} className={`mt-2 ml-3 pl-6 border-l-2 space-y-3 min-h-[60px] transition-colors rounded-br-xl ${snapSubDrop.isDraggingOver ? 'bg-black/5' : ''}`} style={{ borderColor: 'var(--border-soft)' }}>
                                    {cat.subcategories?.map((sub, sIndex) => (
                                      <Draggable key={`sub-${sub.id}`} draggableId={`sub-${sub.id}`} index={sIndex}>
                                        {(provSub, snapSub) => (
                                          <div ref={provSub.innerRef} {...provSub.draggableProps} className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${snapSub.isDragging ? 'shadow-lg border-brand' : 'border-transparent hover:border-(--border)'}`}
                                            style={{ ...provSub.draggableProps.style, backgroundColor: 'var(--surface-2)', zIndex: snapSub.isDragging ? 50 : 'auto' }}>
                                            <div className="flex items-center gap-3">
                                              <div {...provSub.dragHandleProps} className="cursor-grab text-gray-400 hover:text-gray-600 px-1 py-1 -ml-2 rounded hover:bg-black/5 transition-colors">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>
                                              </div>
                                              <div className="w-8 h-8 rounded-lg bg-(--surface) border border-(--border) flex items-center justify-center text-[10px] font-mono text-(--text-subtle)">
                                                {sub.id}
                                              </div>
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                  <h4 className="font-semibold text-[14px]" style={{ color: 'var(--text)' }}>
                                                    {sub.name_en}
                                                  </h4>
                                                  <span className="font-medium text-[13px] text-(--text-muted)" dir="rtl">
                                                    {sub.name_ar}
                                                  </span>
                                                  <span className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-widest font-bold`}
                                                    style={sub.is_active ? { color: '#10b981', backgroundColor: 'color-mix(in srgb, #10b981 10%, transparent)' } : { color: 'var(--text-subtle)', backgroundColor: 'var(--surface)' }}>
                                                    {sub.is_active ? 'Active' : 'Offline'}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[11px] text-(--text-subtle)">
                                                  <span className="font-mono text-[9px] bg-(--surface) px-1 py-0.5 rounded border border-(--border-soft)">/{sub.slug}</span>
                                                  <span>•</span>
                                                  <span>Sort: {sub.sort_order}</span>
                                                </div>
                                              </div>
                                            </div>
                    
                                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                              {showBin || sub.deleted_status === 'bin' ? (
                                                <>
                                                  <button
                                                    onClick={e => { e.stopPropagation(); handleRestoreSub(sub.id) }}
                                                    className="text-[11px] px-2.5 py-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                                  >Restore</button>
                                                  <button
                                                    onClick={e => { e.stopPropagation(); handleHardDeleteSub(sub.id) }}
                                                    className="text-[11px] px-2.5 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                                                  >Delete Forever</button>
                                                </>
                                              ) : (
                                                <>
                                                  <button
                                                    onClick={e => openEditSub(sub, cat, e)}
                                                    className="text-[11px] px-2.5 py-1 rounded border border-(--border) hover:bg-(--border) transition-colors text-(--text)"
                                                  >Edit</button>
                                                  <button
                                                    onClick={e => handleDeleteSub(sub.id, e)}
                                                    className="text-[11px] px-2.5 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                                                  >Delete</button>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provSubDrop.placeholder}
                                    {!cat.subcategories?.length && (
                                      <div className="p-3 rounded-xl text-[12px] italic text-(--text-subtle)" style={{ backgroundColor: 'var(--surface-2)' }}>
                                        No subcategories. Drag one here or click "+ Add Sub".
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Droppable>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {providedRoot.placeholder}
                </div>
              )}
            </Droppable>
          )}
        </div>
      </DragDropContext>

      {/* ── Drawers — key forces full remount when target record changes ── */}
      <CategoryDrawer
        key={`cat-${catDrawer.data?.id ?? 'new'}-${catDrawer.open}`}
        open={catDrawer.open}
        initial={catDrawer.data}
        onClose={() => setCatDrawer({ open: false, data: null })}
        onDone={refresh}
      />
      <SubcategoryDrawer
        key={`sub-${subDrawer.data?.id ?? 'new'}-${subDrawer.catId}-${subDrawer.open}`}
        open={subDrawer.open}
        initial={subDrawer.data}
        categoryId={subDrawer.catId}
        categoryName={subDrawer.catName}
        onClose={() => setSubDrawer({ open: false, data: null, catId: null, catName: '' })}
        onDone={refresh}
      />
    </div>
  )
}
