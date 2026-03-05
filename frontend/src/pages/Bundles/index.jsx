import { useQuery } from '@tanstack/react-query'
import { getBundles, deleteBundle } from '../../api'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'

export default function Bundles() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ['bundles'], queryFn: getBundles })

  const handleDelete = async (productId) => {
    const res = await Swal.fire({
      title: 'Remove bundle definition?',
      text: "The product itself stays in the database.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, remove it'
    })
    if (!res.isConfirmed) return
    await deleteBundle(productId); toast.success('Bundle removed'); refetch()
  }

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center h-60 text-sm" style={{ color: 'var(--text-subtle)' }}>Loading bundles…</div>
  )

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Bundles / Gift Sets</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Gift set product + its component items</p>
        </div>
        <button className="t-btn-primary">
          <span className="text-lg leading-none">+</span> New Bundle
        </button>
      </div>

      {/* Empty */}
      {!data?.data?.length && (
        <div className="flex flex-col items-center justify-center h-52 rounded-xl"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-subtle)' }}>
          <p className="text-3xl mb-3">⊞</p>
          <p className="text-[14px]">No bundles yet</p>
          <p className="text-[12px] mt-1">Create a gift-set product first, then register it here</p>
        </div>
      )}

      {/* Bundle cards */}
      <div className="space-y-4">
        {data?.data?.map(bundle => (
          <div key={bundle.bundle_id} className="rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            {/* Card header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">🎁</span>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>{bundle.name_en}</p>
                  <p className="text-[11px] mt-0.5" dir="rtl" style={{ color: 'var(--text-muted)' }}>{bundle.name_ar}</p>
                </div>
                <span className="ml-2 font-mono text-[11px] px-2 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--color-brand)', border: '1px solid var(--border)' }}>
                  {bundle.fgd}
                </span>
              </div>
              <div className="flex gap-2">
                <button className="t-btn-ghost text-[12px]">Edit Items</button>
                <button onClick={() => handleDelete(bundle.product_id)}
                  className="text-[12px] px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{ backgroundColor: 'color-mix(in srgb, #ef4444 10%, transparent)', color: '#ef4444', border: '1px solid color-mix(in srgb, #ef4444 20%, transparent)' }}>
                  Remove
                </button>
              </div>
            </div>

            {/* Items table */}
            <table className="w-full">
              <thead style={{ backgroundColor: 'var(--surface-2)' }}>
                <tr>
                  {['#', 'Component', 'FGD Code', 'Qty', 'Type'].map(h => (
                    <th key={h} className="t-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bundle.items?.map((item, i) => (
                  <tr key={item.id}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                    <td className="t-td" style={{ color: 'var(--text-subtle)' }}>{i + 1}</td>
                    <td className="t-td font-medium">{item.product_id ? item.product_name_en : item.component_name_en}</td>
                    <td className="t-td">
                      {item.product_fgd
                        ? <span className="font-mono text-[11px] px-2 py-0.5 rounded"
                            style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}>{item.product_fgd}</span>
                        : <span style={{ color: 'var(--text-subtle)' }}>—</span>
                      }
                    </td>
                    <td className="t-td">× {item.qty}</td>
                    <td className="t-td">
                      {item.product_id ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand) 10%, transparent)', color: 'var(--color-brand)', border: '1px solid color-mix(in srgb, var(--color-brand) 20%, transparent)' }}>
                          Linked Product
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-subtle)', border: '1px solid var(--border)' }}>
                          Standalone
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!bundle.items?.length && (
              <p className="text-center text-[13px] py-4" style={{ color: 'var(--text-subtle)', backgroundColor: 'var(--surface-2)' }}>No items added</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
