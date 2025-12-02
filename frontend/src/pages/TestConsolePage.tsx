import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  Terminal, 
  Mail, 
  FileSpreadsheet, 
  Send, 
  CheckCircle, 
  XCircle,
  Copy,
  RefreshCw
} from 'lucide-react';
import { rawDataApi } from '../api/client';

// Примеры данных для тестирования
const EMAIL_EXAMPLES = [
  {
    name: 'ЖД статус (Красноярск)',
    data: {
      body: 'Контейнер DEMO1234567 прибыл на станцию Красноярск.\nРасстояние до станции назначения Москва-Товарная: 4100 км.\nОжидаемая дата прибытия: 15.12.2025',
      subject: 'Статус DEMO1234567',
      senderEmail: 'tracking@rzd.ru'
    }
  },
  {
    name: 'Порт прибытия',
    data: {
      body: 'Container SHIP9876543 arrived at Vladivostok port.\nETA to final destination: 20.12.2025\nStatus: Awaiting customs clearance',
      subject: 'Arrival notification',
      senderEmail: 'port@vostok.ru'
    }
  },
  {
    name: 'Доставка завершена',
    data: {
      body: 'Контейнер DONE1111111 успешно доставлен на склад получателя.\nАдрес: Москва, ул. Промышленная, 15\nВремя: 10:30',
      subject: 'Доставка завершена',
      senderEmail: 'delivery@trans.ru'
    }
  }
];

const TABLE_EXAMPLES = [
  {
    name: 'В море',
    data: {
      containerNumber: 'TABL2222222',
      containerType: '40',
      state: 'Отгружен / в пути море',
      from: 'SHANGHAI, CHINA',
      to: 'Москва',
      shippedToSea: '01.12.2025',
      eta: '25.12.2025'
    }
  },
  {
    name: 'На СВХ',
    data: {
      containerNumber: 'WARE3333333',
      containerType: '20/24',
      state: 'Размещен на СВХ',
      from: 'BUSAN, KOREA',
      to: 'Екатеринбург',
      arrivedPort: '28.11.2025',
      onWarehouse: '29.11.2025',
      currentLocation: 'СВХ Владивосток',
      eta: '10.12.2025'
    }
  },
  {
    name: 'Отгружен на ЖД',
    data: {
      containerNumber: 'RAIL4444444',
      containerType: '40',
      state: 'Отгружен / в пути по ЖД',
      from: 'NINGBO, CHINA',
      to: 'Новосибирск',
      shippedOnRail: '02.12.2025',
      currentLocation: 'ст. Владивосток',
      distanceToDestination: '5800',
      eta: '12.12.2025'
    }
  }
];

export default function TestConsolePage() {
  const [activeTab, setActiveTab] = useState<'email' | 'table'>('email');
  const [emailInput, setEmailInput] = useState(JSON.stringify(EMAIL_EXAMPLES[0].data, null, 2));
  const [tableInput, setTableInput] = useState(JSON.stringify(TABLE_EXAMPLES[0].data, null, 2));
  const [result, setResult] = useState<any>(null);

  const emailMutation = useMutation({
    mutationFn: (data: { body: string; subject?: string; senderEmail?: string }) => 
      rawDataApi.processOperatorEmail(data.body, data.subject, data.senderEmail),
    onSuccess: (data) => setResult(data),
    onError: (error) => setResult({ error: error.message }),
  });

  const tableMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => rawDataApi.processTableRow(data),
    onSuccess: (data) => setResult(data),
    onError: (error) => setResult({ error: error.message }),
  });

  const handleSubmit = () => {
    setResult(null);
    try {
      if (activeTab === 'email') {
        const data = JSON.parse(emailInput);
        emailMutation.mutate(data);
      } else {
        const data = JSON.parse(tableInput);
        tableMutation.mutate(data);
      }
    } catch (e) {
      setResult({ error: 'Invalid JSON format' });
    }
  };

  const loadExample = (example: typeof EMAIL_EXAMPLES[0] | typeof TABLE_EXAMPLES[0]) => {
    if (activeTab === 'email') {
      setEmailInput(JSON.stringify(example.data, null, 2));
    } else {
      setTableInput(JSON.stringify(example.data, null, 2));
    }
    setResult(null);
  };

  const isPending = emailMutation.isPending || tableMutation.isPending;
  const examples = activeTab === 'email' ? EMAIL_EXAMPLES : TABLE_EXAMPLES;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-slate-800/50 flex items-center px-6 bg-slate-900/30">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-brand-400" />
          <h1 className="text-lg font-semibold text-white">Тестовая консоль</h1>
        </div>
        <p className="ml-4 text-sm text-slate-500">
          Демонстрация работы нормализаторов
        </p>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Input panel */}
        <div className="w-1/2 border-r border-slate-800/50 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-800/50">
            <button
              onClick={() => { setActiveTab('email'); setResult(null); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'email' 
                  ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-500/5' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Mail className="w-4 h-4" />
              Email от оператора
            </button>
            <button
              onClick={() => { setActiveTab('table'); setResult(null); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'table' 
                  ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-500/5' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Табличные данные
            </button>
          </div>

          {/* Examples */}
          <div className="p-4 border-b border-slate-800/50">
            <div className="text-xs text-slate-500 mb-2">Примеры:</div>
            <div className="flex flex-wrap gap-2">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => loadExample(ex)}
                  className="px-3 py-1.5 text-xs bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg transition-colors"
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 p-4">
            <textarea
              value={activeTab === 'email' ? emailInput : tableInput}
              onChange={(e) => activeTab === 'email' ? setEmailInput(e.target.value) : setTableInput(e.target.value)}
              className="w-full h-full p-4 bg-slate-900/50 border border-slate-700/50 rounded-lg font-mono text-sm text-slate-200 resize-none focus:border-brand-500/50 focus:outline-none"
              placeholder="Введите JSON данные..."
            />
          </div>

          {/* Submit button */}
          <div className="p-4 border-t border-slate-800/50">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Обработка...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Отправить на нормализацию
                </>
              )}
            </button>
          </div>
        </div>

        {/* Result panel */}
        <div className="w-1/2 flex flex-col bg-slate-900/20">
          <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
            <h2 className="font-semibold text-white">Результат нормализации</h2>
            {result && (
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"
              >
                <Copy className="w-4 h-4" />
                Копировать
              </button>
            )}
          </div>

          <div className="flex-1 p-4 overflow-auto">
            {!result ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                <p>Отправьте данные для просмотра результата</p>
              </div>
            ) : result.error ? (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-red-400 mb-2">
                  <XCircle className="w-5 h-5" />
                  <span className="font-semibold">Ошибка</span>
                </div>
                <pre className="text-sm text-red-300 whitespace-pre-wrap">
                  {result.error}
                </pre>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Успешно нормализовано</span>
                </div>

                {result.data && (
                  <div className="grid gap-3">
                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-xs text-slate-500 mb-1">Контейнер</div>
                      <div className="font-mono font-semibold text-white">
                        {result.data.containerNumber}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">Статус код</div>
                        <div className="font-semibold text-brand-400">
                          {result.data.statusCode}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">Статус текст</div>
                        <div className="text-white">
                          {result.data.statusText}
                        </div>
                      </div>
                    </div>

                    {result.data.location && (
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">Локация</div>
                        <div className="text-white">{result.data.location}</div>
                      </div>
                    )}

                    {result.data.distanceToDestinationKm && (
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">Расстояние до назначения</div>
                        <div className="text-white">{result.data.distanceToDestinationKm} км</div>
                      </div>
                    )}

                    {result.data.eta && (
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">ETA</div>
                        <div className="text-white">
                          {new Date(result.data.eta).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-slate-800/50 rounded-lg">
                      <div className="text-xs text-slate-500 mb-1">Источник</div>
                      <div className="text-white">{result.data.sourceType}</div>
                    </div>
                  </div>
                )}

                <details className="mt-4">
                  <summary className="text-sm text-slate-400 cursor-pointer hover:text-white">
                    Полный JSON ответ
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-900/50 rounded-lg text-xs text-slate-400 overflow-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

