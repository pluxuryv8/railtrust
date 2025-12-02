import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  Container, 
  LayoutDashboard, 
  Terminal,
  Zap,
  Download,
  FileSpreadsheet,
  X,
  TrendingUp,
  Upload,
  ArrowDownToLine,
  Settings,
  Bell,
  Clock,
  RefreshCw,
  Eye,
  Save,
  Info,
  Server,
  Database,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { exportApi } from '../api/client';

// Глобальные настройки системы
const DEFAULT_SETTINGS = {
  staleThresholdDays: 3,
  upcomingDays: 7,
  autoRefreshMinutes: 5,
  showDelivered: true,
  notifyOverdue: true,
  notifyStale: true,
  companyName: 'Rail Trust',
  defaultExportFormat: 'csv' as 'csv' | 'json',
};

export type AppSettings = typeof DEFAULT_SETTINGS;

export default function Layout() {
  const location = useLocation();
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('appSettings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('appSettings', JSON.stringify(newSettings));
  };

  const navItems = [
    { path: '/dashboard', label: 'Дашборд', icon: TrendingUp },
    { path: '/containers', label: 'Контейнеры', icon: Container },
    { path: '/ingest', label: 'Загрузка данных', icon: ArrowDownToLine },
    { path: '/test-console', label: 'Тест-консоль', icon: Terminal },
  ];

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      if (format === 'csv') {
        const blobUrl = await exportApi.exportFor1C('csv');
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `containers_1c_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      } else {
        const data = await exportApi.exportFor1C('json');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `containers_1c_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setShowExportModal(false);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/50 border-r border-slate-800/50 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/50">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:shadow-brand-500/40 transition-shadow">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white tracking-tight">SmartSync</div>
              <div className="text-[10px] text-slate-500 tracking-widest uppercase">Rail Trust</div>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path === '/containers' && location.pathname.startsWith('/containers/'));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-brand-500/10 text-brand-400 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-brand-400' : ''}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Export button */}
        <div className="p-4 border-t border-slate-800/50">
          <button
            onClick={() => setShowExportModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Экспорт в 1С
          </button>
        </div>

        {/* Settings button */}
        <div className="p-4 border-t border-slate-800/50">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/30 hover:bg-slate-700/50 text-slate-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Settings className="w-4 h-4" />
            Настройки
          </button>
        </div>

        {/* Footer - clickable */}
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowAboutModal(true)}
            className="w-full px-4 py-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors text-left group"
          >
            <div className="flex items-center gap-2 text-xs text-slate-500 group-hover:text-slate-400">
              <LayoutDashboard className="w-4 h-4" />
              <span>Панель логиста</span>
              <Info className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-[10px] text-slate-600 group-hover:text-slate-500 mt-1">
              {settings.companyName} • v1.0.0
            </div>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        <Outlet />
      </main>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-md w-full animate-fade-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-400" />
                Экспорт для 1С
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-400 mb-4">
                Выберите формат экспорта. CSV рекомендуется для импорта в 1С.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-8 h-8 text-green-400" />
                  <span className="text-white font-medium">CSV</span>
                  <span className="text-xs text-slate-500">Для Excel / 1С</span>
                </button>
                <button
                  onClick={() => handleExport('json')}
                  disabled={exporting}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <div className="w-8 h-8 flex items-center justify-center text-blue-400 font-mono text-lg font-bold">
                    {'{ }'}
                  </div>
                  <span className="text-white font-medium">JSON</span>
                  <span className="text-xs text-slate-500">Для API / интеграций</span>
                </button>
              </div>
              {exporting && (
                <p className="text-sm text-brand-400 mt-4 text-center">
                  Подготовка файла...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-lg w-full animate-slide-up">
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-brand-400" />
                Настройки системы
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-6 max-h-[70vh] overflow-auto">
              {/* Company name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Название компании
                </label>
                <input 
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => saveSettings({ ...settings, companyName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500 transition-colors"
                  placeholder="Rail Trust"
                />
              </div>

              {/* Section: Monitoring */}
              <div>
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Мониторинг
                </h4>
                <div className="space-y-4 pl-1">
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">
                      Порог устаревания (дней без обновлений)
                    </label>
                    <input 
                      type="number"
                      min="1"
                      max="30"
                      value={settings.staleThresholdDays}
                      onChange={(e) => saveSettings({ ...settings, staleThresholdDays: parseInt(e.target.value) || 3 })}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Контейнеры без обновлений дольше этого срока будут помечены как «устаревшие»
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">
                      Горизонт прибытий (дней вперёд)
                    </label>
                    <input 
                      type="number"
                      min="1"
                      max="60"
                      value={settings.upcomingDays}
                      onChange={(e) => saveSettings({ ...settings, upcomingDays: parseInt(e.target.value) || 7 })}
                      className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      За сколько дней показывать ожидаемые прибытия на дашборде
                    </p>
                  </div>
                </div>
              </div>

              {/* Section: Auto-refresh */}
              <div>
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Автообновление
                </h4>
                <div className="pl-1">
                  <label className="block text-sm text-slate-300 mb-2">
                    Интервал обновления (минут)
                  </label>
                  <input 
                    type="number"
                    min="1"
                    max="60"
                    value={settings.autoRefreshMinutes}
                    onChange={(e) => saveSettings({ ...settings, autoRefreshMinutes: parseInt(e.target.value) || 5 })}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Данные на дашборде обновляются автоматически с указанным интервалом
                  </p>
                </div>
              </div>

              {/* Section: Display */}
              <div>
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Отображение
                </h4>
                <div className="space-y-3 pl-1">
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <div className="text-sm text-slate-300">Показывать доставленные</div>
                      <div className="text-xs text-slate-500">Учитывать доставленные контейнеры в статистике</div>
                    </div>
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
                  
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <div className="text-sm text-slate-300">Уведомления о просрочке</div>
                      <div className="text-xs text-slate-500">Выделять контейнеры с просроченным ETA</div>
                    </div>
                    <button
                      onClick={() => saveSettings({ ...settings, notifyOverdue: !settings.notifyOverdue })}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.notifyOverdue ? 'bg-brand-500' : 'bg-slate-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        settings.notifyOverdue ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Section: Export */}
              <div>
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Экспорт
                </h4>
                <div className="pl-1">
                  <label className="block text-sm text-slate-300 mb-2">
                    Формат экспорта по умолчанию
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveSettings({ ...settings, defaultExportFormat: 'csv' })}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        settings.defaultExportFormat === 'csv'
                          ? 'bg-brand-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      CSV (для 1С)
                    </button>
                    <button
                      onClick={() => saveSettings({ ...settings, defaultExportFormat: 'json' })}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        settings.defaultExportFormat === 'json'
                          ? 'bg-brand-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      JSON (для API)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-700 flex items-center justify-between">
              <button
                onClick={() => {
                  saveSettings(DEFAULT_SETTINGS);
                }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Сбросить настройки
              </button>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-6 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-md w-full animate-slide-up">
            <div className="p-6 text-center border-b border-slate-700">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/20">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">SmartSync Adaptive</h2>
              <p className="text-sm text-slate-400 mt-1">Система отслеживания контейнерных перевозок</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-brand-500/10 text-brand-400 rounded-full text-xs font-medium">
                <CheckCircle className="w-3 h-3" />
                Версия 1.0.0
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Company */}
              <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                  <LayoutDashboard className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{settings.companyName}</div>
                  <div className="text-xs text-slate-500">Панель логиста</div>
                </div>
              </div>

              {/* Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 bg-slate-800/30 rounded-lg">
                  <Server className="w-4 h-4 text-green-400" />
                  <div>
                    <div className="text-xs text-slate-500">Backend</div>
                    <div className="text-sm text-green-400">Онлайн</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-slate-800/30 rounded-lg">
                  <Database className="w-4 h-4 text-green-400" />
                  <div>
                    <div className="text-xs text-slate-500">База данных</div>
                    <div className="text-sm text-green-400">Подключена</div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="p-3 bg-slate-800/30 rounded-lg">
                <div className="text-xs text-slate-500 mb-2">Возможности системы</div>
                <div className="flex flex-wrap gap-1.5">
                  {['Автодетект форматов', 'ISO 6346', 'Экспорт 1С', 'Уведомления'].map(feature => (
                    <span key={feature} className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-xs">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* Links */}
              <div className="flex gap-2">
                <a
                  href="https://github.com/pluxuryv8/railtrust"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-lg text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  GitHub
                </a>
                <a
                  href="http://localhost:3001/api/health"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 hover:text-white rounded-lg text-sm transition-colors"
                >
                  <Server className="w-4 h-4" />
                  API Status
                </a>
              </div>
            </div>

            <div className="p-5 border-t border-slate-700">
              <button
                onClick={() => setShowAboutModal(false)}
                className="w-full px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
