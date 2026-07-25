'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

export function KPICard({ label, value, change, changeType = 'positive', icon }) {
  const isPositive = changeType === 'positive';
  const changeIcon = isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;

  return (
    <div className="bg-card rounded-lg border border-border p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-2">{label}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {change && (
            <div className={`flex items-center gap-1 mt-3 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {changeIcon}
              <span>{change}</span>
            </div>
          )}
        </div>
        {icon && <div className="text-primary opacity-50">{icon}</div>}
      </div>
    </div>
  );
}
