import { ParsedItem } from './universalParser.js';
import { NormalizedStatusEvent } from '../types/index.js';
import { StatusCode, SourceType } from '@prisma/client';
import { validateContainerNumber, ContainerValidationResult } from './containerValidator.js';
import { findLocation, normalizeLocationName, inferLocationType } from './locationDictionary.js';

/**
 * ============================================
 * DATA VALIDATOR - Валидация и финализация данных
 * ============================================
 * 
 * Выполняет строгую валидацию с высокой точностью:
 * - Проверка номера контейнера по ISO 6346
 * - Валидация локаций по справочнику
 * - Проверка логической консистентности
 * - Расчёт точной уверенности
 */

export interface ValidationResult {
  isValid: boolean;
  normalized?: NormalizedStatusEvent;
  partialData?: NormalizedStatusEvent;
  errors: string[];
  warnings: string[];
  confidence: number;
  validationDetails: {
    containerValidation?: ContainerValidationResult;
    locationConfidence: number;
    statusConfidence: number;
    dataCompleteness: number;
    consistencyScore: number;
  };
}

// Маппинг статусов на допустимые типы локаций
const STATUS_LOCATION_RULES: Record<string, string[]> = {
  'ON_RAIL': ['STATION'],
  'RAIL_ARRIVED': ['STATION'],
  'IN_PORT': ['PORT'],
  'ARRIVED_PORT': ['PORT'],
  'ON_ANCHORAGE': ['PORT'],
  'ON_SHIP': [], // В море - локация не обязательна
  'ON_WAREHOUSE': ['WAREHOUSE', 'CUSTOMS'],
  'CUSTOMS': ['WAREHOUSE', 'CUSTOMS'],
  'CUSTOMS_CLEARED': ['WAREHOUSE', 'CUSTOMS'],
  'DELIVERED': ['CITY', 'WAREHOUSE'],
};

export class DataValidator {
  
  /**
   * Валидация и нормализация ParsedItem с высокой точностью
   */
  validate(item: ParsedItem): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let containerValidation: ContainerValidationResult | undefined;
    let locationConfidence = 0;
    let statusConfidence = 0;
    let consistencyScore = 1;

    // ═══════════════════════════════════════════════════
    // 1. ВАЛИДАЦИЯ НОМЕРА КОНТЕЙНЕРА (ISO 6346)
    // ═══════════════════════════════════════════════════
    
    if (item.containerNumber) {
      containerValidation = validateContainerNumber(item.containerNumber);
      
      if (!containerValidation.isValid) {
        errors.push(containerValidation.error || 'Invalid container number');
      } else {
        // Применяем исправленный номер
        item.containerNumber = containerValidation.containerNumber;
        
        if (containerValidation.corrections) {
          warnings.push(...containerValidation.corrections);
        }
        
        if (!containerValidation.details.checkDigitValid) {
          warnings.push('Контрольная цифра не соответствует ISO 6346');
        }
      }
    } else {
      errors.push('Номер контейнера обязателен');
    }

    // ═══════════════════════════════════════════════════
    // 2. ВАЛИДАЦИЯ ЛОКАЦИИ
    // ═══════════════════════════════════════════════════
    
    let normalizedLocation: string | undefined;
    
    if (item.location) {
      const locationResult = findLocation(item.location);
      
      if (locationResult.found && locationResult.location) {
        normalizedLocation = locationResult.location.name;
        locationConfidence = locationResult.confidence;
        
        // Добавляем тип локации если определён
        if (locationResult.location.type) {
          item.locationType = locationResult.location.type;
        }
      } else {
        // Локация не найдена в справочнике
        normalizedLocation = normalizeLocationName(item.location);
        locationConfidence = 0.5;
        warnings.push(`Локация "${item.location}" не найдена в справочнике`);
        
        // Пробуем определить тип по контексту
        const inferredType = inferLocationType(item.location);
        if (inferredType) {
          item.locationType = inferredType;
          locationConfidence += 0.2;
        }
      }
    }

    // ═══════════════════════════════════════════════════
    // 3. ВАЛИДАЦИЯ СТАТУСА
    // ═══════════════════════════════════════════════════
    
    const statusCode = this.validateAndMapStatus(item.statusCode);
    
    if (statusCode === 'UNKNOWN') {
      if (item.statusCode && item.statusCode !== 'UNKNOWN') {
        warnings.push(`Неизвестный статус: ${item.statusCode}`);
        statusConfidence = 0.3;
      } else {
        statusConfidence = 0.1;
      }
    } else {
      statusConfidence = 0.95; // Высокая уверенность для известного статуса
    }

    // ═══════════════════════════════════════════════════
    // 4. ПРОВЕРКА КОНСИСТЕНТНОСТИ
    // ═══════════════════════════════════════════════════
    
    // Проверяем соответствие статуса и типа локации
    if (statusCode !== 'UNKNOWN' && item.locationType) {
      const allowedLocationTypes = STATUS_LOCATION_RULES[statusCode];
      if (allowedLocationTypes && allowedLocationTypes.length > 0) {
        if (!allowedLocationTypes.includes(item.locationType)) {
          warnings.push(`Тип локации ${item.locationType} не соответствует статусу ${statusCode}`);
          consistencyScore *= 0.8;
        }
      }
    }
    
    // Проверяем логичность расстояния
    if (item.distanceToDestination !== undefined) {
      if (item.distanceToDestination < 0) {
        errors.push('Расстояние не может быть отрицательным');
        item.distanceToDestination = undefined;
      } else if (item.distanceToDestination > 15000) {
        warnings.push(`Необычно большое расстояние: ${item.distanceToDestination} км`);
        consistencyScore *= 0.9;
      }
      
      // Если доставлен, расстояние должно быть 0
      if (statusCode === 'DELIVERED' && item.distanceToDestination > 0) {
        warnings.push('Статус "доставлен", но расстояние > 0');
        consistencyScore *= 0.9;
      }
    }

    // ═══════════════════════════════════════════════════
    // 5. ВАЛИДАЦИЯ ДАТ
    // ═══════════════════════════════════════════════════
    
    const eta = this.validateDate(item.eta);
    if (item.eta && !eta) {
      warnings.push(`Некорректная дата ETA: ${item.eta}`);
    }
    
    // Проверяем что ETA в будущем (если статус не "доставлен")
    if (eta && statusCode !== 'DELIVERED') {
      const etaDate = new Date(eta);
      const now = new Date();
      if (etaDate < now) {
        warnings.push('ETA в прошлом');
        consistencyScore *= 0.9;
      }
    }

    const eventTime = this.validateDate(item.eventTime) || new Date().toISOString();

    // ═══════════════════════════════════════════════════
    // 6. РАСЧЁТ ПОЛНОТЫ ДАННЫХ
    // ═══════════════════════════════════════════════════
    
    let filledFields = 0;
    const totalFields = 6;
    
    if (item.containerNumber) filledFields++;
    if (statusCode !== 'UNKNOWN') filledFields++;
    if (normalizedLocation) filledFields++;
    if (eta) filledFields++;
    if (item.distanceToDestination !== undefined) filledFields++;
    if (item.origin || item.destination) filledFields++;
    
    const dataCompleteness = filledFields / totalFields;

    // ═══════════════════════════════════════════════════
    // 7. РАСЧЁТ ИТОГОВОЙ УВЕРЕННОСТИ
    // ═══════════════════════════════════════════════════
    
    let confidence = 0;
    
    // Базовая уверенность от валидации контейнера (главный фактор)
    if (containerValidation?.isValid) {
      confidence = containerValidation.confidence; // Начинаем с уверенности контейнера (70-100%)
      
      // Бонусы за дополнительные данные
      if (statusConfidence > 0.9) confidence += 0.05;    // +5% за известный статус
      if (locationConfidence > 0.9) confidence += 0.05;  // +5% за известную локацию
      if (dataCompleteness > 0.5) confidence += 0.03;    // +3% за полноту данных
      if (consistencyScore >= 1) confidence += 0.02;     // +2% за консистентность
      
      // Максимум 100%
      confidence = Math.min(confidence, 1.0);
    } else {
      // Если контейнер невалидный, считаем по старой формуле
      confidence = statusConfidence * 0.3 + locationConfidence * 0.3 + dataCompleteness * 0.4;
    }
    
    // Штраф только за критические ошибки
    if (errors.length > 0) {
      confidence *= 0.5; // -50% если есть ошибки
    }
    
    // Небольшой штраф за много предупреждений (>3)
    if (warnings.length > 3) {
      confidence *= 0.95;
    }

    // ═══════════════════════════════════════════════════
    // 8. ФОРМИРОВАНИЕ РЕЗУЛЬТАТА
    // ═══════════════════════════════════════════════════
    
    const normalized: NormalizedStatusEvent = {
      containerNumber: item.containerNumber,
      statusCode: statusCode,
      statusText: item.statusText || this.getStatusText(statusCode),
      location: normalizedLocation,
      distanceToDestinationKm: this.validateDistance(item.distanceToDestination),
      eta: eta,
      eventTime: eventTime,
      sourceType: 'MANUAL' as SourceType,
      sourceRaw: item.rawSource,
      origin: this.sanitizeString(item.origin),
      destination: this.sanitizeString(item.destination),
      carrierName: this.sanitizeString(item.carrierName),
    };

    const hasMinimalData = !!(
      normalized.containerNumber || 
      (normalized.statusCode !== 'UNKNOWN') ||
      normalized.location
    );

    const isValid = errors.length === 0 && !!normalized.containerNumber && confidence >= 0.5;

    return {
      isValid,
      normalized: isValid ? normalized : undefined,
      partialData: !isValid && hasMinimalData ? normalized : undefined,
      errors,
      warnings,
      confidence: Math.round(confidence * 100) / 100,
      validationDetails: {
        containerValidation,
        locationConfidence,
        statusConfidence,
        dataCompleteness,
        consistencyScore,
      },
    };
  }

  /**
   * Валидация и маппинг статуса
   */
  private validateAndMapStatus(value?: string): StatusCode {
    if (!value) return 'UNKNOWN';

    const upper = value.toUpperCase().replace(/[_\s\-]/g, '');
    
    const validStatuses: Record<string, StatusCode> = {
      'LOADED': 'LOADED',
      'INPORT': 'IN_PORT',
      'IN_PORT': 'IN_PORT',
      'PORT': 'IN_PORT',
      'ONSHIP': 'ON_SHIP',
      'ON_SHIP': 'ON_SHIP',
      'SHIP': 'ON_SHIP',
      'ONRAIL': 'ON_RAIL',
      'ON_RAIL': 'ON_RAIL',
      'RAIL': 'ON_RAIL',
      'ONWAREHOUSE': 'ON_WAREHOUSE',
      'ON_WAREHOUSE': 'ON_WAREHOUSE',
      'WAREHOUSE': 'ON_WAREHOUSE',
      'DELIVERED': 'DELIVERED',
      'UNKNOWN': 'UNKNOWN',
      'INTRANSIT': 'IN_TRANSIT',
      'IN_TRANSIT': 'IN_TRANSIT',
      'TRANSIT': 'IN_TRANSIT',
      'CUSTOMS': 'CUSTOMS',
      'ONANCHORAGE': 'ON_ANCHORAGE',
      'ON_ANCHORAGE': 'ON_ANCHORAGE',
      'ANCHORAGE': 'ON_ANCHORAGE',
      'ARRIVEDPORT': 'ARRIVED_PORT',
      'ARRIVED_PORT': 'ARRIVED_PORT',
      'RAILARRIVED': 'RAIL_ARRIVED',
      'RAIL_ARRIVED': 'RAIL_ARRIVED',
      'CUSTOMSCLEARED': 'CUSTOMS_CLEARED',
      'CUSTOMS_CLEARED': 'CUSTOMS_CLEARED',
      'UNLOADED': 'UNLOADED',
      'ONAUTO': 'ON_AUTO',
      'ON_AUTO': 'ON_AUTO',
      'AUTO': 'ON_AUTO',
    };

    return validStatuses[upper] || 'UNKNOWN';
  }

  /**
   * Получение текстового описания статуса
   */
  private getStatusText(code: StatusCode): string {
    const texts: Record<StatusCode, string> = {
      'LOADED': 'Загружен',
      'IN_PORT': 'В порту',
      'ON_SHIP': 'В море',
      'ON_RAIL': 'В пути по ЖД',
      'ON_WAREHOUSE': 'На складе',
      'DELIVERED': 'Доставлен',
      'UNKNOWN': 'Статус неизвестен',
      'IN_TRANSIT': 'В пути',
      'CUSTOMS': 'На таможне',
      'ON_ANCHORAGE': 'На рейде',
      'ARRIVED_PORT': 'Прибыл в порт',
      'RAIL_ARRIVED': 'Прибыл на станцию',
      'CUSTOMS_CLEARED': 'Таможня пройдена',
      'UNLOADED': 'Выгружен',
      'ON_AUTO': 'Автодоставка',
    };

    return texts[code] || 'Статус неизвестен';
  }

  /**
   * Валидация даты
   */
  private validateDate(value?: string): string | null {
    if (!value) return null;

    try {
      // Пробуем разные форматы
      const formats = [
        /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/,    // DD.MM.YYYY
        /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2})$/,    // DD.MM.YY
        /^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/,    // YYYY-MM-DD
      ];

      for (const format of formats) {
        const match = value.match(format);
        if (match) {
          let year: number, month: number, day: number;
          
          if (format === formats[2]) {
            year = parseInt(match[1]);
            month = parseInt(match[2]);
            day = parseInt(match[3]);
          } else {
            day = parseInt(match[1]);
            month = parseInt(match[2]);
            year = parseInt(match[3]);
            if (year < 100) year += 2000;
          }

          // Валидация диапазонов
          if (month < 1 || month > 12) return null;
          if (day < 1 || day > 31) return null;
          if (year < 2020 || year > 2030) return null;

          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        }
      }

      // Пробуем нативный парсинг
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      // Ошибка парсинга
    }

    return null;
  }

  /**
   * Валидация расстояния
   */
  private validateDistance(value?: number): number | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number' || isNaN(value)) return null;
    if (value < 0) return null;
    if (value > 20000) return null; // Максимум ~половина окружности Земли
    
    return Math.round(value);
  }

  /**
   * Очистка строки
   */
  private sanitizeString(value?: string): string | undefined {
    if (!value) return undefined;
    
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[<>]/g, '')
      .slice(0, 500);
  }
}
