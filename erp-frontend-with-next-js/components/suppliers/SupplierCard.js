'use client';

import { Phone, Mail, MapPin, Package, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Link, Unlink } from 'lucide-react';

export default function SupplierCard({
  item, isExpanded, activeTab, currency,
  onToggle, onEdit, onDelete, onAddMaterial, onPayDebt, onRemoveMaterial,
}) {
  const hasDebt = parseFloat(item.debt_amount) > 0;
  const cardStyle = { background: 'rgb(236, 199, 150)', borderColor: '#ECC796', color: '#231B3D' };

  return (
    <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold" style={{ background: '#3D3554', color: '#ECC796' }}>
            {item.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold flex items-center gap-2" style={{ color: '#231B3D' }}>
              {item.name}
              {hasDebt && (
                <span className="px-2 py-0.5 rounded text-[10px] bg-red-500 text-white font-bold animate-pulse">
                  دين: {parseFloat(item.debt_amount).toFixed(2)} {currency}
                  {item.debt_due_date ? ` (مستحق ${item.debt_due_date})` : ''}
                </span>
              )}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {item.contact_person && (
                <span className="text-xs font-medium" style={{ color: '#4E4869' }}>{item.contact_person}</span>
              )}
              {item.phone && (
                <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#4E4869' }}>
                  <Phone className="w-3 h-3" />{item.phone}
                </span>
              )}
              {item.email && (
                <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#4E4869' }}>
                  <Mail className="w-3 h-3" />{item.email}
                </span>
              )}
              {item.address && (
                <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#4E4869' }}>
                  <MapPin className="w-3 h-3" />{item.address}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
          {activeTab === 'suppliers' && (
            <>
              <div className="text-center px-3">
                <p className="text-lg font-bold" style={{ color: '#231B3D' }}>{item.materials?.length || 0}</p>
                <p className="text-xs font-semibold" style={{ color: '#4E4869' }}>مادة</p>
              </div>
              <button
                onClick={() => onAddMaterial(item.id)}
                className="p-2 rounded-lg text-xs transition-all flex items-center gap-1"
                style={{ background: '#3D3554', color: '#10B981' }}
                aria-label="ربط مادة بهذا المورد"
              >
                <Link className="w-4 h-4" />
              </button>
            </>
          )}

          {activeTab === 'suppliers' && hasDebt && (
            <button
              onClick={() => onPayDebt(item)}
              className="px-3 py-2 rounded-lg text-xs font-bold transition-all hover:opacity-90 flex items-center gap-1"
              style={{ background: '#10B981', color: '#FFF' }}
            >
              سداد الدين
            </button>
          )}

          <button
            onClick={() => onEdit(item)}
            className="p-2 rounded-lg transition-all"
            style={{ background: '#3D3554', color: '#ECC796' }}
            aria-label="تعديل"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item.id, item.name)}
            className="p-2 rounded-lg transition-all"
            style={{ background: '#3D3554', color: '#EF4444' }}
            aria-label="حذف"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {activeTab === 'suppliers' && (
            <button
              onClick={() => onToggle(item.id)}
              className="p-2 rounded-lg transition-all"
              style={{ background: '#3D3554', color: '#A49EC0' }}
              aria-label={isExpanded ? 'طي المواد' : 'عرض المواد'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'suppliers' && isExpanded && (
        <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: 'rgba(35, 27, 61, 0.15)' }}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#231B3D' }}>
              <Package className="w-4 h-4" style={{ color: '#3D3554' }} />
              المواد التي يوفرها هذا المورد
            </h4>
            <button
              onClick={() => onAddMaterial(item.id)}
              className="text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"
              style={{ background: '#3D3554', color: '#ffffff' }}
            >
              <Plus className="w-3 h-3" />
              إضافة مادة
            </button>
          </div>
          {!item.materials || item.materials.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: '#4E4869' }}>
              لم يتم ربط أي مادة بهذا المورد بعد. اضغط "إضافة مادة" لربط المواد التي يوفرها.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {item.materials.map(mat => (
                <div key={mat.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#3D3554', color: '#ffffff' }}>
                  <div>
                    <p className="text-sm font-semibold text-white">{mat.name}</p>
                    <p className="text-xs mt-0.5 text-gray-200">
                      {mat.unit}
                      {mat.pivot?.price ? ` • EGP ${parseFloat(mat.pivot.price).toFixed(2)}/وحدة` : ''}
                    </p>
                    {mat.pivot?.notes && (
                      <p className="text-xs mt-0.5 text-gray-300">{mat.pivot.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveMaterial(item.id, mat.id, mat.name)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#FCA5A5' }}
                    aria-label="إلغاء الربط"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {item.notes && (
            <div className="mt-3 p-3 rounded-xl text-xs font-semibold" style={{ background: '#3D3554', color: '#ffffff' }}>
              <span className="font-bold text-[#ECC796]">ملاحظات: </span>{item.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
