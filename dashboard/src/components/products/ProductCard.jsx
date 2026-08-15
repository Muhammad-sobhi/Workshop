import React from 'react';
import { Pencil, Trash2, Eye, Armchair, Tag, PlusCircle, ArrowUpRight, TrendingUp, AlertCircle } from 'lucide-react';
import { formatDecimal } from '@/lib/utils';
import { getImageUrl } from '@/lib/config';
import { useAppStore } from '@/lib/store';
import { Link } from 'react-router-dom';

export default function ProductCard({ prod, settings, onEdit, onDelete, onViewBOM }) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';
  const currency = settings?.currency || 'EGP';

  const stockCount = parseFloat(prod.stock ?? prod.stock_quantity ?? 0);
  const isLowStock = stockCount <= 2;
  const isOutOfStock = stockCount <= 0;

  const salePrice = parseFloat(prod.sale_price) || 0;
  const bomCost = parseFloat(prod.unit_cost) || 0;
  const profitMargin = salePrice - bomCost;
  const profitPct = salePrice > 0 ? ((profitMargin / salePrice) * 100).toFixed(1) : 0;
  const isProfitable = profitMargin >= 0;

  return (
    <div
      className="group rounded-2xl border flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl overflow-hidden relative"
      style={{
        background: isLight ? '#FFFFFF' : 'linear-gradient(145deg, #2D2447 0%, #201A30 100%)',
        borderColor: isLight ? '#E2E8F0' : '#3D3554'
      }}
    >
      
      {/* Top Media Thumbnail Header */}
      <div className="h-44 relative overflow-hidden flex items-center justify-center shrink-0" style={{ background: isLight ? '#F8FAFF' : '#1D172E' }}>
        {prod.image_path ? (
          <img
            src={getImageUrl(prod.image_path)}
            alt={prod.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 p-4 text-center" style={{ color: isLight ? '#94A3B8' : '#7C739D' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 shadow-inner">
              <Armchair className="w-6 h-6 text-[#ECC796]" />
            </div>
            <span className="text-[11px] font-semibold text-gray-400">موديل بدون صورة</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className={`absolute inset-0 pointer-events-none ${isLight ? 'bg-gradient-to-t from-white/60 via-transparent to-transparent' : 'bg-gradient-to-t from-[#201A30] via-transparent to-black/30'}`} />

        {/* Floating Category Badge */}
        <div
          className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold backdrop-blur-md border shadow-sm"
          style={{
            background: isLight ? '#EFF2FE' : 'rgba(35, 27, 61, 0.85)',
            color: isLight ? '#4338CA' : '#ECC796',
            borderColor: isLight ? '#CBD5E1' : 'rgba(236,199,150,0.3)'
          }}
        >
          <Tag className="w-2.5 h-2.5 text-[#ECC796]" />
          <span>{prod.category || prod.category_name || 'عام'}</span>
        </div>

        {/* Floating Stock Tag */}
        <div className={`absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-md border shadow-sm flex items-center gap-1.5 ${
          isOutOfStock
            ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
            : isLowStock 
              ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span>{stockCount} {prod.unit || 'قطعة'} بالمعرض</span>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3
              className="text-xs font-bold transition-colors leading-tight text-white line-clamp-1"
              title={prod.name}
            >
              {prod.name}
            </h3>
            {prod.sku && (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#2F264C] text-[#A49EC0] border border-[#3D3554] shrink-0">
                {prod.sku}
              </span>
            )}
          </div>

          {/* Pricing & Profit Matrix */}
          <div
            className="p-2.5 rounded-xl border space-y-2 mt-2"
            style={{
              background: isLight ? '#F8FAFF' : '#2F264C',
              borderColor: isLight ? '#E2E8F0' : '#3D3554'
            }}
          >
            <div className="flex items-center justify-between text-xs">
              <div className="text-right">
                <span className="text-[10px] text-[#A49EC0] block">سعر البيع:</span>
                <p className="text-xs font-black font-mono text-emerald-400 mt-0.5">
                  {currency} {formatDecimal(prod.sale_price)}
                </p>
              </div>
              <div className="text-right border-r border-[#3D3554] pr-3">
                <span className="text-[10px] text-[#A49EC0] block">
                  {prod.has_next_cost ? 'التكلفة الحالية:' : 'التكلفة (BOM):'}
                </span>
                <p className="text-xs font-black font-mono text-[#ECC796] mt-0.5">
                  {currency} {formatDecimal(prod.unit_cost)}
                </p>
              </div>
            </div>

            {/* Next Cost Alert Badge (If Material Cost Updated & Old Stock Still Active) */}
            {prod.has_next_cost && (
              <div 
                className="px-2 py-1 rounded-lg border flex items-center justify-between text-[10px] font-bold transition-all"
                style={{
                  background: 'rgba(236, 199, 150, 0.08)',
                  borderColor: 'rgba(236, 199, 150, 0.3)',
                  color: '#ECC796'
                }}
                title="تم تحديث تكلفة بعض الخامات، وستصبح هذه تكلفة التصنيع الأساسية بمجرد نفاد الدفعات القديمة المتاحة"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ECC796] animate-pulse" />
                  <span>التكلفة القادمة:</span>
                </div>
                <span className="font-mono font-black text-amber-200">
                  {currency} {formatDecimal(prod.next_cost)}
                  <span className="text-[9px] text-[#ECC796] mr-1">
                    ({prod.next_cost_diff > 0 ? `+${formatDecimal(prod.next_cost_diff)}` : formatDecimal(prod.next_cost_diff)})
                  </span>
                </span>
              </div>
            )}

            {/* Profit Margin Pill */}
            <div className={`flex items-center justify-between pt-1.5 border-t border-[#3D3554]/60 text-[10px] font-bold ${
              isProfitable ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              <span className="text-[#A49EC0]">هامش الربح للقطعة:</span>
              <span className="flex items-center gap-1 font-mono">
                {isProfitable ? `+${profitPct}% (+${formatDecimal(profitMargin)} ${currency})` : `${profitPct}% (${formatDecimal(profitMargin)} ${currency})`}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: View BOM, Edit, Produce, Delete */}
        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-[#3D3554]">
          <button
            onClick={() => onViewBOM(prod)}
            className="flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all bg-[#231B3D] border border-[#3D3554] text-white hover:border-[#ECC796]/50"
            title="استعراض جدول المكونات والخامات"
          >
            <Eye className="w-3.5 h-3.5 text-[#ECC796]" />
            <span>المكونات BOM</span>
          </button>

          <Link
            to={`/production`}
            className="p-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all shrink-0"
            title="إنشاء أمر إنتاج سريع لهذا المنتج"
          >
            <PlusCircle className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={() => onEdit(prod)}
            className="p-1.5 rounded-xl text-[10px] font-bold flex items-center justify-center bg-[#ECC796] text-[#201A30] hover:bg-[#D4A660] transition-all shrink-0 shadow-sm"
            title="تعديل المنتج"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDelete(prod.id)}
            className="p-1.5 rounded-xl transition-all text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 shrink-0"
            aria-label="حذف"
            title="حذف المنتج"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
