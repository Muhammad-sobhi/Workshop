'use client';

import { Pencil, Trash2, Eye, Image as ImageIcon } from 'lucide-react';
import { formatDecimal } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/config';

const CARD = { background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' };
const API_URL = getApiBaseUrl();

export default function ProductCard({ prod, settings, onEdit, onDelete, onViewBOM }) {
  return (
    <div
      className="rounded-2xl border flex flex-col justify-between transition-all hover:translate-y-[-2px] hover:shadow-xl overflow-hidden"
      style={CARD}
    >
      <div className="h-40 bg-[#2F264C]/50 relative flex items-center justify-center border-b border-[#3D3554]/10 shrink-0">
        {prod.image_path ? (
          <img
            src={`${API_URL}${prod.image_path}`}
            alt={prod.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <ImageIcon className="w-10 h-10" />
            <span className="text-[10px]">لا توجد صورة للمنتج</span>
          </div>
        )}
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold text-white bg-black/60 backdrop-blur-sm">
          {prod.unit}
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold" style={{ background: '#3D3554', color: '#ECC796' }}>
                {prod.category || 'عام'}
              </span>
              <h3 className="text-sm font-bold mt-1.5 leading-snug text-[#231B3D]">{prod.name}</h3>
              <p className="text-[10px] font-mono mt-0.5 text-gray-600">
                {prod.code} | {prod.sku}
              </p>
            </div>
          </div>

          <p className="text-xs mt-2.5 line-clamp-2 text-gray-700">
            {prod.description || 'لا يوجد وصف متاح للمنتج.'}
          </p>

          <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3.5 border-t border-[#3d3554]/10 font-bold">
            <div>
              <span className="text-[9px] text-gray-600">سعر البيع المقترح</span>
              <p className="text-xs text-emerald-800">{settings.currency} {formatDecimal(prod.sale_price)}</p>
            </div>
            <div>
              <span className="text-[9px] text-gray-600">تكلفة الإنتاج (BOM)</span>
              <p className="text-xs text-red-800">{settings.currency} {formatDecimal(prod.unit_cost)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 text-xs p-2 rounded-xl bg-black/5">
            <span className="font-semibold text-gray-800">
              المخزون: <b className={prod.stock > 0 ? "text-emerald-800" : "text-amber-800"}>{prod.stock} {prod.unit}</b>
            </span>
            <span className="font-semibold text-gray-800">
              المكونات: <b>{prod.materials?.length || 0} مواد</b>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-4 pt-3.5 border-t border-[#3d3554]/10">
          <button
            onClick={() => onViewBOM(prod)}
            className="w-full py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all text-white"
            style={{ background: '#3D3554' }}
          >
            <Eye className="w-3.5 h-3.5 text-[#ECC796]" />
            <span>مكونات وصورة المنتج</span>
          </button>

          <div className="flex gap-2 w-full">
            <button
              onClick={() => onEdit(prod)}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all bg-amber-500 hover:bg-amber-600 text-[#231B3D]"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>تعديل الخصائص</span>
            </button>
            <button
              onClick={() => onDelete(prod.id)}
              className="p-1.5 rounded-lg transition-all text-red-700 hover:bg-red-500/10 border border-red-700/20"
              aria-label="حذف"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
