import React, { useState, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { formatDecimal } from '@/lib/utils';
import {
  DollarSign, TrendingUp, AlertTriangle, CheckCircle2, ShieldCheck,
  Calculator, History, Loader2, ArrowRight, Layers, Box, Info
} from 'lucide-react';

export default function SmartPriceUpdateModal({ material, currency, onClose, onSuccess }) {
  const [newPrice, setNewPrice] = useState(material?.unit_cost?.toString() || '');
  const [applyMaterialStock, setApplyMaterialStock] = useState(true);
  const [applyBom, setApplyBom] = useState(true);
  const [applyFutureOnly, setApplyFutureOnly] = useState(false);
  const [notes, setNotes] = useState('');

  const [loadingImpact, setLoadingImpact] = useState(false);
  const [impactData, setImpactData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Editable product prices mapping: { [productId]: price }
  const [customProductPrices, setCustomProductPrices] = useState({});

  // Active view: 'update' | 'history'
  const [activeTab, setActiveTab] = useState('update');
  const [priceHistory, setPriceHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch Impact Analysis when newPrice changes
  useEffect(() => {
    const cost = parseFloat(newPrice);
    if (isNaN(cost) || cost < 0 || !material?.id) return;

    const timer = setTimeout(async () => {
      setLoadingImpact(true);
      try {
        const res = await apiClient.get(`/materials/${material.id}/price-impact?new_unit_cost=${cost}`);
        setImpactData(res.data);

        // Pre-fill suggested prices
        const initialPrices = {};
        (res.data?.affected_products || []).forEach(p => {
          initialPrices[p.product_id] = p.suggested_sale_price;
        });
        setCustomProductPrices(initialPrices);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingImpact(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [newPrice, material?.id]);

  // Fetch Price History
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient.get(`/materials/${material.id}/price-history`);
      setPriceHistory(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOptionChange = (option) => {
    if (option === 'future_only') {
      setApplyFutureOnly(true);
      setApplyBom(false);
      setApplyMaterialStock(false);
    } else if (option === 'bom_and_stock') {
      setApplyFutureOnly(false);
      setApplyBom(true);
      setApplyMaterialStock(true);
    } else if (option === 'stock_only') {
      setApplyFutureOnly(false);
      setApplyBom(false);
      setApplyMaterialStock(true);
    }
  };

  const handleProductPriceChange = (productId, val) => {
    setCustomProductPrices(prev => ({
      ...prev,
      [productId]: val
    }));
  };

  const handleApplySuggestedPrices = () => {
    const initialPrices = {};
    (impactData?.affected_products || []).forEach(p => {
      initialPrices[p.product_id] = p.suggested_sale_price;
    });
    setCustomProductPrices(initialPrices);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cost = parseFloat(newPrice);
    if (isNaN(cost) || cost < 0) {
      setError('يرجى إدخال سعر صحيح للمادة الخام.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    // Format product prices payload if BOM update is enabled
    const productPricesPayload = applyBom && !applyFutureOnly
      ? Object.entries(customProductPrices).map(([productId, salePrice]) => ({
          product_id: parseInt(productId),
          sale_price: parseFloat(salePrice) || 0
        }))
      : [];

    try {
      const res = await apiClient.post(`/materials/${material.id}/update-price`, {
        new_unit_cost: cost,
        apply_to_material_stock: applyMaterialStock,
        apply_to_products_bom: applyBom,
        apply_future_only: applyFutureOnly,
        notes: notes,
        product_prices: productPricesPayload
      });

      setSuccessMsg(res.data?.message || 'تم تحديث السعر بنجاح.');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'فشل تحديث سعر المادة الخام.');
    } finally {
      setSubmitting(false);
    }
  };

  const oldCost = (material?.unit_cost || 0);
  const enteredCost = parseFloat(newPrice) || oldCost;
  const costDiff = enteredCost - oldCost;
  const percentDiff = oldCost > 0 ? ((costDiff / oldCost) * 100).toFixed(1) : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl border p-5 sm:p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col"
        style={{ background: '#231B3D', borderColor: '#3D3554' }}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-[#3D3554] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(236,199,150,0.15)', color: '#ECC796' }}>
              <Calculator size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                تحديث السعر الذكي: {material?.name}
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#2F264C] text-[#D4CEEB]">
                  {material?.unit}
                </span>
              </h3>
              <p className="text-[11px]" style={{ color: '#A49EC0' }}>
                السعر الحالي: {currency || 'ر.س'} {formatDecimal(oldCost)} | الرصيد الحالي: {material?.stock || 0} {material?.unit}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeTab === 'update') {
                  setActiveTab('history');
                  fetchHistory();
                } else {
                  setActiveTab('update');
                }
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors"
              style={{ background: '#2F264C', borderColor: '#3D3554', color: activeTab === 'history' ? '#ECC796' : '#D4CEEB' }}
            >
              <History size={13} />
              <span>{activeTab === 'history' ? 'رجوع للتعديل' : 'سجل الأسعار'}</span>
            </button>
            <button onClick={onClose} className="text-xs text-[#A49EC0] hover:text-white p-1">✕</button>
          </div>
        </div>

        {/* Tab 1: Price History */}
        {activeTab === 'history' ? (
          <div className="flex-1 overflow-y-auto space-y-3 p-1">
            {loadingHistory ? (
              <div className="text-center py-12 text-xs text-[#A49EC0]">جاري تحميل سجل الأسعار...</div>
            ) : priceHistory.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#A49EC0]">لا يوجد سجل تعديلات سابقة لهذه المادة.</div>
            ) : (
              <div className="space-y-2">
                {priceHistory.map(h => (
                  <div key={h.id} className="p-3 rounded-xl border flex items-center justify-between" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{currency || 'ر.س'} {formatDecimal(h.old_unit_cost)} ⬅ {currency || 'ر.س'} {formatDecimal(h.new_unit_cost)}</span>
                        {h.apply_future_only && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">طلبيات مستقبلية فقط</span>
                        )}
                        {h.apply_to_products_bom && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">تحديث BOM</span>
                        )}
                      </div>
                      {h.notes && <p className="text-[11px] text-[#A49EC0] mt-1">{h.notes}</p>}
                    </div>
                    <div className="text-right text-[10px] text-[#A49EC0]">
                      <p>{h.user?.name || 'المدير'}</p>
                      <p>{new Date(h.created_at).toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Tab 2: Smart Price Update Form */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Price Inputs & Quick Comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>
                  السعر الجديد للمادة الخام ({currency || 'ر.س'}) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full rounded-xl py-2 px-3 pl-8 text-xs font-bold border outline-none"
                    style={{ background: '#231B3D', borderColor: '#3D3554', color: '#ECC796' }}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#A49EC0]">
                    {currency || 'ر.س'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <span className="text-[11px]" style={{ color: '#A49EC0' }}>نسبة التغير ومقدار الفرق</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-bold ${costDiff > 0 ? 'text-rose-400' : costDiff < 0 ? 'text-emerald-400' : 'text-white'}`}>
                    {costDiff > 0 ? `+${formatDecimal(costDiff)}` : formatDecimal(costDiff)} {currency || 'ر.س'}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${costDiff > 0 ? 'bg-rose-500/20 text-rose-300' : costDiff < 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white'}`}>
                    {costDiff > 0 ? `+${percentDiff}%` : `${percentDiff}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* Smart Pricing Options (The 3 Choices) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#ECC796]" />
                حدد آلية تطبيق السعر الجديد في النظام:
              </label>

              <div className="space-y-2 text-xs">
                {/* Option A: Full BOM & Stock Revaluation */}
                <label
                  onClick={() => handleOptionChange('bom_and_stock')}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    applyBom && applyMaterialStock && !applyFutureOnly
                      ? 'border-[#ECC796] bg-[#ECC796]/10'
                      : 'border-[#3D3554] bg-[#2F264C] opacity-80'
                  }`}
                >
                  <input
                    type="radio"
                    name="price_option"
                    checked={applyBom && applyMaterialStock && !applyFutureOnly}
                    onChange={() => {}}
                    className="mt-0.5 text-[#ECC796] focus:ring-0"
                  />
                  <div>
                    <p className="font-bold text-white">1️⃣ تحديث تقييم المخزون وتكلفة المنتجات المصنعة (BOM) واقتراح أسعار البيع</p>
                    <p className="text-[11px] text-[#A49EC0] mt-0.5">
                      يُعاد تقييم رصيد المادة الخام بالمستودع، وتحديث تكلفة المنتجات المصنعة فوراً، مع إمكانية تعديل سعر البيع للحفاظ على هامش الربح.
                    </p>
                  </div>
                </label>

                {/* Option B: Stock Revaluation Only (No BOM update) */}
                <label
                  onClick={() => handleOptionChange('stock_only')}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    applyMaterialStock && !applyBom && !applyFutureOnly
                      ? 'border-[#ECC796] bg-[#ECC796]/10'
                      : 'border-[#3D3554] bg-[#2F264C] opacity-80'
                  }`}
                >
                  <input
                    type="radio"
                    name="price_option"
                    checked={applyMaterialStock && !applyBom && !applyFutureOnly}
                    onChange={() => {}}
                    className="mt-0.5 text-[#ECC796] focus:ring-0"
                  />
                  <div>
                    <p className="font-bold text-white">2️⃣ تحديث تقييم مخزون الخام فقط مع تثبيت تكلفة المنتجات الحالية</p>
                    <p className="text-[11px] text-[#A49EC0] mt-0.5">
                      تعديل سعر المادة الخام في المستودع دون المساس ببطاقات وتكاليف المنتجات المصنعة حالياً.
                    </p>
                  </div>
                </label>

                {/* Option C: Future Orders Only */}
                <label
                  onClick={() => handleOptionChange('future_only')}
                  className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    applyFutureOnly
                      ? 'border-[#ECC796] bg-[#ECC796]/10'
                      : 'border-[#3D3554] bg-[#2F264C] opacity-80'
                  }`}
                >
                  <input
                    type="radio"
                    name="price_option"
                    checked={applyFutureOnly}
                    onChange={() => {}}
                    className="mt-0.5 text-[#ECC796] focus:ring-0"
                  />
                  <div>
                    <p className="font-bold text-white">3️⃣ اعتماد السعر الجديد للطلبيات والمشتريات المستقبلية فقط</p>
                    <p className="text-[11px] text-[#A49EC0] mt-0.5">
                      يُحفظ السعر الجديد كمرجع قياسي للطلبيات القادمة دون تغيير تكلفة أي مخزون أو منتج مصنع مسبقاً.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Affected Products Table (BOM Margin Protection) */}
            {applyBom && !applyFutureOnly && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers size={14} className="text-[#ECC796]" />
                    المنتجات المتأثرة بتغير سعر المادة الخام ({impactData?.total_affected_products || 0}):
                  </label>
                  {impactData?.total_affected_products > 0 && (
                    <button
                      type="button"
                      onClick={handleApplySuggestedPrices}
                      className="text-[10px] text-[#ECC796] hover:underline font-semibold"
                    >
                      تطبيق أسعار البيع المقترحة للحفاظ على الأرباح
                    </button>
                  )}
                </div>

                {loadingImpact ? (
                  <div className="text-center py-6 text-xs text-[#A49EC0] flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    <span>جاري فحص المنتجات وحساب الهوامش الربحية...</span>
                  </div>
                ) : !impactData?.affected_products || impactData.affected_products.length === 0 ? (
                  <div className="p-3 rounded-xl border text-xs text-[#A49EC0] text-center" style={{ background: '#2F264C', borderColor: '#3D3554' }}>
                    لا توجد منتجات مسجلة تستخدم هذه المادة الخام في بطاقة التصنيع (BOM).
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-x-auto max-h-48" style={{ background: '#201A30', borderColor: '#3D3554' }}>
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b text-right text-[#A49EC0]" style={{ borderColor: '#3D3554', background: '#2F264C' }}>
                          <th className="p-2">المنتج</th>
                          <th className="p-2">التكلفة الجديدة</th>
                          <th className="p-2">هامش الربح الحالي</th>
                          <th className="p-2">سعر البيع المقترح / الجديد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {impactData.affected_products.map(p => (
                          <tr key={p.product_id} className="border-b" style={{ borderColor: '#3D3554' }}>
                            <td className="p-2 font-semibold text-white">
                              {p.product_name}
                              <span className="block text-[9px] text-[#A49EC0]">{p.product_sku} (استهلاك: {p.material_qty_used} {material?.unit})</span>
                            </td>
                            <td className="p-2">
                              <span className="text-white line-through opacity-60 text-[10px] ml-1">
                                {formatDecimal(p.current_unit_cost)}
                              </span>
                              <span className="font-bold text-[#ECC796]">
                                {formatDecimal(p.new_calculated_unit_cost)} {currency || 'ر.س'}
                              </span>
                            </td>
                            <td className="p-2">
                              <span className="px-1.5 py-0.5 rounded bg-white/5 font-bold text-white">
                                {p.current_margin_percent}%
                              </span>
                            </td>
                            <td className="p-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={customProductPrices[p.product_id] !== undefined ? customProductPrices[p.product_id] : p.suggested_sale_price}
                                  onChange={(e) => handleProductPriceChange(p.product_id, e.target.value)}
                                  className="w-20 rounded py-1 px-1.5 text-[11px] font-bold border outline-none bg-[#2F264C] text-emerald-400 border-[#3D3554]"
                                />
                                <span className="text-[10px] text-[#A49EC0]">{currency || 'ر.س'}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#D4CEEB' }}>سبب أو ملاحظة التعديل (اختياري)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: زيادة أسعار المورد بنسبة 15%"
                className="w-full rounded-xl py-2 px-3 text-xs border outline-none"
                style={{ background: '#2F264C', borderColor: '#3D3554', color: '#FFFFFF' }}
              />
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#3D3554] shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl py-2 px-4 text-xs font-semibold hover:bg-white/5 transition-colors"
                style={{ color: '#A49EC0' }}
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl py-2 px-5 text-xs font-bold transition-all duration-200 active:scale-[0.98] flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>جاري تطبيق التحديث...</span>
                  </>
                ) : (
                  <>
                    <TrendingUp size={14} />
                    <span>تأكيد واعتماد السعر الجديد</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
