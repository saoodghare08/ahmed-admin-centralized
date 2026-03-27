import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { previewCampaign } from '../../api'

const FLAGS = { AE:'🇦🇪', SA:'🇸🇦', QA:'🇶🇦', BH:'🇧🇭', KW:'🇰🇼', OM:'🇴🇲' }

export default function CampaignPreview({ campaignId, tempState, countries }) {
  const selectedCountries = countries.filter(c => tempState.countries.includes(c.id))
  const [activeCountry, setActiveCountry] = useState(selectedCountries[0]?.id || 1)
  
  // If active country is no longer selected, switch to first available
  if (activeCountry && !tempState.countries.includes(activeCountry) && selectedCountries.length > 0) {
    setActiveCountry(selectedCountries[0].id)
  }

  // We use a query but with the temp state as dependency to refresh preview
  const { data, isLoading, isError } = useQuery({
    queryKey: ['campaign-preview', campaignId || 'new', activeCountry, tempState],
    queryFn: () => previewCampaign(campaignId || 'new', { 
      ...tempState, 
      country_id: activeCountry 
    }),
    enabled: !!activeCountry && (!!tempState.scope.length || !!tempState.product_overrides?.length)
  })

  if (!tempState.scope.length && !tempState.product_overrides?.length) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-border rounded-2xl bg-surface-2/20">
        <p className="text-[13px] font-bold opacity-30">Select at least one category or product to see impact.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Country Tabs */}
      <div className="flex items-center gap-1 p-1 bg-surface-2 rounded-xl w-fit self-center">
        {selectedCountries.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCountry(c.id)}
            className={`px-4 py-1.5 rounded-lg text-[11px] font-black transition-all ${activeCountry === c.id ? 'bg-white shadow-sm text-brand' : 'text-text-subtle'}`}
          >
            {FLAGS[c.code]} {c.code}
          </button>
        ))}
      </div>

      <div className="t-card bg-white overflow-hidden p-1">
        <div className="flex items-center justify-between p-4 border-b border-border">
           <h3 className="text-[12px] font-black uppercase tracking-widest text-text-muted">Calculated Impacts</h3>
           <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                 <span className="text-[9px] font-black opacity-30 uppercase tracking-widest">Affected Units</span>
                 <span className="text-sm font-black">{data?.summary?.total_products || 0}</span>
              </div>
              {tempState.type === 'discount' && (
                <div className="flex flex-col items-end">
                   <span className="text-[9px] font-black opacity-30 uppercase tracking-widest">Avg Discount</span>
                   <span className="text-sm font-black text-green-600">{data?.summary?.avg_discount_pct || 0}%</span>
                </div>
              )}
           </div>
        </div>

        {isLoading ? (
          <div className="p-20 text-center animate-pulse opacity-30 font-black">Calculating impacts...</div>
        ) : isError ? (
          <div className="p-20 text-center text-red-500 font-bold">Failed to load preview. Please check network.</div>
        ) : data?.affected_products?.length === 0 ? (
          <div className="p-20 text-center opacity-30 font-bold">No products in this criteria for selected country.</div>
        ) : (
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full text-left border-collapse">
               <thead className="sticky top-0 bg-surface-2/90 backdrop-blur z-10 border-b border-border">
                  <tr>
                     <th className="p-3 text-[10px] font-black uppercase tracking-widest opacity-40">Product</th>
                     <th className="p-3 text-[10px] font-black uppercase tracking-widest opacity-40">Regular</th>
                     <th className="p-3 text-[10px] font-black uppercase tracking-widest opacity-40">Campaign</th>
                     <th className="p-3 text-[10px] font-black uppercase tracking-widest opacity-40">Sale Price</th>
                     <th className="p-3 text-[10px] font-black uppercase tracking-widest opacity-40 text-right">Saving</th>
                  </tr>
               </thead>
               <tbody>
                  {data.affected_products.map(p => (
                     <tr key={p.product_id} className="border-b border-border/50 hover:bg-surface-2 transition-colors">
                        <td className="p-3">
                           <div className="flex flex-col">
                              <span className="text-[12px] font-bold">{p.name_en}</span>
                              <span className="text-[10px] opacity-40 font-mono">#{p.fgd}</span>
                           </div>
                        </td>
                        <td className="p-3">
                           <span className="text-[12px] font-medium opacity-50 line-through">
                              {p.regular_price.toFixed(data.currency.decimals)}
                           </span>
                        </td>
                        <td className="p-3">
                           <span className="text-[11px] font-black text-blue-600">
                              {p.discount_type === 'percentage' ? `${p.discount_value}% OFF` : `-${p.discount_value} OFF`}
                           </span>
                        </td>
                        <td className="p-3">
                           <div className="flex flex-col">
                              <span className="text-[13px] font-black text-brand">
                                 {p.sale_price.toFixed(data.currency.decimals)} <span className="text-[10px] opacity-40">{data.currency.code}</span>
                              </span>
                              {p.warnings?.length > 0 && p.warnings.map((w, i) => (
                                 <span key={i} className="text-[9px] font-black text-red-600 italic leading-none">{w}</span>
                              ))}
                           </div>
                        </td>
                        <td className="p-3 text-right">
                           <span className="text-[11px] font-black bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                              +{p.savings.toFixed(data.currency.decimals)} {data.currency.code}
                           </span>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
