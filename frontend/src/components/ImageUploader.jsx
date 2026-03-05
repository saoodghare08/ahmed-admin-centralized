import { useState, useEffect } from 'react'
import GalleryPicker from './GalleryPicker'

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')

const resolveUrl = (src) => {
  if (!src) return null
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src
  // Gallery paths are like /gallery/folder/file.jpg
  return `${API_ORIGIN}${src.startsWith('/') ? '' : '/'}${src}`
}

/**
 * ImageUploader — opens the GalleryPicker to select an image.
 *
 * Props:
 *   value    {string}  current stored path (e.g. /gallery/category/hero.jpg)
 *   onChange {fn}      called with the new path after selection
 *   label    {string}  optional label override
 */
export default function ImageUploader({ value, onChange, label = 'Choose from Gallery' }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [preview, setPreview]       = useState(resolveUrl(value))

  useEffect(() => { setPreview(resolveUrl(value)) }, [value])

  const handleSelect = (path) => {
    // path is like "folder/file.jpg" — store as /gallery/folder/file.jpg
    const stored = path.startsWith('/') ? path : `/gallery/${path}`
    onChange(stored)
    setPreview(resolveUrl(stored))
  }

  const handleRemove = () => { onChange(''); setPreview(null) }

  return (
    <div className="flex flex-col gap-2">
      {/* Preview */}
      {preview && (
        <div className="relative group rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <img src={preview} alt="preview" className="w-full max-h-48 object-contain p-2" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2 gap-2"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)' }}>
            <button type="button" onClick={() => setPickerOpen(true)}
              className="text-[12px] font-semibold text-white px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: 'var(--color-brand)' }}>
              Change
            </button>
            <button type="button" onClick={handleRemove}
              className="text-[12px] font-semibold text-white px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: 'rgba(239,68,68,0.85)' }}>
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Select button when no image, or when no preview */}
      {!preview && (
        <button type="button" onClick={() => setPickerOpen(true)}
          className="w-full rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors py-8"
          style={{ border: '2px dashed var(--border)', backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.color = 'var(--color-brand)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 0115.75 13.5H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <span className="text-[13px] font-medium">{label}</span>
          <span className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>Browse your gallery</span>
        </button>
      )}

      {/* Stored path hint */}
      {value && (
        <p className="text-[10px] font-mono truncate" style={{ color: 'var(--text-subtle)' }}>{value}</p>
      )}

      <GalleryPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleSelect} />
    </div>
  )
}
