import { useState, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api')

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
  const downloadTemplate = () => {
    window.open(`${API_BASE}/import/template`, '_blank')
  }

  // ── Dry-run on file select ─────────────────────────────────
  const runPreview = useCallback(async (selectedFile) => {
    setFile(selectedFile)
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const res = await fetch(`${API_BASE}/import/products?dry_run=true`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Preview failed')
      setPreview(data)
      setStep(2)
    } catch (e) {
      toast.error(e.message)
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
      const res = await fetch(`${API_BASE}/import/products?dry_run=false`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setResult(data)
      setStep(3)
      if (data.summary.inserted > 0) qc.invalidateQueries({ queryKey: ['products'] })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const readyCount = preview?.results?.filter(r => r.status === 'ready').length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>

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
              <h2 className="text-[15px] font-bold" style={{ color: 'var(--text)' }}>Import Products from Excel</h2>
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
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              {/* Drop zone */}
              <div
                className="rounded-2xl flex flex-col items-center justify-center gap-3 py-16 cursor-pointer transition-all"
                style={{
                  border: `2px dashed ${dragging ? 'var(--color-brand)' : 'var(--border)'}`,
                  backgroundColor: dragging ? 'color-mix(in srgb,var(--color-brand) 5%,transparent)' : 'var(--surface-2)',
                }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }}>
                {loading ? (
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'var(--color-brand)', borderTopColor: 'transparent' }} />
                ) : (
                  <>
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                      style={{ color: dragging ? 'var(--color-brand)' : 'var(--text-subtle)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
                      {dragging ? 'Drop it here!' : 'Drag & drop your .xlsx file'}
                    </p>
                    <p className="text-[12px]" style={{ color: 'var(--text-subtle)' }}>or click to browse</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
                onChange={e => handleFile(e.target.files?.[0])} />

              {/* Template download */}
              <div className="rounded-xl p-4 flex items-center gap-4"
                style={{ backgroundColor: 'color-mix(in srgb,var(--color-brand) 8%,transparent)', border: '1px solid color-mix(in srgb,var(--color-brand) 25%,transparent)' }}>
                <svg className="w-8 h-8 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  style={{ color: 'var(--color-brand)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>
                    Don't have the template?
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    47 pre-filled columns · includes example row for reference
                  </p>
                </div>
                <button onClick={downloadTemplate}
                  className="px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors"
                  style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  Download Template
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 2 && preview && (
            <div className="flex flex-col gap-4">
              {/* Summary pills */}
              <div className="flex gap-3">
                {[
                  { label: 'Ready to insert', count: readyCount, color: '#16a34a', bg: 'color-mix(in srgb,#22c55e 15%,transparent)' },
                  { label: 'Will be skipped', count: preview.summary.skipped, color: '#d97706', bg: 'color-mix(in srgb,#f59e0b 15%,transparent)' },
                  { label: 'Have errors', count: preview.summary.errors, color: '#dc2626', bg: 'color-mix(in srgb,#ef4444 15%,transparent)' },
                ].map(p => (
                  <div key={p.label} className="flex-1 rounded-xl p-3 flex flex-col gap-1"
                    style={{ backgroundColor: p.bg, border: `1px solid ${p.color}30` }}>
                    <span className="text-[22px] font-black" style={{ color: p.color }}>{p.count}</span>
                    <span className="text-[11px] font-medium" style={{ color: p.color }}>{p.label}</span>
                  </div>
                ))}
              </div>

              {/* Rows table */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                      {['Row', 'FGD', 'Name (EN)', 'Category', 'Status', 'Reason'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold"
                          style={{ color: 'var(--text-subtle)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.results.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', backgroundColor: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                        <td className="px-3 py-2 font-mono text-[11px]" style={{ color: 'var(--text-subtle)' }}>{r.row}</td>
                        <td className="px-3 py-2 font-mono font-semibold" style={{ color: 'var(--text)' }}>{r.fgd}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text)' }}>{r.name_en}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.category || '—'}</td>
                        <td className="px-3 py-2"><Badge status={r.status} /></td>
                        <td className="px-3 py-2 text-[11px]" style={{ color: 'var(--text-subtle)' }}>{r.reason || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {step === 3 && result && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                {[
                  { label: 'Inserted', count: result.summary.inserted, color: '#16a34a', bg: 'color-mix(in srgb,#22c55e 15%,transparent)' },
                  { label: 'Skipped', count: result.summary.skipped, color: '#d97706', bg: 'color-mix(in srgb,#f59e0b 15%,transparent)' },
                  { label: 'Errors', count: result.summary.errors, color: '#dc2626', bg: 'color-mix(in srgb,#ef4444 15%,transparent)' },
                ].map(p => (
                  <div key={p.label} className="flex-1 rounded-xl p-3 flex flex-col gap-1"
                    style={{ backgroundColor: p.bg, border: `1px solid ${p.color}30` }}>
                    <span className="text-[22px] font-black" style={{ color: p.color }}>{p.count}</span>
                    <span className="text-[11px] font-medium" style={{ color: p.color }}>{p.label}</span>
                  </div>
                ))}
              </div>
              {result.results?.filter(r => r.status === 'error').length > 0 && (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <div className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest"
                    style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-subtle)', borderBottom: '1px solid var(--border)' }}>
                    Error Details
                  </div>
                  {result.results.filter(r => r.status === 'error').map((r, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3"
                      style={{ borderBottom: '1px solid var(--border)', backgroundColor: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                      <span className="font-mono text-[11px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>Row {r.row}</span>
                      <span className="font-semibold text-[12px]" style={{ color: 'var(--text)' }}>{r.fgd}</span>
                      <span className="text-[12px]" style={{ color: '#dc2626' }}>{r.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface-2)' }}>
          <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--border)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            {step === 1 ? 'Cancel' : step === 3 ? 'Close' : '← Back'}
          </button>
          {step === 2 && (
            <button onClick={handleConfirm} disabled={readyCount === 0 || loading}
              className="px-5 py-2 rounded-lg text-[13px] font-semibold transition-colors flex items-center gap-2"
              style={{
                backgroundColor: readyCount > 0 ? 'var(--color-brand)' : 'var(--surface-2)',
                color: readyCount > 0 ? '#fff' : 'var(--text-muted)',
                opacity: loading ? 0.7 : 1,
                cursor: readyCount === 0 ? 'not-allowed' : 'pointer'
              }}>
              {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
              Confirm — Import {readyCount} Product{readyCount !== 1 ? 's' : ''}
            </button>
          )}
          {step === 3 && (
            <button onClick={onClose}
              className="px-5 py-2 rounded-lg text-[13px] font-semibold"
              style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
