import { RawInput } from './inputProcessor.js';

/**
 * ============================================
 * FORMAT DETECTOR - Автоматическое определение формата
 * ============================================
 * 
 * Определяет тип входящих данных:
 * - PLAIN_TEXT: свободный текст (email, сообщение)
 * - JSON_OBJECT: структурированный JSON объект
 * - JSON_ARRAY: массив JSON объектов
 * - CSV_TEXT: CSV-формат в виде текста
 * - TABLE_ROW: одиночная строка таблицы
 * - TABLE_ROWS: массив строк таблицы
 * - MIXED: смешанный формат (текст + данные)
 * - UNKNOWN: не удалось определить
 */

export type FormatType = 
  | 'PLAIN_TEXT'
  | 'JSON_OBJECT'
  | 'JSON_ARRAY'
  | 'CSV_TEXT'
  | 'TABLE_ROW'
  | 'TABLE_ROWS'
  | 'MIXED'
  | 'UNKNOWN';

export interface DetectedFormat {
  type: FormatType;
  confidence: number;
  details: {
    hasContainerNumber: boolean;
    hasStatusInfo: boolean;
    hasDateInfo: boolean;
    hasLocationInfo: boolean;
    language: 'ru' | 'en' | 'mixed' | 'unknown';
    estimatedRowCount: number;
  };
}

export class FormatDetector {
  
  /**
   * Определяет формат входных данных
   */
  detect(input: RawInput): DetectedFormat {
    const { content, hint } = input;
    
    // Сначала проверяем массив - это самый частый случай для пакетных данных
    if (Array.isArray(content)) {
      return this.detectArrayFormat(content);
    }
    
    // Если есть подсказка, используем её
    if (hint) {
      return this.detectWithHint(content, hint);
    }
    
    // Автоматическое определение
    if (typeof content === 'string') {
      return this.detectStringFormat(content);
    }
    
    if (typeof content === 'object' && content !== null) {
      return this.detectObjectFormat(content as Record<string, unknown>);
    }
    
    return this.unknownFormat();
  }

  /**
   * Определение формата строковых данных
   */
  private detectStringFormat(content: string): DetectedFormat {
    const trimmed = content.trim();
    
    // Проверяем, это JSON?
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return this.detectArrayFormat(parsed);
        }
        return this.detectObjectFormat(parsed);
      } catch {
        // Не JSON, продолжаем
      }
    }
    
    // Проверяем, это CSV?
    if (this.looksLikeCSV(trimmed)) {
      return this.createFormat('CSV_TEXT', 0.8, trimmed);
    }
    
    // Это свободный текст
    return this.createFormat('PLAIN_TEXT', 0.9, trimmed);
  }

  /**
   * Определение формата массива
   */
  private detectArrayFormat(content: unknown[]): DetectedFormat {
    if (content.length === 0) {
      return this.unknownFormat();
    }
    
    // Проверяем первый элемент
    const firstItem = content[0];
    
    if (typeof firstItem === 'object' && firstItem !== null) {
      // Массив объектов - скорее всего строки таблицы
      const hasTableFields = this.hasTableFields(firstItem as Record<string, unknown>);
      
      if (hasTableFields) {
        return this.createFormat('TABLE_ROWS', 0.9, JSON.stringify(content), content.length);
      }
      
      return this.createFormat('JSON_ARRAY', 0.8, JSON.stringify(content), content.length);
    }
    
    // Массив строк - возможно CSV без заголовков
    if (typeof firstItem === 'string') {
      return this.createFormat('CSV_TEXT', 0.6, content.join('\n'), content.length);
    }
    
    return this.createFormat('JSON_ARRAY', 0.5, JSON.stringify(content), content.length);
  }

  /**
   * Определение формата объекта
   */
  private detectObjectFormat(content: Record<string, unknown>): DetectedFormat {
    // Проверяем, похоже ли на строку таблицы
    if (this.hasTableFields(content)) {
      return this.createFormat('TABLE_ROW', 0.9, JSON.stringify(content));
    }
    
    // Проверяем, есть ли вложенный массив rows
    if (Array.isArray(content.rows)) {
      return this.detectArrayFormat(content.rows);
    }
    
    // Проверяем, есть ли вложенный массив data
    if (Array.isArray(content.data)) {
      return this.detectArrayFormat(content.data);
    }
    
    // Проверяем, есть ли текстовое поле body
    if (typeof content.body === 'string') {
      return this.createFormat('MIXED', 0.8, content.body as string);
    }
    
    return this.createFormat('JSON_OBJECT', 0.7, JSON.stringify(content));
  }

  /**
   * Определение с подсказкой
   */
  private detectWithHint(content: string | object | unknown[], hint: string): DetectedFormat {
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    
    switch (hint) {
      case 'text':
        return this.createFormat('PLAIN_TEXT', 0.95, contentStr);
      case 'json':
        if (Array.isArray(content)) {
          return this.createFormat('JSON_ARRAY', 0.95, contentStr, (content as unknown[]).length);
        }
        return this.createFormat('JSON_OBJECT', 0.95, contentStr);
      case 'csv':
        return this.createFormat('CSV_TEXT', 0.95, contentStr);
      case 'table':
        if (Array.isArray(content)) {
          return this.createFormat('TABLE_ROWS', 0.95, contentStr, (content as unknown[]).length);
        }
        return this.createFormat('TABLE_ROW', 0.95, contentStr);
      default:
        return this.detect({ content });
    }
  }

  /**
   * Проверка на CSV-формат
   */
  private looksLikeCSV(content: string): boolean {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length < 2) return false;
    
    // Проверяем наличие разделителей
    const delimiters = [';', ',', '\t'];
    
    for (const delimiter of delimiters) {
      const firstLineCount = (lines[0].match(new RegExp(delimiter, 'g')) || []).length;
      if (firstLineCount >= 2) {
        // Проверяем, что другие строки имеют похожее количество разделителей
        const consistent = lines.slice(1, 5).every(line => {
          const count = (line.match(new RegExp(delimiter, 'g')) || []).length;
          return Math.abs(count - firstLineCount) <= 1;
        });
        if (consistent) return true;
      }
    }
    
    return false;
  }

  /**
   * Проверка на поля таблицы
   */
  private hasTableFields(obj: Record<string, unknown>): boolean {
    const tableFields = [
      'containerNumber', 'container_number', 'containernumber',
      'state', 'status', 'statusCode', 'status_code',
      'from', 'to', 'origin', 'destination',
      'eta', 'ETA', 'arrival', 'arrivalDate',
      'location', 'currentLocation', 'current_location',
    ];
    
    const keys = Object.keys(obj).map(k => k.toLowerCase());
    const matches = tableFields.filter(f => keys.includes(f.toLowerCase()));
    
    return matches.length >= 2;
  }

  /**
   * Создание результата определения формата
   */
  private createFormat(
    type: FormatType, 
    confidence: number, 
    content: string,
    rowCount: number = 1
  ): DetectedFormat {
    return {
      type,
      confidence,
      details: {
        hasContainerNumber: this.hasContainerNumber(content),
        hasStatusInfo: this.hasStatusInfo(content),
        hasDateInfo: this.hasDateInfo(content),
        hasLocationInfo: this.hasLocationInfo(content),
        language: this.detectLanguage(content),
        estimatedRowCount: rowCount,
      },
    };
  }

  /**
   * Проверка наличия номера контейнера
   */
  private hasContainerNumber(content: string): boolean {
    return /[A-Z]{4}\d{6,7}/i.test(content);
  }

  /**
   * Проверка наличия информации о статусе
   */
  private hasStatusInfo(content: string): boolean {
    const statusKeywords = [
      'статус', 'status', 'состояние', 'state',
      'прибыл', 'отгружен', 'доставлен', 'arrived', 'delivered', 'shipped',
      'в пути', 'в порту', 'на складе', 'on rail', 'in port',
    ];
    const lower = content.toLowerCase();
    return statusKeywords.some(kw => lower.includes(kw));
  }

  /**
   * Проверка наличия даты
   */
  private hasDateInfo(content: string): boolean {
    return /\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}|\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}/.test(content);
  }

  /**
   * Проверка наличия информации о локации
   */
  private hasLocationInfo(content: string): boolean {
    const locationKeywords = [
      'ст.', 'ст ', 'станци', 'station',
      'порт', 'port',
      'склад', 'warehouse', 'свх',
      'город', 'city',
    ];
    const lower = content.toLowerCase();
    return locationKeywords.some(kw => lower.includes(kw));
  }

  /**
   * Определение языка
   */
  private detectLanguage(content: string): 'ru' | 'en' | 'mixed' | 'unknown' {
    const cyrillicCount = (content.match(/[а-яё]/gi) || []).length;
    const latinCount = (content.match(/[a-z]/gi) || []).length;
    
    if (cyrillicCount > latinCount * 2) return 'ru';
    if (latinCount > cyrillicCount * 2) return 'en';
    if (cyrillicCount > 0 && latinCount > 0) return 'mixed';
    return 'unknown';
  }

  /**
   * Неизвестный формат
   */
  private unknownFormat(): DetectedFormat {
    return {
      type: 'UNKNOWN',
      confidence: 0,
      details: {
        hasContainerNumber: false,
        hasStatusInfo: false,
        hasDateInfo: false,
        hasLocationInfo: false,
        language: 'unknown',
        estimatedRowCount: 0,
      },
    };
  }
}

