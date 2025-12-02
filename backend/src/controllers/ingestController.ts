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

