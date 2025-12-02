import { Request, Response } from 'express';
import { inputProcessor, RawInput, processingLogger } from '../middleware/index.js';
import { statusEventService } from '../services/index.js';
import { prisma } from '../utils/prisma.js';
import { SourceType } from '@prisma/client';

/**
 * ============================================
 * INGEST CONTROLLER - Универсальный приём данных
 * ============================================
 * 
 * Единая точка входа для ВСЕХ типов данных:
 * - POST /api/ingest - универсальный приём
 * - POST /api/ingest/text - чистый текст
 * - POST /api/ingest/json - структурированный JSON
 * - POST /api/ingest/csv - CSV данные
 * - POST /api/ingest/batch - пакетная загрузка
 */

/**
 * Универсальный приём данных с автоопределением формата
 */
export async function ingestUniversal(req: Request, res: Response): Promise<void> {
  try {
    // Извлекаем контент из различных возможных полей
    let rawContent = req.body.content ?? req.body.body ?? req.body.data ?? req.body.items ?? req.body.rows ?? req.body.text ?? req.body;
    
    // Если передан объект с единственным полем content/body/data - распаковываем
    if (typeof rawContent === 'object' && rawContent !== null && !Array.isArray(rawContent)) {
      const keys = Object.keys(rawContent);
      if (keys.length === 1 && ['content', 'body', 'data', 'items', 'rows', 'text'].includes(keys[0])) {
        rawContent = rawContent[keys[0] as keyof typeof rawContent];
      }
    }

    const input: RawInput = {
      content: rawContent,
      hint: req.body.hint,
      metadata: {
        sourceEmail: req.body.sourceEmail || req.body.senderEmail,
        sourceSubject: req.body.subject,
        sourceCarrierId: req.body.carrierId,
        sourceUrl: req.body.sourceUrl,
        receivedAt: req.body.receivedAt || new Date().toISOString(),
      },
    };

    // Определяем тип источника
    const sourceType: SourceType = determineSourceType(req.body, input);

    // Обрабатываем через InputProcessor
    const result = await inputProcessor.process(input);

    if (!result.success || !result.data || result.data.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Failed to process input data',
        details: result.errors,
        warnings: result.warnings,
        processingLog: result.processingLog,
      });
      return;
    }

    // Сохраняем RawMessage для аудита
    const rawMessage = await prisma.rawMessage.create({
      data: {
        sourceType,
        content: typeof input.content === 'string' 
          ? input.content 
          : JSON.stringify(input.content),
        senderEmail: input.metadata?.sourceEmail,
        subject: input.metadata?.sourceSubject,
        carrierId: input.metadata?.sourceCarrierId,
        processed: true,
        processedAt: new Date(),
      },
    });

    // Создаём StatusEvents для каждого найденного элемента
    const savedEvents = [];
    const errors = [];

    for (const normalized of result.data) {
      try {
        // Пропускаем записи без номера контейнера
        if (!normalized.containerNumber) {
          errors.push({
            error: 'Missing container number',
            data: normalized,
          });
          continue;
        }

        // Создаём или находим контейнер
        const container = await statusEventService.findOrCreateContainer(
          normalized.containerNumber,
          {
            origin: normalized.origin,
            destination: normalized.destination,
          }
        );

        // Создаём событие
        const event = await prisma.statusEvent.create({
          data: {
            containerId: container.id,
            statusCode: normalized.statusCode,
            statusText: normalized.statusText,
            location: normalized.location || null,
            distanceToDestinationKm: normalized.distanceToDestinationKm || null,
            eta: normalized.eta ? new Date(normalized.eta) : null,
            eventTime: normalized.eventTime ? new Date(normalized.eventTime) : new Date(),
            sourceType,
            sourceRaw: normalized.sourceRaw || null,
            rawMessageId: rawMessage.id,
          },
          include: {
            container: true,
          },
        });

        savedEvents.push(event);
      } catch (err) {
        errors.push({
          error: err instanceof Error ? err.message : 'Unknown error',
          data: normalized,
        });
      }
    }

    // Обновляем RawMessage с результатами
    await prisma.rawMessage.update({
      where: { id: rawMessage.id },
      data: {
        errorMessage: errors.length > 0 ? JSON.stringify(errors) : null,
      },
    });

    res.status(201).json({
      success: true,
      message: `Processed ${savedEvents.length} status events`,
      data: {
        processed: savedEvents.length,
        failed: errors.length,
        events: savedEvents,
        warnings: result.warnings,
      },
      processing: {
        format: result.detectedFormat,
        confidence: result.confidence,
        log: result.processingLog,
      },
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Ingest error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during data ingestion',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Приём чистого текста (email, сообщения)
 */
export async function ingestText(req: Request, res: Response): Promise<void> {
  const { text, body, content } = req.body;
  const textContent = text || body || content;

  if (!textContent || typeof textContent !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Text content is required (use "text", "body", or "content" field)',
    });
    return;
  }

  req.body = {
    content: textContent,
    hint: 'text',
    ...req.body,
  };

  await ingestUniversal(req, res);
}

/**
 * Приём структурированного JSON
 */
export async function ingestJson(req: Request, res: Response): Promise<void> {
  const { rows, data, items, content } = req.body;
  const jsonContent = rows || data || items || content;

  if (!jsonContent) {
    res.status(400).json({
      success: false,
      error: 'JSON data is required (use "rows", "data", "items", or "content" field)',
    });
    return;
  }

  req.body = {
    content: jsonContent,
    hint: Array.isArray(jsonContent) ? 'table' : 'json',
    ...req.body,
  };

  await ingestUniversal(req, res);
}

/**
 * Приём CSV данных
 */
export async function ingestCsv(req: Request, res: Response): Promise<void> {
  const { csv, content, body } = req.body;
  const csvContent = csv || content || body;

  if (!csvContent || typeof csvContent !== 'string') {
    res.status(400).json({
      success: false,
      error: 'CSV content is required (use "csv", "content", or "body" field)',
    });
    return;
  }

  req.body = {
    content: csvContent,
    hint: 'csv',
    ...req.body,
  };

  await ingestUniversal(req, res);
}

/**
 * Пакетная загрузка (множество записей)
 */
export async function ingestBatch(req: Request, res: Response): Promise<void> {
  const { items, batch, data } = req.body;
  const batchItems = items || batch || data;

  if (!Array.isArray(batchItems) || batchItems.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Batch items array is required (use "items", "batch", or "data" field)',
    });
    return;
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < batchItems.length; i++) {
    try {
      const input: RawInput = {
        content: batchItems[i],
        metadata: req.body.metadata,
      };

      const result = await inputProcessor.process(input);
      
      if (result.success && result.data) {
        for (const normalized of result.data) {
          if (normalized.containerNumber) {
            const container = await statusEventService.findOrCreateContainer(
              normalized.containerNumber,
              { origin: normalized.origin, destination: normalized.destination }
            );

            const event = await prisma.statusEvent.create({
              data: {
                containerId: container.id,
                statusCode: normalized.statusCode,
                statusText: normalized.statusText,
                location: normalized.location || null,
                distanceToDestinationKm: normalized.distanceToDestinationKm || null,
                eta: normalized.eta ? new Date(normalized.eta) : null,
                eventTime: normalized.eventTime ? new Date(normalized.eventTime) : new Date(),
                sourceType: 'EXCEL',
                sourceRaw: JSON.stringify(batchItems[i]),
              },
            });

            results.push(event);
          }
        }
      } else {
        errors.push({ index: i, errors: result.errors, item: batchItems[i] });
      }
    } catch (err) {
      errors.push({ 
        index: i, 
        error: err instanceof Error ? err.message : 'Unknown error',
        item: batchItems[i],
      });
    }
  }

  res.status(201).json({
    success: true,
    message: `Batch processed: ${results.length} successful, ${errors.length} failed`,
    data: {
      processed: results.length,
      failed: errors.length,
      total: batchItems.length,
    },
    errors: errors.length > 0 ? errors : undefined,
  });
}

/**
 * Получение логов обработки
 */
export async function getProcessingLogs(req: Request, res: Response): Promise<void> {
  const { limit = '100', errors_only = 'false' } = req.query;

  const numLimit = parseInt(limit as string, 10) || 100;
  const errorsOnly = errors_only === 'true';

  const logs = errorsOnly 
    ? processingLogger.getErrorLogs(numLimit)
    : processingLogger.getRecentLogs(numLimit);

  const stats = processingLogger.getStats();

  res.json({
    success: true,
    data: {
      logs,
      stats,
    },
  });
}

/**
 * Получение статистики обработки
 */
export async function getProcessingStats(req: Request, res: Response): Promise<void> {
  const stats = processingLogger.getStats();

  // Дополнительная статистика из БД
  const dbStats = await prisma.$transaction([
    prisma.rawMessage.count(),
    prisma.rawMessage.count({ where: { processed: true } }),
    prisma.rawMessage.count({ where: { errorMessage: { not: null } } }),
    prisma.statusEvent.count(),
    prisma.container.count(),
  ]);

  res.json({
    success: true,
    data: {
      processing: stats,
      database: {
        totalRawMessages: dbStats[0],
        processedMessages: dbStats[1],
        failedMessages: dbStats[2],
        totalStatusEvents: dbStats[3],
        totalContainers: dbStats[4],
      },
    },
  });
}

/**
 * Тестовый endpoint для проверки парсинга (без сохранения)
 */
export async function testParsing(req: Request, res: Response): Promise<void> {
  try {
    const input: RawInput = {
      content: req.body.content || req.body.body || req.body.data || req.body,
      hint: req.body.hint,
      metadata: req.body.metadata,
    };

    const result = await inputProcessor.process(input);

    res.json({
      success: result.success,
      data: result.data,
      detectedFormat: result.detectedFormat,
      confidence: result.confidence,
      warnings: result.warnings,
      errors: result.errors,
      processingLog: result.processingLog,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Определение типа источника
 */
function determineSourceType(body: Record<string, unknown>, input: RawInput): SourceType {
  if (body.sourceType) {
    const type = String(body.sourceType).toUpperCase();
    if (['EMAIL', 'EXCEL', 'API', 'MANUAL'].includes(type)) {
      return type as SourceType;
    }
  }

  if (input.metadata?.sourceEmail) return 'EMAIL';
  if (input.hint === 'csv' || input.hint === 'table') return 'EXCEL';
  if (input.hint === 'api') return 'API';
  
  // Автоопределение по содержимому
  if (typeof input.content === 'string') {
    const content = input.content.toLowerCase();
    if (content.includes('от:') || content.includes('from:') || content.includes('@')) {
      return 'EMAIL';
    }
  }
  
  if (Array.isArray(input.content)) return 'EXCEL';
  
  return 'MANUAL';
}

/**
 * Сброс всех данных (контейнеры, события, сообщения)
 */
export async function resetDatabase(req: Request, res: Response): Promise<void> {
  try {
    // Удаляем в правильном порядке (из-за foreign keys)
    await prisma.statusEvent.deleteMany();
    await prisma.rawMessage.deleteMany();
    await prisma.container.deleteMany();
    await prisma.syncJob.deleteMany();
    
    res.json({
      success: true,
      message: 'База данных очищена',
      deleted: {
        statusEvents: true,
        rawMessages: true,
        containers: true,
        syncJobs: true,
      },
    });
  } catch (error) {
    console.error('Reset database error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при очистке базы данных' 
    });
  }
}

/**
 * Заполнение тестовыми данными со всеми статусами
 */
export async function seedDemoData(req: Request, res: Response): Promise<void> {
  try {
    // Тестовые контейнеры со всеми статусами
    const demoContainers = [
      {
        containerNumber: 'MSCU1234567',
        containerType: '40',
        originPoint: 'Шанхай',
        destinationPoint: 'Москва',
        status: { code: 'LOADED', text: 'Загружен', location: 'Шанхай', distance: 8500 },
      },
      {
        containerNumber: 'HLBU2345678',
        containerType: '40',
        originPoint: 'Циндао',
        destinationPoint: 'Новосибирск',
        status: { code: 'IN_PORT', text: 'В порту отправления', location: 'Циндао', distance: 5200 },
      },
      {
        containerNumber: 'CMAU3456789',
        containerType: '20',
        originPoint: 'Нинбо',
        destinationPoint: 'Екатеринбург',
        status: { code: 'ON_SHIP', text: 'В море', location: 'Японское море', distance: 4800 },
      },
      {
        containerNumber: 'OOLU4567890',
        containerType: '40',
        originPoint: 'Пусан',
        destinationPoint: 'Владивосток',
        status: { code: 'ON_ANCHORAGE', text: 'На рейде', location: 'Владивосток', distance: 50 },
      },
      {
        containerNumber: 'CSQU5678901',
        containerType: '40',
        originPoint: 'Шанхай',
        destinationPoint: 'Красноярск',
        status: { code: 'ARRIVED_PORT', text: 'Прибыл в порт', location: 'Владивосток', distance: 4100 },
      },
      {
        containerNumber: 'EITU6789012',
        containerType: '20',
        originPoint: 'Далянь',
        destinationPoint: 'Иркутск',
        status: { code: 'ON_WAREHOUSE', text: 'На складе СВХ', location: 'Владивосток СВХ', distance: 3800 },
      },
      {
        containerNumber: 'TGHU7890123',
        containerType: '40',
        originPoint: 'Гуанчжоу',
        destinationPoint: 'Москва',
        status: { code: 'CUSTOMS', text: 'На таможне', location: 'Владивосток', distance: 9200 },
      },
      {
        containerNumber: 'NYKU8901234',
        containerType: '40',
        originPoint: 'Токио',
        destinationPoint: 'Казань',
        status: { code: 'CUSTOMS_CLEARED', text: 'Растаможен', location: 'Владивосток', distance: 6500 },
      },
      {
        containerNumber: 'YMLU9012345',
        containerType: '20',
        originPoint: 'Сингапур',
        destinationPoint: 'Новосибирск',
        status: { code: 'ON_RAIL', text: 'В пути по ЖД', location: 'ст. Гончарово', distance: 1857 },
      },
      {
        containerNumber: 'KKFU0123456',
        containerType: '40',
        originPoint: 'Шэньчжэнь',
        destinationPoint: 'Екатеринбург',
        status: { code: 'RAIL_ARRIVED', text: 'Прибыл на станцию', location: 'ст. Екатеринбург-Товарный', distance: 0 },
      },
      {
        containerNumber: 'MOLU1234560',
        containerType: '20',
        originPoint: 'Нинбо',
        destinationPoint: 'Пермь',
        status: { code: 'ON_AUTO', text: 'Автодоставка', location: 'Пермь', distance: 25 },
      },
      {
        containerNumber: 'TRLU2345670',
        containerType: '40',
        originPoint: 'Пусан',
        destinationPoint: 'Челябинск',
        status: { code: 'DELIVERED', text: 'Доставлен', location: 'Челябинск', distance: 0 },
      },
      {
        containerNumber: 'FCIU3456780',
        containerType: '40',
        originPoint: 'Шанхай',
        destinationPoint: 'Самара',
        status: { code: 'IN_TRANSIT', text: 'В пути', location: 'Забайкальск', distance: 4200 },
      },
      {
        containerNumber: 'GESU4567891',
        containerType: '20',
        originPoint: 'Циндао',
        destinationPoint: 'Омск',
        status: { code: 'UNLOADED', text: 'Выгружен', location: 'Омск', distance: 0 },
      },
    ];

    const createdContainers = [];
    const now = new Date();

    for (let i = 0; i < demoContainers.length; i++) {
      const demo = demoContainers[i];
      
      // Создаём контейнер
      const container = await prisma.container.create({
        data: {
          containerNumber: demo.containerNumber,
          containerType: demo.containerType,
          originPoint: demo.originPoint,
          destinationPoint: demo.destinationPoint,
        },
      });

      // Создаём событие статуса
      const eta = new Date(now);
      eta.setDate(eta.getDate() + Math.floor(Math.random() * 14) + 1); // 1-14 дней

      await prisma.statusEvent.create({
        data: {
          containerId: container.id,
          statusCode: demo.status.code as any,
          statusText: demo.status.text,
          location: demo.status.location,
          distanceToDestinationKm: demo.status.distance,
          eta: eta,
          eventTime: new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000), // За последние 24 часа
          sourceType: 'MANUAL',
          sourceRaw: `Демо-данные: ${demo.status.text}`,
        },
      });

      createdContainers.push({
        containerNumber: demo.containerNumber,
        status: demo.status.code,
      });
    }

    res.json({
      success: true,
      message: `Создано ${createdContainers.length} тестовых контейнеров со всеми статусами`,
      containers: createdContainers,
    });
  } catch (error) {
    console.error('Seed demo data error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка при создании тестовых данных' 
    });
  }
}

