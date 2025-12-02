import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:3001/api';

interface ProcessingResult {
  success: boolean;
  message?: string;
  data?: {
    processed: number;
    failed: number;
    events?: Array<{
      id: string;
      statusCode: string;
      statusText: string;
      location: string | null;
      container: {
        id: string;
        containerNumber: string;
      };
    }>;
    warnings?: string[];
  };
  processing?: {
    format: {
      type: string;
      confidence: number;
      details: {
        hasContainerNumber: boolean;
        hasStatusInfo: boolean;
        hasDateInfo: boolean;
        hasLocationInfo: boolean;
        language: string;
        estimatedRowCount: number;
      };
    };
    confidence: number;
  };
  errors?: Array<{ error: string; data?: unknown }> | string[];
  error?: string;
  details?: string[];
}

type ProcessingStep = 'idle' | 'analyzing' | 'parsing' | 'saving' | 'done' | 'error';

const STEP_MESSAGES: Record<ProcessingStep, string> = {
  idle: 'Готов к приёму данных',
  analyzing: 'Анализирую формат данных...',
  parsing: 'Извлекаю информацию о контейнерах...',
  saving: 'Сохраняю в базу данных...',
  done: 'Готово!',
  error: 'Ошибка обработки',
};

export default function IngestPage() {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const processData = useCallback(async (data: string): Promise<ProcessingResult> => {
    // Пробуем определить, это JSON или нет
    let parsedContent: unknown = data;
    
    try {
      // Пробуем распарсить как JSON
      const trimmed = data.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        parsedContent = JSON.parse(trimmed);
      }
    } catch {
      // Не JSON - оставляем как строку
    }

    // Отправляем на универсальный endpoint
    const response = await axios.post<ProcessingResult>(`${API_URL}/ingest`, {
      content: parsedContent,
    });
    
    return response.data;
  }, []);

  const ingestMutation = useMutation({
    mutationFn: processData,
    onMutate: () => {
      setStep('analyzing');
      setResult(null);
    },
    onSuccess: (data) => {
      if (data.success) {
        setStep('done');
      } else {
        setStep('error');
      }
      setResult(data);
    },
    onError: (error: unknown) => {
      setStep('error');
      if (axios.isAxiosError(error) && error.response?.data) {
        setResult(error.response.data as ProcessingResult);
      } else {
        setResult({
          success: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        });
      }
    },
  });

  // Симуляция шагов для UX
  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    setStep('analyzing');
    await new Promise(r => setTimeout(r, 300));
    
    setStep('parsing');
    await new Promise(r => setTimeout(r, 200));
    
    setStep('saving');
    ingestMutation.mutate(content);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Автоматически обрабатываем вставку
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      setContent(pastedText);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const text = e.dataTransfer.getData('text');
    if (text) {
      setContent(text);
    }
  };

  const handleReset = () => {
    setContent('');
    setResult(null);
    setStep('idle');
  };

  const isProcessing = step === 'analyzing' || step === 'parsing' || step === 'saving';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            Загрузка данных
          </h1>
          <p className="text-slate-400">
            Вставьте любые данные о контейнерах — система автоматически их обработает
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Main Input Area */}
        <div 
          className={`
            relative rounded-2xl border-2 border-dashed transition-all duration-300
            ${dragOver 
              ? 'border-brand-500 bg-brand-500/10' 
              : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
            }
            ${step === 'done' ? 'border-emerald-500/50' : ''}
            ${step === 'error' ? 'border-red-500/50' : ''}
          `}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 relative">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
                </div>
                <p className="text-lg font-medium text-white">{STEP_MESSAGES[step]}</p>
              </div>
            </div>
          )}

          <div className="p-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Данные о контейнерах
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              placeholder={`Вставьте сюда данные в любом формате:

• Текст письма от оператора
• Таблицу из Excel (Ctrl+C → Ctrl+V)
• JSON данные
• CSV строки
• Список контейнеров с информацией

Примеры:
─────────────────────────────────
Контейнер MSKU1234567 на станции Гончарово, 1857 км до Иня-Восточная
─────────────────────────────────
ABCD1234567;ON_RAIL;Новосибирск;2800
EFGH7654321;IN_PORT;Владивосток;0
─────────────────────────────────
[{"containerNumber": "IJKL9999999", "status": "ON_SHIP"}]`}
              rows={14}
              disabled={isProcessing}
              className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl px-4 py-3 text-sm font-mono text-slate-200 placeholder:text-slate-600 focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none disabled:opacity-50"
            />
          </div>

          {/* Stats bar */}
          {content && (
            <div className="px-6 pb-4 flex items-center gap-4 text-xs text-slate-500">
              <span>{content.length} символов</span>
              <span>{content.split('\n').filter(l => l.trim()).length} строк</span>
              {content.match(/[A-Z]{4}\d{6,7}/gi)?.length && (
                <span className="text-brand-400">
                  ~{content.match(/[A-Z]{4}\d{6,7}/gi)?.length} контейнеров найдено
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !content.trim()}
            className="flex-1 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 text-lg shadow-lg shadow-brand-500/25 disabled:shadow-none"
          >
            {isProcessing ? (
              <>
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                Обработка...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Загрузить в систему
              </>
            )}
          </button>
          
          {content && (
            <button
              onClick={handleReset}
              disabled={isProcessing}
              className="px-6 py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl transition-colors"
            >
              Очистить
            </button>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className={`mt-8 rounded-2xl border p-6 animate-fade-in ${
            result.success 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-red-500/10 border-red-500/30'
          }`}>
            <div className="flex items-start gap-4">
              {result.success ? (
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              )}
              
              <div className="flex-1">
                <h3 className={`text-xl font-semibold mb-2 ${result.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.success ? 'Данные успешно загружены!' : 'Не удалось обработать данные'}
                </h3>
                
                {result.success && result.data && (
                  <div className="space-y-4">
                    <p className="text-slate-300">
                      Обработано <span className="font-bold text-white">{result.data.processed}</span> контейнеров
                      {result.data.failed > 0 && (
                        <span className="text-amber-400 ml-2">({result.data.failed} с ошибками)</span>
                      )}
                    </p>
                    
                    {/* Processed containers */}
                    {result.data.events && result.data.events.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-400">Загруженные контейнеры:</p>
                        <div className="grid gap-2">
                          {result.data.events.slice(0, 10).map((event) => (
                            <button
                              key={event.id}
                              onClick={() => navigate(`/containers/${event.container.id}`)}
                              className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl hover:bg-slate-800/50 transition-colors text-left"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-sm font-semibold text-brand-400">
                                  {event.container.containerNumber}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-lg bg-slate-700 text-slate-300">
                                  {event.statusText}
                                </span>
                              </div>
                              {event.location && (
                                <span className="text-sm text-slate-500">{event.location}</span>
                              )}
                            </button>
                          ))}
                          {result.data.events.length > 10 && (
                            <p className="text-sm text-slate-500 text-center py-2">
                              ... и ещё {result.data.events.length - 10}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => navigate('/containers')}
                        className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Открыть список контейнеров
                      </button>
                      <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Загрузить ещё
                      </button>
                    </div>
                  </div>
                )}

                {!result.success && (
                  <div className="space-y-3">
                    <p className="text-slate-400">
                      {result.error || 'Проверьте формат данных и попробуйте снова'}
                    </p>
                    
                    {result.errors && result.errors.length > 0 && (
                      <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                        <p className="text-xs font-semibold text-red-400 mb-2">Детали ошибок:</p>
                        <ul className="text-xs text-slate-400 space-y-1">
                          {(result.errors as Array<{ error?: string } | string>).slice(0, 5).map((err, i) => (
                            <li key={i}>• {typeof err === 'string' ? err : err.error || JSON.stringify(err)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.details && result.details.length > 0 && (
                      <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                        <ul className="text-xs text-slate-400 space-y-1">
                          {result.details.map((detail, i) => (
                            <li key={i}>• {detail}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={handleReset}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Попробовать снова
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Processing details */}
            {result.processing && (
              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 mb-3">Детали обработки:</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs">
                    Формат: {result.processing.format.type}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-400 text-xs">
                    Уверенность: {Math.round(result.processing.confidence * 100)}%
                  </span>
                  {result.processing.format.details.hasContainerNumber && (
                    <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs">✓ Номера контейнеров</span>
                  )}
                  {result.processing.format.details.hasStatusInfo && (
                    <span className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs">✓ Статусы</span>
                  )}
                  {result.processing.format.details.hasLocationInfo && (
                    <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs">✓ Локации</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Help section */}
        {!result && (
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900/30 rounded-xl border border-slate-800/30 p-5">
              <div className="text-3xl mb-3">📧</div>
              <h3 className="font-semibold text-white mb-2">Текст из писем</h3>
              <p className="text-sm text-slate-500">
                Скопируйте текст письма от оператора — система найдёт номера контейнеров и статусы
              </p>
            </div>
            
            <div className="bg-slate-900/30 rounded-xl border border-slate-800/30 p-5">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-semibold text-white mb-2">Таблицы Excel/1С</h3>
              <p className="text-sm text-slate-500">
                Выделите ячейки в Excel и вставьте (Ctrl+V) — данные автоматически распознаются
              </p>
            </div>
            
            <div className="bg-slate-900/30 rounded-xl border border-slate-800/30 p-5">
              <div className="text-3xl mb-3">🔄</div>
              <h3 className="font-semibold text-white mb-2">Любой формат</h3>
              <p className="text-sm text-slate-500">
                JSON, CSV, просто список — система сама определит структуру данных
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
