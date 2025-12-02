import { SourceType } from '@prisma/client';
import { FormatDetector, DetectedFormat } from './formatDetector.js';
import { UniversalParser } from './universalParser.js';
import { DataValidator } from './dataValidator.js';
import { ProcessingLogger, ProcessingLogEntry } from './processingLogger.js';
import { NormalizedStatusEvent } from '../types/index.js';

/**
 * ============================================
 * INPUT PROCESSOR - Единая точка входа
 * ============================================
 * 
 * Middleware-слой для обработки ЛЮБЫХ входящих данных:
 * - Текстовые сообщения (email, SMS, мессенджеры)
 * - Табличные данные (Excel, CSV, JSON)
 * - Структурированные API-ответы
 * - Обрывки данных, частично битые данные
 * - В будущем: расшифровки голосовых сообщений
 * 
 * Цепочка обработки:
 * RAW INPUT → FormatDetector → UniversalParser → DataValidator → NormalizedOutput
 */

export interface RawInput {
  /** Сырые данные (строка, объект, массив) */
  content: string | object | unknown[];
  
  /** Подсказка о типе (если известен) */
  hint?: 'text' | 'json' | 'csv' | 'table' | 'api';
  
  /** Метаданные источника */
  metadata?: {
    sourceEmail?: string;
    sourceSubject?: string;
    sourceCarrierId?: string;
    sourceUrl?: string;
    receivedAt?: string;
  };
}

export interface ProcessingResult {
  success: boolean;
  
  /** Нормализованные данные (если успех) */
  data?: NormalizedStatusEvent[];
  
  /** Детектированный формат */
  detectedFormat?: DetectedFormat;
  
  /** Ошибки обработки */
  errors?: string[];
  
  /** Предупреждения (данные обработаны, но с оговорками) */
  warnings?: string[];
  
  /** Лог обработки для аудита */
  processingLog: ProcessingLogEntry;
  
  /** Уверенность в результате (0-1) */
  confidence: number;
}

export class InputProcessor {
  private formatDetector: FormatDetector;
  private universalParser: UniversalParser;
  private dataValidator: DataValidator;
  private logger: ProcessingLogger;

  constructor() {
    this.formatDetector = new FormatDetector();
    this.universalParser = new UniversalParser();
    this.dataValidator = new DataValidator();
    this.logger = new ProcessingLogger();
  }

  /**
   * Главный метод обработки входящих данных
   */
  async process(input: RawInput): Promise<ProcessingResult> {
    const startTime = Date.now();
    const logEntry = this.logger.startProcessing(input);
    
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // ШАГ 1: Определяем формат данных
      const detectedFormat = this.formatDetector.detect(input);
      logEntry.detectedFormat = detectedFormat;
      
      if (detectedFormat.confidence < 0.3) {
        warnings.push(`Low format detection confidence: ${detectedFormat.confidence}`);
      }

      // ШАГ 2: Парсим данные универсальным парсером
      const parsedData = await this.universalParser.parse(input, detectedFormat);
      logEntry.parsedItemsCount = parsedData.items.length;
      
      if (parsedData.errors.length > 0) {
        errors.push(...parsedData.errors);
      }
      if (parsedData.warnings.length > 0) {
        warnings.push(...parsedData.warnings);
      }

      // ШАГ 3: Валидируем и нормализуем данные
      const normalizedData: NormalizedStatusEvent[] = [];
      const validationConfidences: number[] = [];
      
      for (const item of parsedData.items) {
        const validation = this.dataValidator.validate(item);
        
        if (validation.isValid && validation.normalized) {
          normalizedData.push(validation.normalized);
          validationConfidences.push(validation.confidence);
          
          // Добавляем предупреждения валидации
          if (validation.warnings.length > 0) {
            warnings.push(...validation.warnings.map(w => 
              `[${validation.normalized?.containerNumber}] ${w}`
            ));
          }
        } else {
          // Пытаемся восстановить частичные данные только если уверенность > 0.3
          if (validation.partialData && validation.confidence > 0.3) {
            normalizedData.push(validation.partialData);
            validationConfidences.push(validation.confidence);
            warnings.push(`Частичные данные: ${validation.partialData.containerNumber || 'без номера'} (уверенность ${Math.round(validation.confidence * 100)}%)`);
          } else {
            errors.push(`Ошибка валидации: ${validation.errors.join(', ')}`);
          }
        }
      }
      
      // Средняя уверенность валидации
      const avgValidationConfidence = validationConfidences.length > 0
        ? validationConfidences.reduce((a, b) => a + b, 0) / validationConfidences.length
        : 0;

      // ШАГ 4: Финализируем лог
      logEntry.duration = Date.now() - startTime;
      logEntry.outputItemsCount = normalizedData.length;
      logEntry.errors = errors;
      logEntry.warnings = warnings;
      logEntry.success = normalizedData.length > 0;

      // Рассчитываем общую уверенность (используем среднюю уверенность валидации)
      const confidence = avgValidationConfidence > 0 
        ? avgValidationConfidence 
        : this.calculateConfidence(detectedFormat, parsedData, normalizedData, errors);

      return {
        success: normalizedData.length > 0,
        data: normalizedData.length > 0 ? normalizedData : undefined,
        detectedFormat,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        processingLog: logEntry,
        confidence,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
      errors.push(errorMessage);
      
      logEntry.duration = Date.now() - startTime;
      logEntry.errors = errors;
      logEntry.success = false;

      return {
        success: false,
        errors,
        processingLog: logEntry,
        confidence: 0,
      };
    }
  }

  /**
   * Пакетная обработка (для CSV/Excel с множеством строк)
   */
  async processBatch(inputs: RawInput[]): Promise<{
    results: ProcessingResult[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      partialSuccess: number;
    };
  }> {
    const results = await Promise.all(inputs.map(input => this.process(input)));
    
    return {
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success && !r.warnings?.length).length,
        failed: results.filter(r => !r.success).length,
        partialSuccess: results.filter(r => r.success && r.warnings?.length).length,
      },
    };
  }

  /**
   * Расчёт общей уверенности в результате
   */
  private calculateConfidence(
    format: DetectedFormat,
    parsed: { items: unknown[]; errors: string[] },
    normalized: NormalizedStatusEvent[],
    errors: string[]
  ): number {
    let confidence = format.confidence;
    
    // Штраф за ошибки парсинга
    if (parsed.errors.length > 0) {
      confidence *= 0.8;
    }
    
    // Штраф за потерю данных при нормализации
    if (parsed.items.length > 0 && normalized.length < parsed.items.length) {
      confidence *= (normalized.length / parsed.items.length);
    }
    
    // Штраф за общие ошибки
    if (errors.length > 0) {
      confidence *= Math.max(0.5, 1 - errors.length * 0.1);
    }
    
    // Бонус за полноту данных
    const avgCompleteness = normalized.reduce((sum, item) => {
      let fields = 0;
      if (item.containerNumber) fields++;
      if (item.statusCode) fields++;
      if (item.location) fields++;
      if (item.eta) fields++;
      if (item.distanceToDestinationKm) fields++;
      return sum + fields / 5;
    }, 0) / Math.max(normalized.length, 1);
    
    confidence *= (0.5 + avgCompleteness * 0.5);
    
    return Math.min(Math.max(confidence, 0), 1);
  }
}

export const inputProcessor = new InputProcessor();

