'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

export function DataTable({
  columns,
  data,
  title,
  onEdit,
  onDelete,
  isLoading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState(null);

  const filteredData = data.filter((row) =>
    columns.some((col) => {
      const value = row[col.key];
      return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
    })
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="w-full space-y-4">
      {title && <h2 className="text-2xl font-bold text-foreground">{title}</h2>}

      <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-lg border border-border">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent outline-none text-sm"
        />
      </div>

      <div 
        className="overflow-x-auto rounded-lg border border-border"
        style={{ background: '#201A30' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: '#3D3554', background: '#2F264C' }}>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-4 py-3 text-right font-semibold text-foreground select-none"
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-2 hover:text-[#ECC796] transition-colors"
                    >
                      {col.label}
                      {sortConfig?.key === col.key && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
              {(onEdit || onDelete) && <th className="px-4 py-3 text-right font-semibold">الإجراءات</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="px-4 py-8 text-center text-muted-foreground bg-[#201A30]">
                  جاري التحميل...
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="px-4 py-8 text-center text-muted-foreground bg-[#201A30]">
                  لا توجد بيانات
                </td>
              </tr>
            ) : (
              sortedData.map((row) => (
                <tr 
                  key={row.id} 
                  className="border-b transition-colors hover:bg-white/5"
                  style={{ borderColor: '#3D3554', background: '#201A30' }}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-foreground bg-transparent">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="px-4 py-3 bg-transparent">
                      <div className="flex gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="px-3 py-1 text-[#201A30] rounded-lg hover:opacity-90 transition-opacity text-xs font-semibold"
                            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)' }}
                          >
                            تعديل
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row)}
                            className="px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors text-xs font-semibold"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
