import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, updateUser, resetUserPassword, deleteUser, hardDeleteUser } from '../../api'
import toast from 'react-hot-toast'
import Swal from 'sweetalert2'
import { useAuth } from '../../context/AuthContext'

const ALL_MODULES = [
  { 
    key: 'products', 
    label: 'Products',
    subModules: [
      { key: 'products.core', label: 'Core Tab' },
      { key: 'products.fragrance', label: 'Fragrance Tab' },
      { key: 'products.media', label: 'Media Tab' },
      { key: 'products.seo', label: 'SEO Tab' },
      { key: 'products.inventory', label: 'Inventory Tab' },
    ]
  },
  { 
    key: 'categories', 
    label: 'Categories',
    subModules: [
      { key: 'categories.core', label: 'Core Tab' },
      { key: 'categories.seo', label: 'SEO Tab' }
    ]
  },
  { key: 'pricing', label: 'Pricing' },
  { key: 'bundles', label: 'Bundles' },
  { key: 'sales', label: 'Sales' },
  { key: 'gallery', label: 'Gallery' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'users', label: 'Users' },
  { key: 'audit_logs', label: 'Audit Logs' },
]

export default function Users() {
  const qc = useQueryClient()
  const { user: currentUser } = useAuth()
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const users = data?.data || []

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: '', role: 'user', permissions: [] })

  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  const createMut = useMutation({ mutationFn: (d) => createUser(d), onSuccess: () => { toast.success('User created'); qc.invalidateQueries({ queryKey: ['users'] }); closeModal(); } })
  const updateMut = useMutation({ mutationFn: ({ id, d }) => updateUser(id, d), onSuccess: () => { toast.success('User updated'); qc.invalidateQueries({ queryKey: ['users'] }); closeModal(); } })
  const resetPwMut = useMutation({ mutationFn: ({ id, password }) => resetUserPassword(id, password), onSuccess: () => { toast.success('Password reset'); setShowPasswordModal(false); setNewPassword(''); } })
  const deleteMut = useMutation({ mutationFn: (id) => deleteUser(id), onSuccess: () => { toast.success('User deactivated'); qc.invalidateQueries({ queryKey: ['users'] }); } })
  const hardDeleteMut = useMutation({ mutationFn: (id) => hardDeleteUser(id), onSuccess: () => { toast.success('User permanently deleted'); qc.invalidateQueries({ queryKey: ['users'] }); } })

  const closeModal = () => { setShowModal(false); setEditing(null); setForm({ username: '', email: '', full_name: '', password: '', role: 'user', permissions: [] }); }

  const openCreate = () => {
    setEditing(null)
    setForm({ username: '', email: '', full_name: '', password: '', role: 'user', permissions: [] })
    setShowModal(true)
  }

  const openEdit = (u) => {
    setEditing(u)
    setForm({ username: u.username, email: u.email, full_name: u.full_name, password: '', role: u.role, permissions: u.permissions || [] })
    setShowModal(true)
  }

  const togglePerm = (key) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key]
    }))
  }

  const selectAllPerms = () => {
    const allKeys = []
    ALL_MODULES.forEach(m => {
      allKeys.push(m.key)
      if (m.subModules) m.subModules.forEach(sm => allKeys.push(sm.key))
    })
    setForm(prev => ({ ...prev, permissions: allKeys }))
  }

  const clearAllPerms = () => {
    setForm(prev => ({ ...prev, permissions: [] }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editing) {
      const { password, ...rest } = form
      updateMut.mutate({ id: editing.id, d: rest })
    } else {
      createMut.mutate(form)
    }
  }

  const handleDelete = async (user) => {
    const result = await Swal.fire({
      title: 'Deactivate user?',
      text: `This will deactivate "${user.username}". They won't be able to log in.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Deactivate',
    })
    if (result.isConfirmed) deleteMut.mutate(user.id)
  }

  const handleHardDelete = async (user) => {
    const result = await Swal.fire({
      title: 'Permanently delete user?',
      text: `This will permanently delete "${user.username}" from the database. This action cannot be undone.`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Delete Permanently',
    })
    if (result.isConfirmed) hardDeleteMut.mutate(user.id)
  }

  const handleReactivate = async (user) => {
    updateMut.mutate({
      id: user.id,
      d: { ...user, is_active: 1 }
    })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>User Management</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
            Create and manage admin users with module-level permissions
          </p>
        </div>
        <button className="t-btn-primary" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add User
        </button>
      </div>

      {/* Table */}
      <div className="t-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: 'var(--surface-2)' }}>
              <th className="t-th">User</th>
              <th className="t-th">Role</th>
              <th className="t-th">Permissions</th>
              <th className="t-th">Status</th>
              <th className="t-th text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="t-td text-center py-8" style={{ color: 'var(--text-subtle)' }}>Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="t-td text-center py-8" style={{ color: 'var(--text-subtle)' }}>No users found</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:brightness-105 transition-all">
                <td className="t-td">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: u.role === 'admin' ? 'var(--color-brand)' : 'var(--text-subtle)' }}>
                      {u.full_name?.charAt(0)?.toUpperCase() || u.username?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{u.full_name || u.username}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="t-td">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${u.role === 'admin'
                    ? 'text-amber-600'
                    : ''
                    }`}
                    style={{
                      backgroundColor: u.role === 'admin'
                        ? 'color-mix(in srgb, var(--color-brand) 12%, transparent)'
                        : 'var(--surface-2)',
                      color: u.role === 'admin' ? 'var(--color-brand)' : 'var(--text-muted)',
                    }}>
                    {u.role === 'admin' ? '👑 Admin' : 'User'}
                  </span>
                </td>
                <td className="t-td">
                  <div className="flex flex-wrap gap-1 max-w-[260px]">
                    {u.role === 'admin' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}>All Modules</span>
                    ) : (u.permissions || []).slice(0, 4).map(p => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}>{p.replace('_', ' ')}</span>
                    ))}
                    {u.role !== 'admin' && (u.permissions || []).length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}>+{u.permissions.length - 4}</span>
                    )}
                  </div>
                </td>
                <td className="t-td">
                  <span className={u.is_active ? 't-badge-active' : 't-badge-inactive'}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="t-td text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(u)} className="p-1.5 rounded-md hover:bg-[var(--surface-2)] transition-colors" title="Edit">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button onClick={() => { setPasswordTarget(u); setShowPasswordModal(true); }} className="p-1.5 rounded-md hover:bg-[var(--surface-2)] transition-colors" title="Reset Password">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                      </svg>
                    </button>
                    {u.is_active ? (
                      <button onClick={() => handleDelete(u)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Deactivate">
                        <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </button>
                    ) : (
                      <button onClick={() => handleReactivate(u)} className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors" title="Reactivate">
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}
                    {currentUser?.role === 'admin' && u.id !== currentUser?.id && (
                      <button onClick={() => handleHardDelete(u)} className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors ml-1" title="Permanently Delete">
                        <svg className="w-4 h-4 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <h3 className="text-[15px] font-bold mb-4" style={{ color: 'var(--text)' }}>
              {editing ? 'Edit User' : 'Create User'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>Username</label>
                  <input className="t-input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>Email</label>
                  <input className="t-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>Full Name</label>
                  <input className="t-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                </div>
                {!editing && (
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>Password</label>
                    <input className="t-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>Role</label>
                  <select className="t-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option value="user">User</option>
                    <option value="admin">Admin (Super User)</option>
                  </select>
                </div>
              </div>

              {form.role === 'user' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>Module Permissions</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllPerms} className="text-[10px] font-medium" style={{ color: 'var(--color-brand)' }}>Select All</button>
                      <button type="button" onClick={clearAllPerms} className="text-[10px] font-medium" style={{ color: 'var(--text-subtle)' }}>Clear</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                    {ALL_MODULES.map(m => (
                      <div key={m.key} className="flex flex-col gap-1 p-2.5 rounded-xl transition-colors" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <label className="flex items-center gap-2 cursor-pointer transition-all text-[12px] font-bold"
                          style={{
                            color: form.permissions.includes(m.key) ? 'var(--text)' : 'var(--text-muted)',
                          }}>
                          <input type="checkbox" checked={form.permissions.includes(m.key)} onChange={() => togglePerm(m.key)} className="hidden" />
                          <span className="w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 transition-colors"
                            style={{
                              borderColor: form.permissions.includes(m.key) ? 'var(--color-brand)' : 'var(--border-soft)',
                              backgroundColor: form.permissions.includes(m.key) ? 'var(--color-brand)' : 'var(--surface-2)',
                            }}>
                            {form.permissions.includes(m.key) && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </span>
                          {m.label}
                        </label>

                        {m.subModules && (
                          <div className="grid grid-cols-1 gap-1 mt-1 pt-1.5" style={{ borderTop: '1px dashed var(--border-soft)' }}>
                            {m.subModules.map(sm => (
                              <label key={sm.key} className="flex items-center gap-1.5 px-1 py-1 rounded cursor-pointer transition-all text-[11px] font-medium"
                                style={{
                                  backgroundColor: form.permissions.includes(sm.key) ? 'color-mix(in srgb, var(--color-brand) 8%, transparent)' : 'transparent',
                                  color: form.permissions.includes(sm.key) ? 'var(--color-brand)' : 'var(--text-subtle)',
                                }}>
                                <input type="checkbox" checked={form.permissions.includes(sm.key)} onChange={() => togglePerm(sm.key)} className="hidden" />
                                <span className="w-3 h-3 rounded flex items-center justify-center border shrink-0 transition-colors"
                                  style={{
                                    borderColor: form.permissions.includes(sm.key) ? 'var(--color-brand)' : 'var(--border-soft)',
                                    backgroundColor: form.permissions.includes(sm.key) ? 'var(--color-brand)' : 'transparent',
                                  }}>
                                  {form.permissions.includes(sm.key) && (
                                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                    </svg>
                                  )}
                                </span>
                                {sm.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                <button type="button" className="t-btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="t-btn-primary" disabled={createMut.isPending || updateMut.isPending}>
                  {(createMut.isPending || updateMut.isPending) ? 'Saving…' : editing ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <h3 className="text-[15px] font-bold mb-1" style={{ color: 'var(--text)' }}>Reset Password</h3>
            <p className="text-[12px] mb-4" style={{ color: 'var(--text-subtle)' }}>
              Set a new password for <strong>{passwordTarget?.username}</strong>
            </p>
            <form onSubmit={e => { e.preventDefault(); resetPwMut.mutate({ id: passwordTarget.id, password: newPassword }); }}>
              <input className="t-input mb-4" type="password" placeholder="New password (min 6 chars)" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} required minLength={6} autoFocus />
              <div className="flex justify-end gap-2">
                <button type="button" className="t-btn-ghost" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                <button type="submit" className="t-btn-primary" disabled={resetPwMut.isPending}>
                  {resetPwMut.isPending ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
