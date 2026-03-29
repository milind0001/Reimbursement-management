import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { approvalsAPI } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { FileCheck, CheckCircle, XCircle, Clock, MessageSquare, ArrowUpRight, Inbox } from 'lucide-react';

export default function Approvals() {
  const { user, company } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [commentModal, setCommentModal] = useState(null);
  const [comment, setComment] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    try {
      const { data } = await approvalsAPI.list();
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (recordId) => {
    setActionLoading(recordId);
    try {
      await approvalsAPI.approve(recordId, { comments: 'Approved' });
      await fetchApprovals();
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (recordId) => {
    if (!comment.trim()) return;
    setActionLoading(recordId);
    try {
      await approvalsAPI.reject(recordId, { comments: comment });
      await fetchApprovals();
      setCommentModal(null);
      setComment('');
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setActionLoading(null);
    }
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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <FileCheck className="w-7 h-7 text-primary-400" />
          Pending Approvals
        </h1>
        <p className="text-dark-400 mt-1">
          {records.length} expense{records.length !== 1 ? 's' : ''} waiting for your review
        </p>
      </div>

      {records.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Inbox className="w-16 h-16 mx-auto mb-4 text-dark-500" />
          <p className="text-xl text-dark-300 font-medium">All caught up!</p>
          <p className="text-dark-400 mt-2">No expenses waiting for your approval</p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record, index) => (
            <div
              key={record.id}
              className="glass-card-hover p-6 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-lg font-semibold text-white">
                        {record.expense?.description}
                      </p>
                      <p className="text-sm text-dark-400 mt-1">
                        by {record.expense?.user?.name} • {record.expense?.category} • {record.expense?.expenseDate}
                      </p>
                    </div>
                    <div className="badge-pending flex items-center gap-1 ml-4 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {record.step?.approverRoleLabel || 'Approver'}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 mt-3">
                    <div>
                      <p className="text-xs text-dark-400">Original Amount</p>
                      <p className="text-sm text-dark-200">
                        {record.expense?.currencyCode} {record.expense?.amount?.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-dark-400">{company?.currencyCode} Amount</p>
                      <p className="text-sm font-bold text-white">
                        {company?.currencySymbol}{record.expense?.convertedAmount?.toFixed(2)}
                      </p>
                    </div>
                    {record.expense?.lines?.length > 0 && (
                      <div>
                        <p className="text-xs text-dark-400">Line Items</p>
                        <p className="text-sm text-dark-200">{record.expense.lines.length}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/dashboard/expenses/${record.expense?.id}`)}
                    className="btn-secondary py-2 px-4 text-sm flex items-center gap-1"
                  >
                    View <ArrowUpRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleApprove(record.id)}
                    disabled={actionLoading === record.id}
                    className="btn-success py-2 px-4 text-sm flex items-center gap-1"
                  >
                    {actionLoading === record.id ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => { setCommentModal(record.id); setComment(''); }}
                    className="btn-danger py-2 px-4 text-sm flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {commentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-md w-full animate-scale-in">
            <h3 className="text-lg font-semibold text-white mb-4">Reject Expense</h3>
            <p className="text-sm text-dark-400 mb-4">Provide a reason for rejection.</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="input-field resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setCommentModal(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => handleReject(commentModal)}
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
