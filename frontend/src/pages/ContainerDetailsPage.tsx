import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Route, 
  FileText,
  Mail,
  FileSpreadsheet,
  Keyboard,
  Zap,
  ChevronDown,
  MessageSquare,
  Copy,
  Check
} from 'lucide-react';
import { containersApi } from '../api/client';
import { SourceType, SOURCE_LABELS } from '../types';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { useState } from 'react';

const SOURCE_ICONS: Record<SourceType, React.ReactNode> = {
  EMAIL: <Mail className="w-4 h-4" />,
  EXCEL: <FileSpreadsheet className="w-4 h-4" />,
  API: <Zap className="w-4 h-4" />,
  MANUAL: <Keyboard className="w-4 h-4" />,
};

export default function ContainerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [expandedRaw, setExpandedRaw] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationText, setNotificationText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: container, isLoading, isError, error } = useQuery({
    queryKey: ['container', id],
    queryFn: () => containersApi.getContainer(id!),
    enabled: !!id,
  });

  const notificationMutation = useMutation({
    mutationFn: (format: 'short' | 'full') => containersApi.getNotification(id!, format),
    onSuccess: (data) => {
      setNotificationText(data);
      setShowNotification(true);
    },
  });

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'd MMMM yyyy', { locale: ru });
    } catch {
      return '—';
    }
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'd MMM yyyy, HH:mm', { locale: ru });
    } catch {
      return '—';
    }
  };

  const handleCopyNotification = async () => {
    if (notificationText) {
      await navigator.clipboard.writeText(notificationText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Загрузка контейнера..." />
      </div>
    );
  }

  if (isError || !container) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">Контейнер не найден</div>
          <div className="text-sm text-slate-500 mb-4">
            {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </div>
          <Link
            to="/containers"
            className="inline-flex items-center gap-2 text-brand-400 hover:text-brand-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Вернуться к списку
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800/50 bg-slate-900/30">
        <div className="px-6 py-4">
          <Link
            to="/containers"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Все контейнеры
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold font-mono text-white mb-2">
                {container.containerNumber}
              </h1>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                {container.containerType && (
                  <span>Тип: {container.containerType}</span>
                )}
                {container.clientName && (
                  <span>Клиент: {container.clientName}</span>
                )}
                {container.carrierName && (
                  <span>Перевозчик: {container.carrierName}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Generate notification button */}
              <button
                onClick={() => notificationMutation.mutate('short')}
                disabled={notificationMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <MessageSquare className="w-4 h-4" />
                {notificationMutation.isPending ? 'Генерация...' : 'Уведомление клиенту'}
              </button>
              
              {container.lastStatus && (
                <StatusBadge 
                  status={container.lastStatus.statusCode} 
                  text={container.lastStatus.statusText}
                  size="lg"
                />
              )}
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="px-6 pb-4 grid grid-cols-4 gap-4">
          <div className="bg-slate-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
              <Route className="w-4 h-4" />
              Маршрут
            </div>
            <div className="text-sm">
              <div className="text-slate-400">{container.originPoint || '—'}</div>
              <div className="text-white font-medium">→ {container.destinationPoint || '—'}</div>
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
              <MapPin className="w-4 h-4" />
              Текущая позиция
            </div>
            <div className="text-white font-medium">
              {container.lastStatus?.location || '—'}
            </div>
            {container.statusHistory[0]?.distanceToDestinationKm && (
              <div className="text-xs text-slate-500 mt-1">
                {container.statusHistory[0].distanceToDestinationKm} км до назначения
              </div>
            )}
          </div>

          <div className="bg-slate-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
              <Clock className="w-4 h-4" />
              Ожидаемое прибытие
            </div>
            <div className="text-white font-medium">
              {formatDate(container.lastStatus?.eta)}
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
              <FileText className="w-4 h-4" />
              Последнее обновление
            </div>
            <div className="text-white font-medium">
              {formatDateTime(container.lastStatus?.eventTime)}
            </div>
          </div>
        </div>
      </header>

      {/* Notification modal */}
      {showNotification && notificationText && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 max-w-lg w-full animate-fade-in">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-400" />
                Уведомление для клиента
              </h3>
              <button
                onClick={() => setShowNotification(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
                <pre className="text-sm text-slate-200 whitespace-pre-wrap font-sans">
                  {notificationText}
                </pre>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCopyNotification}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Скопировано!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Копировать текст
                    </>
                  )}
                </button>
                <button
                  onClick={() => notificationMutation.mutate('full')}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                >
                  Полный формат
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-auto p-6">
        <h2 className="text-lg font-semibold text-white mb-6">История статусов</h2>

        {container.statusHistory.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            Нет записей о статусах
          </div>
        ) : (
          <div className="space-y-0">
            {container.statusHistory.map((event, index) => (
              <div 
                key={event.id} 
                className="relative pl-12 pb-8 timeline-item animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Timeline dot */}
                <div className={`
                  absolute left-0 top-1 w-8 h-8 rounded-full flex items-center justify-center
                  ${index === 0 
                    ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' 
                    : 'bg-slate-800 text-slate-400'
                  }
                `}>
                  {SOURCE_ICONS[event.sourceType]}
                </div>

                {/* Content card */}
                <div className={`
                  bg-slate-800/30 rounded-lg border overflow-hidden
                  ${index === 0 ? 'border-brand-500/30' : 'border-slate-700/30'}
                `}>
                  {/* Header */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <StatusBadge 
                          status={event.statusCode} 
                          text={event.statusText}
                        />
                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                          <span>{formatDateTime(event.eventTime)}</span>
                          <span className="flex items-center gap-1">
                            {SOURCE_ICONS[event.sourceType]}
                            {SOURCE_LABELS[event.sourceType]}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {event.location && (
                        <div>
                          <div className="text-slate-500 mb-1">Местоположение</div>
                          <div className="text-white flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-slate-500" />
                            {event.location}
                          </div>
                        </div>
                      )}
                      {event.distanceToDestinationKm && (
                        <div>
                          <div className="text-slate-500 mb-1">До назначения</div>
                          <div className="text-white">
                            {event.distanceToDestinationKm} км
                          </div>
                        </div>
                      )}
                      {event.eta && (
                        <div>
                          <div className="text-slate-500 mb-1">ETA</div>
                          <div className="text-white">
                            {formatDate(event.eta)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Raw data toggle */}
                  {event.sourceRaw && (
                    <div className="border-t border-slate-700/30">
                      <button
                        onClick={() => setExpandedRaw(
                          expandedRaw === event.id ? null : event.id
                        )}
                        className="w-full px-4 py-2 flex items-center justify-between text-sm text-slate-400 hover:text-slate-300 hover:bg-slate-700/20 transition-colors"
                      >
                        <span>Исходные данные от оператора</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${
                          expandedRaw === event.id ? 'rotate-180' : ''
                        }`} />
                      </button>
                      {expandedRaw === event.id && (
                        <div className="px-4 pb-4">
                          <pre className="p-3 bg-slate-900/50 rounded-lg text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap font-mono">
                            {event.sourceRaw}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
