import { useState, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../api/client'
import { importCategories } from '../../api'

// ── Status badge ───────────────────────────────────────────────
function Badge({ status }) {
  const cfg = {
    ready:    { bg: 'color-mix(in srgb,#22c55e 15%,transparent)', color: '#16a34a', text: '✅ Ready' },
    inserted: { bg: 'color-mix(in srgb,#22c55e 15%,transparent)', color: '#16a34a', text: '✅ Inserted' },
    skip:     { bg: 'color-mix(in srgb,#f59e0b 15%,transparent)', color: '#d97706', text: '⚠️ Skip' },
    error:    { bg: 'color-mix(in srgb,#ef4444 15%,transparent)', color: '#dc2626', text: '❌ Error' },
  }[status] || { bg: 'var(--surface-2)', color: 'var(--text-muted)', text: status }
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.text}</span>
  )
}

// ── Import Modal ───────────────────────────────────────────────
export default function ImportModal({ onClose }) {
  const qc = useQueryClient()
  const fileRef = useRef()
  const [step, setStep] = useState(1) // 1=upload 2=preview 3=result
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)   // dry-run result
  const [result, setResult] = useState(null)     // real import result
  const [loading, setLoading] = useState(false)

  // ── Template download ──────────────────────────────────────
  const downloadTemplate = async () => {
    try {
      const resp = await api.get('/categories/template', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([resp.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'categories_import_template.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      toast.error('Failed to download template')
    }
  }

  // ── Dry-run on file select ─────────────────────────────────
  const runPreview = useCallback(async (selectedFile) => {
    setFile(selectedFile)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const res = await importCategories(fd, true)
      setPreview(res.data)
      setStep(2)
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Preview failed')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleFile = (f) => {
    if (!f || !f.name.endsWith('.xlsx')) { toast.error('Please upload a .xlsx file'); return }
    runPreview(f)
  }

  // ── Confirm real import ────────────────────────────────────
  const handleConfirm = async () => {
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await importCategories(fd, false)
      setResult(res.data)
      setStep(3)
      if (res.data.summary.inserted > 0) qc.invalidateQueries({ queryKey: ['categories-admin'] })
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const readyCount = preview?.results?.filter(r => r.status === 'ready').length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'color-mix(in srgb,var(--color-brand) 15%,transparent)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ color: 'var(--color-brand)' }}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-[15px] font-bold" style={{ color: 'var(--text)' }}>Import Categories & Subcategories</h2>
              <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                {step === 1 ? 'Upload your .xlsx file' : step === 2 ? 'Review before importing' : 'Import complete'}
              </p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mr-4">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors"
                  style={{
                    backgroundColor: step >= s ? 'var(--color-brand)' : 'var(--surface-2)',
                    color: step >= s ? '#fff' : 'var(--text-subtle)'
                  }}>{s}</div>
                {s < 3 && <div className="w-6 h-px" style={{ backgroundColor: step > s ? 'var(--color-brand)' : 'var(--border)' }} />}
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">

          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              {/* Drop zone */}
              <div
                className="rounded-2xl flex flex-col items-center justify-center gap-3 py-16 cursor-pointer transition-all hover:scale-[1.005]"
                style={{
                  border: `2px dashed ${dragging ? 'var(--color-brand)' : 'var(--border)'}`,
                  backgroundColor: dragging ? 'color-mix(in srgb,var(--color-brand) 5%,transparent)' : 'var(--surface-2)',
                }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }}>
                {loading ? (
                  <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'var(--color-brand)', borderTopColor: 'transparent' }} />
                ) : (
                  <>
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                      style={{ color: dragging ? 'var(--color-brand)' : 'var(--text-subtle)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
                      {dragging ? 'Drop it here!' : 'Drag & drop category excel file'}
                    </p>
                    <p className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>Only .xlsx files are supported</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
                onChange={e => handleFile(e.target.files?.[0])} />

              {/* Template download */}
              <div className="rounded-xl p-5 flex items-center gap-4 transition-all hover:translate-y-[-2px]"
                style={{ backgroundColor: 'color-mix(in srgb,var(--color-brand) 8%,transparent)', border: '1px solid color-mix(in srgb,var(--color-brand) 25%,transparent)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                   style={{ backgroundColor: 'var(--surface)' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                    style={{ color: 'var(--color-brand)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>
                    Download Template
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Pre-formatted sheet for categories and subcategories
                  </p>
                </div>
                <button onClick={downloadTemplate}
                  className="px-4 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm active:scale-95"
                  style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  Get Template
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 2 && preview && (
            <div className="flex flex-col gap-4">
              {/* Summary pills */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Ready to import', count: readyCount, color: '#16a34a', bg: 'color-mix(in srgb,#22c55e 15%,transparent)' },
                  { label: 'Skipped (exists)', count: preview.summary.skipped, color: '#d97706', bg: 'color-mix(in srgb,#f59e0b 15%,transparent)' },
                  { label: 'Validation Errors', count: preview.summary.errors, color: '#dc2626', bg: 'color-mix(in srgb,#ef4444 15%,transparent)' },
                ].map(p => (
                  <div key={p.label} className="rounded-xl p-4 flex flex-col gap-1 border"
                    style={{ backgroundColor: p.bg, borderColor: `${p.color}25` }}>
                    <span className="text-[24px] font-black leading-none" style={{ color: p.color }}>{p.count}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-70" style={{ color: p.color }}>{p.label}</span>
                  </div>
                ))}
              </div>

              {/* Rows table */}
              <div className="rounded-xl overflow-hidden border shadow-sm" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Row', 'Type', 'Name (EN)', 'Parent', 'Status', 'Message'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-bold uppercase tracking-widest text-[10px]"
                          style={{ color: 'var(--text-subtle)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.results.map((r, i) => (
                      <tr key={i} className="transition-colors hover:bg-black/2"
                        style={{ borderBottom: '1px solid var(--border)', backgroundColor: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                        <td className="px-4 py-3 font-mono text-[11px] opacity-40">{r.row}</td>
                        <td className="px-4 py-3 font-bold text-[11px] uppercase tracking-tighter" style={{ color: 'var(--text-subtle)' }}>{r.type}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text)' }}>{r.name_en}</td>
                        <td className="px-4 py-3 opacity-60 italic" style={{ color: 'var(--text-muted)' }}>{r.parent}</td>
                        <td className="px-4 py-3"><Badge status={r.status} /></td>
                        <td className="px-4 py-3 text-[11px]" style={{ color: r.status === 'error' ? '#ef4444' : 'var(--text-subtle)' }}>{r.reason || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {step === 3 && result && (
            <div className="flex flex-col gap-6 items-center py-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-2"
                style={{ backgroundColor: 'color-mix(in srgb,#22c55e 15%,transparent)' }}>
                <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-[20px] font-black" style={{ color: 'var(--text)' }}>Import Processed</h3>
                <p className="text-[13px] mt-1" style={{ color: 'var(--text-subtle)' }}>
                  Successfully added {result.summary.inserted} records with {result.summary.errors} failures.
                </p>
              </div>

              <div className="flex gap-4 w-full mt-4">
                {[
                  { label: 'Inserted', count: result.summary.inserted, color: '#16a34a' },
                  { label: 'Skipped', count: result.summary.skipped, color: '#d97706' },
                  { label: 'Errors', count: result.summary.errors, color: '#dc2626' },
                ].map(p => (
                  <div key={p.label} className="flex-1 rounded-2xl p-5 bg-black/5 border text-center"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="text-[24px] font-black" style={{ color: p.color }}>{p.count}</div>
                    <div className="text-[11px] font-bold uppercase tracking-widest opacity-40">{p.label}</div>
                  </div>
                ))}
              </div>

              {result.results?.filter(r => r.status === 'error').length > 0 && (
                <div className="w-full mt-4 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                  <div className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest"
                    style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)' }}>
                    Failed Rows
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {result.results.filter(r => r.status === 'error').map((r, i) => (
                      <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}>
                        <span className="font-mono text-[10px] opacity-30">Row {r.row}</span>
                        <span className="font-bold text-[12px] shrink-0" style={{ color: 'var(--text)' }}>{r.name_en}</span>
                        <span className="text-[11px] flex-1 text-right" style={{ color: '#dc2626' }}>{r.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}>
          <button onClick={step === 1 ? onClose : () => setStep(1)}
            className="px-4 py-2 rounded-lg text-[13px] font-bold transition-all hover:bg-black/5"
            style={{ color: 'var(--text-muted)' }}>
            {step === 1 ? 'Cancel' : 'Start Over'}
          </button>
          
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button onClick={handleConfirm} disabled={readyCount === 0 || loading}
                className="px-6 py-2 rounded-lg text-[13px] font-bold transition-all flex items-center gap-2 shadow-sm active:scale-95"
                style={{
                  backgroundColor: readyCount > 0 ? 'var(--color-brand)' : 'var(--border)',
                  color: readyCount > 0 ? '#fff' : 'var(--text-muted)',
                  opacity: loading ? 0.7 : 1,
                  cursor: readyCount === 0 ? 'not-allowed' : 'pointer'
                }}>
                {loading && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                Confirm Import ({readyCount})
              </button>
            )}
            {step === 3 && (
              <button onClick={onClose}
                className="px-8 py-2 rounded-lg text-[13px] font-bold shadow-sm"
                style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
