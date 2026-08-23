import ProductionLogGrid from '@/components/employees/ProductionLogGrid';

export default function ProductionTabPanel({
  selectedEmpId,
  setSelectedEmpId,
  activeEmployees,
  selectedEmployee,
  products,
  inputCls,
}) {
  return (
    <div className="bg-[#231B3D] border border-[#3D3554] rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="max-w-xs">
        <label className="block text-xs font-bold text-[#A49EC0] mb-1.5">اختر الموظف لتسجيل الإنتاج</label>
        <select className={inputCls} value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
          <option value="">— اختر الموظف —</option>
          {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>
      {selectedEmployee ? (
        <ProductionLogGrid
          employee={selectedEmployee}
          products={products}
        />
      ) : (
        <div className="text-center py-16 text-xs font-bold text-[#A49EC0] bg-[#2F264C] rounded-xl border border-[#3D3554]">
          يرجى اختيار موظف من القائمة أعلاه لتسجيل عمليات الإنتاج بالقطعة
        </div>
      )}
    </div>
  );
}
