import { Pencil, Trash2, Eye, Image as ImageIcon, Layers, Tag } from 'lucide-react';
import { formatDecimal } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/config';

const API_URL = getApiBaseUrl();

export default function ProductCard({ prod, settings, onEdit, onDelete, onViewBOM }) {
  const stockCount = prod.stock || 0;
  const isLowStock = stockCount <= 5;

  return (
    <div className="group rounded-xl border border-[#3D3554]/50 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg overflow-hidden relative" style={{ background: 'linear-gradient(145deg, #2F264C 0%, #231B3D 100%)' }}>
      
      {/* Top Media Header - Larger Image Area */}
      <div className="h-44 bg-[#1A142A] relative overflow-hidden flex items-center justify-center shrink-0">
        {prod.image_path ? (
          <img
            src={`${API_URL}${prod.image_path}`}
            alt={prod.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-[#6C638E]">
            <ImageIcon className="w-8 h-8 stroke-[1.5]" />
            <span className="text-[10px] font-medium">لا توجد صورة للمنتج</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#231B3D] via-transparent to-black/30 pointer-events-none" />

        {/* Floating Category Badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold backdrop-blur-md border border-white/10 shadow-sm" style={{ background: 'rgba(35, 27, 61, 0.85)', color: '#ECC796' }}>
          <Tag className="w-2.5 h-2.5 text-[#ECC796]" />
          <span>{prod.category || 'عام'}</span>
        </div>

        {/* Floating Stock Tag */}
        <div className={`absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md border shadow-sm flex items-center gap-1 ${
          isLowStock 
            ? 'bg-red-500/20 border-red-500/30 text-red-300' 
            : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isLowStock ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span>{stockCount} {prod.unit}</span>
        </div>
      </div>

      {/* Card Content Body - Compacted */}
      <div className="p-2.5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-white group-hover:text-[#ECC796] transition-colors leading-tight truncate">
            {prod.name}
          </h3>

          {/* Pricing Grid */}
          <div className="grid grid-cols-2 gap-1.5 mt-2 p-1.5 rounded-lg border border-[#3D3554]/40" style={{ background: 'rgba(32, 26, 48, 0.6)' }}>
            <div className="text-right">
              <span className="text-[9px] font-medium block text-[#A49EC0]">سعر البيع</span>
              <p className="text-xs font-extrabold text-emerald-400 mt-0.5">
                {settings?.currency || 'ر.س'} {formatDecimal(prod.sale_price)}
              </p>
            </div>
            <div className="text-right border-r border-[#3D3554]/40 pr-1.5">
              <span className="text-[9px] font-medium block text-[#A49EC0]">التكلفة (BOM)</span>
              <p className="text-xs font-extrabold text-[#ECC796] mt-0.5">
                {settings?.currency || 'ر.س'} {formatDecimal(prod.unit_cost)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-[#3D3554]/40">
          <button
            onClick={() => onViewBOM(prod)}
            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all duration-200 border border-[#3D3554] hover:border-[#ECC796]/50 text-white hover:text-[#ECC796]"
            style={{ background: '#231B3D' }}
          >
            <Eye className="w-3 h-3 text-[#ECC796]" />
            <span>المكونات</span>
          </button>

          <button
            onClick={() => onEdit(prod)}
            className="p-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all duration-200 hover:opacity-90 active:scale-95 shadow"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            title="تعديل"
          >
            <Pencil className="w-3 h-3" />
          </button>

          <button
            onClick={() => onDelete(prod.id)}
            className="p-1.5 rounded-lg transition-all duration-200 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 active:scale-95"
            aria-label="حذف"
            title="حذف"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
