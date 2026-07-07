'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ currentPage, lastPage, onPageChange, total, loading }) {
  if (lastPage <= 1) return null;

  const pages = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(lastPage, currentPage + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t flex-wrap gap-3" style={{ borderColor: '#3D3554' }}>
      <span className="text-xs" style={{ color: '#A49EC0' }}>
        إجمالي {total || 0} سجل
      </span>
      <div className="flex items-center gap-1.5" dir="ltr">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || loading}
          className="p-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30"
          style={{ background: '#2F264C', border: '1px solid #3D3554', color: '#A49EC0' }}
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {start > 1 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: '#2F264C', border: '1px solid #3D3554', color: '#A49EC0' }}
            >
              1
            </button>
            {start > 2 && <span className="px-1 text-xs" style={{ color: '#A49EC0' }}>...</span>}
          </>
        )}

        {pages.map(p => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors min-w-[32px]"
            style={p === currentPage
              ? { background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }
              : { background: '#2F264C', border: '1px solid #3D3554', color: '#A49EC0' }
            }
          >
            {p}
          </button>
        ))}

        {end < lastPage && (
          <>
            {end < lastPage - 1 && <span className="px-1 text-xs" style={{ color: '#A49EC0' }}>...</span>}
            <button
              onClick={() => onPageChange(lastPage)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: '#2F264C', border: '1px solid #3D3554', color: '#A49EC0' }}
            >
              {lastPage}
            </button>
          </>
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= lastPage || loading}
          className="p-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-30"
          style={{ background: '#2F264C', border: '1px solid #3D3554', color: '#A49EC0' }}
          aria-label="الصفحة التالية"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
