'use client';

import { X, Image as ImageIcon } from 'lucide-react';
import { formatDecimal } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/config';

const API_URL = getApiBaseUrl();

export default function BOMViewerModal({ viewingBOM, materials, settings, onClose }) {
  if (!viewingBOM) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="تفاصيل المنتج">
      <div className="w-full max-w-xl rounded-2xl border p-6" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: '#3D3554' }}>
          <div>
            <h2 className="text-sm font-bold text-white">تفاصيل ومكونات المنتج (BOM)</h2>
            <p className="text-xs text-amber-400 mt-1 font-semibold">{viewingBOM.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }} aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="h-44 bg-[#231B3D] border border-[#3D3554] rounded-xl overflow-hidden flex items-center justify-center">
            {viewingBOM.image_path ? (
              <img
                src={`${API_URL}${viewingBOM.image_path}`}
                alt={viewingBOM.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <ImageIcon className="w-10 h-10" />
                <span className="text-[10px]">لا توجد صورة للمنتج</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="border-b" style={{ borderColor: '#3D3554' }}>
                  <th className="py-2 text-gray-400 font-semibold">المادة الخام</th>
                  <th className="py-2 text-gray-400 font-semibold text-center">الكمية المطلوبة</th>
                  <th className="py-2 text-gray-400 font-semibold text-left">التكلفة التقريبية</th>
                </tr>
              </thead>
              <tbody>
                {viewingBOM.materials && viewingBOM.materials.length > 0 ? (
                  viewingBOM.materials.map((m, idx) => {
                    const originalMaterial = materials.find(orig => orig.id === m.id);
                    const cost = originalMaterial ? originalMaterial.unit_cost * m.quantity : 0;
                    return (
                      <tr key={idx} className="border-b" style={{ borderColor: '#3D3554' }}>
                        <td className="py-3 font-semibold text-white">{m.name}</td>
                        <td className="py-3 text-center text-gray-200 font-mono">
                          {m.quantity} {m.unit}
                        </td>
                        <td className="py-3 text-left font-semibold text-amber-300 font-mono">
                          {settings.currency} {formatDecimal(cost)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-gray-400">
                      لا توجد مواد مضافة لجدول تصنيع هذا المنتج بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {viewingBOM.materials && viewingBOM.materials.length > 0 && (
            <div className="p-3.5 rounded-xl flex items-center justify-between text-xs font-bold" style={{ background: '#231B3D' }}>
              <span style={{ color: '#A49EC0' }}>إجمالي التكلفة النظرية للمواد الخام:</span>
              <span className="text-sm text-green-400 font-mono">
                {settings.currency} {
                  formatDecimal(viewingBOM.materials.reduce((acc, m) => {
                    const originalMaterial = materials.find(orig => orig.id === m.id);
                    return acc + (originalMaterial ? originalMaterial.unit_cost * m.quantity : 0);
                  }, 0))
                }
              </span>
            </div>
          )}
        </div>

        <div className="mt-5 pt-3 border-t flex justify-end" style={{ borderColor: '#3D3554' }}>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-bold text-white hover:opacity-90"
            style={{ background: '#8D7EC8' }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
