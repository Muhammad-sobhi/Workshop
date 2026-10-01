import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/main-layout';
import { useAppStore } from '@/lib/store';
import {
  menuItems, hasPermission, getBottomNavItems, MAX_BOTTOM_NAV_ITEMS,
} from '@/lib/navigation';
import { ChevronLeft, Settings, LogOut, Moon, Sun, Check, RotateCcw } from 'lucide-react';

function Group({ title, footer, children }) {
  return (
    <section>
      {title && <h2 className="px-4 pb-1.5 text-xs font-semibold text-muted-foreground">{title}</h2>}
      <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {children}
      </div>
      {footer && <div className="px-4 pt-1.5 text-[11px] leading-relaxed text-muted-foreground">{footer}</div>}
    </section>
  );
}

function IconTile({ icon: Icon, color }) {
  return (
    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: color }}>
      <Icon className="w-4 h-4" color="#FFFFFF" strokeWidth={2} />
    </span>
  );
}

function LinkRow({ to, icon, color, label }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-2.5 active:bg-muted transition-colors">
      <IconTile icon={icon} color={color} />
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <ChevronLeft className="w-4 h-4 text-muted-foreground" />
    </Link>
  );
}

export default function MorePage() {
  const navigate = useNavigate();
  const { user, theme, setTheme, bottomNav, setBottomNav, logout } = useAppStore();
  const [limitMessage, setLimitMessage] = useState('');

  useEffect(() => {
    if (!limitMessage) return;
    const timer = setTimeout(() => setLimitMessage(''), 3500);
    return () => clearTimeout(timer);
  }, [limitMessage]);

  const allowedItems = menuItems.filter((item) => hasPermission(user, item.href));
  const selected = getBottomNavItems(user, bottomNav).map((item) => item.href);
  const otherSections = allowedItems.filter((item) => !selected.includes(item.href));

  const toggleBottomNavItem = (href) => {
    if (selected.includes(href)) {
      setLimitMessage('');
      setBottomNav(selected.filter((h) => h !== href));
      return;
    }
    if (selected.length >= MAX_BOTTOM_NAV_ITEMS) {
      setLimitMessage(`يمكن اختيار ${MAX_BOTTOM_NAV_ITEMS} أقسام كحد أقصى. ألغِ اختيار قسم أولاً لإضافة قسم آخر.`);
      return;
    }
    setLimitMessage('');
    setBottomNav([...selected, href]);
  };

  const resetBottomNav = () => {
    setLimitMessage('');
    setBottomNav(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <MainLayout>
      <div className="max-w-xl mx-auto space-y-6 select-none">
        <h1 className="text-2xl font-bold text-foreground px-1">المزيد</h1>

        {/* Account */}
        <Link
          to="/profile"
          className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border active:bg-muted transition-colors"
        >
          <span className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0">
            {user?.name ? user.name.charAt(0) : 'م'}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-base font-bold text-foreground truncate">{user?.name}</span>
            <span className="block text-xs text-muted-foreground truncate" dir="ltr" style={{ textAlign: 'right' }}>{user?.email}</span>
          </span>
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </Link>

        {/* Sections not already in the bottom bar */}
        <Group title="الأقسام">
          {otherSections.map(({ href, label, icon, color }) => (
            <LinkRow key={href} to={href} icon={icon} color={color} label={label} />
          ))}
          <LinkRow to="/settings" icon={Settings} color="#8E8E93" label="الإعدادات" />
        </Group>

        {/* Appearance */}
        <Group title="المظهر" footer="يُحفظ الاختيار على هذا الجهاز فقط.">
          <div className="p-2">
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted" role="radiogroup" aria-label="المظهر">
              {[
                { value: 'light', label: 'فاتح', icon: Sun },
                { value: 'dark', label: 'داكن', icon: Moon },
              ].map(({ value, label, icon: Icon }) => {
                const active = theme === value;
                return (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setTheme(value)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                      active ? 'bg-card text-foreground shadow' : 'text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </Group>

        {/* Bottom bar customization */}
        <Group
          title={`تخصيص الشريط السفلي (${selected.length}/${MAX_BOTTOM_NAV_ITEMS})`}
          footer={`اضغط على الأقسام بالترتيب الذي تريد ظهورها به (حتى ${MAX_BOTTOM_NAV_ITEMS} أقسام). يظهر "المزيد" دائماً في آخر الشريط.`}
        >
          {allowedItems.map(({ href, label, icon, color }) => {
            const order = selected.indexOf(href);
            const isSelected = order !== -1;
            return (
              <button
                key={href}
                onClick={() => toggleBottomNavItem(href)}
                aria-pressed={isSelected}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-right active:bg-muted transition-colors"
              >
                <IconTile icon={icon} color={color} />
                <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
                {isSelected ? (
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {order + 1}
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border-2 border-border" />
                )}
              </button>
            );
          })}
        </Group>

        <Group>
          <button
            onClick={resetBottomNav}
            disabled={bottomNav === null}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-primary disabled:opacity-40 active:bg-muted transition-colors"
          >
            {bottomNav === null ? <Check className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
            {bottomNav === null ? 'الترتيب الافتراضي مُفعّل' : 'استعادة الترتيب الافتراضي'}
          </button>
        </Group>

        {limitMessage && (
          <div
            role="alert"
            className="fixed inset-x-4 z-50 mx-auto max-w-md px-4 py-3 rounded-2xl text-xs font-semibold text-center text-[#FFFFFF] shadow-lg bg-destructive"
            style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}
          >
            {limitMessage}
          </div>
        )}

        <Group>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-destructive active:bg-muted transition-colors"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </Group>
      </div>
    </MainLayout>
  );
}
