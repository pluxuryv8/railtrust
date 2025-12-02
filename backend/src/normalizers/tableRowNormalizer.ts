import { StatusCode, SourceType } from '@prisma/client';
import { NormalizationResult, STATUS_MAPPINGS, STATUS_LABELS } from './types.js';
import { TableRowInput } from '../types/index.js';

/**
 * Нормализатор табличных данных (из 1С, Excel)
 * 
 * Маппит структурированные данные в единый формат StatusEvent
 */
export class TableRowNormalizer {
  
  /**
   * Основной метод нормализации строки таблицы
   */
  normalize(input: TableRowInput): NormalizationResult {
    try {
      // Определяем статус на основе поля state или дат
      const statusCode = this.detectStatus(input);
      const statusText = this.getStatusText(input, statusCode);
      
      // Извлекаем местоположение
      const location = this.extractLocation(input);
      
      // Парсим расстояние
      const distance = this.parseDistance(input.distanceToDestination);
      
      // Определяем ETA
      const eta = this.parseETA(input.eta);
      
      // Определяем время события (берём самую свежую дату из доступных)
      const eventTime = this.determineEventTime(input);

      return {
        success: true,
        data: {
          containerNumber: input.containerNumber?.trim().toUpperCase(),
          statusCode,
          statusText,
          location,
          distanceToDestinationKm: distance,
          eta,
          eventTime,
          sourceType: SourceType.EXCEL,
        },
        confidence: 0.9, // Структурированные данные имеют высокую надёжность
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  }

  /**
   * Определение статуса на основе поля state или последней заполненной даты
   */
  private detectStatus(input: TableRowInput): StatusCode {
    // Сначала проверяем поле state
    if (input.state) {
      const stateLower = input.state.toLowerCase().trim();
      
      // Проверяем маппинг статусов
      for (const [pattern, code] of Object.entries(STATUS_MAPPINGS)) {
        if (stateLower.includes(pattern)) {
          return code;
        }
      }

      // Специфичные паттерны из таблицы 1С
      if (stateLower.includes('отгружен') && stateLower.includes('море')) {
        return StatusCode.ON_SHIP;
      }
      if (stateLower.includes('прибыл') && stateLower.includes('порт')) {
        return StatusCode.ARRIVED_PORT;
      }
      if (stateLower.includes('отгружен') && stateLower.includes('жд')) {
        return StatusCode.ON_RAIL;
      }
      if (stateLower.includes('контейнер') && stateLower.includes('порту')) {
        return StatusCode.IN_PORT;
      }
    }

    // Определяем по последней заполненной дате (в порядке логической последовательности)
    if (input.shippedOnRail) return StatusCode.ON_RAIL;
    if (input.loadedOnRail) return StatusCode.ON_RAIL;
    if (input.warehouseClosed) return StatusCode.CUSTOMS_CLEARED;
    if (input.onWarehouse) return StatusCode.ON_WAREHOUSE;
    if (input.arrivedPort) return StatusCode.ARRIVED_PORT;
    if (input.onAnchorage) return StatusCode.ON_ANCHORAGE;
    if (input.shippedToSea) return StatusCode.ON_SHIP;

    return StatusCode.UNKNOWN;
  }

  /**
   * Получение человекочитаемого текста статуса
   */
  private getStatusText(input: TableRowInput, statusCode: StatusCode): string {
    // Если есть оригинальный статус - используем его
    if (input.state) {
      return input.state.trim();
    }
    
    // Иначе берём из маппинга
    return STATUS_LABELS[statusCode];
  }

  /**
   * Извлечение местоположения
   */
  private extractLocation(input: TableRowInput): string | undefined {
    if (input.currentLocation) {
      return input.currentLocation.trim();
    }

    // Если нет текущей локации, пробуем определить по статусу
    const statusCode = this.detectStatus(input);
    
    switch (statusCode) {
      case StatusCode.ON_SHIP:
      case StatusCode.ON_ANCHORAGE:
      case StatusCode.ARRIVED_PORT:
      case StatusCode.IN_PORT:
        return input.to ? `Порт ${input.to.trim()}` : undefined;
      case StatusCode.LOADED:
        return input.from ? input.from.trim() : undefined;
      default:
        return undefined;
    }
  }

  /**
   * Парсинг расстояния из строки или числа
   */
  private parseDistance(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value === 'number') {
      return value;
    }

    // Убираем "км" и другие единицы измерения
    const cleaned = value.replace(/[^\d]/g, '');
    const parsed = parseInt(cleaned, 10);
    
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * Парсинг ETA из строки
   */
  private parseETA(value: string | undefined): Date | undefined {
    if (!value) return undefined;

    // Пробуем разные форматы даты
    const formats = [
      // DD.MM.YYYY
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
      // DD/MM/YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // YYYY-MM-DD
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
    ];

    for (const format of formats) {
      const match = value.match(format);
      if (match) {
        let day: number, month: number, year: number;
        
        if (format.source.startsWith('(\\d{4})')) {
          [, year, month, day] = match.map(Number) as [unknown, number, number, number];
        } else {
          [, day, month, year] = match.map(Number) as [unknown, number, number, number];
        }
        
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    // Пробуем стандартный парсинг
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }

  /**
   * Определение времени события на основе последней заполненной даты
   */
  private determineEventTime(input: TableRowInput): Date {
    // Список дат в порядке приоритета (от последних к первым)
    const dateCandidates = [
      input.shippedOnRail,
      input.loadedOnRail,
      input.warehouseClosed,
      input.onWarehouse,
      input.arrivedPort,
      input.onAnchorage,
      input.shippedToSea,
    ];

    for (const dateStr of dateCandidates) {
      if (dateStr) {
        const parsed = this.parseETA(dateStr);
        if (parsed) return parsed;
      }
    }

    // Если нет дат - используем текущее время
    return new Date();
  }

  /**
   * Валидация номера контейнера
   */
  validateContainerNumber(number: string): boolean {
    // ISO 6346: 4 буквы (владелец) + 6 цифр + 1 контрольная цифра
    // Но на практике бывают вариации
    const pattern = /^[A-Z]{4}\d{6,7}$/;
    return pattern.test(number.replace(/\s/g, '').toUpperCase());
  }
}

export const tableRowNormalizer = new TableRowNormalizer();

