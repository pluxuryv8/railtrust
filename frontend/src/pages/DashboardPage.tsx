import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Container, 
  Ship, 
  Train, 
  Package,
  TrendingUp,
  Clock,
  MapPin,
  AlertCircle,
  Settings,
  X,
  RefreshCw,
  Download,
  Bell,
  CheckCircle,
  Activity
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

// Настройки по умолчанию
const DEFAULT_SETTINGS = {
  staleThresholdDays: 3,
  upcomingDays: 7,
  autoRefreshMinutes: 5,
  showDelivered: true,
  notifyOverdue: true,
  notifyStale: true,
};

export default function DashboardPage() {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('dashboardSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['containers', { limit: 200 }],
    queryFn: () => containersApi.getContainers({ limit: 200 }),
    refetchInterval: settings.autoRefreshMinutes * 60 * 1000,
  });

  const saveSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem('dashboardSettings', JSON.stringify(newSettings));
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Загрузка статистики..." />
      </div>
    );
  }

  const containers = data?.data || [];
  const activeContainers = settings.showDelivered 
    ? containers 
    : containers.filter(c => c.lastStatus?.statusCode !== 'DELIVERED');
  
  // Подсчёт по группам
  const groupCounts = Object.entries(STATUS_GROUPS).map(([group, statuses]) => {
    const count = activeContainers.filter(c => 
      c.lastStatus && statuses.includes(c.lastStatus.statusCode)
    ).length;
    return { group, count };
  });

  // Контейнеры с просроченным ETA
  const overdueContainers = activeContainers.filter(c => {
    if (!c.lastStatus?.eta) return false;
    if (c.lastStatus.statusCode === 'DELIVERED') return false;
    return new Date(c.lastStatus.eta) < new Date();
  });

  // Контейнеры без обновлений
  const staleContainers = activeContainers.filter(c => {
    if (!c.lastStatus?.eventTime) return false;
    if (c.lastStatus.statusCode === 'DELIVERED') return false;
    const daysSinceUpdate = (Date.now() - new Date(c.lastStatus.eventTime).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > settings.staleThresholdDays;
  });

  // Ближайшие прибытия
  const upcomingArrivals = activeContainers
    .filter(c => {
      if (!c.lastStatus?.eta) return false;
      if (c.lastStatus.statusCode === 'DELIVERED') return false;
      const eta = new Date(c.lastStatus.eta);
      const now = new Date();
      const futureDate = new Date(now.getTime() + settings.upcomingDays * 24 * 60 * 60 * 1000);
      return eta >= now && eta <= futureDate;
    })
    .sort((a, b) => 
      new Date(a.lastStatus!.eta!).getTime() - new Date(b.lastStatus!.eta!).getTime()
    )
    .slice(0, 8);

  // Статистика за сегодня
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayUpdates = containers.filter(c => 
    c.lastStatus?.eventTime && new Date(c.lastStatus.eventTime) >= todayStart
  ).length;

  // Прогресс доставки (% доставленных от общего)
  const deliveredCount = containers.filter(c => c.lastStatus?.statusCode === 'DELIVERED').length;
  const deliveryProgress = containers.length > 0 ? Math.round((deliveredCount / containers.length) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {/* Header */}
      <header className="h-16 border-b border-slate-800/50 flex items-center px-6 bg-slate-900/30">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-brand-400" />
          <h1 className="text-lg font-semibold text-white">Дашборд</h1>
        </div>
        
        <div className="ml-auto flex items-center gap-3">
          {/* Last update */}
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Обновлено: {new Date(dataUpdatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
          
          {/* Refresh button */}
          <button 
            onClick={() => refetch()}
            className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition-colors"
            title="Обновить данные"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          {/* Export button */}
          <a 
            href="http://localhost:3001/api/export/1c?format=csv"
            download
            className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition-colors"
            title="Экспорт в 1С"
          >
            <Download className="w-4 h-4" />
          </a>
          
          {/* Settings button */}
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-400 hover:text-white transition-colors"
            title="Настройки"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* Quick stats row */}
        <div className="grid grid-cols-5 gap-4">
          {/* Summary cards */}
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
          
          {/* Today's updates */}
          <div 
            className="relative overflow-hidden bg-slate-800/30 rounded-xl border border-slate-700/50 p-5 animate-fade-in"
            style={{ animationDelay: `400ms` }}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-500 to-purple-500 opacity-10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mb-3">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{todayUpdates}</div>
              <div className="text-sm text-slate-400">Обновлено сегодня</div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="font-semibold text-white">Общий прогресс доставки</span>
            </div>
            <span className="text-2xl font-bold text-green-400">{deliveryProgress}%</span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-1000"
              style={{ width: `${deliveryProgress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-slate-500">
            <span>Всего: {containers.length} контейнеров</span>
            <span>Доставлено: {deliveredCount}</span>
          </div>
        </div>

        {/* Alerts row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Overdue */}
          <div className={`bg-slate-800/30 rounded-xl border p-5 ${
            overdueContainers.length > 0 ? 'border-red-500/50' : 'border-slate-700/50'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className={`w-5 h-5 ${overdueContainers.length > 0 ? 'text-red-400' : 'text-slate-500'}`} />
              <h2 className="font-semibold text-white">Просроченные ETA</h2>
              <span className={`ml-auto px-2 py-0.5 rounded text-sm ${
                overdueContainers.length > 0 
                  ? 'bg-red-500/20 text-red-400' 
                  : 'bg-slate-700/50 text-slate-500'
              }`}>
                {overdueContainers.length}
              </span>
            </div>
            {overdueContainers.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Нет просроченных контейнеров
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-auto">
                {overdueContainers.slice(0, 8).map(c => {
                  const daysOverdue = Math.ceil((Date.now() - new Date(c.lastStatus!.eta!).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={c.id} className="flex items-center justify-between text-sm p-2 bg-red-500/5 rounded-lg">
                      <span className="font-mono text-slate-300">{c.containerNumber}</span>
                      <span className="text-red-400">
                        +{daysOverdue} дн.
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stale updates */}
          <div className={`bg-slate-800/30 rounded-xl border p-5 ${
            staleContainers.length > 0 ? 'border-amber-500/50' : 'border-slate-700/50'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              <Clock className={`w-5 h-5 ${staleContainers.length > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
              <h2 className="font-semibold text-white">Нет обновлений {'>'} {settings.staleThresholdDays} дней</h2>
              <span className={`ml-auto px-2 py-0.5 rounded text-sm ${
                staleContainers.length > 0 
                  ? 'bg-amber-500/20 text-amber-400' 
                  : 'bg-slate-700/50 text-slate-500'
              }`}>
                {staleContainers.length}
              </span>
            </div>
            {staleContainers.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Все контейнеры актуальны
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-auto">
                {staleContainers.slice(0, 8).map(c => {
                  const daysSince = Math.floor((Date.now() - new Date(c.lastStatus!.eventTime).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={c.id} className="flex items-center justify-between text-sm p-2 bg-amber-500/5 rounded-lg">
                      <span className="font-mono text-slate-300">{c.containerNumber}</span>
                      <span className="text-amber-400">
                        {daysSince} дн. назад
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming arrivals */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-brand-400" />
            <h2 className="font-semibold text-white">Ближайшие прибытия ({settings.upcomingDays} дней)</h2>
            <span className="ml-auto px-2 py-0.5 bg-brand-500/20 text-brand-400 rounded text-sm">
              {upcomingArrivals.length}
            </span>
          </div>
          {upcomingArrivals.length === 0 ? (
            <p className="text-sm text-slate-500">Нет ожидаемых прибытий на ближайшие {settings.upcomingDays} дней</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {upcomingArrivals.map((c, index) => {
                const eta = new Date(c.lastStatus!.eta!);
                const daysUntil = Math.ceil((eta.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div 
                    key={c.id} 
                    className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-lg animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      daysUntil <= 1 
                        ? 'bg-green-500/20 text-green-400' 
                        : daysUntil <= 3 
                          ? 'bg-brand-500/20 text-brand-400'
                          : 'bg-slate-700/50 text-slate-400'
                    }`}>
                      <span className="font-bold text-lg">{daysUntil}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-semibold text-white truncate">{c.containerNumber}</div>
                      <div className="text-sm text-slate-400 truncate">
                        {c.lastStatus?.location || '—'} → {c.destinationPoint || '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-slate-300">
                        {eta.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </div>
                      <div className="text-xs text-slate-500">
                        {daysUntil === 0 ? 'Сегодня' : daysUntil === 1 ? 'Завтра' : `${daysUntil} дн.`}
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
          <div className="grid grid-cols-7 gap-3">
            {Object.entries(STATUS_LABELS).map(([code, label]) => {
              const count = containers.filter(c => c.lastStatus?.statusCode === code).length;
              if (count === 0) return null;
              return (
                <div key={code} className="text-center p-3 bg-slate-900/50 rounded-lg hover:bg-slate-800/50 transition-colors">
                  <div className="text-2xl font-bold text-white">{count}</div>
                  <div className="text-xs text-slate-400 truncate" title={label}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand-400" />
                Настройки дашборда
              </h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-5">
              {/* Stale threshold */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Порог устаревания (дней без обновлений)
                </label>
                <input 
                  type="number"
                  min="1"
                  max="30"
                  value={settings.staleThresholdDays}
                  onChange={(e) => saveSettings({ ...settings, staleThresholdDays: parseInt(e.target.value) || 3 })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              
              {/* Upcoming days */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Горизонт прибытий (дней вперёд)
                </label>
                <input 
                  type="number"
                  min="1"
                  max="30"
                  value={settings.upcomingDays}
                  onChange={(e) => saveSettings({ ...settings, upcomingDays: parseInt(e.target.value) || 7 })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              
              {/* Auto refresh */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Автообновление (минут)
                </label>
                <input 
                  type="number"
                  min="1"
                  max="60"
                  value={settings.autoRefreshMinutes}
                  onChange={(e) => saveSettings({ ...settings, autoRefreshMinutes: parseInt(e.target.value) || 5 })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              
              {/* Show delivered */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">
                  Показывать доставленные
                </label>
                <button
                  onClick={() => saveSettings({ ...settings, showDelivered: !settings.showDelivered })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.showDelivered ? 'bg-brand-500' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    settings.showDelivered ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-700">
              <button
                onClick={() => {
                  saveSettings(DEFAULT_SETTINGS);
                }}
                className="w-full px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Сбросить настройки по умолчанию
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
