import { Link, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getBottomNavItems, isActivePath } from '@/lib/navigation';

// Mobile-only tab bar; replaces the sidebar below the lg breakpoint.
export function BottomNav() {
  const { pathname } = useLocation();
  const { user, bottomNav } = useAppStore();
  const items = getBottomNavItems(user, bottomNav);
  const tabs = [...items, { shortLabel: 'المزيد', icon: MoreHorizontal, href: '/more' }];
  const activeHref = tabs.find((tab) => isActivePath(pathname, tab.href))?.href;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-md select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', WebkitTapHighlightColor: 'transparent' }}
      aria-label="التنقل الرئيسي"
    >
      <ul className="flex h-14">
        {tabs.map(({ shortLabel, icon: Icon, href }) => {
          const isActive = href === activeHref;
          return (
            <li key={href} className="flex-1 min-w-0">
              <Link
                to={href}
                aria-current={isActive ? 'page' : undefined}
                className={`h-full flex flex-col items-center justify-center gap-1 transition-colors active:opacity-60 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 1.8} />
                <span className={`text-[10px] leading-none truncate max-w-full px-1 ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {shortLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
