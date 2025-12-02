# Архитектура SmartSync Adaptive

## Обзор

SmartSync Adaptive построен по принципу **слоёной архитектуры** с чётким разделением ответственности между компонентами.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
│                     React + TailwindCSS + Vite                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                              REST API (JSON)
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                          APPLICATION LAYER                          │
│                     Express.js + Controllers                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                         MIDDLEWARE LAYER                            │
│        InputProcessor + Validators + Parsers + Dictionaries         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                          BUSINESS LAYER                             │
│                    Services + Generators + Exporters                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                               │
│                     Prisma ORM + PostgreSQL                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Компоненты

### 1. Presentation Layer (Frontend)

**Технологии:** React 18, TypeScript, TailwindCSS, Vite, React Query

**Структура:**
```
frontend/src/
├── pages/           # Страницы приложения
├── components/      # Переиспользуемые компоненты
├── api/             # HTTP клиент
└── types/           # TypeScript типы
```

### 2. Application Layer (Controllers)

**Технологии:** Express.js, TypeScript

**Ответственность:**
- Обработка HTTP запросов
- Валидация входных параметров
- Формирование ответов

**Файлы:**
```
backend/src/controllers/
├── ingestController.ts      # Приём данных
├── containerController.ts   # CRUD контейнеров
├── statusEventController.ts # История статусов
└── exportController.ts      # Экспорт в 1С
```

### 3. Middleware Layer (Ядро нормализации)

**Ответственность:**
- Автоматическое определение формата данных
- Парсинг и извлечение информации
- Валидация по стандартам (ISO 6346)
- Расчёт уверенности

**Компоненты:**
```
backend/src/middleware/
├── inputProcessor.ts       # Оркестратор обработки
├── formatDetector.ts       # Детектор форматов
├── universalParser.ts      # Парсер данных
├── dataValidator.ts        # Валидатор данных
├── containerValidator.ts   # ISO 6346 валидация
├── locationDictionary.ts   # Справочник локаций
└── processingLogger.ts     # Аудит-лог
```

### 4. Business Layer (Services)

**Ответственность:**
- Бизнес-логика
- Работа с данными
- Генерация отчётов

**Файлы:**
```
backend/src/services/
├── containerService.ts      # Логика контейнеров
└── statusEventService.ts    # Логика статусов

backend/src/generators/
└── clientNotificationGenerator.ts  # Генерация уведомлений

backend/src/exporters/
└── oneCExporter.ts          # Экспорт для 1С
```

### 5. Data Layer (Prisma + PostgreSQL)

**Модели:**
- `Container` — контейнеры
- `StatusEvent` — события статусов
- `RawMessage` — сырые сообщения (аудит)
- `Client` — клиенты
- `Carrier` — перевозчики

---

## Потоки данных

### Поток: Загрузка данных

```
Frontend                    Backend
   │                           │
   │  POST /api/ingest         │
   │  { content: "..." }       │
   │ ─────────────────────────►│
   │                           │
   │                    ┌──────┴──────┐
   │                    │ Controller  │
   │                    └──────┬──────┘
   │                           │
   │                    ┌──────┴──────┐
   │                    │ Middleware  │
   │                    │  Layer      │
   │                    │             │
   │                    │ 1.Detect    │
   │                    │ 2.Parse     │
   │                    │ 3.Validate  │
   │                    └──────┬──────┘
   │                           │
   │                    ┌──────┴──────┐
   │                    │ Service     │
   │                    │ (save)      │
   │                    └──────┬──────┘
   │                           │
   │                    ┌──────┴──────┐
   │                    │ Database    │
   │                    └──────┬──────┘
   │                           │
   │  { success, data,         │
   │    confidence }           │
   │ ◄─────────────────────────│
   │                           │
```

### Поток: Экспорт в 1С

```
Frontend                    Backend                    1С
   │                           │                        │
   │  GET /api/export/1c       │                        │
   │  ?format=csv              │                        │
   │ ─────────────────────────►│                        │
   │                           │                        │
   │                    ┌──────┴──────┐                 │
   │                    │ Export      │                 │
   │                    │ Service     │                 │
   │                    └──────┬──────┘                 │
   │                           │                        │
   │  CSV file                 │                        │
   │ ◄─────────────────────────│                        │
   │                           │                        │
   │─────────────────── Ручной импорт ────────────────►│
   │                           │                        │
```

---

## Принципы проектирования

### 1. Single Responsibility

Каждый модуль отвечает за одну задачу:
- `FormatDetector` — только определение формата
- `ContainerValidator` — только валидация контейнеров
- `LocationDictionary` — только работа с локациями

### 2. Open/Closed

Система открыта для расширения:
- Новые форматы добавляются через новые парсеры
- Новые статусы добавляются в enum
- Новые локации добавляются в справочник

### 3. Dependency Injection

Зависимости передаются через конструктор:
```typescript
class InputProcessor {
  constructor(
    private formatDetector: FormatDetector,
    private universalParser: UniversalParser,
    private dataValidator: DataValidator,
  ) {}
}
```

### 4. Fail-Safe

Система устойчива к ошибкам:
- Частичные данные сохраняются с предупреждениями
- Ошибки логируются, но не ломают обработку
- Всегда есть fallback для неизвестных форматов

---

## Масштабирование

### Текущее состояние

- Один инстанс backend
- Один инстанс PostgreSQL
- Подходит для ~100 запросов/сек

### Рекомендации для масштабирования

1. **Redis** — кэширование справочников
2. **Load Balancer** — распределение нагрузки
3. **Read Replicas** — для тяжёлых запросов
4. **Message Queue** — для асинхронной обработки больших файлов
