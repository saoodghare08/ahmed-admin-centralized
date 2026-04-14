import { useQuery } from '@tanstack/react-query'
import { getProducts, updateAllPrices, getPricing, getCountries } from '../../api'
import toast from 'react-hot-toast'
import { useState } from 'react'

const getFlagEmoji = (countryCode) => {
  if (!countryCode) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export default function Pricing() {
  const [productId, setProductId] = useState('')
  const [search, setSearch]       = useState('')
  const [draft, setDraft]         = useState({})

  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn: getCountries,
    select: res => res.data?.data || res.data || []
  })

  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn:  () => getProducts({ limit: 500 }),
  })

  useQuery({
    queryKey: ['pricing', productId],
    queryFn:  () => getPricing(productId),
    enabled:  !!productId,
    select: (data) => {
      const map = {}
      data.data.forEach(p => { map[p.country_id] = { regular_price: p.regular_price, cost_price: p.cost_price ?? '' } })
      return map
    },
    onSuccess: (map) => setDraft(map),
  })

  const filtered = (products?.data || []).filter(p =>
    !search || p.name_en.toLowerCase().includes(search.toLowerCase()) || p.fgd.toLowerCase().includes(search.toLowerCase())
  )

  const setField = (countryId, field, value) =>
    setDraft(d => ({ ...d, [countryId]: { ...d[countryId], [field]: value } }))

  const handleSave = async () => {
    if (!productId) return
    const prices = (countriesData || []).map(c => ({
      country_id:    c.id,
      currency_id:   c.currency_id || c.id,
      regular_price: parseFloat(draft[c.id]?.regular_price || 0),
      cost_price:    draft[c.id]?.cost_price ? parseFloat(draft[c.id].cost_price) : null,
    })).filter(p => p.regular_price > 0)
    await updateAllPrices(productId, prices)
    toast.success('Prices saved for all countries')
  }

  const selected = products?.data?.find(p => String(p.id) === String(productId))

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Pricing</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Set prices per storefront independently</p>
        </div>
        {productId && (
          <button onClick={handleSave} className="t-btn-primary">Save All Prices</button>
        )}
      </div>

      {/* Product selector */}
      <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-[12px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>Select Product</p>
        <input
          type="text"
          placeholder="Search by name or FGD code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="t-input"
        />
        {search && (
          <div className="mt-2 rounded-lg overflow-hidden max-h-52 overflow-y-auto"
            style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}>
            {filtered.slice(0, 20).map(p => (
              <button key={p.id}
                onClick={() => { setProductId(p.id); setSearch('') }}
                className="w-full text-left px-4 py-2.5 text-[13px] flex items-center justify-between transition-colors"
                style={{
                  borderBottom: '1px solid var(--border-soft)',
                  color: String(p.id) === String(productId) ? 'var(--color-brand)' : 'var(--text)',
                  backgroundColor: String(p.id) === String(productId) ? 'color-mix(in srgb, var(--color-brand) 8%, transparent)' : '',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
              >
                <span>{p.name_en}</span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--text-subtle)' }}>{p.fgd}</span>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="mt-3 flex items-center gap-3 rounded-lg px-4 py-2.5"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-brand) 20%, transparent)' }}>
            <span className="font-semibold text-[13px]" style={{ color: 'var(--color-brand)' }}>{selected.name_en}</span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}>{selected.fgd}</span>
          </div>
        )}
      </div>

      {/* 6-country price grid */}
      {productId ? (
        <div className="grid grid-cols-3 gap-4">
          {(countriesData || []).map(c => (
            <div key={c.id} className="rounded-xl p-5 transition-colors"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-brand)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-2xl">{getFlagEmoji(c.code)}</span>
                <div>
                  <p className="font-semibold text-[14px]" style={{ color: 'var(--text)' }}>{c.name_en}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>{c.currency_code} · {c.decimal_places} decimals</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-subtle)' }}>
                    Regular Price
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={c.decimal_places === 3 ? '0.001' : '0.01'}
                      placeholder={c.decimal_places === 3 ? '0.000' : '0.00'}
                      value={draft[c.id]?.regular_price ?? ''}
                      onChange={e => setField(c.id, 'regular_price', e.target.value)}
                      className="t-input pr-14 text-[14px] font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold" style={{ color: 'var(--text-subtle)' }}>
                      {c.currency_code}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-subtle)' }}>
                    Cost Price <span className="normal-case font-normal tracking-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={c.decimal_places === 3 ? '0.001' : '0.01'}
                      placeholder="—"
                      value={draft[c.id]?.cost_price ?? ''}
                      onChange={e => setField(c.id, 'cost_price', e.target.value)}
                      className="t-input pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold" style={{ color: 'var(--text-subtle)' }}>
                      {c.currency_code}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-52">
          <p className="text-3xl mb-3">¤</p>
          <p className="text-[14px]" style={{ color: 'var(--text-subtle)' }}>Search and select a product above to edit its prices</p>
        </div>
      )}
    </div>
  )
}
