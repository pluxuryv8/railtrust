# SmartSync Adaptive — Полное описание системы

> Документ для внутреннего использования. Описывает архитектуру, логику работы и принципы проектирования системы.

---

## 📑 Содержание

1. [Бизнес-контекст](#1-бизнес-контекст)
2. [Общая архитектура](#2-общая-архитектура)
3. [Middleware Layer — ядро системы](#3-middleware-layer--ядро-системы)
4. [Валидация контейнеров (ISO 6346)](#4-валидация-контейнеров-iso-6346)
5. [Справочник локаций](#5-справочник-локаций)
6. [Расчёт уверенности (Confidence)](#6-расчёт-уверенности-confidence)
7. [Модель данных](#7-модель-данных)
8. [API Endpoints](#8-api-endpoints)
9. [Frontend](#9-frontend)
10. [Интеграция с 1С](#10-интеграция-с-1с)
11. [Безопасность и производительность](#11-безопасность-и-производительность)
12. [Масштабирование](#12-масштабирование)

---

## 1. Бизнес-контекст

### 1.1 Проблема

Rail Trust — логистический оператор контейнерных перевозок (море + ЖД + авто). 

**Текущий процесс:**
```
Перевозчики                    Логист                        Клиент
(50+ операторов)               Rail Trust
     │                              │                            │
     │ email с текстом              │                            │
     │ Excel таблица                │ Ручной ввод в 1С           │
     │ личный кабинет    ─────────► │ (30% рабочего времени)     │
     │ телефонный звонок            │                            │
     │                              │ Ручная отправка ─────────► │ Ожидание
     │                              │ письма клиенту             │ статуса
```

**Проблемы:**
- Логист тратит ~30% времени на копирование статусов
- Разные форматы данных от разных операторов
- Ошибки при ручном вводе (опечатки в номерах контейнеров)
- Клиенты не видят статусы в реальном времени
- Нет единой истории перемещений

### 1.2 Решение

SmartSync Adaptive — прослойка между операторами и 1С:

```
Перевозчики                SmartSync                    1С / Клиент
     │                         │                             │
     │ Любой формат            │ Нормализация                │
     │ (как удобно      ─────► │ Валидация         ─────────►│ Готовые
     │  оператору)             │ Сохранение                  │ данные
     │                         │                             │
     │                    [Middleware Layer]                 │
     │                    - FormatDetector                   │
     │                    - UniversalParser                  │
     │                    - DataValidator                    │
     │                    - ISO 6346                         │
```

---

## 2. Общая архитектура

### 2.1 Компоненты системы

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│   Панель логиста │ Загрузка данных │ Дашборд │ Экспорт в 1С   │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (Node.js)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Controllers Layer                       │  │
│  │   ingestController │ containerController │ exportController│  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    MIDDLEWARE LAYER                        │  │
│  │  InputProcessor → FormatDetector → UniversalParser        │  │
│  │       → DataValidator → ContainerValidator                 │  │
│  │       → LocationDictionary → ProcessingLogger             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Services Layer                          │  │
│  │   containerService │ statusEventService │ exportService   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Data Layer (Prisma)                     │  │
│  │   Container │ StatusEvent │ RawMessage │ Client │ Carrier │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE (PostgreSQL)                      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Поток данных

```
1. ВХОД: Логист вставляет данные в любом формате
   │
   ▼
2. FORMAT DETECTION: Система определяет тип данных
   │  - PLAIN_TEXT (email, сообщение)
   │  - JSON_OBJECT / JSON_ARRAY
   │  - CSV_TEXT
   │  - TABLE_ROW / TABLE_ROWS
   │
   ▼
3. PARSING: Извлечение структурированных данных
   │  - Номер контейнера (regex + эвристики)
   │  - Статус (словарь ключевых слов)
   │  - Локация (справочник + паттерны)
   │  - ETA, расстояние
   │
   ▼
4. VALIDATION: Проверка и нормализация
   │  - ISO 6346 для контейнеров
   │  - Справочник локаций
   │  - Логическая консистентность
   │
   ▼
5. STORAGE: Сохранение в БД
   │  - Container (если новый)
   │  - StatusEvent
   │  - RawMessage (для аудита)
   │
   ▼
6. ВЫХОД: API response с результатами + confidence
```

---

## 3. Middleware Layer — ядро системы

Middleware Layer — это сердце системы, отвечающее за преобразование "грязных" данных в чистый формат.

### 3.1 InputProcessor

**Файл:** `backend/src/middleware/inputProcessor.ts`

Главный оркестратор, координирующий работу всех компонентов.

```typescript
// Упрощённая логика
async process(input: RawInput): Promise<ProcessingResult> {
  // 1. Определяем формат
  const format = this.formatDetector.detect(input);
  
  // 2. Парсим данные
  const parsed = await this.universalParser.parse(input, format);
  
  // 3. Валидируем каждый элемент
  const normalized = [];
  for (const item of parsed.items) {
    const validation = this.dataValidator.validate(item);
    if (validation.isValid) {
      normalized.push(validation.normalized);
    }
  }
  
  // 4. Возвращаем результат с уверенностью
  return {
    success: normalized.length > 0,
    data: normalized,
    confidence: avgConfidence,
  };
}
```

### 3.2 FormatDetector

**Файл:** `backend/src/middleware/formatDetector.ts`

Автоматически определяет формат входящих данных.

```
Входные данные                      Определённый формат
──────────────────────────────────────────────────────────
"Контейнер MSKU..."           →    PLAIN_TEXT (95%)
{"containerNumber": "..."}    →    JSON_OBJECT (90%)
[{...}, {...}]                →    JSON_ARRAY/TABLE_ROWS (90%)
"col1;col2;col3\nval1;..."    →    CSV_TEXT (80%)
```

**Алгоритм детекции:**

```typescript
detect(input) {
  // 1. Массив? → TABLE_ROWS
  if (Array.isArray(input.content)) {
    return { type: 'TABLE_ROWS', confidence: 0.9 };
  }
  
  // 2. Строка начинается с { или [ ? → JSON
  if (typeof input.content === 'string') {
    if (startsWithJson(input.content)) {
      return parseAndDetect(input.content);
    }
    
    // 3. Похоже на CSV? (разделители)
    if (looksLikeCSV(input.content)) {
      return { type: 'CSV_TEXT', confidence: 0.8 };
    }
    
    // 4. Иначе — текст
    return { type: 'PLAIN_TEXT', confidence: 0.9 };
  }
  
  // 5. Объект? → JSON_OBJECT или TABLE_ROW
  if (typeof input.content === 'object') {
    return detectObjectFormat(input.content);
  }
}
```

### 3.3 UniversalParser

**Файл:** `backend/src/middleware/universalParser.ts`

Извлекает структурированные данные из любого формата.

**Для текста:**
```typescript
parseText(text) {
  // 1. Ищем номера контейнеров
  const containers = this.extractContainerNumbers(text);
  // Паттерны: XXXX1234567, XXXX 1234567, MSC01234567 (с опечаткой)
  
  // 2. Для каждого контейнера извлекаем данные
  for (const container of containers) {
    const item = {
      containerNumber: container,
      location: this.extractLocation(text),      // "ст. Гончарово"
      distance: this.extractDistance(text),       // "1857 км"
      eta: this.extractETA(text),                 // "15.12.2025"
      statusCode: this.extractStatus(text).code,  // "ON_RAIL"
    };
  }
}
```

**Извлечение локации:**
```typescript
extractLocation(text) {
  const patterns = [
    /(?:ст\.|станци[яи])\s+([А-Яа-яёЁ\-]+)/i,     // ст. Гончарово
    /(?:порт|port)\s+([А-Яа-яёЁ\-]+)/i,           // порт Владивосток
    /(?:местоположение)[:\s]+([^\d,]+)/i,          // местоположение: ...
  ];
  // Пробуем каждый паттерн
}
```

**Извлечение статуса:**
```typescript
extractStatus(text) {
  const statusMap = [
    { keywords: ['доставлен', 'delivered'], code: 'DELIVERED' },
    { keywords: ['в порту', 'in port'], code: 'IN_PORT' },
    { keywords: ['на станции', 'ст.'], code: 'ON_RAIL' },
    { keywords: ['в море', 'on ship'], code: 'ON_SHIP' },
    // ... 15+ статусов
  ];
  
  for (const status of statusMap) {
    if (status.keywords.some(kw => text.includes(kw))) {
      return { code: status.code };
    }
  }
}
```

### 3.4 DataValidator

**Файл:** `backend/src/middleware/dataValidator.ts`

Строгая валидация с расчётом уверенности.

```typescript
validate(item: ParsedItem): ValidationResult {
  let confidence = 0;
  
  // 1. Валидация контейнера (главный фактор)
  const containerValidation = validateContainerNumber(item.containerNumber);
  if (containerValidation.isValid) {
    confidence = containerValidation.confidence; // 85-100%
  }
  
  // 2. Бонусы за дополнительные данные
  if (knownStatus) confidence += 0.05;
  if (knownLocation) confidence += 0.05;
  if (dataComplete) confidence += 0.03;
  if (consistent) confidence += 0.02;
  
  // 3. Штрафы
  if (errors.length > 0) confidence *= 0.5;
  
  return {
    isValid: confidence >= 0.5,
    confidence,
    normalized: {...},
  };
}
```

---

## 4. Валидация контейнеров (ISO 6346)

### 4.1 Стандарт ISO 6346

Международный стандарт для идентификации контейнеров:

```
    M  S  C  U  1  2  3  4  5  6  0
    │  │  │  │  │  │  │  │  │  │  └── Контрольная цифра (check digit)
    │  │  │  │  └──┴──┴──┴──┴──┴───── Серийный номер (6 цифр)
    │  │  │  └───────────────────────── Код категории (U/J/Z)
    └──┴──┴──────────────────────────── Код владельца (3 буквы)
```

### 4.2 Расчёт контрольной цифры

```typescript
function calculateCheckDigit(code: string): string {
  // Таблица значений символов ISO 6346
  const values = {
    'A': 10, 'B': 12, 'C': 13, ..., 'Z': 38,
    '0': 0, '1': 1, ..., '9': 9
  };
  
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += values[code[i]] * Math.pow(2, i);
  }
  
  const remainder = sum % 11;
  return remainder === 10 ? '0' : String(remainder);
}
```

### 4.3 База BIC-кодов

```typescript
const KNOWN_OWNER_CODES = [
  'MSKU', 'MSCU', 'MAEU',           // Maersk
  'CMAU', 'CGMU',                    // CMA CGM
  'HLBU', 'HLCU', 'HLXU',           // Hapag-Lloyd
  'CSQU', 'CCLU', 'CBHU',           // COSCO
  'OOLU', 'OOCU',                    // OOCL
  'EITU', 'EGSU',                    // Evergreen
  // ... 50+ кодов
];
```

### 4.4 Автоисправление опечаток

```typescript
function fixTypos(input: string): string {
  // Первые 4 символа — буквы
  const prefix = input.slice(0, 4)
    .replace(/0/g, 'O')   // 0 → O
    .replace(/1/g, 'I')   // 1 → I
    .replace(/8/g, 'B')   // 8 → B
    .replace(/5/g, 'S');  // 5 → S
  
  // Остальное — цифры
  const suffix = input.slice(4)
    .replace(/O/g, '0')   // O → 0
    .replace(/I/g, '1')   // I → 1
    .replace(/B/g, '8')   // B → 8
    .replace(/S/g, '5');  // S → 5
  
  return prefix + suffix;
}
```

**Примеры:**
```
MSC01234560 → MSCO1234560 (исправлена буква O)
HL8U1234567 → HLBU1234567 (исправлена буква B)
00LU7654321 → OOLU7654321 (исправлены буквы OO)
```

---

## 5. Справочник локаций

### 5.1 Структура

```typescript
interface KnownLocation {
  name: string;           // "Гончарово"
  type: LocationType;     // "STATION" | "PORT" | "WAREHOUSE"
  aliases: string[];      // ["гончарово", "goncharovo"]
  region?: string;        // "Забайкальский край"
  country: string;        // "RU"
}
```

### 5.2 Категории

**ЖД станции России (20+):**
- Гончарово, Забайкальск, Наушки
- Новосибирск, Красноярск, Иркутск
- Москва, Орехово-Зуево, Ворсино

**Порты (25+):**
- Россия: Владивосток, Восточный, Находка, Новороссийск
- Китай: Шанхай, Циндао, Нинбо, Далянь, Шэньчжэнь
- Другие: Пусан, Сингапур, Роттердам, Гамбург

**СВХ:**
- Шереметьево, Домодедово, Ворсино

### 5.3 Логика поиска

```typescript
function findLocation(text: string): LocationMatchResult {
  const lowerText = text.toLowerCase();
  
  // 1. Точное совпадение по справочнику
  for (const [alias, location] of locationIndex) {
    if (lowerText.includes(alias)) {
      return { found: true, location, confidence: 0.95 };
    }
  }
  
  // 2. Паттерн "ст. X"
  const stationMatch = text.match(/ст\.\s+(\w+)/i);
  if (stationMatch) {
    // Известная станция → 95%, неизвестная → 70%
  }
  
  // 3. Паттерн "порт X"
  const portMatch = text.match(/порт\s+(\w+)/i);
  // ...
}
```

### 5.4 Консистентность статус-локация

```typescript
const STATUS_LOCATION_RULES = {
  'ON_RAIL': ['STATION'],           // На ЖД → должна быть станция
  'IN_PORT': ['PORT'],              // В порту → должен быть порт
  'ON_WAREHOUSE': ['WAREHOUSE'],    // На складе → должен быть склад
  'DELIVERED': ['CITY', 'WAREHOUSE'],
};

// При валидации проверяем соответствие
if (status === 'ON_RAIL' && locationType !== 'STATION') {
  warnings.push('Тип локации не соответствует статусу');
  consistencyScore *= 0.8;
}
```

---

## 6. Расчёт уверенности (Confidence)

### 6.1 Формула

```
CONFIDENCE = ContainerConfidence × Bonuses × Penalties

ContainerConfidence (0.85 - 1.0):
  - Базовый формат XXXX0000000:     0.85
  - + Контрольная цифра верна:      +0.10
  - + Известный владелец (BIC):     +0.05
  - + Без автоисправлений:          +0.02

Bonuses:
  - Известный статус:               +0.05
  - Локация из справочника:         +0.05
  - Полнота данных > 50%:           +0.03
  - Логическая консистентность:     +0.02

Penalties:
  - Есть ошибки:                    ×0.5
  - Много предупреждений (>3):      ×0.95
```

### 6.2 Примеры

**Идеальный случай:**
```
Вход: "MSCU1234560 на станции Гончарово"

ContainerConfidence:
  - Формат OK:           0.85
  - Check digit OK:      +0.10 = 0.95
  - Known owner (MSCU):  +0.05 = 1.00
  - No corrections:      +0.02 = 1.02 → cap to 1.0

Bonuses:
  - Status ON_RAIL:      +0.05 = 1.05
  - Location known:      +0.05 = 1.10 → cap to 1.0

ИТОГО: 100%
```

**Случай с опечаткой:**
```
Вход: "MSC01234560 доставлен"

ContainerConfidence:
  - Формат OK (после исправления): 0.85
  - Check digit FAIL:    +0.00 = 0.85
  - Known owner:         +0.05 = 0.90
  - Had corrections:     +0.00 = 0.90

Bonuses:
  - Status DELIVERED:    +0.05 = 0.95

Penalties:
  - Warnings (2):        none

ИТОГО: 95%
```

---

## 7. Модель данных

### 7.1 Prisma Schema

```prisma
model Container {
  id               String        @id @default(cuid())
  containerNumber  String        @unique  // MSKU1234567
  containerType    String?                // 20, 40, 45
  originPoint      String?                // Шанхай
  destinationPoint String?                // Москва
  clientId         String?
  carrierId        String?
  statusEvents     StatusEvent[]
}

model StatusEvent {
  id                      String     @id @default(cuid())
  containerId             String
  statusCode              StatusCode // ON_RAIL, IN_PORT, ...
  statusText              String     // "На станции Гончарово"
  location                String?    
  distanceToDestinationKm Int?
  eta                     DateTime?
  eventTime               DateTime
  sourceType              SourceType // EMAIL, EXCEL, API
  sourceRaw               String?    @db.Text
  rawMessageId            String?
}

model RawMessage {
  id           String     @id @default(cuid())
  sourceType   SourceType
  content      String     @db.Text
  senderEmail  String?
  processed    Boolean    @default(false)
  errorMessage String?
  statusEvents StatusEvent[]
}
```

### 7.2 Связи

```
Container 1 ←──────→ N StatusEvent
     │                     │
     │                     │
     ▼                     ▼
  Client              RawMessage
  Carrier
```

---

## 8. API Endpoints

### 8.1 Ingest API

```http
POST /api/ingest
Content-Type: application/json

{
  "content": <any>,
  "hint": "text" | "json" | "csv"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processed": 2,
    "failed": 0,
    "events": [
      {
        "id": "...",
        "container": { "containerNumber": "MSKU1234567" },
        "statusCode": "ON_RAIL",
        "location": "Гончарово"
      }
    ]
  },
  "confidence": 0.98,
  "processing": {
    "format": { "type": "PLAIN_TEXT", "confidence": 0.9 }
  }
}
```

### 8.2 Containers API

```http
GET /api/containers
GET /api/containers/:id
GET /api/containers/:id/notification?format=short|full
```

### 8.3 Export API

```http
GET /api/export/1c?format=json|csv
```

---

## 9. Frontend

### 9.1 Страницы

| Путь | Компонент | Описание |
|------|-----------|----------|
| `/dashboard` | DashboardPage | Обзор, метрики |
| `/containers` | ContainersPage | Список контейнеров |
| `/containers/:id` | ContainerDetailsPage | Детали + история |
| `/ingest` | IngestPage | Загрузка данных |

### 9.2 Технологии

- **React 18** — UI library
- **React Router 6** — Маршрутизация
- **React Query** — Кэширование и запросы
- **TailwindCSS** — Стилизация
- **Lucide Icons** — Иконки

---

## 10. Интеграция с 1С

### 10.1 Экспорт CSV

```http
GET /api/export/1c?format=csv
```

**Структура файла:**
```csv
Номер КТК;Тип КТК;Состояние;Пункт отправления;Пункт назначения;Отгружен в море;Прибыл в порт;Отгружен на ЖД;Текущее местоположение;Расстояние до назначения;Ориентировочная дата прибытия
MSKU1234567;40;В пути по ЖД;Шанхай;Москва;15.10.2025;28.10.2025;01.11.2025;ст. Гончарово;1857;04.12.2025
```

### 10.2 Маппинг полей

| 1С поле | StatusEvent поле |
|---------|------------------|
| Номер КТК | container.containerNumber |
| Состояние | statusText |
| Текущее местоположение | location |
| Расстояние до назначения | distanceToDestinationKm |
| Ориентировочная дата прибытия | eta |

---

## 11. Безопасность и производительность

### 11.1 Валидация входных данных

- Все входные строки sanitize (XSS protection)
- Ограничение длины полей (max 500 символов)
- Проверка формата дат и чисел

### 11.2 Rate Limiting

```typescript
// TODO: Добавить в production
app.use('/api/ingest', rateLimit({
  windowMs: 60 * 1000,  // 1 минута
  max: 100,             // 100 запросов
}));
```

### 11.3 Производительность

- Индексы в БД на containerNumber, eventTime
- Пагинация для списков
- Кэширование справочников в памяти

---

## 12. Масштабирование

### 12.1 Горизонтальное масштабирование

```
                 Load Balancer
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   Backend #1    Backend #2    Backend #3
        │             │             │
        └─────────────┼─────────────┘
                      │
                 PostgreSQL
                 (Primary)
                      │
              ┌───────┴───────┐
              │               │
           Replica #1     Replica #2
           (Read)         (Read)
```

### 12.2 Будущие улучшения

- **Redis** — кэширование и очереди
- **Elasticsearch** — полнотекстовый поиск
- **Kafka** — обработка потоков данных
- **LLM API** — умный парсинг сложных текстов

---

## 📞 Контакты

**Разработка:** SmartSync Team  
**Заказчик:** Rail Trust  
**Версия документа:** 1.0  
**Дата:** Декабрь 2025

