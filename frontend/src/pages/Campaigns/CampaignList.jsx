import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCampaigns, deleteCampaign, getCountries } from '../../api'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
    active: 'bg-green-500/10 text-green-500 border-green-500/20',
    scheduled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    paused: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    expired: 'bg-red-500/10 text-red-500 border-red-500/20',
    archived: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
}

const SortIcon = ({ col, currentSort }) => {
    if (currentSort.sortBy !== col) return <span className="opacity-20 ml-1">⇅</span>
    return <span className="text-brand ml-1">{currentSort.sortOrder === 'ASC' ? '↑' : '↓'}</span>
}

export default function CampaignList() {
    const navigate = useNavigate()
    
    // Filter & Sort State
    const [filters, setFilters] = useState({
        search: '',
        effective_status: '',
        type: '',
        country_id: ''
    })
    const [sort, setSort] = useState({
        sortBy: 'created_at',
        sortOrder: 'DESC'
    })

    // Local Search term state for debouncing
    const [searchTerm, setSearchTerm] = useState('')

    // Data Fetching
    const { data: countries } = useQuery({ queryKey: ['countries'], queryFn: getCountries })
    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['campaigns', filters, sort],
        queryFn: () => getCampaigns({ ...filters, ...sort })
    })

    // Debounce search effect
    useEffect(() => {
        const h = setTimeout(() => {
            setFilters(prev => ({ ...prev, search: searchTerm }))
        }, 400)
        return () => clearTimeout(h)
    }, [searchTerm])

    const handleDelete = async (id) => {
        if (!confirm('Archive this campaign?')) return
        try {
            await deleteCampaign(id)
            toast.success('Campaign archived')
            refetch()
        } catch (err) {
            toast.error(err.error || 'Failed to archive')
        }
    }

    const toggleSort = (col) => {
        setSort(prev => ({
            sortBy: col,
            sortOrder: prev.sortBy === col && prev.sortOrder === 'DESC' ? 'ASC' : 'DESC'
        }))
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20">
            {/* Linear Loading Indicator at the very top */}
            {isFetching && (
                <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-brand/10 overflow-hidden">
                    <div className="h-full bg-brand animate-progress-linear w-full" />
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black tracking-tight">Campaign Management</h1>
                    <p className="text-[12px] text-text-muted font-bold uppercase tracking-widest mt-1">Manage discounts and promotions</p>
                </div>
                <button 
                    onClick={() => navigate('/campaigns/new')}
                    className="t-btn-primary px-8 h-12 font-black shadow-lg shadow-brand/20"
                >
                    + Create New Campaign
                </button>
            </div>

            {/* Filter Bar */}
            <div className="t-card p-4 flex flex-wrap items-center gap-4 bg-surface-2/20">
                <div className="relative flex-1 min-w-[240px]">
                    <input 
                        type="text" 
                        className="t-input h-10 pl-10 text-[13px] font-bold"
                        placeholder="Search campaigns by name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                </div>

                <select 
                    className="t-input h-10 w-40 text-[11px] font-black"
                    value={filters.effective_status}
                    onChange={e => setFilters({ ...filters, effective_status: e.target.value })}
                >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="expired">Expired</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                </select>

                <select 
                    className="t-input h-10 w-40 text-[11px] font-black"
                    value={filters.type}
                    onChange={e => setFilters({ ...filters, type: e.target.value })}
                >
                    <option value="">All Types</option>
                    <option value="discount">Discount</option>
                    <option value="bxgy">BXGY</option>
                    <option value="foc">FOC</option>
                </select>

                <select 
                    className="t-input h-10 w-40 text-[11px] font-black"
                    value={filters.country_id}
                    onChange={e => setFilters({ ...filters, country_id: e.target.value })}
                >
                    <option value="">All Countries</option>
                    {countries?.data?.map(c => (
                        <option key={c.id} value={c.id}>{c.name_en} ({c.code})</option>
                    ))}
                </select>

                <button 
                    onClick={() => {
                        setSearchTerm('')
                        setFilters({ search: '', effective_status: '', type: '', country_id: '' })
                    }}
                    className="h-10 px-4 text-[10px] font-black uppercase text-text-muted hover:text-red-500 transition-colors"
                >
                    Reset
                </button>
            </div>

            {/* Table */}
            <div className={`t-card overflow-hidden transition-opacity duration-200 ${isFetching && !data ? 'opacity-40' : 'opacity-100'}`}>
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-border bg-surface-2/50 text-[11px] font-black uppercase tracking-widest text-text-muted">
                            <th 
                                className="p-4 cursor-pointer hover:text-brand transition-colors"
                                onClick={() => toggleSort('name_en')}
                            >
                                Campaign <SortIcon col="name_en" currentSort={sort} />
                            </th>
                            <th className="p-4">Type</th>
                            <th className="p-4 text-center">Status</th>
                            <th 
                                className="p-4 cursor-pointer hover:text-brand transition-colors text-center"
                                onClick={() => toggleSort('start_at')}
                            >
                                Schedule <SortIcon col="start_at" currentSort={sort} />
                            </th>
                            <th 
                                className="p-4 cursor-pointer hover:text-brand transition-colors text-center"
                                onClick={() => toggleSort('priority')}
                            >
                                Priority <SortIcon col="priority" currentSort={sort} />
                            </th>
                            <th className="p-4">Countries</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {data?.data?.map(c => (
                            <tr key={c.id} className="hover:bg-surface-2/30 transition-colors group">
                                <td className="p-4">
                                    <div className="flex flex-col">
                                        <span className="text-[14px] font-black group-hover:text-brand transition-colors">{c.name_en}</span>
                                        <span className="text-[12px] opacity-40 font-bold" dir="rtl">{c.name_ar}</span>
                                    </div>
                                </td>
                                <td className="p-4 uppercase text-[10px] font-black tracking-widest opacity-60">
                                    {c.type}
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${STATUS_COLORS[c.effective_status]}`}>
                                        {c.effective_status}
                                    </span>
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex flex-col text-[11px] font-bold">
                                        <span>{new Date(c.start_at).toLocaleDateString()}</span>
                                        <span className="opacity-30">to {new Date(c.end_at).toLocaleDateString()}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <span className="text-[11px] font-black opacity-60">#{c.priority}</span>
                                </td>
                                <td className="p-4">
                                    <div className="flex gap-1">
                                        {c.country_codes?.split(',').map(code => (
                                            <span key={code} className="w-7 h-5 flex items-center justify-center bg-surface-2 border border-border rounded text-[10px] font-black">
                                                {code}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => navigate(`/campaigns/edit/${c.id}`)}
                                            className="p-2 hover:bg-brand/10 text-brand rounded-lg transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(c.id)}
                                            className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {(isLoading && !data) && (
                    <div className="p-20 text-center space-y-4">
                        <div className="loader mx-auto" />
                        <p className="text-[12px] font-bold text-text-muted uppercase tracking-widest animate-pulse">Initializing Campaigns...</p>
                    </div>
                )}
                {(!data?.data || data.data.length === 0) && !isLoading && (
                    <div className="p-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center mx-auto opacity-10">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <p className="text-[12px] font-bold text-text-muted uppercase tracking-widest">No campaigns found matching these filters</p>
                    </div>
                )}
            </div>
        </div>
    )
}
