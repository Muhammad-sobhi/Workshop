'use client';

import React from 'react';
import { Save, Loader2 } from 'lucide-react';

export default function GeneralSettings({
  companyName, setCompanyName,
  currency, setCurrency,
  taxRate, setTaxRate,
  logoFile, setLogoFile,
  logoPreview, setLogoPreview,
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

        <div>
          <label className="block text-xs font-semibold mb-2" style={{ color: '#D4CEEB' }}>شعار المنشأة / اللوجو</label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <img src={logoPreview} alt="شعار المؤسسة" className="w-12 h-12 rounded-xl object-contain border p-1" style={{ background: '#2F264C', borderColor: '#3D3554' }} />
            ) : (
              <div className="w-12 h-12 rounded-xl border flex items-center justify-center text-xs font-bold" style={{ background: '#2F264C', borderColor: '#3D3554', color: '#ECC796' }}>
                لا يوجد
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setLogoFile(file);
                  setLogoPreview(URL.createObjectURL(file));
                }
              }}
              className="text-xs text-[#A49EC0] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#3D3554] file:text-[#ECC796] hover:file:opacity-80 cursor-pointer"
            />
          </div>
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
