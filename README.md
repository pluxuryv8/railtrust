# SmartSync Adaptive

<div align="center">

![SmartSync](https://img.shields.io/badge/SmartSync-Adaptive-0c8ee9?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEzIDEwVjNMNCAxNGg3djdsMTAtMTFoLTh6Ii8+PC9zdmc+)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![License](https://img.shields.io/badge/license-Proprietary-red?style=for-the-badge)

**Интеллектуальная система нормализации и отслеживания контейнерных перевозок**

[Быстрый старт](#-быстрый-старт) • [Архитектура](#-архитектура) • [API](#-api-reference) • [Документация](#-документация)

</div>

---

## 📋 О проекте

**SmartSync Adaptive** — enterprise-решение для автоматизации отслеживания контейнерных перевозок, разработанное для логистического оператора Rail Trust.

### Ключевые возможности

| Функция | Описание |
|---------|----------|
| 🔄 **Универсальный приём данных** | Автоматическое распознавание форматов: текст, JSON, CSV, Excel |
| 🎯 **Высокая точность** | 95-100% уверенность благодаря ISO 6346 валидации и справочникам |
| 🔧 **Автокоррекция** | Исправление опечаток в номерах контейнеров |
| 📊 **Экспорт в 1С** | Готовый формат для интеграции с учётной системой |
| 📱 **Панель логиста** | Современный веб-интерфейс для управления |

### Решаемые проблемы

```
БЫЛО                                    СТАЛО
─────────────────────────────────────────────────────────────
Логист тратит 1/3 времени         →    Автоматическая обработка
на ручной ввод статусов                за секунды

Данные в разных форматах          →    Единый нормализованный
(email, Excel, сайты)                  формат StatusEvent

Ошибки при копировании            →    Валидация ISO 6346 +
номеров контейнеров                    автоисправление опечаток

Клиенты ждут статусы              →    Мгновенная генерация
от логиста                             уведомлений
```

---

## 🚀 Быстрый старт

### Требования

- **Node.js** 20+
- **PostgreSQL** 16+
- **npm** 10+

### Установка

```bash
# 1. Клонирование репозитория
git clone <repository-url>
cd "Rail Trust"

# 2. Запуск PostgreSQL
docker run -d \
  --name smartsync-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=smartsync \
  -p 5432:5432 \
  postgres:16-alpine

# 3. Настройка Backend
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# 4. Запуск Backend
npm run dev

# 5. В новом терминале: Запуск Frontend
cd ../frontend
npm install
npm run dev
```

### Доступ

| Сервис | URL |
|--------|-----|
| Frontend (Панель логиста) | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| API Health Check | http://localhost:3001/api/health |

---

## 🏗 Архитектура

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ИСТОЧНИКИ ДАННЫХ                            │
│     Email операторов │ Excel/CSV │ API │ Ручной ввод │ Webhook     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MIDDLEWARE LAYER                               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │   Format    │→ │  Universal   │→ │    Data     │→ │ Processing│ │
│  │  Detector   │  │   Parser     │  │  Validator  │  │  Logger   │ │
│  └─────────────┘  └──────────────┘  └─────────────┘  └───────────┘ │
│        │                 │                 │                        │
│  Автодетект        Извлечение        ISO 6346 +          Аудит     │
│  формата           данных            Справочники         лог       │
└───────────────────────────────────────┬─────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         БАЗА ДАННЫХ                                 │
│                         PostgreSQL                                  │
│  ┌──────────┐ ┌─────────────┐ ┌────────────┐ ┌────────┐ ┌────────┐ │
│  │Container │ │ StatusEvent │ │ RawMessage │ │ Client │ │Carrier │ │
│  └──────────┘ └─────────────┘ └────────────┘ └────────┘ └────────┘ │
└───────────────────────────────────────┬─────────────────────────────┘
                                        │
                 ┌──────────────────────┼──────────────────────┐
                 │                      │                      │
                 ▼                      ▼                      ▼
        ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
        │    Панель    │      │  Генератор   │      │   Экспорт    │
        │   логиста    │      │ уведомлений  │      │    в 1С      │
        │   (React)    │      │  клиентам    │      │  (CSV/JSON)  │
        └──────────────┘      └──────────────┘      └──────────────┘
```

### Технологический стек

| Слой | Технологии |
|------|------------|
| **Backend** | Node.js 20, TypeScript 5, Express 4, Prisma 5 |
| **Frontend** | React 18, Vite 5, TailwindCSS 3, React Query |
| **Database** | PostgreSQL 16 |
| **Validation** | ISO 6346, BIC codes database, Location dictionary |

---

## 📡 API Reference

### Универсальный приём данных

```http
POST /api/ingest
Content-Type: application/json
```

Принимает данные в любом формате с автоматическим определением:

```json
{
  "content": "Контейнер MSCU1234560 на станции Гончарово, 1857 км до Иня-Восточная"
}
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "processed": 1,
    "failed": 0,
    "events": [{
      "container": { "containerNumber": "MSCU1234560" },
      "statusCode": "ON_RAIL",
      "location": "Гончарово",
      "distanceToDestinationKm": 1857
    }]
  },
  "confidence": 1.0
}
```

### Все endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| `POST` | `/api/ingest` | Универсальный приём (автодетект) |
| `POST` | `/api/ingest/text` | Текстовые данные |
| `POST` | `/api/ingest/json` | JSON данные |
| `POST` | `/api/ingest/csv` | CSV данные |
| `POST` | `/api/ingest/batch` | Пакетная загрузка |
| `POST` | `/api/ingest/test` | Тест без сохранения |
| `GET` | `/api/ingest/stats` | Статистика обработки |
| `GET` | `/api/containers` | Список контейнеров |
| `GET` | `/api/containers/:id` | Детали контейнера |
| `GET` | `/api/containers/:id/notification` | Генерация уведомления |
| `GET` | `/api/export/1c` | Экспорт для 1С |
| `GET` | `/api/status-events` | История статусов |

---

## 🎯 Система валидации

### Расчёт уверенности (Confidence)

```
┌────────────────────────────────────────────────────────────┐
│              ВАЛИДАЦИЯ КОНТЕЙНЕРА (ISO 6346)               │
├────────────────────────────────────────────────────────────┤
│  Базовый формат (XXXX0000000)              85%            │
│  + Контрольная цифра верна                +10%            │
│  + Известный владелец (BIC)               + 5%            │
│  + Без автоисправлений                    + 2%            │
├────────────────────────────────────────────────────────────┤
│  ИТОГО МАКСИМУМ                           100%            │
└────────────────────────────────────────────────────────────┘
```

### Поддерживаемые владельцы контейнеров (BIC codes)

| Код | Компания |
|-----|----------|
| MSCU, MSKU, MAEU | Maersk |
| CMAU, CGMU | CMA CGM |
| HLBU, HLCU | Hapag-Lloyd |
| CSQU, CCLU | COSCO |
| OOLU, OOCU | OOCL |
| EITU, EGSU | Evergreen |
| + 50 других | ... |

### Справочник локаций

- **ЖД станции России:** Гончарово, Забайкальск, Новосибирск, Красноярск, Иркутск, Москва и др.
- **Порты:** Владивосток, Восточный, Находка, Шанхай, Циндао, Пусан, Сингапур и др.
- **СВХ:** Шереметьево, Домодедово, Ворсино и др.

---

## 📊 Коды статусов

| Код | Описание | Тип локации |
|-----|----------|-------------|
| `LOADED` | Загружен | - |
| `IN_PORT` | В порту | PORT |
| `ON_SHIP` | В море | - |
| `ON_ANCHORAGE` | На рейде | PORT |
| `ARRIVED_PORT` | Прибыл в порт | PORT |
| `ON_WAREHOUSE` | На складе СВХ | WAREHOUSE |
| `CUSTOMS` | На таможне | CUSTOMS |
| `CUSTOMS_CLEARED` | Растаможен | CUSTOMS |
| `ON_RAIL` | В пути по ЖД | STATION |
| `RAIL_ARRIVED` | Прибыл на станцию | STATION |
| `ON_AUTO` | Автодоставка | - |
| `DELIVERED` | Доставлен | CITY |

---

## 📁 Структура проекта

```
Rail Trust/
├── backend/
│   ├── src/
│   │   ├── controllers/        # HTTP обработчики
│   │   ├── services/           # Бизнес-логика
│   │   ├── middleware/         # Ядро нормализации
│   │   │   ├── inputProcessor.ts      # Главный процессор
│   │   │   ├── formatDetector.ts      # Детектор форматов
│   │   │   ├── universalParser.ts     # Парсер данных
│   │   │   ├── dataValidator.ts       # Валидатор ISO 6346
│   │   │   ├── containerValidator.ts  # Валидация контейнеров
│   │   │   ├── locationDictionary.ts  # Справочник локаций
│   │   │   └── processingLogger.ts    # Аудит-лог
│   │   ├── generators/         # Генерация уведомлений
│   │   ├── exporters/          # Экспорт для 1С
│   │   ├── routes/             # API маршруты
│   │   └── types/              # TypeScript типы
│   ├── prisma/
│   │   ├── schema.prisma       # Модель данных
│   │   └── seed.ts             # Тестовые данные
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/              # Страницы
│   │   ├── components/         # UI компоненты
│   │   └── api/                # API клиент
│   └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md         # Архитектура
│   └── SYSTEM_OVERVIEW.md      # Обзор системы
│
└── README.md
```

---

## 🔧 Конфигурация

### Environment Variables

```env
# Backend (.env)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smartsync
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

### Docker Compose (Production)

```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: smartsync
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: smartsync
    volumes:
      - postgres_data:/var/lib/postgresql/data
    
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://smartsync:${DB_PASSWORD}@db:5432/smartsync
    depends_on:
      - db
    ports:
      - "3001:3001"
    
  frontend:
    build: ./frontend
    ports:
      - "80:80"

volumes:
  postgres_data:
```

---

## 📈 Мониторинг

### Статистика обработки

```http
GET /api/ingest/stats
```

```json
{
  "processing": {
    "totalProcessed": 1250,
    "successCount": 1235,
    "errorCount": 15,
    "averageDuration": 45,
    "formatBreakdown": {
      "PLAIN_TEXT": 450,
      "JSON_OBJECT": 380,
      "CSV_TEXT": 320,
      "TABLE_ROWS": 100
    }
  },
  "database": {
    "totalContainers": 890,
    "totalStatusEvents": 3420,
    "totalRawMessages": 1250
  }
}
```

---

## 🔮 Roadmap

- [ ] **v1.1** — LLM-интеграция для сложных текстов
- [ ] **v1.2** — Автоматический мониторинг email
- [ ] **v1.3** — Webhook уведомления
- [ ] **v1.4** — REST API для 1С (HTTP-сервис)
- [ ] **v2.0** — Клиентский портал
- [ ] **v2.1** — Telegram-бот

---

## 📝 Лицензия

**Proprietary** — Rail Trust © 2025

Все права защищены. Использование, копирование и распространение без письменного разрешения запрещено.

---

<div align="center">

**Разработано для Rail Trust**

[Документация](./docs/SYSTEM_OVERVIEW.md) • [API](./docs/API.md) • [Поддержка](mailto:support@railtrust.ru)

</div>
