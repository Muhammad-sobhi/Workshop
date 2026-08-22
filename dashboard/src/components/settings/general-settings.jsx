import React, { useState } from 'react';
import { Save, Loader2, AlertTriangle, X, CheckCircle2, Building2, Phone, MapPin, FileText, DollarSign, Image } from 'lucide-react';
import apiClient from '@/lib/api-client';

export default function GeneralSettings({
  companyName, setCompanyName,
  phone, setPhone,
  address, setAddress,
  taxNumber, setTaxNumber,
  commercialRegister, setCommercialRegister,
  invoiceFooter, setInvoiceFooter,
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
      className="rounded-2xl border p-6 max-w-3xl relative shadow-xl"
      style={{ background: '#231B3D', borderColor: '#3D3554' }}
    >
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#3D3554]">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#ECC796]" />
            <span>بيانات وهوية الورشة والفواتير الرسمية</span>
          </h3>
          <p className="text-xs text-[#A49EC0] mt-1">
            هذه البيانات تظهر تلقائياً في ترويسة وتذييل جميع الفواتير، أذون الشراء (PO)، وكشوف الحسابات (PDF)
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-5">
        
        {/* Row 1: Company Name & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-2 text-[#D4CEEB] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#ECC796]" />
              <span>اسم الورشة / المؤسسة الرسمي *</span>
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="مثال: ورشة الفنون للأثاث المعدني"
              required
              className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2 text-[#D4CEEB] flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#ECC796]" />
              <span>رقم الهاتف / واتساب الورشة</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="مثال: 01012345678 / 01234567890"
              className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
            />
          </div>
        </div>

        {/* Row 2: Address & Tax ID / Commercial Reg */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-2 text-[#D4CEEB] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#ECC796]" />
              <span>العنوان ومقر الورشة / المعرض</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="مثال: المنطقة الصناعية - دمياط الجديدة"
              className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2 text-[#D4CEEB] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#ECC796]" />
              <span>السجل التجاري / الرقم الضريبي (اختياري)</span>
            </label>
            <input
              type="text"
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              placeholder="مثال: س.ت: 12345 • ض.م: 98765"
              className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
            />
          </div>
        </div>

        {/* Row 3: Logo Upload */}
        <div>
          <label className="block text-xs font-semibold mb-2 text-[#D4CEEB] flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5 text-[#ECC796]" />
            <span>شعار الورشة (اللوجو للطباعة في أعلى الفواتير)</span>
          </label>
          <div className="flex items-center gap-4 p-3 rounded-xl border bg-[#2F264C] border-[#3D3554]">
            {logoPreview ? (
              <img src={logoPreview} alt="شعار المؤسسة" className="w-14 h-14 rounded-xl object-contain border p-1 bg-[#231B3D] border-[#3D3554]" />
            ) : (
              <div className="w-14 h-14 rounded-xl border flex items-center justify-center text-xs font-bold bg-[#231B3D] border-[#3D3554] text-[#ECC796]">
                لا يوجد
              </div>
            )}
            <div className="flex-1">
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
              <p className="text-[10px] text-gray-400 mt-1">يُفضل استخدام صورة PNG بخلفية شفافة</p>
            </div>
          </div>
        </div>

        {/* Row 4: Currency & Tax Rate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-2 text-[#D4CEEB] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#ECC796]" />
              <span>رمز العملة الافتراضية (مثال: جنيه، EGP، ر.س) *</span>
            </label>
            <input
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2 text-[#D4CEEB]">نسبة ضريبة القيمة المضافة %</label>
            <input
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value))}
              min="0"
              max="100"
              required
              className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
            />
          </div>
        </div>

        {/* Row 5: Invoice Footer / Terms */}
        <div>
          <label className="block text-xs font-semibold mb-2 text-[#D4CEEB] flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#ECC796]" />
            <span>نص التذييل والشروط المطبوعة أسفل الفواتير</span>
          </label>
          <textarea
            value={invoiceFooter}
            onChange={(e) => setInvoiceFooter(e.target.value)}
            rows={2}
            placeholder="مثال: شكراً لتعاملكم معنا • جميع المنتجات مشمولة بضمان الجودة ضد عيوب الصناعة"
            className="w-full rounded-xl py-2.5 px-4 text-xs border outline-none transition-all bg-[#2F264C] border-[#3D3554] text-white focus:border-[#ECC796]"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-3">
          <button
            type="submit"
            disabled={settingsLoading}
            className="rounded-xl py-2.5 px-8 text-xs font-bold shadow-lg transition-all duration-200 active:scale-[0.98] flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
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
                <span>حفظ وتحديث هوية الفواتير</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Status message */}
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
          تتيح لك هذه الميزة حذف وتصفير جميع الحركات المالية والعمليات التنفيذية وسجلات الموظفين بالكامل (الموردون، العملاء، المشتريات، المبيعات، المصروفات، طلبات الإنتاج، والرواتب واليوميات)، مع **الحفاظ الكامل** على بيانات التسجيل، المستخدمين، المواد الخام، الأثاث والمنتجات الجاهزة، الفئات والمخازن.
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

      {/* Confirm Reset Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border p-5 shadow-2xl relative" style={{ background: '#201A30', borderColor: '#EF4444' }}>
            <div className="flex items-center gap-3 text-red-400 mb-3">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">تأكيد تصفير البيانات المالية والتشغيلية</h3>
            </div>
            
            <p className="text-xs text-gray-300 leading-relaxed mb-4">
              هل أنت متأكد تماماً من رغبتك في تصفير جميع العمليات والحركات النقدية؟
              <br />
              <strong className="text-red-400 mt-2 block font-semibold">تنبيه: هذا الإجراء سيقوم بحذف كافة الفواتير والطلبيات والديون وسجلات الموظفين فوراً.</strong>
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#3D3554]">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={resetLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:bg-white/5 border border-[#3D3554]"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={executeReset}
                disabled={resetLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all flex items-center gap-2"
              >
                {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>نعم، تصفير البيانات الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
