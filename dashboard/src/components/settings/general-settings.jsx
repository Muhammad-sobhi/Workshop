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

      {/* Danger Zone: Data Reset */}
      <div className="mt-8 pt-6 border-t border-red-500/20 space-y-3">
        <h4 className="text-xs font-bold text-red-400 flex items-center gap-2">
          <span>⚠️ منطقة التحكم وتصفير البيانات</span>
        </h4>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          تتيح لك هذه الميزة حذف وتصفير جميع الحركات المالية والعمليات التنفيذية (الموردون، العملاء، المشتريات، المبيعات، المصروفات، وطلبات الإنتاج)، مع **الحفاظ الكامل** على بيانات التسجيل، المستخدمين، المواد الخام، الأثاث والمنتجات الجاهزة، الفئات والمخازن.
        </p>
        <button
          type="button"
          onClick={async () => {
            if (!confirm('⚠️ هل أنت أصلح للتأكيد؟ سيتم حذف جميع الموردين والعملاء والمشتريات والمبيعات والمصروفات وحركات الإنتاج، مع الحفاظ على المواد والمنتجات الجاهزة والمستخدمين والمخازن.')) return;
            try {
              const token = localStorage.getItem('token');
              const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/settings/reset-data`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json',
                }
              });
              const data = await res.json();
              if (res.ok) {
                alert(data.message || 'تم تصفير البيانات بنجاح!');
                window.location.reload();
              } else {
                alert(data.message || 'حدث خطأ أثناء تصفير البيانات');
              }
            } catch (err) {
              alert('فشلت العملية، يرجى المحاولة لاحقاً');
            }
          }}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all flex items-center gap-2"
        >
          <span>حذف وتصفير البيانات المالية والتنفيذية (تصفير الديون والحسابات)</span>
        </button>
      </div>
    </div>
  );
}
