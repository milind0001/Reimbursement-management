import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersAPI } from '../lib/api';
import { Users, Plus, Edit3, Trash2, X, Shield, User, UserCheck } from 'lucide-react';

export default function Team() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({
    name: '', email: '', password: '', role: 'employee', managerId: '',
  });
  const [error, setError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await usersAPI.list();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const managers = users.filter(u => u.role === 'manager');

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', email: '', password: '', role: 'employee', managerId: '' });
    setShowModal(true);
    setError('');
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, managerId: u.managerId || '' });
    setShowModal(true);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFormLoading(true);
    try {
      if (editUser) {
        await usersAPI.update(editUser.id, {
          name: form.name,
          role: form.role,
          managerId: form.managerId || null,
        });
      } else {
        await usersAPI.create(form);
      }
      await fetchUsers();
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await usersAPI.delete(id);
      await fetchUsers();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const roleIcons = {
    admin: Shield,
    manager: UserCheck,
    employee: User,
  };

  const roleColors = {
    admin: 'from-violet-500 to-purple-600',
    manager: 'from-cyan-500 to-blue-600',
    employee: 'from-emerald-500 to-teal-600',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-primary-400" />
            Team Management
          </h1>
          <p className="text-dark-400 mt-1">{users.length} members in your organization</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* User Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u, index) => {
          const RoleIcon = roleIcons[u.role] || User;
          return (
            <div
              key={u.id}
              className="glass-card-hover p-5 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${roleColors[u.role]} flex items-center justify-center`}>
                    <span className="text-white font-bold">{u.name?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{u.name}</p>
                    <p className="text-xs text-dark-400">{u.email}</p>
                  </div>
                </div>
                {u.id !== currentUser.id && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(u)}
                      className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-primary-400 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className={`badge bg-gradient-to-r ${roleColors[u.role]} text-white border-0`}>
                  <RoleIcon className="w-3 h-3 mr-1" />
                  {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                </div>
              </div>

              {u.manager && (
                <p className="text-xs text-dark-400 mt-3">
                  Reports to: <span className="text-dark-300">{u.manager.name}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-md w-full animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">
                {editUser ? 'Edit Member' : 'Add New Member'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="input-label">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>

              {!editUser && (
                <>
                  <div>
                    <label className="input-label">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="input-label">Password</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                      className="input-field"
                      required
                      minLength={6}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="input-label">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                  className="input-field"
                >
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="input-label">Manager (optional)</label>
                <select
                  value={form.managerId}
                  onChange={(e) => setForm(prev => ({ ...prev, managerId: e.target.value }))}
                  className="input-field"
                >
                  <option value="">No manager</option>
                  {managers.filter(m => m.id !== editUser?.id).map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="btn-primary flex-1">
                  {formLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : editUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
