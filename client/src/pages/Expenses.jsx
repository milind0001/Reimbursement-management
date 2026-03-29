import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { expensesAPI } from '../lib/api';
import { Plus, Search, Filter, Receipt, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Expenses() {
  const { user, company } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchExpenses();
  }, [page, statusFilter, categoryFilter]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      const { data } = await expensesAPI.list(params);
      setExpenses(data.expenses);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Failed to fetch expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status) => {
    const classes = {
      pending: 'badge-pending',
      in_review: 'badge-in-review',
      approved: 'badge-approved',
      rejected: 'badge-rejected',
    };
    const labels = {
      pending: 'Pending',
      in_review: 'In Review',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    return <span className={classes[status] || 'badge-pending'}>{labels[status] || status}</span>;
  };

  const categories = ['travel', 'meals', 'office', 'transport', 'other'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <p className="text-dark-400 mt-1">
            {user?.role === 'admin' ? 'All company expenses' :
             user?.role === 'manager' ? 'Your team expenses' : 'Your submitted expenses'}
          </p>
        </div>
        <button
          onClick={() => navigate('/dashboard/expenses/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Expense
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-dark-400" />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-dark-200 focus:outline-none focus:border-primary-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_review">In Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm text-dark-200 focus:outline-none focus:border-primary-500"
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Expenses Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="w-12 h-12 mx-auto mb-4 text-dark-500" />
            <p className="text-dark-400 text-lg">No expenses found</p>
            <button
              onClick={() => navigate('/dashboard/expenses/new')}
              className="text-primary-400 text-sm mt-2 hover:text-primary-300"
            >
              Submit your first expense
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dark-700/50">
                    <th className="text-left text-xs font-semibold text-dark-400 uppercase tracking-wider px-6 py-4">Description</th>
                    <th className="text-left text-xs font-semibold text-dark-400 uppercase tracking-wider px-6 py-4">Category</th>
                    <th className="text-left text-xs font-semibold text-dark-400 uppercase tracking-wider px-6 py-4">Date</th>
                    <th className="text-right text-xs font-semibold text-dark-400 uppercase tracking-wider px-6 py-4">Amount</th>
                    <th className="text-right text-xs font-semibold text-dark-400 uppercase tracking-wider px-6 py-4">Converted</th>
                    <th className="text-center text-xs font-semibold text-dark-400 uppercase tracking-wider px-6 py-4">Status</th>
                    {user?.role !== 'employee' && (
                      <th className="text-left text-xs font-semibold text-dark-400 uppercase tracking-wider px-6 py-4">Submitted By</th>
                    )}
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700/50">
                  {expenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-dark-800/50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/dashboard/expenses/${expense.id}`)}
                    >
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-white truncate max-w-[200px]">{expense.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-dark-300 capitalize">{expense.category}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-dark-300">{expense.expenseDate}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-dark-200">{expense.currencyCode} {expense.amount?.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-semibold text-white">{company?.currencySymbol}{expense.convertedAmount?.toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {statusBadge(expense.status)}
                      </td>
                      {user?.role !== 'employee' && (
                        <td className="px-6 py-4">
                          <span className="text-sm text-dark-300">{expense.user?.name}</span>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <ArrowUpRight className="w-4 h-4 text-dark-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-dark-700/50">
              {expenses.map((expense) => (
                <div
                  key={expense.id}
                  className="p-4 hover:bg-dark-800/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/dashboard/expenses/${expense.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-white">{expense.description}</p>
                    {statusBadge(expense.status)}
                  </div>
                  <div className="flex justify-between items-end">
                    <p className="text-xs text-dark-400">{expense.category} • {expense.expenseDate}</p>
                    <p className="text-sm font-semibold text-white">{company?.currencySymbol}{expense.convertedAmount?.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-dark-700/50 flex items-center justify-between">
                <p className="text-sm text-dark-400">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary py-2 px-3 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-secondary py-2 px-3 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
