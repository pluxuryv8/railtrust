# API Examples — SmartSync Adaptive

Примеры запросов для тестирования API.

---

## 🔄 Универсальный приём данных

### Текстовое сообщение (Email)

```bash
curl -X POST http://localhost:3001/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Добрый день! Контейнер MSCU1234560 находится на станции Гончарово, осталось 1857 км до станции Иня-Восточная. Ориентировочная дата прибытия 04.12.2025"
  }'
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "processed": 1,
    "failed": 0,
    "events": [{
      "id": "cm4abc123...",
      "container": {
        "id": "cm4xyz789...",
        "containerNumber": "MSCU1234560"
      },
      "statusCode": "ON_RAIL",
      "statusText": "На ЖД",
      "location": "Гончарово",
      "distanceToDestinationKm": 1857,
      "eta": "2025-12-04T00:00:00.000Z"
    }]
  },
  "confidence": 1.0,
  "processing": {
    "format": { "type": "PLAIN_TEXT", "confidence": 0.9 },
    "duration": 45
  }
}
```

---

### JSON объект

```bash
curl -X POST http://localhost:3001/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "containerNumber": "HLBU7654321",
      "status": "IN_PORT",
      "location": "Владивосток",
      "eta": "2025-12-10"
    }
  }'
```

---

### JSON массив (несколько контейнеров)

```bash
curl -X POST http://localhost:3001/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": [
      {"containerNumber": "CMAU1111110", "status": "ON_RAIL", "location": "Красноярск"},
      {"containerNumber": "OOLU2222220", "status": "IN_PORT", "location": "Шанхай"},
      {"containerNumber": "CSQU3333330", "status": "DELIVERED", "location": "Москва"}
    ]
  }'
```

---

### CSV данные

```bash
curl -X POST http://localhost:3001/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "containerNumber;status;location;distance;eta\nMSKU1111110;ON_RAIL;Новосибирск;2800;15.12.2025\nHLCU2222220;IN_PORT;Владивосток;;20.12.2025\nCMAU3333330;DELIVERED;Москва;0;"
  }'
```

---

## 📦 Контейнеры

### Список всех контейнеров

```bash
curl http://localhost:3001/api/containers
```

### Поиск по номеру

```bash
curl "http://localhost:3001/api/containers?search=MSKU"
```

### Фильтр по статусу

```bash
curl "http://localhost:3001/api/containers?status=ON_RAIL"
```

### Детали контейнера

```bash
curl http://localhost:3001/api/containers/CONTAINER_ID
```

---

## 📬 Генерация уведомлений

### Короткое уведомление

```bash
curl "http://localhost:3001/api/containers/CONTAINER_ID/notification?format=short"
```

**Ответ:**
```json
{
  "format": "short",
  "text": "MSCU1234560: в пути по ЖД, ст. Гончарово, до прибытия ~1857 км"
}
```

### Полное уведомление (для клиента)

```bash
curl "http://localhost:3001/api/containers/CONTAINER_ID/notification?format=full"
```

**Ответ:**
```json
{
  "format": "full",
  "text": "Добрый день!\n\nИнформация по контейнеру MSCU1234560:\n\nТекущий статус: В пути по ЖД\nМестоположение: ст. Гончарово\nРасстояние до назначения: 1857 км\nОриентировочная дата прибытия: 04.12.2025\n\nС уважением,\nRail Trust"
}
```

---

## 📊 Экспорт в 1С

### JSON формат

```bash
curl "http://localhost:3001/api/export/1c?format=json"
```

### CSV формат

```bash
curl "http://localhost:3001/api/export/1c?format=csv" -o export.csv
```

**Структура CSV:**
```
Номер КТК;Тип КТК;Состояние;Пункт отправления;Пункт назначения;Текущее местоположение;Расстояние до назначения;Ориентировочная дата прибытия
MSCU1234560;40;В пути по ЖД;Шанхай;Москва;ст. Гончарово;1857;04.12.2025
```

---

## 📈 Статистика

### Статистика обработки

```bash
curl http://localhost:3001/api/ingest/stats
```

**Ответ:**
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

## 🧪 Тестовый режим (без сохранения)

```bash
curl -X POST http://localhost:3001/api/ingest/test \
  -H "Content-Type: application/json" \
  -d '{
    "content": "MSCU1234560 на станции Гончарово"
  }'
```

Возвращает результат парсинга **без сохранения в БД** — удобно для отладки.

---

## ❤️ Health Check

```bash
curl http://localhost:3001/api/health
```

```json
{
  "status": "ok",
  "timestamp": "2025-12-01T10:30:00.000Z",
  "database": "connected"
}
```

