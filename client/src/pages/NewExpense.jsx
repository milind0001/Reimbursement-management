import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { expensesAPI, currenciesAPI, workflowsAPI } from '../lib/api';
import { Camera, Upload, X, Plus, Trash2, ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import Tesseract from 'tesseract.js';

export default function NewExpense() {
  const { user, company } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    amount: '',
    currencyCode: company?.currencyCode || 'USD',
    category: 'other',
    description: '',
    expenseDate: new Date().toISOString().split('T')[0],
    isManagerApprover: true,
    workflowId: '',
  });
  const [lines, setLines] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [rates, setRates] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWorkflows();
  }, []);

  useEffect(() => {
    if (form.currencyCode && form.currencyCode !== company?.currencyCode) {
      fetchRates();
    }
  }, [form.currencyCode]);

  const fetchWorkflows = async () => {
    try {
      const { data } = await workflowsAPI.list();
      setWorkflows(data);
      const defaultWf = data.find(w => w.isDefault);
      if (defaultWf) setForm(prev => ({ ...prev, workflowId: defaultWf.id }));
    } catch (err) { /* ignore */ }
  };

  const fetchRates = async () => {
    try {
      const { data } = await currenciesAPI.rates(form.currencyCode);
      setRates(data);
    } catch (err) { /* ignore */ }
  };

  const convertedAmount = () => {
    if (!form.amount || form.currencyCode === company?.currencyCode) return parseFloat(form.amount) || 0;
    if (!rates || !rates[company?.currencyCode]) return 0;
    return (parseFloat(form.amount) * rates[company.currencyCode]).toFixed(2);
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setReceipt(file);
    const reader = new FileReader();
    reader.onload = (e) => setReceiptPreview(e.target.result);
    reader.readAsDataURL(file);

    // Run OCR
    setOcrLoading(true);
    setOcrProgress(0);
    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const text = result.data.text;
      parseReceiptText(text);
    } catch (err) {
      console.error('OCR failed:', err);
    } finally {
      setOcrLoading(false);
    }
  };

  const parseReceiptText = (text) => {
    const lines_text = text.split('\n').filter(l => l.trim());

    // Try to extract amount (look for numbers with decimal points)
    const amountPatterns = [
      /(?:total|amount|sum|grand total|subtotal)[:\s]*[\$€£₹]?\s*([\d,]+\.?\d*)/i,
      /[\$€£₹]\s*([\d,]+\.\d{2})/,
      /([\d,]+\.\d{2})/,
    ];

    let extractedAmount = '';
    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        extractedAmount = match[1].replace(/,/g, '');
        break;
      }
    }

    // Try to extract date
    const datePatterns = [
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s*\d{2,4})/i,
    ];

    let extractedDate = '';
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const d = new Date(match[1]);
          if (!isNaN(d.getTime())) {
            extractedDate = d.toISOString().split('T')[0];
          }
        } catch (e) { /* ignore */ }
        break;
      }
    }

    // Guess category from text
    let category = 'other';
    const lowerText = text.toLowerCase();
    if (/restaurant|cafe|coffee|food|pizza|burger|diner|bistro|kitchen/i.test(lowerText)) category = 'meals';
    else if (/hotel|flight|airline|booking|travel|airbnb|uber|lyft|taxi|cab/i.test(lowerText)) category = 'travel';
    else if (/office|supply|supplies|staples|amazon/i.test(lowerText)) category = 'office';
    else if (/gas|fuel|parking|toll|transit|metro|bus/i.test(lowerText)) category = 'transport';

    // Use first line as description
    const description = lines_text[0]?.substring(0, 100) || '';

    // Try to extract line items
    const extractedLines = [];
    const lineItemPattern = /(.+?)\s+([\d,]+\.?\d*)\s*$/;
    for (const line of lines_text.slice(1)) {
      const match = line.match(lineItemPattern);
      if (match && parseFloat(match[2].replace(/,/g, '')) > 0) {
        extractedLines.push({
          description: match[1].trim(),
          amount: match[2].replace(/,/g, ''),
          category: category,
        });
      }
    }

    setForm(prev => ({
      ...prev,
      amount: extractedAmount || prev.amount,
      description: description || prev.description,
      expenseDate: extractedDate || prev.expenseDate,
      category: category,
    }));

    if (extractedLines.length > 0) {
      setLines(extractedLines);
    }
  };

  const addLine = () => {
    setLines([...lines, { description: '', amount: '', category: form.category }]);
  };

  const removeLine = (index) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index, field, value) => {
    const updated = [...lines];
    updated[index][field] = value;
    setLines(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = {
        ...form,
        amount: parseFloat(form.amount),
        lines: lines.filter(l => l.description && l.amount),
        receipt: receipt,
      };

      await expensesAPI.create(submitData);
      navigate('/dashboard/expenses');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit expense');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: 'travel', label: '✈️ Travel' },
    { value: 'meals', label: '🍔 Meals' },
    { value: 'office', label: '📎 Office' },
    { value: 'transport', label: '🚗 Transport' },
    { value: 'other', label: '📋 Other' },
  ];

  const commonCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'BRL'];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-dark-800 text-dark-400 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">New Expense</h1>
          <p className="text-dark-400 mt-1">Submit a new expense claim</p>
        </div>
      </div>

      {/* OCR Receipt Scanner */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Camera className="w-5 h-5 text-primary-400" />
          Receipt Scanner (OCR)
        </h2>
        <p className="text-sm text-dark-400 mb-4">Upload a receipt to auto-fill expense details</p>

        {receiptPreview ? (
          <div className="relative">
            <img
              src={receiptPreview}
              alt="Receipt"
              className="max-h-48 rounded-xl border border-dark-600 object-contain"
            />
            <button
              onClick={() => { setReceipt(null); setReceiptPreview(null); }}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-dark-800/80 text-dark-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {ocrLoading && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-sm text-primary-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scanning receipt... {ocrProgress}%</span>
                </div>
                <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary-500 to-cyan-400 rounded-full transition-all"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-dark-600 rounded-xl p-8 text-center cursor-pointer hover:border-primary-500/50 hover:bg-primary-500/5 transition-all"
          >
            <Upload className="w-10 h-10 mx-auto mb-3 text-dark-400" />
            <p className="text-dark-300 font-medium">Click to upload receipt</p>
            <p className="text-xs text-dark-500 mt-1">PNG, JPG, or PDF up to 10MB</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleReceiptUpload}
          className="hidden"
        />
      </div>

      {/* Expense Form */}
      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-5">
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-400 text-sm animate-scale-in">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Amount</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="input-label">Currency</label>
            <select
              value={form.currencyCode}
              onChange={(e) => setForm(prev => ({ ...prev, currencyCode: e.target.value }))}
              className="input-field"
            >
              {commonCurrencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {form.currencyCode !== company?.currencyCode && form.amount && (
              <p className="text-xs text-primary-400 mt-1">
                ≈ {company?.currencySymbol}{convertedAmount()} {company?.currencyCode}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
              className="input-field"
              required
            >
              {categories.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Expense Date</label>
            <input
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm(prev => ({ ...prev, expenseDate: e.target.value }))}
              className="input-field"
              required
            />
          </div>
        </div>

        <div>
          <label className="input-label">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe your expense..."
            rows={3}
            className="input-field resize-none"
            required
          />
        </div>

        {/* Expense Lines */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="input-label mb-0">Expense Lines (optional)</label>
            <button type="button" onClick={addLine} className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add Line
            </button>
          </div>
          {lines.map((line, index) => (
            <div key={index} className="flex items-start gap-3 mb-3 animate-scale-in">
              <input
                type="text"
                value={line.description}
                onChange={(e) => updateLine(index, 'description', e.target.value)}
                placeholder="Item description"
                className="input-field flex-1"
              />
              <input
                type="number"
                step="0.01"
                value={line.amount}
                onChange={(e) => updateLine(index, 'amount', e.target.value)}
                placeholder="0.00"
                className="input-field w-28"
              />
              <button
                type="button"
                onClick={() => removeLine(index)}
                className="p-3 rounded-xl hover:bg-rose-500/10 text-dark-400 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Approval Settings */}
        <div className="border-t border-dark-700/50 pt-5">
          <h3 className="text-sm font-semibold text-white mb-3">Approval Settings</h3>

          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              id="managerApprover"
              checked={form.isManagerApprover}
              onChange={(e) => setForm(prev => ({ ...prev, isManagerApprover: e.target.checked }))}
              className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
            />
            <label htmlFor="managerApprover" className="text-sm text-dark-300">
              Require manager approval first
            </label>
          </div>

          {workflows.length > 0 && (
            <div>
              <label className="input-label">Approval Workflow</label>
              <select
                value={form.workflowId}
                onChange={(e) => setForm(prev => ({ ...prev, workflowId: e.target.value }))}
                className="input-field"
              >
                <option value="">No workflow</option>
                {workflows.map(w => (
                  <option key={w.id} value={w.id}>{w.name} {w.isDefault ? '(Default)' : ''}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Submit Expense
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
