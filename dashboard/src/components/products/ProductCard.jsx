import { Pencil, Trash2, Eye, Image as ImageIcon, Layers, Tag } from 'lucide-react';
import { formatDecimal } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/config';
import { useAppStore } from '@/lib/store';

const API_URL = getApiBaseUrl();

export default function ProductCard({ prod, settings, onEdit, onDelete, onViewBOM }) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';

  const stockCount = prod.stock || 0;
  const isLowStock = stockCount <= 5;

  return (
    <div
      className="group rounded-xl border flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg overflow-hidden relative"
      style={{
        background: isLight ? '#FFFFFF' : 'linear-gradient(145deg, #2F264C 0%, #231B3D 100%)',
        borderColor: isLight ? '#EBF0FF' : 'rgba(61, 53, 84, 0.5)'
      }}
    >
      
      {/* Top Media Header */}
      <div className="h-44 relative overflow-hidden flex items-center justify-center shrink-0" style={{ background: isLight ? '#F8FAFF' : '#1A142A' }}>
        {prod.image_path ? (
          <img
            src={`${API_URL}${prod.image_path}`}
            alt={prod.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-1" style={{ color: isLight ? '#8288A4' : '#6C638E' }}>
            <ImageIcon className="w-8 h-8 stroke-[1.5]" />
            <span className="text-[10px] font-medium">لا توجد صورة للمنتج</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className={`absolute inset-0 pointer-events-none ${isLight ? 'bg-gradient-to-t from-white/60 via-transparent to-transparent' : 'bg-gradient-to-t from-[#231B3D] via-transparent to-black/30'}`} />

        {/* Floating Category Badge */}
        <div
          className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md border shadow-sm"
          style={{
            background: isLight ? '#EFF2FE' : 'rgba(35, 27, 61, 0.85)',
            color: isLight ? '#4338CA' : '#ECC796',
            borderColor: isLight ? '#EBF0FF' : 'rgba(255,255,255,0.1)'
          }}
        >
          <Tag className="w-2.5 h-2.5" style={{ color: isLight ? '#4338CA' : '#ECC796' }} />
          <span>{prod.category || 'عام'}</span>
        </div>

        {/* Floating Stock Tag */}
        <div className={`absolute bottom-2 left-2 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md border shadow-sm flex items-center gap-1 ${
          isLowStock 
            ? (isLight ? 'bg-red-50 border-red-200 text-red-600' : 'bg-red-500/20 border-red-500/30 text-red-300')
            : (isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300')
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isLowStock ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
          <span>{stockCount} {prod.unit}</span>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <h3
            className="text-xs font-bold transition-colors leading-tight truncate"
            style={{ color: isLight ? '#1E293B' : '#FFFFFF' }}
          >
            {prod.name}
          </h3>

          {/* Pricing Grid */}
          <div
            className="grid grid-cols-2 gap-1.5 mt-2.5 p-2 rounded-xl border"
            style={{
              background: isLight ? '#F5F7FF' : 'rgba(32, 26, 48, 0.6)',
              borderColor: isLight ? '#EBF0FF' : 'rgba(61, 53, 84, 0.4)'
            }}
          >
            <div className="text-right">
              <span className="text-[9px] font-medium block" style={{ color: isLight ? '#8288A4' : '#A49EC0' }}>سعر البيع</span>
              <p className="text-xs font-black mt-0.5" style={{ color: isLight ? '#059669' : '#34D399' }}>
                {settings?.currency || 'ر.س'} {formatDecimal(prod.sale_price)}
              </p>
            </div>
            <div className="text-right border-r pr-2" style={{ borderColor: isLight ? '#EBF0FF' : 'rgba(61, 53, 84, 0.4)' }}>
              <span className="text-[9px] font-medium block" style={{ color: isLight ? '#8288A4' : '#A49EC0' }}>التكلفة (BOM)</span>
              <p className="text-xs font-black mt-0.5" style={{ color: isLight ? '#4338CA' : '#ECC796' }}>
                {settings?.currency || 'ر.س'} {formatDecimal(prod.unit_cost)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t" style={{ borderColor: isLight ? '#EBF0FF' : 'rgba(61, 53, 84, 0.4)' }}>
          <button
            onClick={() => onViewBOM(prod)}
            className="flex-1 py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all duration-200 border"
            style={{
              background: isLight ? '#F5F7FF' : '#231B3D',
              borderColor: isLight ? '#EBF0FF' : '#3D3554',
              color: isLight ? '#4338CA' : '#FFFFFF'
            }}
          >
            <Eye className="w-3.5 h-3.5" style={{ color: isLight ? '#4338CA' : '#ECC796' }} />
            <span>المكونات</span>
          </button>

          <button
            onClick={() => onEdit(prod)}
            className="p-2 rounded-xl text-[10px] font-bold flex items-center justify-center transition-all duration-200 hover:opacity-90 active:scale-95 shadow-sm"
            style={{
              background: isLight ? '#4F46E5' : 'linear-gradient(135deg, #ECC796, #D4A660)',
              color: isLight ? '#FFFFFF' : '#201A30'
            }}
            title="تعديل"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDelete(prod.id)}
            className="p-2 rounded-xl transition-all duration-200 text-red-500 hover:bg-red-50 border border-red-200 active:scale-95"
            aria-label="حذف"
            title="حذف"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
