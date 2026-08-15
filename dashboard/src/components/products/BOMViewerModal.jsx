import { X, Image as ImageIcon } from 'lucide-react';
import { formatDecimal } from '@/lib/utils';
import { getImageUrl } from '@/lib/config';
import { useAppStore } from '@/lib/store';

export default function BOMViewerModal({ viewingBOM, materials = [], settings = {}, onClose }) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';
  const currency = settings?.currency || 'EGP';

  if (!viewingBOM) return null;

  const matList = materials || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="تفاصيل المنتج">
      <div
        className="w-full max-w-md rounded-2xl border p-4 shadow-2xl transition-all max-h-[90vh] overflow-y-auto"
        style={{
          background: isLight ? '#FFFFFF' : '#2F264C',
          borderColor: isLight ? '#EBF0FF' : '#3D3554'
        }}
      >
        <div className="flex items-center justify-between pb-3 border-b mb-3" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
          <div>
            <h2 className="text-xs font-bold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>تفاصيل ومكونات المنتج (BOM)</h2>
            <p className="text-[11px] mt-0.5 font-bold" style={{ color: isLight ? '#4338CA' : '#ECC796' }}>{viewingBOM.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-black/5" style={{ color: isLight ? '#8288A4' : '#A49EC0' }} aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div
            className="h-32 border rounded-xl overflow-hidden flex items-center justify-center"
            style={{
              background: isLight ? '#F8FAFF' : '#231B3D',
              borderColor: isLight ? '#EBF0FF' : '#3D3554'
            }}
          >
            {viewingBOM.image_path ? (
              <img
                src={getImageUrl(viewingBOM.image_path)}
                alt={viewingBOM.name}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <div className="flex flex-col items-center gap-1" style={{ color: isLight ? '#8288A4' : '#6B7280' }}>
                <ImageIcon className="w-8 h-8" />
                <span className="text-[10px]">لا توجد صورة للمنتج</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="border-b" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
                  <th className="py-1.5 font-bold" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>المادة الخام</th>
                  <th className="py-1.5 font-bold text-center" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>الكمية المطلوبة</th>
                  <th className="py-1.5 font-bold text-left" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>التكلفة التقريبية</th>
                </tr>
              </thead>
              <tbody>
                {viewingBOM.materials && viewingBOM.materials.length > 0 ? (
                  viewingBOM.materials.map((m, idx) => {
                    const originalMaterial = matList.find(orig => orig.id === m.id || orig.id === parseInt(m.id));
                    const cost = originalMaterial ? (parseFloat(originalMaterial.unit_cost) || 0) * (parseFloat(m.quantity) || 0) : (parseFloat(m.unit_cost || 0) * parseFloat(m.quantity || 0));
                    return (
                      <tr key={idx} className="border-b" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
                        <td className="py-2 font-semibold" style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}>{m.name}</td>
                        <td className="py-2 text-center font-mono text-[11px]" style={{ color: isLight ? '#1E293B' : '#E5E7EB' }}>
                          {m.quantity} {m.unit || originalMaterial?.unit || 'وحدة'}
                        </td>
                        <td className="py-2 text-left font-mono font-bold text-[11px]" style={{ color: isLight ? '#4338CA' : '#ECC796' }}>
                          {currency} {formatDecimal(cost)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-4 text-[11px]" style={{ color: isLight ? '#8288A4' : '#9CA3AF' }}>
                      لا توجد مواد مضافة لجدول تصنيع هذا المنتج بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {viewingBOM.materials && viewingBOM.materials.length > 0 && (
            <div className="space-y-2 mt-2">
              <div
                className="p-2.5 rounded-xl flex items-center justify-between text-xs font-bold border"
                style={{
                  background: isLight ? '#F8FAFF' : '#231B3D',
                  borderColor: isLight ? '#EBF0FF' : '#3D3554'
                }}
              >
                <span style={{ color: isLight ? '#8288A4' : '#A49EC0' }}>
                  {viewingBOM.has_next_cost ? 'التكلفة الحالية للرصيد المتاح (FIFO):' : 'إجمالي تكلفة المواد الخام (BOM):'}
                </span>
                <span className="text-xs font-mono font-black" style={{ color: isLight ? '#059669' : '#34D399' }}>
                  {currency} {formatDecimal(viewingBOM.unit_cost)}
                </span>
              </div>

              {viewingBOM.has_next_cost && (
                <div
                  className="p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold"
                  style={{
                    background: 'rgba(236, 199, 150, 0.08)',
                    borderColor: 'rgba(236, 199, 150, 0.3)',
                    color: '#ECC796'
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ECC796] animate-pulse" />
                    <span>التكلفة القادمة بعد نفاد الدفعة الحالية:</span>
                  </span>
                  <span className="text-xs font-mono font-black text-amber-200">
                    {currency} {formatDecimal(viewingBOM.next_cost || viewingBOM.theoretical_cost)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 pt-2.5 border-t flex justify-end" style={{ borderColor: isLight ? '#EBF0FF' : '#3D3554' }}>
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all hover:opacity-90 text-[#201A30] bg-[#ECC796] hover:bg-[#D4A660]"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
