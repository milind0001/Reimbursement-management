import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { workflowsAPI, usersAPI } from '../lib/api';
import { GitBranch, Plus, Trash2, X, ArrowDown, Settings, Percent, UserCheck, Layers } from 'lucide-react';

export default function Workflows() {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '', isDefault: false, steps: [], rules: [],
  });
  const [error, setError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    Promise.all([fetchWorkflows(), fetchUsers()]);
  }, []);

  const fetchWorkflows = async () => {
    try {
      const { data } = await workflowsAPI.list();
      setWorkflows(data);
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data } = await usersAPI.list();
      setUsers(data);
    } catch (err) { /* ignore */ }
  };

  const approvers = users.filter(u => u.role === 'manager' || u.role === 'admin');

  const addStep = () => {
    setForm(prev => ({
      ...prev,
      steps: [...prev.steps, { approverId: '', approverRoleLabel: '', stepOrder: prev.steps.length + 1 }],
    }));
  };

  const removeStep = (index) => {
    setForm(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepOrder: i + 1 })),
    }));
  };

  const updateStep = (index, field, value) => {
    setForm(prev => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], [field]: value };
      return { ...prev, steps };
    });
  };

  const addRule = () => {
    setForm(prev => ({
      ...prev,
      rules: [...prev.rules, { ruleType: 'percentage', percentageThreshold: 60, specificApproverId: '' }],
    }));
  };

  const removeRule = (index) => {
    setForm(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  const updateRule = (index, field, value) => {
    setForm(prev => {
      const rules = [...prev.rules];
      rules[index] = { ...rules[index], [field]: value };
      return { ...prev, rules };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFormLoading(true);
    try {
      await workflowsAPI.create(form);
      await fetchWorkflows();
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create workflow');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this workflow?')) return;
    try {
      await workflowsAPI.delete(id);
      await fetchWorkflows();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const ruleTypeLabels = {
    percentage: { icon: Percent, label: 'Percentage Rule', color: 'text-amber-400' },
    specific_approver: { icon: UserCheck, label: 'Specific Approver', color: 'text-cyan-400' },
    hybrid: { icon: Layers, label: 'Hybrid Rule', color: 'text-violet-400' },
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
            <GitBranch className="w-7 h-7 text-primary-400" />
            Approval Workflows
          </h1>
          <p className="text-dark-400 mt-1">Configure multi-level approval flows and conditional rules</p>
        </div>
        <button
          onClick={() => {
            setForm({ name: '', isDefault: false, steps: [], rules: [] });
            setShowModal(true);
            setError('');
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Workflow
        </button>
      </div>

      {/* Workflow list */}
      <div className="space-y-4">
        {workflows.length === 0 ? (
          <div className="glass-card p-16 text-center">
            <GitBranch className="w-12 h-12 mx-auto mb-4 text-dark-500" />
            <p className="text-dark-300 text-lg">No workflows configured</p>
            <p className="text-dark-400 text-sm mt-1">Create your first approval workflow</p>
          </div>
        ) : (
          workflows.map((wf, index) => (
            <div
              key={wf.id}
              className="glass-card p-6 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
                    <GitBranch className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{wf.name}</h3>
                    {wf.isDefault && (
                      <span className="badge bg-primary-500/20 text-primary-400 border border-primary-500/30 text-xs">
                        Default
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(wf.id)}
                  className="p-2 rounded-lg hover:bg-rose-500/10 text-dark-400 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Steps */}
              {wf.steps?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-dark-400 uppercase mb-3">Approval Steps</p>
                  <div className="space-y-2">
                    {wf.steps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center text-xs font-bold text-primary-400">
                          {step.stepOrder}
                        </div>
                        <ArrowDown className="w-3 h-3 text-dark-500" />
                        <div className="flex-1 p-3 bg-dark-800/50 rounded-lg">
                          <p className="text-sm text-dark-200">{step.approverRoleLabel}</p>
                          <p className="text-xs text-dark-400">{step.approver?.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rules */}
              {wf.rules?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-dark-400 uppercase mb-3">Conditional Rules</p>
                  <div className="space-y-2">
                    {wf.rules.map((rule) => {
                      const ruleInfo = ruleTypeLabels[rule.ruleType] || ruleTypeLabels.percentage;
                      const RuleIcon = ruleInfo.icon;
                      return (
                        <div key={rule.id} className="flex items-center gap-3 p-3 bg-dark-800/50 rounded-lg">
                          <RuleIcon className={`w-4 h-4 ${ruleInfo.color}`} />
                          <div>
                            <p className="text-sm text-dark-200">{ruleInfo.label}</p>
                            <p className="text-xs text-dark-400">
                              {rule.ruleType === 'percentage' && `${rule.percentageThreshold}% of approvers must approve`}
                              {rule.ruleType === 'specific_approver' && `If ${rule.specificApprover?.name || 'specified approver'} approves → auto-approve`}
                              {rule.ruleType === 'hybrid' && `${rule.percentageThreshold}% OR ${rule.specificApprover?.name || 'specific approver'} approves`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass-card p-6 max-w-lg w-full animate-scale-in my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Create Workflow</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="input-label">Workflow Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Standard Approval"
                  className="input-field"
                  required
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="wf-default"
                  checked={form.isDefault}
                  onChange={(e) => setForm(prev => ({ ...prev, isDefault: e.target.checked }))}
                  className="w-4 h-4 rounded border-dark-600 bg-dark-800"
                />
                <label htmlFor="wf-default" className="text-sm text-dark-300">Set as default workflow</label>
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="input-label mb-0">Approval Steps</label>
                  <button type="button" onClick={addStep} className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Step
                  </button>
                </div>
                {form.steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-2 mb-3 animate-scale-in">
                    <div className="w-8 h-8 rounded-lg bg-dark-800 flex items-center justify-center text-xs font-bold text-primary-400 flex-shrink-0 mt-1">
                      {index + 1}
                    </div>
                    <select
                      value={step.approverId}
                      onChange={(e) => updateStep(index, 'approverId', e.target.value)}
                      className="input-field flex-1"
                      required
                    >
                      <option value="">Select approver</option>
                      {approvers.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={step.approverRoleLabel}
                      onChange={(e) => updateStep(index, 'approverRoleLabel', e.target.value)}
                      placeholder="Role label"
                      className="input-field w-32"
                    />
                    <button type="button" onClick={() => removeStep(index)} className="p-2 text-dark-400 hover:text-rose-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Rules */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="input-label mb-0">Conditional Rules (optional)</label>
                  <button type="button" onClick={addRule} className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Rule
                  </button>
                </div>
                {form.rules.map((rule, index) => (
                  <div key={index} className="p-4 bg-dark-800/50 rounded-xl mb-3 space-y-3 animate-scale-in">
                    <div className="flex items-center justify-between">
                      <select
                        value={rule.ruleType}
                        onChange={(e) => updateRule(index, 'ruleType', e.target.value)}
                        className="input-field w-auto"
                      >
                        <option value="percentage">Percentage Rule</option>
                        <option value="specific_approver">Specific Approver</option>
                        <option value="hybrid">Hybrid (Both)</option>
                      </select>
                      <button type="button" onClick={() => removeRule(index)} className="p-2 text-dark-400 hover:text-rose-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {(rule.ruleType === 'percentage' || rule.ruleType === 'hybrid') && (
                      <div>
                        <label className="text-xs text-dark-400">Percentage Threshold (%)</label>
                        <input
                          type="number"
                          min="1" max="100"
                          value={rule.percentageThreshold}
                          onChange={(e) => updateRule(index, 'percentageThreshold', e.target.value)}
                          className="input-field mt-1"
                        />
                      </div>
                    )}

                    {(rule.ruleType === 'specific_approver' || rule.ruleType === 'hybrid') && (
                      <div>
                        <label className="text-xs text-dark-400">Specific Approver</label>
                        <select
                          value={rule.specificApproverId}
                          onChange={(e) => updateRule(index, 'specificApproverId', e.target.value)}
                          className="input-field mt-1"
                        >
                          <option value="">Select approver</option>
                          {approvers.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="btn-primary flex-1">
                  {formLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : 'Create Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
