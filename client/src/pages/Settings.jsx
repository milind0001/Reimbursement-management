import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Settings as SettingsIcon, Building2, Globe, DollarSign, Save } from 'lucide-react';

export default function Settings() {
  const { company } = useAuth();
  const [saved, setSaved] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-primary-400" />
          Company Settings
        </h1>
        <p className="text-dark-400 mt-1">Manage your company configuration</p>
      </div>

      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-4 pb-5 border-b border-dark-700/50">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{company?.name}</h2>
            <p className="text-dark-400 text-sm">Company ID: {company?.id?.slice(0, 8)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Country
            </label>
            <input
              type="text"
              value={company?.country || ''}
              className="input-field"
              disabled
            />
          </div>

          <div>
            <label className="input-label flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Company Currency
            </label>
            <input
              type="text"
              value={`${company?.currencyCode} (${company?.currencySymbol})`}
              className="input-field"
              disabled
            />
          </div>
        </div>

        <div className="bg-dark-800/50 rounded-xl p-4">
          <p className="text-sm text-dark-300">
            💡 Company settings like country and currency are set during signup and apply across all expense reporting.
            All expense amounts are automatically converted to {company?.currencyCode} using live exchange rates.
          </p>
        </div>
      </div>
    </div>
  );
}
