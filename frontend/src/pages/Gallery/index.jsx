import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import api from '../../api/client'
import PageHeader from '../../components/PageHeader'

const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')

// Resolve a gallery relative path to a full URL
const galleryUrl = (p) => `${API}/gallery/${p}`

// Human-readable file size
const fmtSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const isVideo = (f) => f.type === 'video'

// ── Icon components ──────────────────────────────────────────
const FolderIcon = ({ color = 'var(--color-brand)' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full" style={{ color }}>
    <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
  </svg>
)
const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8" style={{ color: 'var(--text-subtle)' }}>
    <path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 9.75v9A2.25 2.25 0 004.5 18.75z" />
  </svg>
)

// ── Modals ───────────────────────────────────────────────────
function NewFolderModal({ onClose, onConfirm }) {
  const [name, setName] = useState('')
  const ref = useRef()
  useEffect(() => ref.current?.focus(), [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-xl p-6 w-80 flex flex-col gap-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-[15px]" style={{ color: 'var(--text)' }}>New Folder</h3>
        <input ref={ref} className="t-input" value={name} onChange={e => setName(e.target.value)}
          placeholder="Folder name" onKeyDown={e => { if (e.key === 'Enter') onConfirm(name); if (e.key === 'Escape') onClose() }} />
        <div className="flex gap-2">
          <button className="t-btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button className="t-btn-primary flex-1 justify-center" onClick={() => onConfirm(name)}>Create</button>
        </div>
      </div>
    </div>
  )
}

function RenameModal({ item, onClose, onConfirm }) {
  // For files, split name into base + ext so user only edits the base
  const dotIdx = item.type !== 'folder' ? item.name.lastIndexOf('.') : -1
  const extPart = dotIdx > 0 ? item.name.slice(dotIdx) : ''        // e.g. ".jpg"
  const basePart = dotIdx > 0 ? item.name.slice(0, dotIdx) : item.name

  const [name, setName] = useState(basePart)
  const ref = useRef()
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])

  const handleConfirm = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed + extPart)   // always re-attach the original extension
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-xl p-6 w-80 flex flex-col gap-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
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

function MoveModal({ item, onClose, onConfirm }) {
  const [dest, setDest] = useState('')
  const [data, setData] = useState(null)

  const load = useCallback(async (p = '') => {
    const res = await fetch(`${API}/api/gallery?path=${encodeURIComponent(p)}`)
    const json = await res.json()
    setData(json)
    setDest(p)
  }, [])

  useEffect(() => { async function init() { await load('') } init() }, [load])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="rounded-xl p-6 w-96 flex flex-col gap-4 max-h-[70vh]" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-[15px]" style={{ color: 'var(--text)' }}>Move "{item.name}" to…</h3>
        <div className="text-[12px] px-3 py-1.5 rounded-md" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}>
          📂 {dest || 'Gallery root'}
        </div>
        <div className="overflow-y-auto flex-1 rounded-xl" style={{ border: '1px solid var(--border)', minHeight: '120px' }}>
          {data && (
            <>
              {dest && (
                <button className="w-full text-left px-4 py-2.5 text-[13px] flex items-center gap-2 transition-colors"
                  style={{ borderBottom: '1px solid var(--border-soft)', color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                  onClick={() => load(data.breadcrumbs[data.breadcrumbs.length - 2]?.path || '')}>
                  ← ..
                </button>
              )}
              {data.folders.filter(f => f.path !== item.path).map(f => (
                <button key={f.path} className="w-full text-left px-4 py-2.5 text-[13px] flex items-center gap-2 transition-colors"
                  style={{ borderBottom: '1px solid var(--border-soft)', color: 'var(--text)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                  onDoubleClick={() => load(f.path)}
                  onClick={() => setDest(f.path)}>
                  <span className="w-4 h-4 shrink-0"><FolderIcon /></span> {f.name}
                </button>
              ))}
              {!data.folders.length && <p className="text-center py-6 text-[12px]" style={{ color: 'var(--text-subtle)' }}>Empty folder</p>}
            </>
          )}
        </div>
        <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>Double-click a folder to navigate into it</p>
        <div className="flex gap-2">
          <button className="t-btn-ghost flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button className="t-btn-primary flex-1 justify-center" onClick={() => onConfirm(dest)}>Move Here</button>
        </div>
      </div>
    </div>
  )
}

// ── Context Menu ─────────────────────────────────────────────
function ContextMenu({ x, y, item, onRename, onMove, onDelete, onCopyUrl, onClose }) {
  const ref = useRef()
  useEffect(() => {
    const handler = () => onClose()
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])
  return (
    <div ref={ref} className="fixed z-50 rounded-xl py-1.5 shadow-xl min-w-44"
      style={{ top: y, left: x, backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      onMouseDown={e => e.stopPropagation()}>
      {item.type !== 'folder' && (
        <button className="w-full text-left px-4 py-2 text-[13px] transition-colors flex items-center gap-2"
          style={{ color: 'var(--text)' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
          onClick={onCopyUrl}>
          🔗 Copy URL
        </button>
      )}
      <button className="w-full text-left px-4 py-2 text-[13px] transition-colors flex items-center gap-2"
        style={{ color: 'var(--text)' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
        onClick={onRename}>
        ✏️ Rename
      </button>
      <button className="w-full text-left px-4 py-2 text-[13px] transition-colors flex items-center gap-2"
        style={{ color: 'var(--text)' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
        onClick={onMove}>
        📁 Move
      </button>
      <div style={{ borderTop: '1px solid var(--border-soft)', margin: '4px 0' }} />
      <button className="w-full text-left px-4 py-2 text-[13px] transition-colors flex items-center gap-2"
        style={{ color: '#ef4444' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'color-mix(in srgb,#ef4444 8%,transparent)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
        onClick={onDelete}>
        🗑 Delete
      </button>
    </div>
  )
}

// ── Main Gallery Page ─────────────────────────────────────────
export default function Gallery() {
  const [currentPath, setCurrentPath] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [dragItem, setDragItem] = useState(null)   // item being dragged
  const [dropTarget, setDropTarget] = useState(null)   // folder path hovered during drag

  // Modals
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [renaming, setRenaming] = useState(null) // item
  const [moving, setMoving] = useState(null) // item
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, item }

  const fileInputRef = useRef()

  // ── Load directory ────────────────────────────────────────
  const load = useCallback(async (p = currentPath) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/gallery?path=${encodeURIComponent(p)}`)
      const json = await res.json()
      setData(json)
      setCurrentPath(p)
    } catch { toast.error('Failed to load gallery') }
    finally { setLoading(false) }
  }, [currentPath])

  useEffect(() => { async function init() { await load('') } init() }, []) // eslint-disable-line

  // ── Upload ────────────────────────────────────────────────
  const doUpload = async (files) => {
    if (!files.length) return
    setUploading(true)
    const form = new FormData()
    Array.from(files).forEach(f => form.append('files', f))
    try {
      const res = await fetch(`${API}/api/gallery/upload?path=${encodeURIComponent(currentPath)}`, { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      toast.success(`${json.data.length} file(s) uploaded`)
      load(currentPath)
    } catch (e) { toast.error(e.message) }
    finally { setUploading(false) }
  }

  // ── Create folder ─────────────────────────────────────────
  const createFolder = async (name) => {
    if (!name.trim()) { toast.error('Enter a folder name'); return }
    setNewFolderOpen(false)
    try {
      const res = await fetch(`${API}/api/gallery/folder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: currentPath, name: name.trim() }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Folder created')
      load(currentPath)
    } catch (e) { toast.error(e.message) }
  }

  // ── Delete ────────────────────────────────────────────────
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
      const res = await fetch(`${API}${endpoint}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: item.path }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Deleted')
      load(currentPath)
    } catch (e) { toast.error(e.message) }
  }

  // ── Rename ────────────────────────────────────────────────
  const doRename = async (newName) => {
    const item = renaming; setRenaming(null)
    if (!newName.trim() || newName === item.name) return
    try {
      const res = await fetch(`${API}/api/gallery/rename`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: item.path, name: newName.trim() }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Renamed')
      load(currentPath)
    } catch (e) { toast.error(e.message) }
  }

  // ── Move (from modal or drag-drop) ────────────────────────
  const doMove = async (item, dest) => {
    if (item.type === 'folder' && dest.startsWith(item.path)) { toast.error("Can't move a folder into itself"); return }
    if (dest === currentPath || dest === item.path.replace('/' + item.name, '') || (currentPath === '' && dest === '')) { setMoving(null); return }
    try {
      const res = await fetch(`${API}/api/gallery/move`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: item.path, dest }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('Moved')
      load(currentPath)
    } catch (e) { toast.error(e.message) }
    setMoving(null)
  }

  // ── Drag-to-move ──────────────────────────────────────────
  const onItemDragStart = (e, item) => { setDragItem(item); e.dataTransfer.effectAllowed = 'move' }
  const onFolderDragOver = (e, folderPath) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(folderPath) }
  const onFolderDrop = (e, folderPath) => {
    e.preventDefault(); setDropTarget(null)
    if (dragItem && folderPath !== dragItem.path) { doMove(dragItem, folderPath) }
    setDragItem(null)
  }

  // ── Right-click ───────────────────────────────────────────
  const openCtx = (e, item) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, item })
  }

  // ── UI helpers ────────────────────────────────────────────
  const gridCls = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'

  if (!data && loading) return (
    <div className="flex items-center justify-center h-full min-h-64">
      <p className="text-sm animate-pulse" style={{ color: 'var(--text-subtle)' }}>Loading gallery…</p>
    </div>
  )

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Toolbar ── */}
      <div >
        <PageHeader
          title="Gallery"
          subtitle="Manage campaign images, product media, and brand assets"
        >
          <button onClick={() => setNewFolderOpen(true)} className="t-btn-ghost text-[12px]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
            New Folder
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="t-btn-primary text-[12px]" disabled={uploading}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </PageHeader>
        <input ref={fileInputRef} type="file" multiple accept="image/*,video/mp4,video/webm" className="hidden"
          onChange={e => { doUpload(e.target.files); e.target.value = '' }} />
      </div>

      {/* ── Navigation sub-bar: back + breadcrumbs ── */}
      {data && (
        <div className="flex items-center gap-2 px-6 py-2 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          {currentPath ? (
            <button
              onClick={() => load(data.breadcrumbs[data.breadcrumbs.length - 2]?.path ?? '')}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors shrink-0"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--color-brand)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              title="Go up"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </button>
          ) : (
            <div className="w-7 h-7 shrink-0" />
          )}
          <div className="flex items-center gap-1 overflow-x-auto">
            {data.breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1">
                {i > 0 && <span style={{ color: 'var(--text-subtle)' }}>/</span>}
                <button className="text-[12px] transition-colors px-1 rounded whitespace-nowrap"
                  style={{ color: i === data.breadcrumbs.length - 1 ? 'var(--text)' : 'var(--text-muted)' }}
                  onMouseEnter={e => { if (i < data.breadcrumbs.length - 1) e.currentTarget.style.color = 'var(--color-brand)' }}
                  onMouseLeave={e => { if (i < data.breadcrumbs.length - 1) e.currentTarget.style.color = 'var(--text-muted)' }}
                  onClick={() => load(crumb.path)}>
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Drop zone (entire content area) ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 relative"
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault(); setDragOver(false)
          if (e.dataTransfer.files.length) { doUpload(e.dataTransfer.files); return }
          // File card dropped on empty space → nothing
        }}>

        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl pointer-events-none"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand) 12%, transparent)', border: '2px dashed var(--color-brand)' }}>
            <p className="text-lg font-semibold" style={{ color: 'var(--color-brand)' }}>Drop files to upload</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm animate-pulse" style={{ color: 'var(--text-subtle)' }}>Loading…</p>
          </div>
        ) : (
          <>
            {/* ── Folders ── */}
            {data?.folders.length > 0 && (
              <div className="mb-6">
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>Folders</p>
                <div className={gridCls}>
                  {data.folders.map(folder => (
                    <div key={folder.path}
                      draggable
                      onDragStart={e => onItemDragStart(e, folder)}
                      onDragOver={e => onFolderDragOver(e, folder.path)}
                      onDragLeave={() => setDropTarget(null)}
                      onDrop={e => onFolderDrop(e, folder.path)}
                      onContextMenu={e => openCtx(e, folder)}
                      onDoubleClick={() => load(folder.path)}
                      className="group rounded-xl p-3 flex flex-col items-center gap-2 cursor-pointer transition-all duration-150 select-none"
                      style={{
                        backgroundColor: dropTarget === folder.path
                          ? 'color-mix(in srgb, var(--color-brand) 15%, transparent)'
                          : 'var(--surface)',
                        border: `1px solid ${dropTarget === folder.path ? 'var(--color-brand)' : 'var(--border)'}`,
                      }}
                      onMouseEnter={e => { if (dropTarget !== folder.path) e.currentTarget.style.borderColor = 'var(--color-brand)' }}
                      onMouseLeave={e => { if (dropTarget !== folder.path) e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      <div className="w-12 h-12"><FolderIcon /></div>
                      <p className="text-[12px] font-medium text-center truncate w-full" style={{ color: 'var(--text)' }}>{folder.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Files ── */}
            {data?.files.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>
                  Files <span style={{ color: 'var(--text-subtle)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({data.files.length})</span>
                </p>
                <div className={gridCls}>
                  {data.files.map(file => (
                    <div key={file.path}
                      draggable
                      onDragStart={e => onItemDragStart(e, file)}
                      onContextMenu={e => openCtx(e, file)}
                      className="group rounded-xl overflow-hidden cursor-pointer transition-all duration-150 select-none"
                      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-brand)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: 'var(--surface-2)' }}>
                        {isVideo(file) ? (
                          <div className="w-full h-full flex items-center justify-center"><VideoIcon /></div>
                        ) : (
                          <img src={galleryUrl(file.path)} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                        )}
                        {/* Hover overlay */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1"
                          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
                          <button className="text-[11px] font-semibold text-white px-2 py-1 rounded-md transition-colors"
                            style={{ backgroundColor: 'var(--color-brand)' }}
                            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(galleryUrl(file.path)); toast.success('URL copied!') }}>
                            Copy URL
                          </button>
                        </div>
                      </div>
                      {/* Name + size */}
                      <div className="px-2 py-1.5">
                        <p className="text-[11px] font-medium truncate" style={{ color: 'var(--text)' }}>{file.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{fmtSize(file.size)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!data?.folders.length && !data?.files.length && (
              <div className="flex flex-col items-center justify-center h-52" style={{ color: 'var(--text-subtle)' }}>
                <p className="text-4xl mb-3">🖼</p>
                <p className="text-[14px] font-medium" style={{ color: 'var(--text)' }}>This folder is empty</p>
                <p className="text-[12px] mt-1">Drag files here or click Upload to add images</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {newFolderOpen && <NewFolderModal onClose={() => setNewFolderOpen(false)} onConfirm={createFolder} />}
      {renaming && <RenameModal item={renaming} onClose={() => setRenaming(null)} onConfirm={doRename} />}
      {moving && <MoveModal item={moving} currentPath={currentPath} onClose={() => setMoving(null)} onConfirm={dest => doMove(moving, dest)} />}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y} item={ctxMenu.item}
          onClose={() => setCtxMenu(null)}
          onCopyUrl={() => { navigator.clipboard.writeText(galleryUrl(ctxMenu.item.path)); toast.success('URL copied!'); setCtxMenu(null) }}
          onRename={() => { setRenaming(ctxMenu.item); setCtxMenu(null) }}
          onMove={() => { setMoving(ctxMenu.item); setCtxMenu(null) }}
          onDelete={() => { deleteItem(ctxMenu.item); setCtxMenu(null) }}
        />
      )}
    </div>
  )
}
