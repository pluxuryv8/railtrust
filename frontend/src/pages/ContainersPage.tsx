import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Search, 
  Filter, 
  ChevronRight, 
  MapPin, 
  Clock,
  RefreshCw,
  Container as ContainerIcon,
  AlertTriangle
} from 'lucide-react';
import { containersApi } from '../api/client';
import { StatusCode } from '../types';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import TimeAgo from '../components/TimeAgo';

const STATUS_OPTIONS: { value: StatusCode | ''; label: string }[] = [
  { value: '', label: 'Все статусы' },
  { value: 'LOADED', label: 'Загружен' },
  { value: 'IN_PORT', label: 'В порту' },
  { value: 'ON_SHIP', label: 'В пути морем' },
  { value: 'ARRIVED_PORT', label: 'Прибыл в порт' },
  { value: 'ON_WAREHOUSE', label: 'На СВХ' },
  { value: 'ON_RAIL', label: 'В пути по ЖД' },
  { value: 'DELIVERED', label: 'Доставлен' },
];

export default function ContainersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusCode | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['containers', { search, statusFilter, page }],
    queryFn: () => containersApi.getContainers({
      search: search || undefined,
      statusCode: statusFilter || undefined,
      page,
      limit: 20,
    }),
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'd MMM yyyy', { locale: ru });
    } catch {
      return '—';
    }
  };

  // Проверка, просрочен ли ETA
  const isOverdue = (eta: string | null) => {
    if (!eta) return false;
    return new Date(eta) < new Date();
  };

  // Проверка, давно ли обновлялся (> 3 дней)
  const isStale = (eventTime: string | null) => {
    if (!eventTime) return false;
    const daysSince = (Date.now() - new Date(eventTime).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 3;
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-slate-800/50 flex items-center justify-between px-6 bg-slate-900/30">
        <div className="flex items-center gap-3">
          <ContainerIcon className="w-5 h-5 text-brand-400" />
          <h1 className="text-lg font-semibold text-white">Контейнеры</h1>
          {data?.pagination && (
            <span className="text-sm text-slate-500">
              ({data.pagination.total})
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </header>

      {/* Filters */}
      <div className="p-6 border-b border-slate-800/30">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Поиск по номеру контейнера..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:border-brand-500/50 transition-colors"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusCode | '');
                setPage(1);
              }}
              className="appearance-none pl-10 pr-10 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white cursor-pointer hover:border-slate-600/50 focus:border-brand-500/50 transition-colors"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 rotate-90 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner text="Загрузка контейнеров..." />
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-red-400 mb-2">Ошибка загрузки</div>
              <div className="text-sm text-slate-500">
                {error instanceof Error ? error.message : 'Неизвестная ошибка'}
              </div>
            </div>
          </div>
        ) : !data?.data.length ? (
          <EmptyState
            title="Контейнеры не найдены"
            description={search ? 'Попробуйте изменить параметры поиска' : 'Добавьте первый контейнер'}
          />
        ) : (
          <>
            {/* Table */}
            <div className="bg-slate-900/30 rounded-xl border border-slate-800/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Контейнер</th>
                      <th>Статус</th>
                      <th>Местоположение</th>
                      <th>Маршрут</th>
                      <th>ETA</th>
                      <th>Обновлено</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((container, index) => {
                      const overdue = isOverdue(container.lastStatus?.eta || null);
                      const stale = isStale(container.lastStatus?.eventTime || null);
                      
                      return (
                        <tr 
                          key={container.id}
                          className={`animate-fade-in ${stale ? 'bg-amber-500/5' : ''}`}
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <td>
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                stale ? 'bg-amber-500/20' : 'bg-slate-800/50'
                              }`}>
                                {stale ? (
                                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                                ) : (
                                  <ContainerIcon className="w-5 h-5 text-slate-500" />
                                )}
                              </div>
                              <div>
                                <div className="font-mono font-semibold text-white">
                                  {container.containerNumber}
                                </div>
                                {container.containerType && (
                                  <div className="text-xs text-slate-500">
                                    {container.containerType}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            {container.lastStatus ? (
                              <StatusBadge 
                                status={container.lastStatus.statusCode} 
                                text={container.lastStatus.statusText}
                              />
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td>
                            {container.lastStatus?.location ? (
                              <div className="flex items-center gap-2 text-slate-300">
                                <MapPin className="w-4 h-4 text-slate-500" />
                                {container.lastStatus.location}
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td>
                            <div className="text-sm">
                              <div className="text-slate-400">
                                {container.originPoint || '?'}
                              </div>
                              <div className="text-slate-300">
                                → {container.destinationPoint || '?'}
                              </div>
                            </div>
                          </td>
                          <td>
                            {container.lastStatus?.eta ? (
                              <div className={`flex items-center gap-2 ${overdue ? 'text-red-400' : 'text-slate-300'}`}>
                                <Clock className={`w-4 h-4 ${overdue ? 'text-red-400' : 'text-slate-500'}`} />
                                <span>
                                  {formatDate(container.lastStatus.eta)}
                                  {overdue && (
                                    <span className="ml-1 text-xs">(просрочено)</span>
                                  )}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td>
                            {container.lastStatus?.eventTime ? (
                              <TimeAgo 
                                date={container.lastStatus.eventTime} 
                                className="text-sm"
                              />
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td>
                            <Link
                              to={`/containers/${container.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg transition-colors"
                            >
                              Детали
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-slate-500">
                  Страница {data.pagination.page} из {data.pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm bg-slate-800/50 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Назад
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                    disabled={page === data.pagination.totalPages}
                    className="px-4 py-2 text-sm bg-slate-800/50 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    Вперёд
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
