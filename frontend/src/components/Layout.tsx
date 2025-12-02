import { useState } from 'react';
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
  ArrowDownToLine
} from 'lucide-react';
import { exportApi } from '../api/client';

export default function Layout() {
  const location = useLocation();
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

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

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/50">
          <div className="px-4 py-3 rounded-lg bg-slate-800/30">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <LayoutDashboard className="w-4 h-4" />
              <span>Панель логиста</span>
            </div>
          </div>
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
    </div>
  );
}
