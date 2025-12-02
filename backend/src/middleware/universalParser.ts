import { RawInput } from './inputProcessor.js';
import { DetectedFormat, FormatType } from './formatDetector.js';

/**
 * ============================================
 * UNIVERSAL PARSER - Универсальный парсер данных
 * ============================================
 * 
 * Извлекает структурированные данные из любого формата:
 * - Текстовые сообщения → извлечение по паттернам
 * - JSON → прямой маппинг
 * - CSV → разбор строк
 * - Смешанные данные → комбинированный подход
 */

export interface ParsedItem {
  containerNumber?: string;
  statusCode?: string;
  statusText?: string;
  location?: string;
  locationType?: string; // STATION, PORT, WAREHOUSE, etc.
  distanceToDestination?: number;
  eta?: string;
  etaUnload?: string;        // Дата разгрузки
  eventTime?: string;
  origin?: string;
  destination?: string;
  carrierName?: string;
  carrierType?: string;
  sourceInfo?: string;       // Источник данных (CRM, Excel, Email и т.д.)
  operatorComment?: string;  // Комментарий оператора
  rawSource: string;
  extractionConfidence: number;
}

export interface ParseResult {
  items: ParsedItem[];
  errors: string[];
  warnings: string[];
}

export class UniversalParser {
  
  /**
   * Главный метод парсинга
   */
  async parse(input: RawInput, format: DetectedFormat): Promise<ParseResult> {
    const { content } = input;
    
    // Если это массив - обрабатываем как TABLE_ROWS независимо от детекции
    if (Array.isArray(content)) {
      return this.parseJsonArray(content);
    }
    
    switch (format.type) {
      case 'PLAIN_TEXT':
        return this.parseText(content as string);
      
      case 'JSON_OBJECT':
        return this.parseJsonObject(content);
      
      case 'JSON_ARRAY':
      case 'TABLE_ROWS':
        return this.parseJsonArray(content);
      
      case 'TABLE_ROW':
        return this.parseTableRow(content);
      
      case 'CSV_TEXT':
        return this.parseCSV(content as string);
      
      case 'MIXED':
        return this.parseMixed(content);
      
      default:
        return this.attemptBestEffort(content);
    }
  }

  /**
   * Парсинг свободного текста
   * Использует набор регулярных выражений и эвристик
   */
  private parseText(text: string): ParseResult {
    const items: ParsedItem[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Извлекаем все номера контейнеров
    const containerNumbers = this.extractContainerNumbers(text);
    
    if (containerNumbers.length === 0) {
      // Пытаемся создать запись без номера контейнера
      const item = this.extractDataFromText(text, undefined);
      if (item.statusCode || item.location) {
        items.push(item);
        warnings.push('Container number not found, extracted partial data');
      } else {
        errors.push('No container number or useful data found in text');
      }
      return { items, errors, warnings };
    }

    // Для каждого номера контейнера пытаемся извлечь данные
    for (const containerNumber of containerNumbers) {
      const item = this.extractDataFromText(text, containerNumber);
      items.push(item);
    }

    return { items, errors, warnings };
  }

  /**
   * Извлечение данных из текста
   */
  private extractDataFromText(text: string, containerNumber?: string): ParsedItem {
    const lowerText = text.toLowerCase();
    let confidence = 0.5;

    // Извлекаем локацию
    const location = this.extractLocation(text);
    if (location) confidence += 0.1;

    // Извлекаем расстояние
    const distance = this.extractDistance(text);
    if (distance !== undefined) confidence += 0.1;

    // Извлекаем ETA
    const eta = this.extractETA(text);
    if (eta) confidence += 0.1;

    // Извлекаем дату разгрузки
    const etaUnload = this.extractUnloadDate(text);

    // Определяем статус
    const { statusCode, statusText } = this.extractStatus(text);
    if (statusCode !== 'UNKNOWN') confidence += 0.15;

    // Сначала пробуем извлечь маршрут целиком (более точно)
    const route = this.extractRoute(text);
    
    // Если маршрут не нашёлся, пробуем отдельные поля
    let origin = route?.origin;
    let destination = route?.destination;
    
    if (!origin) {
      origin = this.extractOrigin(text);
    }
    if (!destination) {
      destination = this.extractDestination(text);
      // Фильтруем "порт" как destination если это не настоящий пункт назначения
      if (destination?.toLowerCase() === 'порт' || destination?.toLowerCase() === 'port') {
        destination = undefined;
      }
    }
    
    if (origin) confidence += 0.05;
    if (destination) confidence += 0.05;

    // Извлекаем перевозчика
    const carrierName = this.extractCarrier(text);

    // Извлекаем дату события
    const eventTime = this.extractEventTime(text);

    // Извлекаем источник данных
    const sourceInfo = this.extractSourceInfo(text);

    // Извлекаем комментарий оператора
    const operatorComment = this.extractOperatorComment(text);

    if (containerNumber) confidence += 0.05;

    return {
      containerNumber,
      statusCode,
      statusText,
      location,
      distanceToDestination: distance,
      eta,
      etaUnload,
      eventTime,
      origin,
      destination,
      carrierName,
      sourceInfo,
      operatorComment,
      rawSource: text,
      extractionConfidence: Math.min(confidence, 1),
    };
  }

  /**
   * Парсинг JSON объекта
   */
  private parseJsonObject(content: string | object): ParseResult {
    const items: ParsedItem[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const obj = typeof content === 'string' ? JSON.parse(content) : content;
      
      // Проверяем вложенные массивы
      if (Array.isArray(obj.rows)) {
        return this.parseJsonArray(obj.rows);
      }
      if (Array.isArray(obj.data)) {
        return this.parseJsonArray(obj.data);
      }
      if (Array.isArray(obj.containers)) {
        return this.parseJsonArray(obj.containers);
      }

      // Если есть поле body - это текстовое сообщение
      if (typeof obj.body === 'string') {
        const textResult = this.parseText(obj.body);
        // Добавляем метаданные из объекта
        for (const item of textResult.items) {
          if (obj.carrierName && !item.carrierName) {
            item.carrierName = obj.carrierName;
          }
        }
        return textResult;
      }

      // Пытаемся распарсить как строку таблицы
      const item = this.mapTableRow(obj);
      items.push(item);

    } catch (e) {
      errors.push(`Failed to parse JSON object: ${e instanceof Error ? e.message : 'unknown error'}`);
    }

    return { items, errors, warnings };
  }

  /**
   * Парсинг JSON массива
   */
  private parseJsonArray(content: string | object | unknown[]): ParseResult {
    const items: ParsedItem[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const arr = Array.isArray(content) 
        ? content 
        : (typeof content === 'string' ? JSON.parse(content) : [content]);

      for (let i = 0; i < arr.length; i++) {
        try {
          const row = arr[i];
          
          if (typeof row === 'string') {
            // Строка - пытаемся как текст
            const textResult = this.parseText(row);
            items.push(...textResult.items);
          } else if (typeof row === 'object' && row !== null) {
            // Объект - маппим поля
            const item = this.mapTableRow(row as Record<string, unknown>);
            items.push(item);
          }
        } catch (e) {
          warnings.push(`Failed to parse row ${i}: ${e instanceof Error ? e.message : 'unknown'}`);
        }
      }

    } catch (e) {
      errors.push(`Failed to parse JSON array: ${e instanceof Error ? e.message : 'unknown error'}`);
    }

    return { items, errors, warnings };
  }

  /**
   * Парсинг строки таблицы
   */
  private parseTableRow(content: string | object): ParseResult {
    const items: ParsedItem[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const obj = typeof content === 'string' ? JSON.parse(content) : content;
      const item = this.mapTableRow(obj as Record<string, unknown>);
      items.push(item);
    } catch (e) {
      errors.push(`Failed to parse table row: ${e instanceof Error ? e.message : 'unknown error'}`);
    }

    return { items, errors, warnings };
  }

  /**
   * Маппинг строки таблицы на ParsedItem
   */
  private mapTableRow(row: Record<string, unknown>): ParsedItem {
    // Нормализуем ключи (приводим к lowercase и убираем спецсимволы)
    const normalizedRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      // Убираем кавычки, пробелы, подчёркивания, дефисы
      const normalizedKey = key.toLowerCase()
        .replace(/^"|"$/g, '')
        .replace(/[_\s\-]/g, '');
      normalizedRow[normalizedKey] = value;
    }

    let containerNumber = this.findField(normalizedRow, [
      'containernumber', 'container', 'ktk', 'ктк', 'номер', 'number', 'containerid'
    ]) as string | undefined;

    // Если не нашли по ключу - ищем значение, похожее на номер контейнера
    if (!containerNumber) {
      for (const value of Object.values(normalizedRow)) {
        if (typeof value === 'string') {
          const cleaned = value.trim().replace(/["\s]/g, '').toUpperCase();
          if (/^[A-Z]{4}\d{6,7}$/.test(cleaned)) {
            containerNumber = cleaned;
            break;
          }
        }
      }
    }

    const statusCode = this.normalizeStatusCode(
      this.findField(normalizedRow, [
        'statuscode', 'status', 'state', 'состояние', 'статус'
      ]) as string | undefined
    );

    const statusText = this.findField(normalizedRow, [
      'statustext', 'statedescription', 'описание', 'состояниетекст'
    ]) as string | undefined;

    const location = this.findField(normalizedRow, [
      'location', 'currentlocation', 'текущееместоположение', 'локация', 'местоположение', 'station', 'станция'
    ]) as string | undefined;

    const distanceRaw = this.findField(normalizedRow, [
      'distance', 'расстояние', 'дистанция', 'distancetodestination', 'км'
    ]);
    const distanceToDestination = distanceRaw !== undefined 
      ? this.parseNumber(distanceRaw) 
      : undefined;

    const etaRaw = this.findField(normalizedRow, [
      'eta', 'arrivaldate', 'датаприбытия', 'ориентировочнаядата', 'expectedarrival'
    ]);
    const eta = etaRaw !== undefined ? this.parseDate(etaRaw) : undefined;

    const eventTimeRaw = this.findField(normalizedRow, [
      'eventtime', 'datetime', 'date', 'дата', 'время', 'timestamp'
    ]);
    const eventTime = eventTimeRaw !== undefined ? this.parseDate(eventTimeRaw) : undefined;

    const origin = this.findField(normalizedRow, [
      'origin', 'from', 'пунктотправления', 'откуда', 'отправление'
    ]) as string | undefined;

    const destination = this.findField(normalizedRow, [
      'destination', 'to', 'пунктназначения', 'куда', 'назначение'
    ]) as string | undefined;

    const carrierName = this.findField(normalizedRow, [
      'carrier', 'carriername', 'перевозчик', 'оператор', 'operator'
    ]) as string | undefined;

    const carrierType = this.findField(normalizedRow, [
      'carriertype', 'type', 'тип', 'типперевозчика', 'типктк'
    ]) as string | undefined;

    // Определяем уверенность
    let confidence = 0.3;
    if (containerNumber) confidence += 0.3;
    if (statusCode !== 'UNKNOWN') confidence += 0.2;
    if (location) confidence += 0.1;
    if (eta) confidence += 0.05;
    if (distanceToDestination !== undefined) confidence += 0.05;

    return {
      containerNumber,
      statusCode,
      statusText,
      location,
      distanceToDestination,
      eta,
      eventTime,
      origin,
      destination,
      carrierName,
      carrierType,
      rawSource: JSON.stringify(row),
      extractionConfidence: Math.min(confidence, 1),
    };
  }

  /**
   * Парсинг CSV текста
   */
  private parseCSV(text: string): ParseResult {
    const items: ParsedItem[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    // Разделяем по \n, но также обрабатываем \r\n
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) {
      errors.push('Empty CSV data');
      return { items, errors, warnings };
    }

    // Определяем разделитель
    const delimiter = this.detectDelimiter(lines[0]);

    // Первая строка - заголовки
    const rawHeaders = this.parseCSVLine(lines[0], delimiter);
    const headers = rawHeaders.map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

    // Если только одна строка - возможно, это данные без заголовков
    if (lines.length === 1) {
      // Пытаемся распарсить как данные
      const values = this.parseCSVLine(lines[0], delimiter);
      // Проверяем, есть ли в первой ячейке что-то похожее на номер контейнера
      if (values[0] && /^[A-Z]{4}\d{6,7}$/i.test(values[0].replace(/["\s]/g, ''))) {
        const item = this.mapCSVRowWithoutHeaders(values);
        items.push(item);
        return { items, errors, warnings };
      }
      warnings.push('CSV contains only header row, no data');
      return { items, errors, warnings };
    }

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = this.parseCSVLine(lines[i], delimiter);
        
        const row: Record<string, string> = {};
        for (let j = 0; j < rawHeaders.length && j < values.length; j++) {
          // Используем нормализованные ключи заголовков для маппинга
          const headerKey = rawHeaders[j].trim().replace(/^"|"$/g, '');
          const value = values[j]?.trim().replace(/^"|"$/g, '') || '';
          row[headerKey] = value;
        }

        const item = this.mapTableRow(row);
        items.push(item);
      } catch (e) {
        warnings.push(`Failed to parse CSV line ${i + 1}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    return { items, errors, warnings };
  }

  /**
   * Маппинг CSV строки без заголовков
   */
  private mapCSVRowWithoutHeaders(values: string[]): ParsedItem {
    // Пробуем угадать поля по позиции и формату
    let containerNumber: string | undefined;
    let statusCode: string | undefined;
    let location: string | undefined;
    let distance: number | undefined;

    for (const val of values) {
      const cleaned = val.trim().replace(/^"|"$/g, '');
      
      // Номер контейнера
      if (!containerNumber && /^[A-Z]{4}\d{6,7}$/i.test(cleaned)) {
        containerNumber = cleaned.toUpperCase();
        continue;
      }
      
      // Статус
      if (!statusCode && /^(ON_RAIL|IN_PORT|ON_SHIP|DELIVERED|LOADED|ON_WAREHOUSE|UNKNOWN|IN_TRANSIT)$/i.test(cleaned)) {
        statusCode = cleaned.toUpperCase();
        continue;
      }
      
      // Расстояние (число)
      if (distance === undefined && /^\d+$/.test(cleaned)) {
        distance = parseInt(cleaned, 10);
        continue;
      }
      
      // Локация (всё остальное)
      if (!location && cleaned && !/^\d+$/.test(cleaned)) {
        location = cleaned;
      }
    }

    return {
      containerNumber,
      statusCode: this.normalizeStatusCode(statusCode),
      statusText: statusCode || undefined,
      location,
      distanceToDestination: distance,
      rawSource: values.join(';'),
      extractionConfidence: containerNumber ? 0.6 : 0.3,
    };
  }

  /**
   * Парсинг смешанного формата
   */
  private parseMixed(content: string | object | unknown[]): ParseResult {
    // Пытаемся несколько стратегий
    
    if (typeof content === 'string') {
      // Сначала пробуем как JSON
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed.body === 'string') {
          return this.parseText(parsed.body);
        }
        return this.parseJsonObject(parsed);
      } catch {
        // Не JSON - как текст
        return this.parseText(content);
      }
    }

    if (typeof content === 'object' && content !== null) {
      const obj = content as Record<string, unknown>;
      if (typeof obj.body === 'string') {
        return this.parseText(obj.body);
      }
      return this.parseJsonObject(obj);
    }

    return this.attemptBestEffort(content);
  }

  /**
   * Попытка извлечь хоть что-то
   */
  private attemptBestEffort(content: unknown): ParseResult {
    const text = typeof content === 'string' 
      ? content 
      : JSON.stringify(content);
    
    return this.parseText(text);
  }

  // ================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==================

  /**
   * Извлечение номеров контейнеров из текста
   */
  private extractContainerNumbers(text: string): string[] {
    const patterns = [
      // Стандартный ISO формат: 4 буквы + 6-7 цифр
      /\b([A-Z]{4}\d{7})\b/gi,
      /\b([A-Z]{4}\s?\d{6,7})\b/gi,
      /\b([A-Z]{3}U\d{7})\b/gi,
      
      // С упоминанием "контейнер"
      /(?:контейнер|ктк|container|cntr|k[тt]k)\s*[#№:]?\s*([A-Z0-9]{10,11})/gi,
      
      // Опечатки: 3 буквы + цифра/буква + 6-7 цифр (MSC0..., ABC1...)
      /\b([A-Z]{3}[A-Z0-9]\d{6,7})\b/gi,
      
      // Смешанный (для тяжёлых опечаток)
      /\b([A-Z][A-Z0-9]{3}\d{6,7})\b/gi,
    ];

    const found = new Set<string>();
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let containerNum = (match[1] || match[0]).replace(/\s/g, '').toUpperCase();
        
        // Пробуем исправить опечатки в первых 4 символах
        if (containerNum.length >= 10) {
          const prefix = containerNum.slice(0, 4);
          const suffix = containerNum.slice(4);
          
          // Исправляем цифры на буквы в префиксе
          const fixedPrefix = prefix
            .replace(/0/g, 'O')
            .replace(/1/g, 'I')
            .replace(/5/g, 'S')
            .replace(/8/g, 'B');
          
          containerNum = fixedPrefix + suffix;
        }
        
        // Проверяем формат после исправления
        if (/^[A-Z]{4}\d{6,7}$/.test(containerNum)) {
          found.add(containerNum);
        }
      }
    }

    return Array.from(found);
  }

  /**
   * Извлечение локации
   */
  private extractLocation(text: string): string | undefined {
    const patterns = [
      // Местоположение: порт Владивосток.
      /(?:местоположение|location)[:\s]+(?:порт\s+)?([А-Яа-яёЁA-Za-z\-]+)(?:\.|,|$|\n)/i,
      // порт Владивосток
      /(?:порт|port)\s+([А-Яа-яёЁA-Za-z\-]+)/i,
      // станция Гончарово
      /(?:ст\.|станци[яи]|station)\s+([А-Яа-яёЁA-Za-z\-]+(?:\s*[\-]\s*[А-Яа-яёЁA-Za-z]+)?)/i,
      // в порту Владивосток
      /(?:в порту|in port)\s+([А-Яа-яёЁA-Za-z\-]+)/i,
      // на станции Гончарово
      /(?:на станции|at station)\s+([А-Яа-яёЁA-Za-z\-]+)/i,
      // прибыл в Владивосток
      /(?:прибыл[а]?\s+в)\s+([А-Яа-яёЁA-Za-z\-]+)/i,
      // текущее местоположение: Владивосток
      /(?:текущее местоположение|current location)[:\s]*([А-Яа-яёЁA-Za-z\-]+)/i,
      // находится в/на X
      /(?:находится\s+(?:в|на))\s+([А-Яа-яёЁA-Za-z\-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const location = match[1].trim();
        // Фильтруем служебные слова
        if (location.length > 2 && 
            !['назначения', 'отправления', 'destination', 'origin'].includes(location.toLowerCase())) {
          return location;
        }
      }
    }

    return undefined;
  }

  /**
   * Извлечение расстояния
   */
  private extractDistance(text: string): number | undefined {
    const patterns = [
      /(\d+(?:\s*\d+)?)\s*(?:км|km)\s*(?:до|to|от|from)/i,
      /(?:расстояние|distance)[:\s]*(\d+(?:\s*\d+)?)\s*(?:км|km)?/i,
      /(\d+(?:\s*\d+)?)\s*(?:км|km)\s+(?:до станции|до порта)/i,
      /(?:осталось|remaining)[:\s]*(\d+(?:\s*\d+)?)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1].replace(/\s/g, ''), 10);
      }
    }

    return undefined;
  }

  /**
   * Извлечение ETA
   */
  private extractETA(text: string): string | undefined {
    // Расширенные паттерны для извлечения ETA
    const patterns = [
      // Явные указания на ETA
      /(?:eta|ета)[:\s]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
      /(?:ориентир\w*\s*(?:дата\s*)?(?:прибыти[яе])?)[:\s]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
      /(?:прибытие|прибудет|arrival)[:\s]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
      /(?:ожида[её]тся|expected|планируется)[:\s]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
      /(?:дата прибытия|arrival date|дата доставки)[:\s]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
      /(?:плановая дата|план\s*дата)[:\s]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
      
      // Формат с годом впереди
      /(?:eta|ориентир|прибытие)[:\s]*(\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2})/i,
      
      // Дата в скобках после ключевых слов
      /(?:ориентир|прибытие|eta)\s*[:\-]?\s*\(?(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})\)?/i,
      
      // Обратный порядок: дата перед словом
      /(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})\s*[-–—]?\s*(?:ориентир|прибытие|eta)/i,
      
      // Словесные месяцы: "15 декабря 2025", "15 дек 2025"
      /(?:eta|ориентир|прибытие)[:\s]*(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|янв|фев|мар|апр|мая|июн|июл|авг|сен|окт|ноя|дек)\.?\s*(\d{4}|\d{2})/i,
      /(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря|янв|фев|мар|апр|мая|июн|июл|авг|сен|окт|ноя|дек)\.?\s*(\d{4}|\d{2})\s*[-–—]?\s*(?:ориентир|прибытие)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        // Проверяем, есть ли словесный месяц
        if (match[2] && /[а-яё]/i.test(match[2])) {
          const day = parseInt(match[1]);
          const month = this.parseMonthName(match[2]);
          let year = parseInt(match[3]);
          if (year < 100) year += 2000;
          
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        } else if (match[1]) {
          const parsed = this.parseDate(match[1]);
          if (parsed) return parsed;
        }
      }
    }

    return undefined;
  }

  /**
   * Парсинг названия месяца
   */
  private parseMonthName(name: string): number {
    const months: Record<string, number> = {
      'января': 0, 'янв': 0, 'jan': 0,
      'февраля': 1, 'фев': 1, 'feb': 1,
      'марта': 2, 'мар': 2, 'mar': 2,
      'апреля': 3, 'апр': 3, 'apr': 3,
      'мая': 4, 'may': 4,
      'июня': 5, 'июн': 5, 'jun': 5,
      'июля': 6, 'июл': 6, 'jul': 6,
      'августа': 7, 'авг': 7, 'aug': 7,
      'сентября': 8, 'сен': 8, 'sep': 8,
      'октября': 9, 'окт': 9, 'oct': 9,
      'ноября': 10, 'ноя': 10, 'nov': 10,
      'декабря': 11, 'дек': 11, 'dec': 11,
    };
    return months[name.toLowerCase()] ?? 0;
  }

  /**
   * Извлечение статуса
   */
  private extractStatus(text: string): { statusCode: string; statusText: string } {
    const lowerText = text.toLowerCase();

    // Порядок важен! Более специфичные паттерны идут первыми
    const statusMap: Array<{ keywords: string[]; code: string; text: string }> = [
      { keywords: ['доставлен', 'delivered', 'выдан', 'получен', 'вручен'], code: 'DELIVERED', text: 'Доставлен' },
      { keywords: ['прибыл в порт', 'arrived port', 'порт назначения', 'прибытие в порт'], code: 'ARRIVED_PORT', text: 'Прибыл в порт' },
      { keywords: ['в порту', 'in port', 'порт владивосток', 'порт восточный', 'порт находка'], code: 'IN_PORT', text: 'В порту' },
      { keywords: ['на рейде', 'рейд', 'anchorage', 'ожидает захода'], code: 'ON_ANCHORAGE', text: 'На рейде' },
      { keywords: ['прибыл на станц', 'прибыл на ст', 'rail arrived', 'на станции назначения'], code: 'RAIL_ARRIVED', text: 'На станции' },
      { keywords: ['на станции', 'ст.', 'станци'], code: 'ON_RAIL', text: 'На ЖД' }, // на станции = едет по ЖД
      { keywords: ['отгружен на жд', 'on rail', 'железн', 'ж/д', 'в пути жд', 'по жд', 'едет по жд'], code: 'ON_RAIL', text: 'На ЖД' },
      { keywords: ['в пути море', 'on ship', 'на судне', 'в море', 'морем', 'идёт морем', 'плывёт'], code: 'ON_SHIP', text: 'В море' },
      { keywords: ['на складе', 'warehouse', 'свх', 'размещ', 'на свх', 'склад'], code: 'ON_WAREHOUSE', text: 'На складе' },
      { keywords: ['погружен', 'загружен', 'loaded', 'отгружен', 'затарен'], code: 'LOADED', text: 'Погружен' },
      { keywords: ['растаможен', 'customs cleared', 'выпущен таможней'], code: 'CUSTOMS_CLEARED', text: 'Растаможен' },
      { keywords: ['таможн', 'customs'], code: 'CUSTOMS', text: 'На таможне' },
      { keywords: ['выгружен', 'unloaded'], code: 'UNLOADED', text: 'Выгружен' },
      { keywords: ['в пути', 'transit', 'следует'], code: 'IN_TRANSIT', text: 'В пути' },
      { keywords: ['авто', 'автомобил', 'фура', 'машина'], code: 'ON_AUTO', text: 'Автодоставка' },
      { keywords: ['ожида', 'погрузк'], code: 'LOADED', text: 'Ожидает погрузки' },
    ];

    for (const status of statusMap) {
      if (status.keywords.some(kw => lowerText.includes(kw))) {
        return { statusCode: status.code, statusText: status.text };
      }
    }

    return { statusCode: 'UNKNOWN', statusText: 'Статус не определён' };
  }

  /**
   * Извлечение пункта отправления
   */
  private extractOrigin(text: string): string | undefined {
    const patterns = [
      /(?:из|from|откуда|отправление)[:\s]+([А-Яа-яёЁA-Za-z\-]+)/i,
      /(?:пункт отправления)[:\s]+([А-Яа-яёЁA-Za-z\-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Извлечение пункта назначения
   */
  private extractDestination(text: string): string | undefined {
    const patterns = [
      /(?:до станции|до порта|в|to|куда|назначение)[:\s]+([А-Яа-яёЁA-Za-z\-]+)/i,
      /(?:пункт назначения)[:\s]+([А-Яа-яёЁA-Za-z\-]+)/i,
      /(\d+)\s*км\s+до\s+(?:станции|порта)?\s*([А-Яа-яёЁA-Za-z\-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const result = match[2] || match[1];
        if (result && !/^\d+$/.test(result)) {
          return result.trim();
        }
      }
    }

    return undefined;
  }

  /**
   * Извлечение перевозчика
   */
  private extractCarrier(text: string): string | undefined {
    const patterns = [
      /(?:оператор\s*связи|carrier|перевозчик)[:\s]+([А-Яа-яёЁA-Za-z\s\-]+?)(?:\n|$|\.)/i,
      /(?:shipping\s*line|морская\s*линия|линия)[:\s]+([А-Яа-яёЁA-Za-z\s\-]+?)(?:\n|$|\.)/i,
      /(?:оператор|operator)[:\s]+([А-Яа-яёЁA-Za-z\s\-]+?)(?:\n|$|\.)/i,
      /(?:компания|company)[:\s]+([А-Яа-яёЁA-Za-z\s\-]+?)(?:\n|$|\.)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const carrier = match[1].trim();
        // Убираем если слишком короткий или слишком длинный
        if (carrier.length > 2 && carrier.length < 100) {
          return carrier;
        }
      }
    }

    // Ищем известные компании
    const knownCarriers = [
      'Maersk', 'MSC', 'CMA CGM', 'COSCO', 'Hapag-Lloyd', 'ONE', 'Evergreen',
      'Yang Ming', 'HMM', 'ZIM', 'PIL', 'Wan Hai', 'SITC', 'FESCO',
      'SeaTrade', 'TransContainer', 'РЖД', 'ОТЭКО'
    ];

    for (const carrier of knownCarriers) {
      if (text.toLowerCase().includes(carrier.toLowerCase())) {
        return carrier;
      }
    }

    return undefined;
  }

  /**
   * Извлечение времени события
   */
  private extractEventTime(text: string): string | undefined {
    const datePatterns = [
      /(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/,
      /(\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2})/,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return this.parseDate(match[1]) || undefined;
      }
    }

    return undefined;
  }

  /**
   * Извлечение маршрута (origin → destination)
   */
  private extractRoute(text: string): { origin?: string; destination?: string } | undefined {
    // Unicode стрелки и разделители
    const arrowPattern = '[→\\->–—]';
    
    const patterns = [
      // Маршрут: Ningbo (CN) → Vladivostok (RU).
      new RegExp(`(?:маршрут|route)[:\\s]*([A-Za-zА-Яа-яёЁ]+)\\s*(?:\\([A-Z]{2}\\))?\\s*${arrowPattern}+\\s*([A-Za-zА-Яа-яёЁ]+)\\s*(?:\\([A-Z]{2}\\))?`, 'i'),
      // Ningbo → Vladivostok (без "маршрут:")
      new RegExp(`([A-Z][a-z]{2,})\\s*(?:\\([A-Z]{2}\\))?\\s*${arrowPattern}+\\s*([A-Z][a-z]{2,})\\s*(?:\\([A-Z]{2}\\))?`),
      // из Шанхая в Москву
      /из\s+([А-Яа-яёЁA-Za-z\-]+)\s+(?:в|до|на)\s+([А-Яа-яёЁA-Za-z\-]+)/i,
      // from Shanghai to Moscow
      /from\s+([A-Za-z\-]+)\s+to\s+([A-Za-z\-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1] && match[2]) {
        const origin = match[1].trim();
        const destination = match[2].trim();
        // Фильтруем слишком короткие или служебные слова
        const skipWords = ['порт', 'port', 'станция', 'station', 'cn', 'ru', 'в', 'на', 'to', 'from'];
        if (origin.length > 2 && destination.length > 2 && 
            !skipWords.includes(origin.toLowerCase()) &&
            !skipWords.includes(destination.toLowerCase())) {
          return { origin, destination };
        }
      }
    }

    return undefined;
  }

  /**
   * Извлечение даты разгрузки
   */
  private extractUnloadDate(text: string): string | undefined {
    const patterns = [
      /(?:разгрузк[аи]|unload(?:ing)?|выгрузк[аи])[:\s]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
      /(?:ориентир\w*\s*разгрузк[аи])[:\s]*(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})/i,
      /(\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})\s*[-–—]?\s*(?:разгрузк|выгрузк)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return this.parseDate(match[1]) || undefined;
      }
    }

    return undefined;
  }

  /**
   * Извлечение источника данных
   */
  private extractSourceInfo(text: string): string | undefined {
    const patterns = [
      /(?:источник\s*(?:данных)?|source)[:\s]*([^\n.]+)/i,
      /(?:получено\s*из|from)[:\s]*([^\n.]+)/i,
      /\(([^)]*(?:CRM|Excel|email|API|сайт|site|выгрузк)[^)]*)\)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const source = match[1].trim();
        if (source.length > 3 && source.length < 100) {
          return source;
        }
      }
    }

    // Ищем ключевые слова
    const lowerText = text.toLowerCase();
    if (lowerText.includes('crm')) return 'CRM';
    if (lowerText.includes('excel')) return 'Excel';
    if (lowerText.includes('email') || lowerText.includes('письм')) return 'Email';
    if (lowerText.includes('api')) return 'API';
    if (lowerText.includes('сайт') || lowerText.includes('site')) return 'Сайт';

    return undefined;
  }

  /**
   * Извлечение комментария оператора
   */
  private extractOperatorComment(text: string): string | undefined {
    const patterns = [
      // Комментарий оператора: текст
      /(?:комментарий\s*оператора|operator\s*comment)[:\s]*([^\n]+)/i,
      // Комментарий: текст
      /(?:комментарий|comment)[:\s]*([^\n]+)/i,
      // Примечание: текст
      /(?:примечани[ея]|note)[:\s]*([^\n]+)/i,
      // Замечание: текст
      /(?:замечани[ея]|remark)[:\s]*([^\n]+)/i,
      // Доп. информация: текст
      /(?:доп\.?\s*информация|additional\s*info)[:\s]*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let comment = match[1].trim();
        // Убираем лишние префиксы если остались
        comment = comment.replace(/^оператора[:\s]*/i, '').trim();
        // Убираем если слишком короткий или слишком длинный
        if (comment.length > 5 && comment.length < 500) {
          return comment;
        }
      }
    }

    return undefined;
  }

  /**
   * Поиск поля по альтернативным именам
   */
  private findField(obj: Record<string, unknown>, names: string[]): unknown {
    for (const name of names) {
      if (obj[name] !== undefined) {
        return obj[name];
      }
    }
    return undefined;
  }

  /**
   * Нормализация кода статуса
   */
  private normalizeStatusCode(raw?: string): string {
    if (!raw) return 'UNKNOWN';
    
    const lower = raw.toLowerCase().replace(/[_\s\-]/g, '');
    
    const mapping: Record<string, string> = {
      // English codes
      'delivered': 'DELIVERED',
      'onrail': 'ON_RAIL',
      'rail': 'ON_RAIL',
      'onship': 'ON_SHIP',
      'ship': 'ON_SHIP',
      'inport': 'IN_PORT',
      'port': 'IN_PORT',
      'arrivedport': 'ARRIVED_PORT',
      'loaded': 'LOADED',
      'onwarehouse': 'ON_WAREHOUSE',
      'warehouse': 'ON_WAREHOUSE',
      'customs': 'CUSTOMS',
      'customscleared': 'CUSTOMS_CLEARED',
      'intransit': 'IN_TRANSIT',
      'transit': 'IN_TRANSIT',
      'onanchorage': 'ON_ANCHORAGE',
      'anchorage': 'ON_ANCHORAGE',
      'railarrived': 'RAIL_ARRIVED',
      'onauto': 'ON_AUTO',
      'auto': 'ON_AUTO',
      'unloaded': 'UNLOADED',
      'unknown': 'UNKNOWN',
      
      // Russian
      'доставлен': 'DELIVERED',
      'нажд': 'ON_RAIL',
      'жд': 'ON_RAIL',
      'железнодорожный': 'ON_RAIL',
      'вморе': 'ON_SHIP',
      'море': 'ON_SHIP',
      'морем': 'ON_SHIP',
      'впорту': 'IN_PORT',
      'порт': 'IN_PORT',
      'прибылвпорт': 'ARRIVED_PORT',
      'погружен': 'LOADED',
      'загружен': 'LOADED',
      'отгружен': 'LOADED',
      'свх': 'ON_WAREHOUSE',
      'склад': 'ON_WAREHOUSE',
      'насвх': 'ON_WAREHOUSE',
      'таможня': 'CUSTOMS',
      'растаможен': 'CUSTOMS_CLEARED',
      'впути': 'IN_TRANSIT',
      'следует': 'IN_TRANSIT',
      'нарейде': 'ON_ANCHORAGE',
      'рейд': 'ON_ANCHORAGE',
      'настанции': 'RAIL_ARRIVED',
      'прибылнастанцию': 'RAIL_ARRIVED',
      'авто': 'ON_AUTO',
      'автодоставка': 'ON_AUTO',
      'выгружен': 'UNLOADED',
    };

    // Сначала проверяем точное совпадение
    if (mapping[lower]) {
      return mapping[lower];
    }
    
    // Затем проверяем вхождение
    for (const [key, value] of Object.entries(mapping)) {
      if (lower.includes(key) || key.includes(lower)) {
        return value;
      }
    }

    return 'UNKNOWN';
  }

  /**
   * Парсинг числа
   */
  private parseNumber(value: unknown): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseInt(value.replace(/[^\d]/g, ''), 10);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }

  /**
   * Парсинг даты
   */
  private parseDate(value: unknown): string | null {
    if (!value) return null;
    
    const str = String(value).trim();
    
    // Форматы дат с регулярными выражениями
    const datePatterns: Array<{
      regex: RegExp;
      order: 'DMY' | 'YMD' | 'MDY';
    }> = [
      // DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY
      { regex: /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/, order: 'DMY' },
      // DD.MM.YY
      { regex: /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2})$/, order: 'DMY' },
      // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
      { regex: /^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/, order: 'YMD' },
      // YYYY-MM-DDTHH:mm:ss (ISO)
      { regex: /^(\d{4})-(\d{2})-(\d{2})T/, order: 'YMD' },
      // DD MMM YYYY (04 Dec 2025)
      { regex: /^(\d{1,2})\s+([A-Za-zА-Яа-яёЁ]{3,})\s+(\d{4})$/, order: 'DMY' },
      // DDMMYYYY (без разделителей)
      { regex: /^(\d{2})(\d{2})(\d{4})$/, order: 'DMY' },
      // YYYYMMDD (без разделителей)
      { regex: /^(\d{4})(\d{2})(\d{2})$/, order: 'YMD' },
    ];

    for (const { regex, order } of datePatterns) {
      const match = str.match(regex);
      if (match) {
        let day: number, month: number, year: number;
        
        // Проверяем, есть ли текстовый месяц
        if (/[A-Za-zА-Яа-яёЁ]/.test(match[2])) {
          day = parseInt(match[1]);
          month = this.parseMonthName(match[2]);
          year = parseInt(match[3]);
        } else if (order === 'YMD') {
          year = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          day = parseInt(match[3]);
        } else if (order === 'MDY') {
          month = parseInt(match[1]) - 1;
          day = parseInt(match[2]);
          year = parseInt(match[3]);
        } else {
          // DMY
          day = parseInt(match[1]);
          month = parseInt(match[2]) - 1;
          year = parseInt(match[3]);
        }
        
        // Корректируем двузначный год
        if (year < 100) {
          year += year > 50 ? 1900 : 2000;
        }
        
        // Валидация диапазонов
        if (month < 0 || month > 11) continue;
        if (day < 1 || day > 31) continue;
        if (year < 2020 || year > 2035) continue;
        
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }

    // Пробуем нативный парсинг для ISO и других форматов
    try {
      const date = new Date(str);
      if (!isNaN(date.getTime())) {
        // Проверяем что дата в разумном диапазоне
        const year = date.getFullYear();
        if (year >= 2020 && year <= 2035) {
          return date.toISOString();
        }
      }
    } catch {
      // Ошибка парсинга
    }

    return null;
  }

  /**
   * Определение разделителя CSV
   */
  private detectDelimiter(line: string): string {
    const delimiters = [';', ',', '\t', '|'];
    let maxCount = 0;
    let bestDelimiter = ';';

    for (const d of delimiters) {
      // Экранируем спецсимволы для RegExp (| - спецсимвол)
      const escaped = d.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
      const count = (line.match(new RegExp(escaped, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = d;
      }
    }

    return bestDelimiter;
  }

  /**
   * Парсинг строки CSV с учётом кавычек
   */
  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }
}

