import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function SearchableSelect({
  options = [], // { value, label, subtitle }
  value,
  onChange,
  placeholder = 'اختر...',
  className = '',
  style = {},
  disabled = false,
  required = false,
  hideSearch = false
}) {
  const { theme } = useAppStore();
  const isLight = theme === 'light';
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  
  const selectedOption = options.find(opt => String(opt.value) === String(value));

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync search term with selected option when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt => 
    opt.label?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    opt.subtitle?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (optValue) => {
    // Explicitly fire onChange even if it matches the current value to fix the default option bug
    if (onChange) {
      onChange({ target: { value: String(optValue) } });
    }
    setIsOpen(false);
  };

  const currentStyle = {
    background: isLight ? '#FFFFFF' : '#2F264C',
    borderColor: isLight ? '#EBF0FF' : '#3D3554',
    color: isLight ? '#1E293B' : '#FFFFFF',
    ...style
  };

  return (
    <div className={`relative w-full ${className}`} ref={wrapperRef} style={{ zIndex: isOpen ? 50 : undefined }}>
      {/* Hidden native input for HTML5 validation if required */}
      {required && (
        <input 
          type="text" 
          value={value || ''} 
          onChange={() => {}} 
          className="absolute opacity-0 pointer-events-none w-0 h-0" 
          required 
        />
      )}
      
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2 rounded-xl border text-xs outline-none flex items-center justify-between cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={currentStyle}
      >
        <span className={selectedOption ? '' : (isLight ? 'text-slate-400' : 'text-[#A49EC0]')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} style={{ color: isLight ? '#94A3B8' : '#A49EC0' }} />
      </div>

      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-1 rounded-xl border shadow-xl max-h-60 flex flex-col overflow-hidden"
          style={{
            background: isLight ? '#FFFFFF' : '#231B3D',
            borderColor: isLight ? '#EBF0FF' : '#3D3554',
          }}
        >
          {!hideSearch && (
            <div className="p-2 border-b" style={{ borderColor: isLight ? '#F1F5F9' : '#3D3554' }}>
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: isLight ? '#94A3B8' : '#A49EC0' }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="ابحث هنا..."
                  autoFocus
                  className="w-full pl-3 pr-8 py-2 rounded-lg text-xs outline-none border transition-colors focus:border-amber-500/50"
                  style={{
                    background: isLight ? '#F8FAFC' : '#1D172E',
                    borderColor: isLight ? '#E2E8F0' : '#2F264C',
                    color: isLight ? '#1E293B' : '#FFFFFF'
                  }}
                />
              </div>
            </div>
          )}
          
          <div className="overflow-y-auto flex-1 p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs" style={{ color: isLight ? '#64748B' : '#A49EC0' }}>
                لا توجد نتائج مطابقة
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className="w-full text-right px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center justify-between group"
                    style={{
                      background: isSelected ? (isLight ? '#FEF3C7' : '#ECC79622') : 'transparent',
                      color: isSelected ? (isLight ? '#B45309' : '#ECC796') : (isLight ? '#334155' : '#D4CEEB'),
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = isLight ? '#F1F5F9' : '#2F264C';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div>
                      <span>{opt.label}</span>
                      {opt.subtitle && (
                        <span className="block text-[10px] mt-0.5 opacity-70 font-normal">
                          {opt.subtitle}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={14} />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}