'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import apiClient from '@/lib/api-client';
import { Bell, Search, Menu, CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Header() {
  const router = useRouter();
  const { toggleSidebar, user } = useAppStore();
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await apiClient.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAll = async () => {
    try {
      await apiClient.delete('/notifications/clear');
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleLabel = (role) => {
    if (role === 'admin') return 'مسؤول';
    if (role === 'manager') return 'مشرف';
    return 'موظف';
  };

  return (
    <header
      className="h-16 sticky top-0 z-30 border-b border-border shrink-0 select-none"
      style={{ background: '#2F264C' }}
    >
      <div className="h-full px-4 flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2.5 rounded-xl hover:bg-white/10 transition-colors active:scale-95"
          style={{ color: '#ECC796' }}
          aria-label="فتح القائمة"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="lg:hidden flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow"
            style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
          >
            ERP
          </div>
          <span className="text-sm font-bold text-white">نظام ERP</span>
        </div>

        <div className="hidden md:flex items-center gap-2 flex-1 max-w-xs">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#A49EC0' }} />
            <input
              id="header-search"
              type="text"
              placeholder="بحث..."
              className="w-full rounded-xl py-2 pr-9 pl-4 text-xs border outline-none transition-colors"
              style={{
                background: '#231B3D',
                borderColor: '#3D3554',
                color: '#FFFFFF',
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mr-auto relative">
          
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="relative p-2 rounded-xl hover:bg-white/10 transition-colors active:scale-95"
              style={{ color: '#D4CEEB' }}
              aria-label="التنبيهات"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-[#201A30]"
                  style={{ background: '#ECC796' }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {dropdownOpen && (
              <div 
                className="absolute left-0 mt-2 w-80 rounded-2xl border shadow-xl z-50 flex flex-col max-h-[400px]"
                style={{ background: '#231B3D', borderColor: '#3D3554' }}
              >
                <div className="p-3.5 border-b border-[#3D3554] flex justify-between items-center shrink-0">
                  <span className="text-xs font-bold text-white">التنبيهات ({unreadCount})</span>
                  {notifications.length > 0 && (
                    <div className="flex gap-2">
                      <button 
                        onClick={handleMarkAllRead} 
                        className="text-[10px] text-[#ECC796] hover:underline"
                      >
                        قراءة الكل
                      </button>
                      <button 
                        onClick={handleClearAll}
                        className="text-[10px] text-red-400 hover:underline flex items-center gap-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>حذف</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {notifications.map(n => (
                    <div 
                      key={n.id}
                      onClick={() => handleMarkAsRead(n.id)}
                      className={`p-3 rounded-xl cursor-pointer transition-colors relative border ${
                        n.is_read 
                          ? 'bg-[#2F264C]/30 border-transparent hover:bg-[#2F264C]/50' 
                          : 'bg-[#2F264C] border-[#3D3554] hover:bg-[#2F264C]/80'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <p className={`text-xs font-bold ${n.is_read ? 'text-[#A49EC0]' : 'text-white'}`}>{n.title}</p>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: '#ECC796' }} />
                        )}
                      </div>
                      <p className="text-[11px] mt-1 text-[#D4CEEB] leading-relaxed">{n.message}</p>
                      <p className="text-[9px] mt-1.5 text-right" style={{ color: '#8278a8' }}>
                        {new Date(n.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}

                  {notifications.length === 0 && (
                    <div className="text-center py-8 text-xs" style={{ color: '#A49EC0' }}>
                      لا توجد تنبيهات جديدة
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6" style={{ background: '#3D3554' }} />

          <div 
            onClick={() => router.push('/profile')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="hidden sm:block text-right">
              <p className="text-xs font-semibold text-white group-hover:text-[#ECC796] transition-colors">{user?.name || 'مدير النظام'}</p>
              <p className="text-[10px]" style={{ color: '#A49EC0' }}>{getRoleLabel(user?.role || 'admin')}</p>
            </div>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg transition-opacity group-hover:opacity-85"
              style={{ background: 'linear-gradient(135deg, #ECC796, #D4A660)', color: '#201A30' }}
            >
              {user?.name ? user.name.charAt(0) : 'م'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
