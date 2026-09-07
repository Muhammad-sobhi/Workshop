'use client';

import { useState } from 'react';
import apiClient from '@/lib/api-client';
import { AlertTriangle, CheckCircle2, X, Play, Hammer, Layers, Info, ChevronDown, ChevronUp } from 'lucide-react';
import BomTreePanel from './BomTreePanel';

export default function MaterialsCheckModal({ showCheck, setShowCheck, warehouses, fetchAll, setConfirmDialog }) {
  if (!showCheck) return null;

  // Filter out finished products warehouse (WH-FIN) — only show materials warehouses
  const materialWarehouses = warehouses.filter(wh => wh.code !== 'WH-FIN' && wh.code !== 'WSH' && !wh.name.includes('منتج'));

  const startOperation = async (id, autoProduce = false) => {
    const confirmMessage = autoProduce
      ? 'هل تريد تأكيد تصنيع المنتجات الفرعية الناقصة وصرف خاماتها، ثم بدء أمر الإنتاج الرئيسي؟ سيقوم النظام بتسجيل القيود المخزنية آلياً.'
      : 'هل تريد صرف المواد والبدء بالإنتاج؟';

    setConfirmDialog({
      type: 'confirm',
      message: confirmMessage,
      onConfirm: async () => {
        try {
          const res = await apiClient.post(`/operations/${id}/start`, {
            auto_produce_sub_products: autoProduce
          });
          setConfirmDialog({ type: 'alert', message: res.data.message });
          fetchAll();
          setShowCheck(null);
        } catch (err) {
          setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'فشل في بدء عملية الإنتاج' });
        }
      }
    });
  };

  const hasMaterialShortage = !!showCheck.has_material_shortage;
  const hasSubProductShortage = !!showCheck.has_sub_product_shortage;
  const canAutoProduce = !!showCheck.can_auto_produce_sub_products;
  const [showBomTree, setShowBomTree] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border p-6 max-h-[90vh] flex flex-col" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b shrink-0" style={{ borderColor: '#3D3554' }}>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              فحص توفر المواد والمنتجات الفرعية
            </h2>
            <p className="text-xs mt-1 text-gray-400">
              أمر تشغيل: <span className="font-mono text-white font-bold">{showCheck.operation_number}</span> — المنتج: <span className="text-white font-semibold">{showCheck.product_name}</span> (الكمية: {showCheck.quantity})
            </p>
          </div>
          <button onClick={() => setShowCheck(null)} className="p-2 rounded-xl hover:bg-white/10" style={{ color: '#A49EC0' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          
          {/* Warehouse Selector */}
          <div className="p-4 rounded-xl space-y-2 border" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
            <label className="block text-xs font-semibold text-gray-300">مستودع صرف المواد للعملية:</label>
            <div className="flex gap-2">
              <select
                value={showCheck.warehouse_id || ''}
                onChange={async (e) => {
                  const newWarehouseId = e.target.value;
                  if (!newWarehouseId) return;
                  try {
                    await apiClient.put(`/operations/${showCheck.operation_id}`, {
                      warehouse_id: parseInt(newWarehouseId)
                    });
                    const res = await apiClient.get(`/operations/${showCheck.operation_id}/check-materials`);
                    setShowCheck(res.data);
                    fetchAll();
                  } catch (err) {
                    setConfirmDialog({ type: 'alert', message: err?.response?.data?.message ?? 'حدث خطأ أثناء تعديل المستودع' });
                  }
                }}
                className="flex-1 rounded-lg px-3 py-2 text-xs border outline-none font-semibold text-white"
                style={{ background: '#2F264C', borderColor: '#3D3554' }}
              >
                <option value="">اختر المستودع...</option>
                {materialWarehouses.map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Alert Banner */}
          {hasMaterialShortage ? (
            <div className="p-4 rounded-xl flex items-start gap-3 bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-400 text-sm">عجز في المواد الخام المطلوبة</h4>
                <p className="text-xs text-gray-300 mt-1">
                  المخزون الحالي في المستودع لا يكفي لتغطية الإنتاج. يرجى مراجعة العجز وشراء المواد الناقصة أولاً.
                </p>
              </div>
            </div>
          ) : hasSubProductShortage && canAutoProduce ? (
            <div className="p-4 rounded-xl flex items-start gap-3 bg-amber-500/10 border border-amber-500/30">
              <Info className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <h4 className="font-bold text-amber-300 text-sm">نقص في المنتجات الفرعية بالمخزن (الخامات متوفرة للتصنيع)</h4>
                <p className="text-xs text-gray-300 mt-1">
                  المخزون الجاهز من المنتجات الفرعية لا يكفي بالكامل، ولكن جميع المواد الخام اللازمة لتصنيع النواقص متوفرة بنجاح! يمكنك البدء مع خيار «تصنيع النواقص تلقائياً».
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
              <div>
                <h4 className="font-bold text-emerald-400 text-sm">جميع المواد والمنتجات الفرعية متوفرة</h4>
                <p className="text-xs text-gray-300 mt-1">المستودع جاهز لبدء الإنتاج وصرف المواد فوراً دون أي عجز.</p>
              </div>
            </div>
          )}

          {/* Products Allocation Breakdown */}
          {Array.isArray(showCheck.products_allocation) && showCheck.products_allocation.length > 0 && (
            <div className="p-3.5 rounded-xl border space-y-2" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>توزيع الكميات المطلوبة وخطة السحب من المخزون:</span>
              </h4>
              <div className="space-y-1.5">
                {showCheck.products_allocation.map((pa, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[#2F264C]">
                    <span className="font-semibold text-white">{pa.product_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300">الإجمالي: <strong>{pa.total_quantity} {pa.unit}</strong></span>
                      {pa.quantity_from_stock > 0 && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          📦 {pa.quantity_from_stock} من المخزن
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ⚙️ {pa.quantity_to_manufacture} تصنيع جديد
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BUG-1 Fix: Full BOM Tree viewer */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#3D3554' }}>
            <button
              onClick={() => setShowBomTree(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-[#A49EC0] hover:bg-white/5 transition-colors"
              style={{ background: '#231B3D' }}
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                عرض شجرة BOM الكاملة (المكونات والخامات)
              </span>
              {showBomTree ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showBomTree && (
              <div className="p-3" style={{ background: '#1E1635' }}>
                <BomTreePanel operationId={showCheck.operation_id} />
              </div>
            )}
          </div>

          {/* GAP-5: Sub-products being drawn from existing stock with FIFO cost */}
          {Array.isArray(showCheck.sub_products_from_stock) && showCheck.sub_products_from_stock.length > 0 && (
            <div className="p-3.5 rounded-xl border space-y-2" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>📦 تكلفة المنتجات الفرعية المسحوبة من المخزن الحالي (FIFO):</span>
              </h4>
              <div className="space-y-1.5">
                {showCheck.sub_products_from_stock.map((sp, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[#2F264C]">
                    <div>
                      <p className="font-semibold text-white">{sp.name}</p>
                      <p className="text-[11px] text-[#A49EC0] font-mono">{sp.sku}</p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-[11px] text-[#A49EC0]">الكمية</p>
                        <p className="font-bold text-amber-300">{sp.quantity_from_stock} {sp.unit}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#A49EC0]">تكلفة FIFO</p>
                        <p className="font-bold text-emerald-400">{sp.fifo_cost.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#A49EC0]">متوسط/وحدة</p>
                        <p className="font-bold text-indigo-300">{sp.avg_unit_cost.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 1. Sub-Products Section (BOM Components) */}
          {Array.isArray(showCheck.sub_products) && showCheck.sub_products.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                المنتجات الفرعية المطلوبة للتجميع (Sub-Products BOM):
              </h3>

              <div className="space-y-2">
                {showCheck.sub_products.map((sp) => {
                  const hasShort = sp.shortage_quantity > 0;
                  return (
                    <div key={sp.id} className="p-3.5 rounded-xl border space-y-2.5" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">{sp.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 font-mono">{sp.sku}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-300">المطلوب: <strong className="text-white">{sp.required_quantity} {sp.unit}</strong></span>
                          <span className="px-2 py-0.5 rounded font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            📦 متوفر: {sp.available_quantity} {sp.unit}
                          </span>
                          {hasShort ? (
                            <span className="px-2 py-0.5 rounded font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                              عجز: -{sp.shortage_quantity} {sp.unit}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              متوفر بالكامل ✅
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Raw Materials needed to manufacture this sub-product shortage */}
                      {hasShort && Array.isArray(sp.materials_needed) && sp.materials_needed.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-[#2F264C]/70 border border-[#3D3554] space-y-1.5">
                          <p className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                            <Hammer className="w-3.5 h-3.5" />
                            الخامات المطلوبة لتصنيع العجز ({sp.shortage_quantity} {sp.unit}):
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sp.materials_needed.map((nm) => (
                              <div key={nm.material_id} className="text-xs p-2 rounded bg-[#231B3D] flex items-center justify-between">
                                <div>
                                  <span className="text-gray-200 font-semibold">{nm.name}</span>
                                  <div className="text-[10px] text-gray-400">
                                    مطلوب: {nm.required_quantity} {nm.unit} | متاح: {nm.available_quantity} {nm.unit}
                                  </div>
                                </div>
                                <div>
                                  {nm.is_sufficient ? (
                                    <span className="text-[11px] font-bold text-emerald-400">كافٍ ✅</span>
                                  ) : (
                                    <span className="text-[11px] font-bold text-red-400">ينقص {nm.shortage_quantity} ❌</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Raw Materials Consolidated Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                إجمالي المواد الخام المطلوبة للصرف:
              </h3>
              <span className="text-[11px] text-gray-400">
                (تشمل خامات المنتج الرئيسي + خامات تصنيع الأجزاء الفرعية)
              </span>
            </div>

            {(!showCheck.materials || showCheck.materials.length === 0) ? (
              <div className="p-4 rounded-xl text-center text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <p className="font-bold">📦 لا توجد خامات مطلوبة للصرف</p>
                <p className="text-gray-300">جميع كميات هذه الطلبية تم تخصيصها وسحبها من المخزن وجاهزة للتسليم للعميل مباشرة.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {showCheck.materials.map((m) => {
                  const isShort = m.shortage_quantity > 0;
                  const hasSubAlloc = (m.sub_products_quantity || 0) > 0;
                  return (
                    <div key={m.id} className="p-3.5 rounded-xl border flex items-center justify-between" style={{ background: '#231B3D', borderColor: '#3D3554' }}>
                      <div>
                        <p className="text-sm font-semibold text-white">{m.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400 font-mono">{m.sku}</span>
                          {hasSubAlloc && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
                              (مباشر: {m.direct_quantity} + للفرعي: {m.sub_products_quantity})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-gray-300">
                          الإجمالي المطلوب: <strong className="text-white">{m.required_quantity} {m.unit}</strong>
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          المتوفر بالمخزن: <span className="font-semibold text-emerald-300">{m.available_quantity} {m.unit}</span>
                        </p>
                        {isShort && (
                          <p className="text-xs font-bold text-red-400 mt-1">
                            العجز: -{m.shortage_quantity} {m.unit}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t flex flex-col gap-3 shrink-0" style={{ borderColor: '#3D3554' }}>
          <div className="flex flex-wrap gap-2">
            
            {/* If there are missing sub-products but raw materials exist to produce them */}
            {canAutoProduce && (
              <button
                onClick={() => startOperation(showCheck.operation_id, true)}
                className="flex-1 min-w-[240px] py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-95 shadow-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
              >
                <Hammer className="w-4 h-4" />
                بدء الإنتاج وتصنيع النواقص الفرعية تلقائياً
              </button>
            )}

            {/* Standard Start Button */}
            {!canAutoProduce && (
              <button
                disabled={showCheck.has_shortage}
                onClick={() => startOperation(showCheck.operation_id, false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#10B981' }}
              >
                <Play className="w-4 h-4" /> بدء وصرف المواد
              </button>
            )}

            <button
              onClick={() => setShowCheck(null)}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm border hover:bg-white/5 transition-all"
              style={{ borderColor: '#3D3554', color: '#A49EC0' }}
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
