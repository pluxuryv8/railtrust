import { StatusCode, SourceType } from '@prisma/client';
import { NormalizationResult, STATUS_MAPPINGS, STATUS_LABELS } from './types.js';
import { EmailInput } from '../types/index.js';

/**
 * Нормализатор текстовых email-сообщений от ОПЕРАТОРОВ
 * 
 * Текущая реализация: правила на основе regex
 * TODO: Заменить на LLM-вызов для более умного парсинга
 */
export class EmailTextNormalizer {
  
  /**
   * Основной метод нормализации email-сообщения
   */
  normalize(input: EmailInput): NormalizationResult {
    const text = input.body.toLowerCase();
    const originalText = input.body;
    
    try {
      // Извлекаем данные из текста
      const containerNumber = this.extractContainerNumber(originalText);
      const location = this.extractLocation(originalText);
      const distance = this.extractDistance(originalText);
      const statusCode = this.detectStatus(text, location, distance);
      const eta = this.extractETA(originalText);
      
      // Определяем время события
      const eventTime = input.receivedAt 
        ? new Date(input.receivedAt) 
        : new Date();

      return {
        success: true,
        data: {
          containerNumber: containerNumber || undefined,
          statusCode,
          statusText: STATUS_LABELS[statusCode],
          location: location || undefined,
          distanceToDestinationKm: distance || undefined,
          eta: eta || undefined,
          eventTime,
          sourceType: SourceType.EMAIL,
        },
        confidence: this.calculateConfidence(containerNumber, location, statusCode),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown parsing error',
      };
    }
  }

  /**
   * Извлечение номера контейнера
   * Форматы: MSKU1234567, TCKU1234567, DEMO1234567, etc.
   */
  private extractContainerNumber(text: string): string | null {
    // Стандартный формат ISO контейнера: 4 буквы + 6-7 цифр
    const patterns = [
      // Прямое указание
      /контейнер[а]?\s*[№#]?\s*:?\s*([A-Z]{4}\s?\d{6,7})/i,
      /container\s*[№#]?\s*:?\s*([A-Z]{4}\s?\d{6,7})/i,
      /ктк\s*[№#]?\s*:?\s*([A-Z]{4}\s?\d{6,7})/i,
      // Просто номер в начале строки или после точки/запятой
      /(?:^|[.,\s])([A-Z]{4}\d{7})(?:[.,\s]|$)/im,
      /(?:^|[.,\s])([A-Z]{4}\d{6})(?:[.,\s]|$)/im,
      // Любой формат XXXX1234567
      /\b([A-Z]{4}\d{7})\b/i,
      /\b([A-Z]{4}\d{6})\b/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const number = match[1].replace(/\s/g, '').toUpperCase();
        // Проверяем, что это валидный номер контейнера (4 буквы + цифры)
        if (/^[A-Z]{4}\d{6,7}$/.test(number)) {
          return number;
        }
      }
    }

    return null;
  }

  /**
   * Извлечение текущего местоположения
   * Примеры: "ст Гончарово", "ст. Иня-Восточная", "порт Владивосток", "Красноярск"
   */
  private extractLocation(text: string): string | null {
    const patterns = [
      // "на станции Красноярск"
      /(?:на|прибыл\s+на)\s+станци[юи]\s+([А-Яа-яЁё][А-Яа-яЁё\-\s]{2,30})/i,
      // "прибыл на станцию Красноярск"
      /прибыл\s+(?:на\s+)?(?:станцию|ст\.?)\s+([А-Яа-яЁё][А-Яа-яЁё\-]{2,20})/i,
      // "местоположение ктк ст Гончарово"
      /местоположени[ея]\s+(?:ктк\s+)?(?:ст\.?\s+)?([А-Яа-яЁё][А-Яа-яЁё\-]{2,20})/i,
      // "находится на станции Гончарово"
      /находится\s+(?:на\s+)?(?:станции|ст\.?)\s+([А-Яа-яЁё][А-Яа-яЁё\-]{2,20})/i,
      // "текущее положение: ст. Гончарово"
      /текущ(?:ее|ая)\s+(?:положение|локация)[:\s]+(?:ст\.?\s+)?([А-Яа-яЁё][А-Яа-яЁё\-]{2,20})/i,
      // "прибыл в порт Владивосток"
      /(?:прибыл\s+)?(?:в\s+)?порт[у]?\s+([А-Яа-яЁё][А-Яа-яЁё\-]{2,20})/i,
      // "arrived at ... port"
      /arrived\s+(?:at\s+)?([A-Za-z][A-Za-z\-\s]{2,20})\s+port/i,
      // "СВХ Владивосток"
      /свх\s+([А-Яа-яЁё][А-Яа-яЁё\-]{2,20})/i,
      // "на складе получателя"
      /на\s+складе?\s+(?:получателя|клиента)?\s*(?:по\s+адресу)?[:\s]*([А-Яа-яЁё][А-Яа-яЁё\-\s,\.]{5,50})/i,
      // "ст. Гончарово" или "ст Гончарово"
      /(?:^|[,.\s])ст\.?\s+([А-Яа-яЁё][А-Яа-яЁё\-]{2,20})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const location = match[1].trim();
        // Убираем лишние слова в конце
        const cleaned = location.replace(/\s+(км|до|от|в|на|по|через).*$/i, '').trim();
        
        // Определяем тип локации
        if (text.toLowerCase().includes('порт') && !cleaned.toLowerCase().startsWith('порт')) {
          return `Порт ${cleaned}`;
        }
        if (text.toLowerCase().includes('свх')) {
          return `СВХ ${cleaned}`;
        }
        if (text.toLowerCase().includes('склад')) {
          return cleaned;
        }
        // По умолчанию - станция
        if (!cleaned.toLowerCase().startsWith('ст.') && !cleaned.toLowerCase().startsWith('порт')) {
          return `ст. ${cleaned}`;
        }
        return cleaned;
      }
    }

    return null;
  }

  /**
   * Извлечение расстояния до пункта назначения
   */
  private extractDistance(text: string): number | null {
    const patterns = [
      // "1857 км до станции"
      /(\d[\d\s]*)\s*км\.?\s+до\s+(?:станции|пункта|назначения|ст\.)/i,
      // "расстояние до станции: 1857 км"
      /расстояние\s+(?:до\s+)?(?:станции\s+)?(?:[А-Яа-яЁё\-]+\s*)?[:\s]*(\d[\d\s]*)\s*км/i,
      // "осталось 1857 км"
      /осталось\s+(\d[\d\s]*)\s*км/i,
      // "4100 km to destination"
      /(\d[\d\s]*)\s*km\.?\s+to\s+(?:destination|final)/i,
      // просто "1857 км" рядом с названием станции (но не расстояние маршрута)
      /[,.\s](\d{3,5})\s*км\.?\s+(?:до|от)/i,
      // "distance: 4100 km"
      /distance[:\s]+(\d[\d\s]*)\s*km/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const numStr = match[1].replace(/\s/g, '');
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > 0 && num < 20000) {
          return num;
        }
      }
    }

    return null;
  }

  /**
   * Извлечение ожидаемой даты прибытия (ETA)
   */
  private extractETA(text: string): Date | null {
    const patterns = [
      // "ETA: 04.12.2025" или "ЕТА 04.12.2025"
      /(?:eta|ета)[:\s]+(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/i,
      // "ожидаемая дата прибытия: 04.12.2025"
      /(?:ожидаем\w*\s+)?дат[аы]\s+прибытия[:\s]+(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/i,
      // "прибытие: 04.12.2025"
      /прибыти[ея][:\s]+(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/i,
      // "estimated arrival: 04.12.2025"
      /(?:estimated\s+)?arrival[:\s]+(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/i,
      // "ориентировочно 04.12.2025"
      /ориентировочн\w*[:\s]+(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/i,
      // Просто дата в формате DD.MM.YYYY (последняя дата в тексте)
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/,
      // "04/12/2025"
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
      // "2025-12-04"
      /(\d{4})-(\d{1,2})-(\d{1,2})/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let day: number, month: number, year: number;
        
        if (pattern.source.includes('(\\d{4})-')) {
          // ISO format: YYYY-MM-DD
          [, year, month, day] = match.slice(1).map(Number) as [number, number, number];
        } else {
          // DD.MM.YYYY or DD/MM/YYYY
          [, day, month, year] = match.slice(1).map(Number) as [number, number, number];
        }
        
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime()) && date.getFullYear() >= 2020) {
          return date;
        }
      }
    }

    return null;
  }

  /**
   * Определение статуса на основе текста
   * 
   * TODO: Здесь можно подключить LLM для более умного определения статуса
   */
  private detectStatus(text: string, location: string | null, distance: number | null): StatusCode {
    // Приоритетные паттерны (точные совпадения)
    const priorityPatterns: [RegExp, StatusCode][] = [
      // Доставка
      [/(?:успешно\s+)?доставлен/, StatusCode.DELIVERED],
      [/delivered/i, StatusCode.DELIVERED],
      [/получен\s+(?:клиентом|получателем)/i, StatusCode.DELIVERED],
      
      // Прибытие на станцию
      [/прибыл\s+на\s+станци[юи]/i, StatusCode.RAIL_ARRIVED],
      [/arrived\s+at\s+.*station/i, StatusCode.RAIL_ARRIVED],
      
      // В пути по ЖД
      [/отгружен\s+на\s+жд/i, StatusCode.ON_RAIL],
      [/в\s+пути\s+по\s+жд/i, StatusCode.ON_RAIL],
      [/отгружен\s+\/\s+в\s+пути\s+(?:по\s+)?жд/i, StatusCode.ON_RAIL],
      
      // Прибытие в порт
      [/прибыл\s+в\s+порт/i, StatusCode.ARRIVED_PORT],
      [/arrived\s+(?:at\s+)?.*port/i, StatusCode.ARRIVED_PORT],
      
      // На складе
      [/(?:размещен|находится)\s+на\s+свх/i, StatusCode.ON_WAREHOUSE],
      [/awaiting\s+customs/i, StatusCode.ON_WAREHOUSE],
      [/на\s+складе/i, StatusCode.ON_WAREHOUSE],
      
      // Растаможен
      [/растаможен/i, StatusCode.CUSTOMS_CLEARED],
      [/склад\s+закрыт/i, StatusCode.CUSTOMS_CLEARED],
      [/customs\s+cleared/i, StatusCode.CUSTOMS_CLEARED],
      
      // На рейде
      [/на\s+рейде/i, StatusCode.ON_ANCHORAGE],
      [/at\s+anchorage/i, StatusCode.ON_ANCHORAGE],
      
      // В море
      [/в\s+(?:пути\s+)?мор(?:е|ем)/i, StatusCode.ON_SHIP],
      [/отгружен\s+в\s+море/i, StatusCode.ON_SHIP],
      [/at\s+sea/i, StatusCode.ON_SHIP],
      
      // В порту
      [/(?:в|на)\s+порту/i, StatusCode.IN_PORT],
      [/контейнер\s+(?:груженый\s+)?в\s+порту/i, StatusCode.IN_PORT],
      
      // Загружен
      [/загружен/i, StatusCode.LOADED],
      [/loaded/i, StatusCode.LOADED],
    ];

    for (const [pattern, code] of priorityPatterns) {
      if (pattern.test(text)) {
        return code;
      }
    }

    // Проверяем стандартные маппинги
    for (const [pattern, code] of Object.entries(STATUS_MAPPINGS)) {
      if (text.includes(pattern)) {
        return code;
      }
    }

    // Эвристики на основе контекста
    if (text.includes('местоположени') && (location || distance)) {
      if (distance && distance > 100) {
        return StatusCode.ON_RAIL;
      }
    }

    if (location?.toLowerCase().includes('свх')) {
      return StatusCode.ON_WAREHOUSE;
    }

    if (location?.toLowerCase().includes('порт')) {
      return StatusCode.IN_PORT;
    }

    if (distance && distance > 500) {
      return StatusCode.ON_RAIL;
    }

    // Если ничего не нашли
    return StatusCode.UNKNOWN;
  }

  /**
   * Расчёт уверенности в результате парсинга
   */
  private calculateConfidence(
    containerNumber: string | null,
    location: string | null,
    statusCode: StatusCode
  ): number {
    let confidence = 0.3; // Базовый уровень

    if (containerNumber) confidence += 0.3;
    if (location) confidence += 0.2;
    if (statusCode !== StatusCode.UNKNOWN) confidence += 0.2;

    return Math.min(confidence, 1.0);
  }

  /**
   * ============================================
   * TODO: LLM Integration Point
   * ============================================
   * 
   * Метод для интеграции с LLM (GPT-4, Claude, etc.)
   * для более умного парсинга неструктурированных email
   * 
   * Пример реализации:
   * 
   * private async parseWithLLM(text: string): Promise<NormalizationResult> {
   *   const prompt = `
   *     Ты — парсер логистических сообщений. Извлеки из текста:
   *     - Номер контейнера (формат: 4 буквы + 7 цифр, например MSKU1234567)
   *     - Текущий статус (один из: LOADED, IN_PORT, ON_SHIP, ON_RAIL, DELIVERED, ON_WAREHOUSE)
   *     - Текущее местоположение (город, станция или порт)
   *     - Расстояние до пункта назначения в км (если указано)
   *     - Ожидаемая дата прибытия (если указана)
   *     
   *     Текст: "${text}"
   *     
   *     Ответ в JSON формате:
   *     {
   *       "containerNumber": "...",
   *       "statusCode": "...",
   *       "location": "...",
   *       "distanceKm": null | number,
   *       "eta": null | "YYYY-MM-DD"
   *     }
   *   `;
   *   
   *   const response = await openai.chat.completions.create({
   *     model: 'gpt-4',
   *     messages: [{ role: 'user', content: prompt }],
   *     response_format: { type: 'json_object' },
   *     temperature: 0,
   *   });
   *   
   *   return JSON.parse(response.choices[0].message.content);
   * }
   */
}

export const emailTextNormalizer = new EmailTextNormalizer();
