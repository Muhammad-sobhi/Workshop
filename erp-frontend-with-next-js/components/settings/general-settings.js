'use client';

import React from 'react';
import { Save, Loader2 } from 'lucide-react';

export default function GeneralSettings({
  companyName, setCompanyName,
  currency, setCurrency,
  taxRate, setTaxRate,
  settingsLoading, handleSaveSettings
}) {
  return (
    <div
      className="rounded-2xl border p-6 max-w-2xl"
      style={{ background: '#231B3D', borderColor: '#3D3554' }}
    >
      <h3 className="text-sm font-bold text-white mb-6">البيانات العامة للمنشأة والعمليات</h3>
      <form onSubmit={handleSaveSettings} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>اسم الورشة / المؤسسة</label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all"
            style={{
              background: '#2F264C',
              borderColor: '#3D3554',
              color: '#FFFFFF',
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>رمز العملة (مثال: ر.س، $, EGP)</label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all"
              style={{
                background: '#2F264C',
                borderColor: '#3D3554',
                color: '#FFFFFF',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>نسبة ضريبة القيمة المضافة %</label>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              min="0"
              max="100"
              required
              className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all"
              style={{
                background: '#2F264C',
                borderColor: '#3D3554',
                color: '#FFFFFF',
              }}
            />
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            disabled={settingsLoading}
            className="rounded-xl py-2 px-6 text-xs font-bold shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
          >
            {settingsLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>حفظ الإعدادات</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
