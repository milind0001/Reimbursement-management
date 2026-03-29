import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Receipt, FileCheck, Users, GitBranch,
  Settings, LogOut, Menu, X, Building2, ChevronDown
} from 'lucide-react';
import { useState } from 'react';

export default function DashboardLayout() {
  const { user, company, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/dashboard/expenses', icon: Receipt, label: 'Expenses' },
    ...(user?.role === 'manager' || user?.role === 'admin'
      ? [{ to: '/dashboard/approvals', icon: FileCheck, label: 'Approvals' }]
      : []),
    ...(user?.role === 'admin'
      ? [
          { to: '/dashboard/team', icon: Users, label: 'Team' },
          { to: '/dashboard/workflows', icon: GitBranch, label: 'Workflows' },
          { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
        ]
      : []),
  ];

  const roleColors = {
    admin: 'from-violet-500 to-purple-600',
    manager: 'from-cyan-500 to-blue-600',
    employee: 'from-emerald-500 to-teal-600',
  };

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 bg-dark-900/80 backdrop-blur-xl
        border-r border-dark-700/50 flex flex-col transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-dark-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white truncate">{company?.name || 'Company'}</h1>
              <p className="text-xs text-dark-400">{company?.currencyCode} ({company?.currencySymbol})</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                isActive ? 'sidebar-link-active' : 'sidebar-link'
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-dark-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleColors[user?.role]} flex items-center justify-center`}>
              <span className="text-white font-bold text-sm">{user?.name?.charAt(0)?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-dark-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl text-dark-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-dark-950/80 backdrop-blur-xl border-b border-dark-700/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-dark-800 text-dark-400"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 ml-auto">
              <div className={`badge bg-gradient-to-r ${roleColors[user?.role]} text-white border-0 text-xs px-3 py-1`}>
                {user?.role?.toUpperCase()}
              </div>
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-dark-800 transition-all"
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${roleColors[user?.role]} flex items-center justify-center`}>
                    <span className="text-white font-bold text-xs">{user?.name?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-dark-200 hidden sm:inline">{user?.name}</span>
                  <ChevronDown className="w-4 h-4 text-dark-400" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-48 glass-card p-2 animate-scale-in">
                    <div className="px-3 py-2 border-b border-dark-700/50 mb-1">
                      <p className="text-xs text-dark-400">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10 transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
