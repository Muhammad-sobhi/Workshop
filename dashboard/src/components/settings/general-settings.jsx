import React, { useState } from 'react';
import { Save, Loader2, AlertTriangle, X, CheckCircle2 } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function GeneralSettings({
  companyName, setCompanyName,
  currency, setCurrency,
  taxRate, setTaxRate,
  logoFile, setLogoFile,
  logoPreview, setLogoPreview,
  settingsLoading, handleSaveSettings
}) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const executeReset = async () => {
    setResetLoading(true);
    try {
      const response = await apiClient.post('/settings/reset-data');
      setShowConfirmModal(false);
      setStatusMessage({ type: 'success', text: response.data?.message || 'تم تصفير البيانات المالية والحسابات بنجاح!' });
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setShowConfirmModal(false);
      const msg = err.response?.data?.message || 'فشلت العملية، يرجى التأكد من تسجيل الدخول والمحاولة لاحقاً';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-6 max-w-2xl relative"
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

      {/* Status banner */}
      {statusMessage && (
        <div className={`mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center justify-between animate-in fade-in ${statusMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Danger Zone: Data Reset */}
      <div className="mt-8 pt-6 border-t border-red-500/20 space-y-3">
        <h4 className="text-xs font-bold text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span>منطقة التحكم وتصفير البيانات</span>
        </h4>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          تتيح لك هذه الميزة حذف وتصفير جميع الحركات المالية والعمليات التنفيذية (الموردون، العملاء، المشتريات، المبيعات، المصروفات، وطلبات الإنتاج)، مع **الحفاظ الكامل** على بيانات التسجيل، المستخدمين، المواد الخام، الأثاث والمنتجات الجاهزة، الفئات والمخازن.
        </p>
        <button
          type="button"
          onClick={() => setShowConfirmModal(true)}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-all flex items-center gap-2"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>حذف وتصفير البيانات المالية والتنفيذية (تصفير الديون والحسابات)</span>
        </button>
      </div>

      {/* Styled React Confirmation Modal Popup */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl"
            style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#3D3554]">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span>تأكيد تصفير البيانات المالية والتنفيذية</span>
              </div>
              <button onClick={() => setShowConfirmModal(false)} className="p-1 rounded-lg text-gray-400 hover:bg-white/5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-right leading-relaxed text-gray-200">
              <p className="font-bold text-red-300">⚠️ هل أنت متأكد بالكامل من استمرار عملية التصفير؟</p>
              <p className="text-gray-300">
                سيتم حذف كافة سجلات الموردين، العملاء، المشتريات، المبيعات، المصروفات، وطلبات الإنتاج بشكل نهائي.
              </p>
              <div className="p-2.5 rounded-xl bg-black/20 border border-white/10 text-[11px] text-[#ECC796]">
                ✔️ سيتم الاحتفاظ بحسابات التسجيل والمستخدمين، الخامات، الأثاث والمنتجات، الفئات، والمخازن.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3D3554]">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={resetLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-all"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeReset}
                disabled={resetLoading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {resetLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري التصفير...</span>
                  </>
                ) : (
                  <span>نعم، نفذ التصفير الآن</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
