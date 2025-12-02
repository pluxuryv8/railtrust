import { useQuery } from '@tanstack/react-query';
import { 
  Container, 
  Ship, 
  Train, 
  Package,
  TrendingUp,
  Clock,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { containersApi } from '../api/client';
import { StatusCode, STATUS_LABELS } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

// Группировка статусов по этапам
const STATUS_GROUPS = {
  'На море': ['LOADED', 'IN_PORT', 'ON_SHIP', 'ON_ANCHORAGE'] as StatusCode[],
  'В порту назначения': ['ARRIVED_PORT', 'ON_WAREHOUSE', 'CUSTOMS_CLEARED'] as StatusCode[],
  'На ЖД': ['ON_RAIL', 'RAIL_ARRIVED'] as StatusCode[],
  'Доставлено': ['DELIVERED', 'ON_AUTO'] as StatusCode[],
};

const GROUP_ICONS = {
  'На море': Ship,
  'В порту назначения': Package,
  'На ЖД': Train,
  'Доставлено': Container,
};

const GROUP_COLORS = {
  'На море': 'from-blue-500 to-cyan-500',
  'В порту назначения': 'from-amber-500 to-orange-500',
  'На ЖД': 'from-orange-500 to-red-500',
  'Доставлено': 'from-green-500 to-emerald-500',
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['containers', { limit: 100 }],
    queryFn: () => containersApi.getContainers({ limit: 100 }),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Загрузка статистики..." />
      </div>
    );
  }

  const containers = data?.data || [];
  
  // Подсчёт по группам
  const groupCounts = Object.entries(STATUS_GROUPS).map(([group, statuses]) => {
    const count = containers.filter(c => 
      c.lastStatus && statuses.includes(c.lastStatus.statusCode)
    ).length;
    return { group, count };
  });

  // Контейнеры с просроченным ETA
  const overdueContainers = containers.filter(c => {
    if (!c.lastStatus?.eta) return false;
    return new Date(c.lastStatus.eta) < new Date();
  });

  // Контейнеры без обновлений > 3 дней
  const staleContainers = containers.filter(c => {
    if (!c.lastStatus?.eventTime) return false;
    const daysSinceUpdate = (Date.now() - new Date(c.lastStatus.eventTime).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 3;
  });

  // Ближайшие прибытия (следующие 7 дней)
  const upcomingArrivals = containers
    .filter(c => {
      if (!c.lastStatus?.eta) return false;
      const eta = new Date(c.lastStatus.eta);
      const now = new Date();
      const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return eta >= now && eta <= weekLater;
    })
    .sort((a, b) => 
      new Date(a.lastStatus!.eta!).getTime() - new Date(b.lastStatus!.eta!).getTime()
    )
    .slice(0, 5);

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {/* Header */}
      <header className="h-16 border-b border-slate-800/50 flex items-center px-6 bg-slate-900/30">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-brand-400" />
          <h1 className="text-lg font-semibold text-white">Дашборд</h1>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {groupCounts.map(({ group, count }, index) => {
            const Icon = GROUP_ICONS[group as keyof typeof GROUP_ICONS];
            const colors = GROUP_COLORS[group as keyof typeof GROUP_COLORS];
            return (
              <div 
                key={group}
                className="relative overflow-hidden bg-slate-800/30 rounded-xl border border-slate-700/50 p-5 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colors} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2`} />
                <div className="relative">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{count}</div>
                  <div className="text-sm text-slate-400">{group}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Alerts row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Overdue */}
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <h2 className="font-semibold text-white">Просроченные ETA</h2>
              <span className="ml-auto px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-sm">
                {overdueContainers.length}
              </span>
            </div>
            {overdueContainers.length === 0 ? (
              <p className="text-sm text-slate-500">Нет просроченных контейнеров</p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-auto">
                {overdueContainers.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-slate-300">{c.containerNumber}</span>
                    <span className="text-red-400">
                      ETA: {new Date(c.lastStatus!.eta!).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stale updates */}
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-amber-400" />
              <h2 className="font-semibold text-white">Нет обновлений {'>'} 3 дней</h2>
              <span className="ml-auto px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-sm">
                {staleContainers.length}
              </span>
            </div>
            {staleContainers.length === 0 ? (
              <p className="text-sm text-slate-500">Все контейнеры актуальны</p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-auto">
                {staleContainers.slice(0, 5).map(c => (
                  <div key={c.id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-slate-300">{c.containerNumber}</span>
                    <span className="text-amber-400">
                      {Math.floor((Date.now() - new Date(c.lastStatus!.eventTime).getTime()) / (1000 * 60 * 60 * 24))} дн. назад
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming arrivals */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-brand-400" />
            <h2 className="font-semibold text-white">Ближайшие прибытия (7 дней)</h2>
          </div>
          {upcomingArrivals.length === 0 ? (
            <p className="text-sm text-slate-500">Нет ожидаемых прибытий на ближайшую неделю</p>
          ) : (
            <div className="grid gap-3">
              {upcomingArrivals.map((c, index) => {
                const eta = new Date(c.lastStatus!.eta!);
                const daysUntil = Math.ceil((eta.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div 
                    key={c.id} 
                    className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-lg animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                      <span className="text-brand-400 font-bold">{daysUntil}</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-mono font-semibold text-white">{c.containerNumber}</div>
                      <div className="text-sm text-slate-400">
                        {c.lastStatus?.location} → {c.destinationPoint}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-300">
                        {eta.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="text-xs text-slate-500">
                        {daysUntil === 0 ? 'Сегодня' : daysUntil === 1 ? 'Завтра' : `через ${daysUntil} дн.`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <h2 className="font-semibold text-white mb-4">Детализация по статусам</h2>
          <div className="grid grid-cols-6 gap-3">
            {Object.entries(STATUS_LABELS).map(([code, label]) => {
              const count = containers.filter(c => c.lastStatus?.statusCode === code).length;
              if (count === 0) return null;
              return (
                <div key={code} className="text-center p-3 bg-slate-900/50 rounded-lg">
                  <div className="text-2xl font-bold text-white">{count}</div>
                  <div className="text-xs text-slate-400 truncate" title={label}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

