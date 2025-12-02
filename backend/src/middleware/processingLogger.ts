import { RawInput } from './inputProcessor.js';
import { DetectedFormat } from './formatDetector.js';

/**
 * ============================================
 * PROCESSING LOGGER - Логирование цепочки обработки
 * ============================================
 * 
 * Ведёт полный аудит-лог:
 * - Откуда пришли данные
 * - Какой формат определён
 * - Что извлечено
 * - Какие ошибки/предупреждения
 * - Сколько времени заняла обработка
 */

export interface ProcessingLogEntry {
  id: string;
  timestamp: string;
  
  // Входные данные
  inputType: string;
  inputSize: number;
  inputPreview: string;
  metadata?: Record<string, string>;
  
  // Результат определения формата
  detectedFormat?: DetectedFormat;
  
  // Результаты парсинга
  parsedItemsCount?: number;
  outputItemsCount?: number;
  
  // Статус
  success: boolean;
  errors?: string[];
  warnings?: string[];
  
  // Метрики
  duration?: number;
}

export class ProcessingLogger {
  private logs: ProcessingLogEntry[] = [];
  private maxLogs = 1000;

  /**
   * Начало обработки - создаёт запись лога
   */
  startProcessing(input: RawInput): ProcessingLogEntry {
    const { content, metadata } = input;
    
    const inputStr = typeof content === 'string' 
      ? content 
      : JSON.stringify(content);

    const entry: ProcessingLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      inputType: this.determineInputType(content),
      inputSize: inputStr.length,
      inputPreview: inputStr.slice(0, 200) + (inputStr.length > 200 ? '...' : ''),
      metadata: metadata as Record<string, string>,
      success: false,
    };

    // Добавляем в начало массива
    this.logs.unshift(entry);
    
    // Ограничиваем размер
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    return entry;
  }

  /**
   * Получение последних логов
   */
  getRecentLogs(limit: number = 100): ProcessingLogEntry[] {
    return this.logs.slice(0, limit);
  }

  /**
   * Получение логов с ошибками
   */
  getErrorLogs(limit: number = 50): ProcessingLogEntry[] {
    return this.logs
      .filter(log => !log.success || (log.errors && log.errors.length > 0))
      .slice(0, limit);
  }

  /**
   * Получение статистики
   */
  getStats(): {
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    averageDuration: number;
    formatBreakdown: Record<string, number>;
  } {
    const successCount = this.logs.filter(l => l.success).length;
    const durations = this.logs
      .filter(l => l.duration !== undefined)
      .map(l => l.duration!);
    
    const formatBreakdown: Record<string, number> = {};
    for (const log of this.logs) {
      if (log.detectedFormat) {
        const type = log.detectedFormat.type;
        formatBreakdown[type] = (formatBreakdown[type] || 0) + 1;
      }
    }

    return {
      totalProcessed: this.logs.length,
      successCount,
      errorCount: this.logs.length - successCount,
      averageDuration: durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0,
      formatBreakdown,
    };
  }

  /**
   * Очистка логов
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Экспорт логов для анализа
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Определение типа входных данных
   */
  private determineInputType(content: unknown): string {
    if (typeof content === 'string') {
      if (content.trim().startsWith('{')) return 'json_string';
      if (content.trim().startsWith('[')) return 'json_array_string';
      return 'plain_text';
    }
    if (Array.isArray(content)) return 'array';
    if (typeof content === 'object') return 'object';
    return 'unknown';
  }

  /**
   * Генерация уникального ID
   */
  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton экземпляр для общего использования
export const processingLogger = new ProcessingLogger();

