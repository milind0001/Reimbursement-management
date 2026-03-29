import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { currenciesAPI } from '../lib/api';
import { Mail, Lock, User, Building2, Globe, ArrowRight, Sparkles } from 'lucide-react';

export default function Signup() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', companyName: '',
    country: '', currencyCode: '', currencySymbol: '',
  });
  const [countries, setCountries] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const { signup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      const { data } = await currenciesAPI.countries();
      setCountries(data);
    } catch (err) {
      console.error('Failed to load countries:', err);
    } finally {
      setLoadingCountries(false);
    }
  };

  const handleCountryChange = (e) => {
    const selected = countries.find(c => c.name === e.target.value);
    if (selected) {
      setForm(prev => ({
        ...prev,
        country: selected.name,
        currencyCode: selected.currencyCode,
        currencySymbol: selected.currencySymbol,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/20 rounded-full blur-[128px] animate-float" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-[128px] animate-float" style={{ animationDelay: '3s' }} />
      </div>

      <div className="w-full max-w-lg relative animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-glow-lg mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Create Your Account</h1>
          <p className="text-dark-400">Set up your company's reimbursement portal</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl px-4 py-3 text-rose-400 text-sm animate-scale-in">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="signup-name" className="input-label">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                  <input
                    id="signup-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="John Doe"
                    className="input-field pl-11"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-email" className="input-label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                  <input
                    id="signup-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="you@company.com"
                    className="input-field pl-11"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="signup-password" className="input-label">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                <input
                  id="signup-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input-field pl-11"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-company" className="input-label">Company Name</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                <input
                  id="signup-company"
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                  placeholder="Acme Inc."
                  className="input-field pl-11"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-country" className="input-label">Country</label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                <select
                  id="signup-country"
                  value={form.country}
                  onChange={handleCountryChange}
                  className="input-field pl-11 appearance-none cursor-pointer"
                  required
                >
                  <option value="">Select your country</option>
                  {countries.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.currencyCode} - {c.currencySymbol})
                    </option>
                  ))}
                </select>
              </div>
              {form.currencyCode && (
                <p className="text-xs text-primary-400 mt-2">
                  Company currency: {form.currencyCode} ({form.currencySymbol})
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-dark-400 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
