import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import api from '../api/client'

const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')
const galleryUrl = (p) => `${API}/gallery/${p}`


const FolderIcon = () => (
  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 transition-transform group-hover:scale-110">
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z"/>
    </svg>
  </div>
)


// ── Context Menu ─────────────────────────────────────────────
function ContextMenu({ x, y, item, onRename, onDelete, onCopyUrl, onClose }) {
  const ref = useRef()
  useEffect(() => {
    const handler = () => onClose()
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref}
      className="fixed z-70 rounded-xl py-1.5 shadow-xl min-w-44"
      style={{ top: y, left: x, backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      onMouseDown={e => e.stopPropagation()}>
      {item.type !== 'folder' && (
        <button className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2 transition-colors"
          style={{ color: 'var(--text)' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
          onClick={onCopyUrl}>
          🔗 Copy URL
        </button>
      )}
      <button className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2 transition-colors"
        style={{ color: 'var(--text)' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
        onClick={onRename}>
        ✏️ Rename
      </button>
      <div style={{ borderTop: '1px solid var(--border-soft)', margin: '4px 0' }} />
      <button className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2 transition-colors"
        style={{ color: '#ef4444' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'color-mix(in srgb,#ef4444 8%,transparent)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
        onClick={onDelete}>
        🗑 Delete
      </button>
    </div>
  )
}

// ── Rename Modal (extension-locked for files) ─────────────────
function RenameModal({ item, onClose, onConfirm }) {
  const dotIdx  = item.type !== 'folder' ? item.name.lastIndexOf('.') : -1
  const extPart = dotIdx > 0 ? item.name.slice(dotIdx) : ''
  const basePart = dotIdx > 0 ? item.name.slice(0, dotIdx) : item.name

  const [name, setName] = useState(basePart)
  const ref = useRef()
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  const handleConfirm = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed + extPart)
  }

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-xl p-6 w-80 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-[15px]" style={{ color: 'var(--text)' }}>Rename</h3>
        <div className="flex items-center gap-1">
          <input ref={ref} className="t-input" value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onClose() }} />
          {extPart && (
            <span className="text-[12px] font-mono px-2 py-1.5 rounded-md shrink-0"
              style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>
              {extPart}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button className="t-btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button className="t-btn-primary flex-1 justify-center" onClick={handleConfirm}>Rename</button>
        </div>
      </div>
    </div>
  )
}

/**
 * GalleryPicker
 * Opens as a full-screen modal overlay. User browses gallery, selects file(s),
 * then clicks "Select".
 *
 * Props:
 *   open        {bool}   whether to show
 *   onClose     {fn}     called when dismissed
 *   onSelect    {fn}     called with selected gallery path(s)
 *   multiple    {bool}   allow multi-select (default false)
 */
export default function GalleryPicker({ open, onClose, onSelect, multiple = false }) {
  const [currentPath, setCurrentPath] = useState('')
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(false)
  const [selected, setSelected]       = useState([])
  const [uploading, setUploading]     = useState(false)
  const [dragOver, setDragOver]       = useState(false)
  const [ctxMenu, setCtxMenu]         = useState(null) // { x, y, item }
  const [renaming, setRenaming]       = useState(null) // item
  const fileInputRef = useRef()

  const load = useCallback(async (p = '') => {
    setLoading(true)
    try {
      const json = await api.get(`/gallery?path=${encodeURIComponent(p)}`)
      setData(json)
      setCurrentPath(p)
    } catch { toast.error('Failed to load gallery') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { if (open) { setSelected([]); load('') } }, [open, load])


  const doUpload = async (files) => {
    if (!files.length) return
    setUploading(true)
    const form = new FormData()
    Array.from(files).forEach(f => form.append('files', f))
    try {
      const json = await api.post(`/gallery/upload?path=${encodeURIComponent(currentPath)}`, form)
      toast.success(`${json.data.length} file(s) uploaded`)
      load(currentPath)
    } catch (e) { toast.error(e.message || 'Upload failed') }
    finally { setUploading(false) }
  }


  const createFolder = async () => {
    const { value: name } = await Swal.fire({
      title: 'New Folder',
      input: 'text',
      inputLabel: 'Folder name',
      inputPlaceholder: 'e.g. products',
      showCancelButton: true,
      confirmButtonText: 'Create'
    })
    
    if (!name || !name.trim()) return
    try {
      await api.post('/gallery/folder', { path: currentPath, name: name.trim() })
      toast.success('Folder created')
      load(currentPath)
    } catch (e) { toast.error(e.error || e.message || 'Failed to create folder') }
  }


  // ── Delete ──────────────────────────────────────────────────
  const deleteItem = async (item) => {
    const swalRes = await Swal.fire({
      title: `Delete "${item.name}"?`,
      text: item.type === 'folder' ? 'This will delete the folder and all its contents.' : 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it'
    })
    if (!swalRes.isConfirmed) return

    try {
      const endpoint = item.type === 'folder' ? '/gallery/folder' : '/gallery/file'
      await api.delete(endpoint, { data: { path: item.path } })
      // Remove from selection if it was selected
      setSelected(prev => prev.filter(p => p !== item.path))
      toast.success('Deleted')
      load(currentPath)
    } catch (e) { toast.error(e.message || 'Delete failed') }
  }


  // ── Rename ──────────────────────────────────────────────────
  const doRename = async (newName) => {
    const item = renaming; setRenaming(null)
    if (!newName.trim() || newName === item.name) return
    try {
      const json = await api.patch('/gallery/rename', { path: item.path, name: newName.trim() })
      // Update selection if renamed file was selected
      if (selected.includes(item.path)) {
        const newPath = json.path
        setSelected(prev => prev.map(p => p === item.path ? newPath : p))
      }
      toast.success('Renamed')
      load(currentPath)
    } catch (e) { toast.error(e.message || 'Rename failed') }
  }


  const openCtx = (e, item) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, item })
  }

  const toggleSelect = (file) => {
    if (!multiple) { setSelected([file.path]); return }
    setSelected(prev => prev.includes(file.path) ? prev.filter(p => p !== file.path) : [...prev, file.path])
  }

  const handleSelect = () => {
    if (!selected.length) { toast.error('No file selected'); return }
    onSelect(multiple ? selected : selected[0])
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-10"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-6xl h-full flex flex-col rounded-[24px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"

        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', outline: '1px solid rgba(255,255,255,0.05)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}>
          <div className="flex items-center gap-4">
            <h2 className="text-[17px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>Media Gallery</h2>
            <div className="h-4 w-[1px]" style={{ backgroundColor: 'var(--border)' }} />
            <div className="flex items-center gap-1.5">
              <button onClick={createFolder} className="t-btn-ghost text-[12px] h-8 px-3">
                <span className="opacity-60">📁</span> New Folder
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="t-btn-primary text-[12px] h-8 px-4" disabled={uploading}>
                {uploading ? 'Uploading…' : '⬆ Upload Media'}
              </button>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl transition-all hover:bg-red-500/10 hover:text-red-500"
            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
            onChange={e => { doUpload(e.target.files); e.target.value = '' }} />
        </div>


        {/* ── Navigation sub-bar: back + breadcrumbs ── */}
        {data && (
          <div className="flex items-center gap-3 px-6 py-2 shrink-0 border-b"
            style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--surface-2) 40%, var(--surface))' }}>
            {currentPath ? (
              <button
                onClick={() => load(data.breadcrumbs[data.breadcrumbs.length - 2]?.path ?? '')}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all shrink-0 hover:scale-105 active:scale-95"
                style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                title="Go up"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <div className="w-7 h-7 flex items-center justify-center rounded-lg opacity-20 shrink-0"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                 <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            )}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[12px] font-medium py-1">
              {data.breadcrumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex items-center gap-1.5 shrink-0">
                  {i > 0 && <span className="opacity-20" style={{ color: 'var(--text)' }}>/</span>}
                  <button className="px-2 py-0.5 rounded-md transition-all hover:bg-white/5 active:scale-95"
                    style={{ color: i === data.breadcrumbs.length - 1 ? 'var(--color-brand)' : 'var(--text-muted)' }}
                    onClick={() => load(crumb.path)}>{crumb.name}</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 relative"
          onClick={() => setSelected([])}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) doUpload(e.dataTransfer.files) }}>

          {dragOver && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none rounded-xl"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand) 12%, transparent)', border: '2px dashed var(--color-brand)' }}>
              <p style={{ color: 'var(--color-brand)' }} className="font-semibold">Drop to upload here</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm animate-pulse" style={{ color: 'var(--text-subtle)' }}>Loading…</p>
            </div>
          ) : (
            <>
              {/* Folders */}
              {data?.folders.length > 0 && (
                <div className="mb-8">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 opacity-40 px-1" style={{ color: 'var(--text)' }}>Directories</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 gap-3">
                    {data.folders.map(f => (
                      <button key={f.path}
                        className="group rounded-2xl p-4 flex flex-col items-center gap-3 transition-all hover:scale-[1.02] active:scale-95"
                        style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                        onContextMenu={e => openCtx(e, f)}
                        onClick={e => { e.stopPropagation(); load(f.path) }}>
                        <FolderIcon />
                        <p className="text-[12px] font-semibold truncate w-full text-center" style={{ color: 'var(--text)' }}>{f.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}


              {/* Files */}
              {data?.files.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-4 opacity-40 px-1" style={{ color: 'var(--text)' }}>Media Records</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {data.files.map(file => {
                      const isSel = selected.includes(file.path)
                      return (
                        <div key={file.path}
                          onClick={e => { e.stopPropagation(); toggleSelect(file) }}
                          onContextMenu={e => openCtx(e, file)}
                          className="group rounded-2xl overflow-hidden cursor-pointer transition-all hover:scale-[1.03] active:scale-95"
                          style={{
                            border: `2px solid ${isSel ? 'var(--color-brand)' : 'transparent'}`,
                            boxShadow: isSel ? `0 0 20px -5px var(--color-brand)` : 'none',
                            backgroundColor: 'var(--surface-2)',
                          }}>
                          <div className="aspect-[4/5] relative overflow-hidden bg-black/20">
                            <img src={galleryUrl(file.path)} alt={file.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            {isSel && (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white shadow-lg flex items-center justify-center text-[10px] font-bold" style={{ color: 'var(--color-brand)' }}>
                                ✓
                              </div>
                            )}
                          </div>
                          <div className="px-3 py-2">
                             <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text)' }}>{file.name}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}


              {!data?.folders.length && !data?.files.length && (
                <div className="flex flex-col items-center justify-center h-40" style={{ color: 'var(--text-subtle)' }}>
                  <p className="text-3xl mb-2">📂</p>
                  <p className="text-[13px]">Empty — drop files here to upload</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}>
          <p className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>
            {selected.length ? `${selected.length} selected` : 'Click to select · Right-click to rename or delete'}
          </p>
          <div className="flex gap-2">
            <button className="t-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="t-btn-primary" onClick={handleSelect} disabled={!selected.length}>
              {multiple ? `Select ${selected.length || ''} File${selected.length !== 1 ? 's' : ''}` : 'Select'}
            </button>
          </div>
        </div>
      </div>

      {/* Context Menu — rendered outside the modal div so it can overflow */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y} item={ctxMenu.item}
          onClose={() => setCtxMenu(null)}
          onCopyUrl={() => { navigator.clipboard.writeText(galleryUrl(ctxMenu.item.path)); toast.success('URL copied!'); setCtxMenu(null) }}
          onRename={() => { setRenaming(ctxMenu.item); setCtxMenu(null) }}
          onDelete={() => { deleteItem(ctxMenu.item); setCtxMenu(null) }}
        />
      )}

      {/* Rename Modal */}
      {renaming && (
        <RenameModal item={renaming} onClose={() => setRenaming(null)} onConfirm={doRename} />
      )}
    </div>
  )
}
