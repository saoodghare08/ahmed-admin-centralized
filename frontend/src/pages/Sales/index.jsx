import { useQuery } from '@tanstack/react-query'
import { getSalesReport, getCountries } from '../../api'
import { useState } from 'react'

const getFlagEmoji = (countryCode) => {
  if (!countryCode) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export default function Sales() {
  const [country, setCountry] = useState('')
  const [from, setFrom]       = useState('')
  const [to, setTo]           = useState('')

  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn: getCountries,
    select: res => res.data?.data || res.data || []
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sales', country, from, to],
    queryFn:  () => getSalesReport({
      country: country || undefined,
      from:    from    || undefined,
      to:      to      || undefined,
    }),
  })

  const rows         = data?.data || []
  const totalUnits   = rows.reduce((s, r) => s + Number(r.total_units), 0)
  const totalRevenue = rows.reduce((s, r) => s + Number(r.total_revenue), 0)

  const filterBtn = (active) => ({
    fontSize: '12px', fontWeight: 500, padding: '6px 12px', borderRadius: '6px',
    cursor: 'pointer', transition: 'all 0.15s', border: 'none',
    ...(active
      ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
      : { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }
    )
  })

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Sales Report</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Pushed from external order system</p>
        </div>
        <button onClick={refetch} className="t-btn-ghost">↻ Refresh</button>
      </div>

      {/* Filters */}
      <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-end gap-4">
          {/* Country */}
          <div className="flex-1">
            <label className="block text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-subtle)' }}>Country</label>
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setCountry('')} style={filterBtn(country === '')}>All</button>
              {(countriesData || []).map(c => (
                <button key={c.code} onClick={() => setCountry(c.code)} style={filterBtn(country === c.code)}>
                  {getFlagEmoji(c.code)} {c.code}
                </button>
              ))}
            </div>
          </div>
          {/* Date range */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-subtle)' }}>From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="t-input" style={{ width: 'auto' }} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-subtle)' }}>To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="t-input" style={{ width: 'auto' }} />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {!isLoading && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Products',    value: rows.length,                       sub: 'in result set' },
            { label: 'Total Units Sold',  value: totalUnits.toLocaleString(),       sub: 'across all countries' },
            { label: 'Total Revenue',     value: totalRevenue.toFixed(2),           sub: 'mixed currencies' },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-6 py-5" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-subtle)' }}>{s.label}</p>
              <p className="text-2xl font-bold mt-1.5" style={{ color: 'var(--text)' }}>{s.value}</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--text-subtle)' }}>Loading report…</div>
        ) : !rows.length ? (
          <div className="flex flex-col items-center justify-center h-52" style={{ color: 'var(--text-subtle)' }}>
            <p className="text-3xl mb-3">↗</p>
            <p className="text-[14px]">No sales data</p>
            <p className="text-[12px] mt-1">Push records via <code className="px-1.5 rounded" style={{ backgroundColor: 'var(--surface-2)' }}>POST /api/sales/log</code></p>
          </div>
        ) : (
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--surface-2)' }}>
              <tr>
                {['Product', 'FGD', 'Country', 'Units Sold', 'Revenue', 'Currency'].map(h => (
                  <th key={h} className="t-th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                  <td className="t-td">
                    <p className="font-medium" style={{ color: 'var(--text)' }}>{row.name_en}</p>
                    <p className="text-[11px]" dir="rtl" style={{ color: 'var(--text-subtle)' }}>{row.name_ar}</p>
                  </td>
                  <td className="t-td">
                    <span className="font-mono text-[12px] px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--surface-2)', color: 'var(--color-brand)' }}>{row.fgd}</span>
                  </td>
                  <td className="t-td">{getFlagEmoji(row.country_code)} {row.country_code}</td>
                  <td className="t-td">
                    <span className="font-bold text-[15px]" style={{ color: 'var(--text)' }}>{Number(row.total_units).toLocaleString()}</span>
                  </td>
                  <td className="t-td">
                    <span className="font-semibold" style={{ color: 'var(--text)' }}>{Number(row.total_revenue).toFixed(2)}</span>
                  </td>
                  <td className="t-td text-[12px]" style={{ color: 'var(--text-muted)' }}>{row.currency_code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
