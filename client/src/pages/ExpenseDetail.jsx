import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { expensesAPI, approvalsAPI } from '../lib/api';
import { ArrowLeft, CheckCircle, XCircle, Clock, User, MessageSquare, Receipt, ExternalLink } from 'lucide-react';

export default function ExpenseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, company } = useAuth();
  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectRecordId, setRejectRecordId] = useState(null);

  useEffect(() => {
    fetchExpense();
  }, [id]);

  const fetchExpense = async () => {
    try {
      const { data } = await expensesAPI.get(id);
      setExpense(data);
    } catch (err) {
      console.error('Failed to fetch expense:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (recordId) => {
    setActionLoading(true);
    try {
      await approvalsAPI.approve(recordId, { comments: comment || 'Approved' });
      await fetchExpense();
      setComment('');
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) return;
    setActionLoading(true);
    try {
      await approvalsAPI.reject(rejectRecordId, { comments: comment });
      await fetchExpense();
      setShowRejectModal(false);
      setComment('');
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdminOverride = async (action) => {
    if (action === 'reject' && !comment.trim()) return;

    setActionLoading(true);
    try {
      await approvalsAPI.overrideExpense(expense.id, {
        action,
        comments: comment || null,
      });
      await fetchExpense();
      setComment('');
    } catch (err) {
      console.error('Admin override failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const statusConfig = {
    pending: { color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Clock, label: 'Pending' },
    in_review: { color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: Clock, label: 'In Review' },
    approved: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle, label: 'Approved' },
    rejected: { color: 'text-rose-400', bg: 'bg-rose-500/20', icon: XCircle, label: 'Rejected' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="text-center py-16">
        <p className="text-dark-400">Expense not found</p>
      </div>
    );
  }

  const status = statusConfig[expense.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  // Check if current user has a pending approval record for this expense
  const myPendingRecord = expense.records?.find(r =>
    r.approverId === user.id && r.status === 'pending'
  );

  // Check if it's actually this approver's turn
  const isMyTurn = myPendingRecord && (() => {
    const myStepOrder = myPendingRecord.step?.stepOrder;
    const previousRecords = expense.records.filter(r => r.step?.stepOrder < myStepOrder);
    return previousRecords.every(r => r.status === 'approved');
  })();

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-dark-800 text-dark-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Expense Detail</h1>
          <p className="text-dark-400 mt-1">#{expense.id.slice(0, 8)}</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${status.bg}`}>
          <StatusIcon className={`w-4 h-4 ${status.color}`} />
          <span className={`text-sm font-semibold ${status.color}`}>{status.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-dark-400 mb-1">Amount</p>
                <p className="text-lg font-bold text-white">{expense.currencyCode} {expense.amount?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-dark-400 mb-1">Converted ({company?.currencyCode})</p>
                <p className="text-lg font-bold text-primary-400">{company?.currencySymbol}{expense.convertedAmount?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-dark-400 mb-1">Category</p>
                <p className="text-sm text-dark-200 capitalize">{expense.category}</p>
              </div>
              <div>
                <p className="text-xs text-dark-400 mb-1">Date</p>
                <p className="text-sm text-dark-200">{expense.expenseDate}</p>
              </div>
              <div>
                <p className="text-xs text-dark-400 mb-1">Exchange Rate</p>
                <p className="text-sm text-dark-200">{expense.exchangeRate?.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-xs text-dark-400 mb-1">Submitted By</p>
                <p className="text-sm text-dark-200">{expense.user?.name}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs text-dark-400 mb-1">Description</p>
              <p className="text-sm text-dark-200">{expense.description}</p>
            </div>

            {/* Receipt */}
            {expense.receiptPath && (
              <div className="mt-4 pt-4 border-t border-dark-700/50">
                <p className="text-xs text-dark-400 mb-2">Receipt</p>
                <img
                  src={`${import.meta.env.VITE_API_URL}${expense.receiptPath}`}
                  alt="Receipt"
                  className="max-h-64 rounded-xl border border-dark-600 object-contain cursor-pointer"
                  onClick={() => window.open(`${import.meta.env.VITE_API_URL}${expense.receiptPath}`, '_blank')}
                />
              </div>
            )}
          </div>

          {/* Expense Lines */}
          {expense.lines?.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Line Items</h2>
              <div className="space-y-3">
                {expense.lines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-xl">
                    <div>
                      <p className="text-sm text-dark-200">{line.description}</p>
                      <p className="text-xs text-dark-400 capitalize">{line.category}</p>
                    </div>
                    <p className="text-sm font-semibold text-white">{expense.currencyCode} {line.amount?.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approve/Reject Actions */}
          {isMyTurn && expense.status !== 'approved' && expense.status !== 'rejected' && (
            <div className="glass-card p-6 border border-primary-500/20">
              <h2 className="text-lg font-semibold text-white mb-4">Your Action Required</h2>
              <div className="mb-4">
                <label className="input-label">Comments</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add your comments..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleApprove(myPendingRecord.id)}
                  disabled={actionLoading}
                  className="btn-success flex-1 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>
                <button
                  onClick={() => { setRejectRecordId(myPendingRecord.id); setShowRejectModal(true); }}
                  disabled={actionLoading}
                  className="btn-danger flex-1 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          )}

          {user?.role === 'admin' && expense.status !== 'approved' && expense.status !== 'rejected' && (
            <div className="glass-card p-6 border border-amber-500/20">
              <h2 className="text-lg font-semibold text-white mb-2">Admin Override</h2>
              <p className="text-sm text-dark-400 mb-4">Finalize this expense regardless of current workflow step.</p>
              <div className="mb-4">
                <label className="input-label">Override Comments</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add context for override action..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => handleAdminOverride('approve')}
                  disabled={actionLoading}
                  className="btn-success flex-1 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Override Approve
                </button>
                <button
                  onClick={() => handleAdminOverride('reject')}
                  disabled={actionLoading || !comment.trim()}
                  className="btn-danger flex-1 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Override Reject
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Approval Timeline */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Approval Timeline</h2>
            {expense.records?.length > 0 ? (
              <div className="space-y-4">
                {expense.records.map((record, index) => {
                  const isLast = index === expense.records.length - 1;
                  const recordStatus = statusConfig[record.status] || statusConfig.pending;
                  const RecordIcon = recordStatus.icon;

                  return (
                    <div key={record.id} className="relative">
                      {!isLast && (
                        <div className="absolute left-5 top-12 w-0.5 h-full -bottom-4 bg-dark-700" />
                      )}
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl ${recordStatus.bg} flex items-center justify-center flex-shrink-0`}>
                          <RecordIcon className={`w-5 h-5 ${recordStatus.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">
                            {record.step?.approverRoleLabel || 'Approver'}
                          </p>
                          <p className="text-xs text-dark-400">{record.approver?.name}</p>
                          <p className={`text-xs font-medium ${recordStatus.color} mt-1`}>
                            {record.status === 'pending' ? 'Waiting' : record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </p>
                          {record.comments && (
                            <div className="mt-2 p-2 bg-dark-800/50 rounded-lg">
                              <p className="text-xs text-dark-300 flex items-start gap-1">
                                <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                {record.comments}
                              </p>
                            </div>
                          )}
                          {record.actedAt && (
                            <p className="text-xs text-dark-500 mt-1">
                              {new Date(record.actedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-dark-400">No approval workflow configured</p>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-md w-full animate-scale-in">
            <h3 className="text-lg font-semibold text-white mb-4">Reject Expense</h3>
            <p className="text-sm text-dark-400 mb-4">Please provide a reason for rejecting this expense.</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="input-field resize-none mb-4"
              required
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowRejectModal(false); setComment(''); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!comment.trim() || actionLoading}
                className="btn-danger flex-1"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
