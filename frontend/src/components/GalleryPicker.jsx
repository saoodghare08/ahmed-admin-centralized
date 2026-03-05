import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'

const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')
const galleryUrl = (p) => `${API}/gallery/${p}`

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8" style={{ color: 'var(--color-brand)' }}>
    <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z"/>
  </svg>
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
      const res  = await fetch(`${API}/api/gallery?path=${encodeURIComponent(p)}`)
      const json = await res.json()
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
      const res  = await fetch(`${API}/api/gallery/upload?path=${encodeURIComponent(currentPath)}`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      toast.success(`${json.data.length} file(s) uploaded`)
      load(currentPath)
    } catch (e) { toast.error(e.message) }
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
    const res = await fetch(`${API}/api/gallery/folder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: currentPath, name: name.trim() }) })
    if (res.ok) { toast.success('Folder created'); load(currentPath) }
    else { const j = await res.json(); toast.error(j.error) }
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
      const endpoint = item.type === 'folder' ? '/api/gallery/folder' : '/api/gallery/file'
      const res  = await fetch(`${API}${endpoint}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: item.path }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      // Remove from selection if it was selected
      setSelected(prev => prev.filter(p => p !== item.path))
      toast.success('Deleted')
      load(currentPath)
    } catch (e) { toast.error(e.message) }
  }

  // ── Rename ──────────────────────────────────────────────────
  const doRename = async (newName) => {
    const item = renaming; setRenaming(null)
    if (!newName.trim() || newName === item.name) return
    try {
      const res  = await fetch(`${API}/api/gallery/rename`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: item.path, name: newName.trim() }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      // Update selection if renamed file was selected
      if (selected.includes(item.path)) {
        const newPath = json.path
        setSelected(prev => prev.map(p => p === item.path ? newPath : p))
      }
      toast.success('Renamed')
      load(currentPath)
    } catch (e) { toast.error(e.message) }
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
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-5xl h-[85vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}>
          <button onClick={createFolder} className="t-btn-ghost text-[12px]">New Folder</button>
          <button onClick={() => fileInputRef.current?.click()} className="t-btn-ghost text-[12px]" disabled={uploading}>
            {uploading ? 'Uploading…' : '⬆ Upload'}
          </button>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" className="hidden"
            onChange={e => { doUpload(e.target.files); e.target.value = '' }} />
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-lg"
            style={{ color: 'var(--text-muted)' }}>×</button>
        </div>

        {/* ── Navigation sub-bar: back + breadcrumbs ── */}
        {data && (
          <div className="flex items-center gap-2 px-4 py-1.5 shrink-0"
            style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'color-mix(in srgb, var(--surface-2) 60%, var(--surface))' }}>
            {currentPath ? (
              <button
                onClick={() => load(data.breadcrumbs[data.breadcrumbs.length - 2]?.path ?? '')}
                className="w-6 h-6 flex items-center justify-center rounded-md transition-colors shrink-0"
                style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--color-brand)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                title="Go up"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            ) : (
              <div className="w-6 h-6 shrink-0" />
            )}
            <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
              {data.breadcrumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex items-center gap-1">
                  {i > 0 && <span style={{ color: 'var(--text-subtle)' }}>/</span>}
                  <button className="px-1 rounded transition-colors whitespace-nowrap"
                    style={{ color: i === data.breadcrumbs.length - 1 ? 'var(--text)' : 'var(--text-muted)' }}
                    onMouseEnter={e => { if (i < data.breadcrumbs.length - 1) e.currentTarget.style.color = 'var(--color-brand)' }}
                    onMouseLeave={e => { if (i < data.breadcrumbs.length - 1) e.currentTarget.style.color = 'var(--text-muted)' }}
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
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-subtle)' }}>Folders</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {data.folders.map(f => (
                      <button key={f.path}
                        className="rounded-lg p-2 flex flex-col items-center gap-1 transition-colors"
                        style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-brand)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                        onContextMenu={e => openCtx(e, f)}
                        onClick={e => { e.stopPropagation(); load(f.path) }}>
                        <FolderIcon />
                        <p className="text-[10px] truncate w-full text-center" style={{ color: 'var(--text)' }}>{f.name}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Files */}
              {data?.files.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-subtle)' }}>Images &amp; Videos</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    {data.files.map(file => {
                      const isSel = selected.includes(file.path)
                      return (
                        <div key={file.path}
                          onClick={e => { e.stopPropagation(); toggleSelect(file) }}
                          onContextMenu={e => openCtx(e, file)}
                          className="rounded-lg overflow-hidden cursor-pointer transition-all"
                          style={{
                            border: `2px solid ${isSel ? 'var(--color-brand)' : 'transparent'}`,
                            outline: isSel ? `3px solid color-mix(in srgb, var(--color-brand) 30%, transparent)` : 'none',
                            backgroundColor: 'var(--surface-2)',
                          }}>
                          <div className="aspect-square relative overflow-hidden">
                            <img src={galleryUrl(file.path)} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                            {isSel && (
                              <div className="absolute inset-0 flex items-center justify-center"
                                style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand) 35%, transparent)' }}>
                                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-xs font-bold" style={{ color: 'var(--color-brand)' }}>✓</div>
                              </div>
                            )}
                          </div>
                          <p className="text-[9px] truncate px-1 py-0.5" style={{ color: 'var(--text-subtle)' }}>{file.name}</p>
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
