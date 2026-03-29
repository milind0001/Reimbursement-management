import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { expensesAPI } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Clock, CheckCircle, XCircle, DollarSign,
  ArrowUpRight, Receipt, Plus
} from 'lucide-react';

export default function Dashboard() {
  const { user, company } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await expensesAPI.stats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `${company?.currencySymbol || '$'}${amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Expenses',
      value: stats?.total || 0,
      icon: Receipt,
      gradient: 'from-primary-500 to-primary-700',
      shadow: 'shadow-primary-500/25',
    },
    {
      label: 'Pending Approval',
      value: stats?.pending || 0,
      icon: Clock,
      gradient: 'from-amber-500 to-orange-600',
      shadow: 'shadow-amber-500/25',
    },
    {
      label: 'Approved',
      value: stats?.approved || 0,
      icon: CheckCircle,
      gradient: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-500/25',
    },
    {
      label: 'Rejected',
      value: stats?.rejected || 0,
      icon: XCircle,
      gradient: 'from-rose-500 to-pink-600',
      shadow: 'shadow-rose-500/25',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-dark-400 mt-1">Here's your expense overview</p>
        </div>
        {(user?.role === 'employee' || user?.role === 'manager') && (
          <button
            onClick={() => navigate('/dashboard/expenses/new')}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Expense
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <div
            key={card.label}
            className="glass-card-hover p-6 animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-dark-400 mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-white">{card.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg ${card.shadow}`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-dark-400">Total Approved</p>
              <p className="text-2xl font-bold text-emerald-400">{formatCurrency(stats?.totalApprovedAmount)}</p>
            </div>
          </div>
          <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000"
              style={{ width: `${stats?.total ? (stats.approved / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '500ms' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-dark-400">Pending Amount</p>
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(stats?.totalPendingAmount)}</p>
            </div>
          </div>
          <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-1000"
              style={{ width: `${stats?.total ? (stats.pending / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '600ms' }}>
        <div className="px-6 py-4 border-b border-dark-700/50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent Expenses</h2>
          <button
            onClick={() => navigate('/dashboard/expenses')}
            className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors"
          >
            View all <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        <div className="divide-y divide-dark-700/50">
          {stats?.recent?.length > 0 ? (
            stats.recent.map((expense) => (
              <div
                key={expense.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-dark-800/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/dashboard/expenses/${expense.id}`)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-dark-800 flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-dark-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{expense.description}</p>
                    <p className="text-xs text-dark-400">{expense.category} • {expense.expenseDate}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">
                    {company?.currencySymbol}{expense.convertedAmount?.toFixed(2)}
                  </p>
                  <span className={`text-xs ${
                    expense.status === 'approved' ? 'text-emerald-400' :
                    expense.status === 'rejected' ? 'text-rose-400' :
                    expense.status === 'in_review' ? 'text-cyan-400' :
                    'text-amber-400'
                  }`}>
                    {expense.status === 'in_review' ? 'In Review' : expense.status?.charAt(0).toUpperCase() + expense.status?.slice(1)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-center text-dark-400">
              <Receipt className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No expenses yet</p>
              <button
                onClick={() => navigate('/dashboard/expenses/new')}
                className="text-primary-400 text-sm mt-2 hover:text-primary-300 transition-colors"
              >
                Submit your first expense
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
