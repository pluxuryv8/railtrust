/**
 * ============================================
 * LOCATION DICTIONARY - Справочник локаций
 * ============================================
 * 
 * База известных станций, портов и городов
 * для повышения точности определения локаций.
 */

export type LocationType = 'STATION' | 'PORT' | 'CITY' | 'WAREHOUSE' | 'CUSTOMS';

export interface KnownLocation {
  name: string;
  type: LocationType;
  aliases: string[];
  region?: string;
  country: string;
}

// Известные ЖД станции России
const RUSSIAN_STATIONS: KnownLocation[] = [
  { name: 'Иня-Восточная', type: 'STATION', aliases: ['иня восточная', 'иня-вост', 'иня вост'], region: 'Новосибирская обл.', country: 'RU' },
  { name: 'Гончарово', type: 'STATION', aliases: ['гончарово', 'goncharovo'], region: 'Забайкальский край', country: 'RU' },
  { name: 'Забайкальск', type: 'STATION', aliases: ['забайкальск', 'zabaikalsk'], region: 'Забайкальский край', country: 'RU' },
  { name: 'Наушки', type: 'STATION', aliases: ['наушки', 'naushki'], region: 'Бурятия', country: 'RU' },
  { name: 'Новосибирск', type: 'STATION', aliases: ['новосибирск', 'новосиб', 'novosibirsk', 'нск'], region: 'Новосибирская обл.', country: 'RU' },
  { name: 'Екатеринбург', type: 'STATION', aliases: ['екатеринбург', 'екб', 'ekaterinburg', 'yekaterinburg'], region: 'Свердловская обл.', country: 'RU' },
  { name: 'Красноярск', type: 'STATION', aliases: ['красноярск', 'krasnoyarsk'], region: 'Красноярский край', country: 'RU' },
  { name: 'Иркутск', type: 'STATION', aliases: ['иркутск', 'irkutsk'], region: 'Иркутская обл.', country: 'RU' },
  { name: 'Хабаровск', type: 'STATION', aliases: ['хабаровск', 'khabarovsk'], region: 'Хабаровский край', country: 'RU' },
  { name: 'Чита', type: 'STATION', aliases: ['чита', 'chita'], region: 'Забайкальский край', country: 'RU' },
  { name: 'Улан-Удэ', type: 'STATION', aliases: ['улан-удэ', 'улан удэ', 'ulan-ude'], region: 'Бурятия', country: 'RU' },
  { name: 'Омск', type: 'STATION', aliases: ['омск', 'omsk'], region: 'Омская обл.', country: 'RU' },
  { name: 'Тюмень', type: 'STATION', aliases: ['тюмень', 'tyumen'], region: 'Тюменская обл.', country: 'RU' },
  { name: 'Пермь', type: 'STATION', aliases: ['пермь', 'perm'], region: 'Пермский край', country: 'RU' },
  { name: 'Казань', type: 'STATION', aliases: ['казань', 'kazan'], region: 'Татарстан', country: 'RU' },
  { name: 'Нижний Новгород', type: 'STATION', aliases: ['нижний новгород', 'нн', 'nizhniy novgorod'], region: 'Нижегородская обл.', country: 'RU' },
  { name: 'Москва', type: 'STATION', aliases: ['москва', 'мск', 'moscow'], region: 'Москва', country: 'RU' },
  { name: 'Орехово-Зуево', type: 'STATION', aliases: ['орехово-зуево', 'орехово зуево', 'orekhovo-zuevo'], region: 'Московская обл.', country: 'RU' },
  { name: 'Санкт-Петербург', type: 'STATION', aliases: ['санкт-петербург', 'спб', 'питер', 'saint-petersburg'], region: 'Санкт-Петербург', country: 'RU' },
  { name: 'Ворсино', type: 'STATION', aliases: ['ворсино', 'vorsino'], region: 'Калужская обл.', country: 'RU' },
  { name: 'Силикатная', type: 'STATION', aliases: ['силикатная', 'silikatnaya'], region: 'Московская обл.', country: 'RU' },
  { name: 'Электроугли', type: 'STATION', aliases: ['электроугли', 'elektrougli'], region: 'Московская обл.', country: 'RU' },
];

// Известные порты
const PORTS: KnownLocation[] = [
  { name: 'Владивосток', type: 'PORT', aliases: ['владивосток', 'vladivostok', 'влад'], region: 'Приморский край', country: 'RU' },
  { name: 'Восточный', type: 'PORT', aliases: ['восточный', 'vostochny', 'порт восточный'], region: 'Приморский край', country: 'RU' },
  { name: 'Находка', type: 'PORT', aliases: ['находка', 'nakhodka'], region: 'Приморский край', country: 'RU' },
  { name: 'Новороссийск', type: 'PORT', aliases: ['новороссийск', 'novorossiysk', 'нврс'], region: 'Краснодарский край', country: 'RU' },
  { name: 'Санкт-Петербург', type: 'PORT', aliases: ['большой порт спб', 'порт спб'], region: 'Санкт-Петербург', country: 'RU' },
  { name: 'Шанхай', type: 'PORT', aliases: ['шанхай', 'shanghai', 'sha'], region: '', country: 'CN' },
  { name: 'Циндао', type: 'PORT', aliases: ['циндао', 'qingdao', 'tsingtao'], region: '', country: 'CN' },
  { name: 'Нинбо', type: 'PORT', aliases: ['нинбо', 'ningbo'], region: '', country: 'CN' },
  { name: 'Далянь', type: 'PORT', aliases: ['далянь', 'dalian', 'дальний'], region: '', country: 'CN' },
  { name: 'Тяньцзинь', type: 'PORT', aliases: ['тяньцзинь', 'tianjin'], region: '', country: 'CN' },
  { name: 'Гуанчжоу', type: 'PORT', aliases: ['гуанчжоу', 'guangzhou', 'кантон'], region: '', country: 'CN' },
  { name: 'Шэньчжэнь', type: 'PORT', aliases: ['шэньчжэнь', 'shenzhen'], region: '', country: 'CN' },
  { name: 'Сямынь', type: 'PORT', aliases: ['сямынь', 'xiamen', 'амой'], region: '', country: 'CN' },
  { name: 'Пусан', type: 'PORT', aliases: ['пусан', 'busan', 'pusan'], region: '', country: 'KR' },
  { name: 'Инчхон', type: 'PORT', aliases: ['инчхон', 'incheon'], region: '', country: 'KR' },
  { name: 'Сингапур', type: 'PORT', aliases: ['сингапур', 'singapore'], region: '', country: 'SG' },
  { name: 'Гонконг', type: 'PORT', aliases: ['гонконг', 'hong kong', 'hongkong'], region: '', country: 'HK' },
  { name: 'Токио', type: 'PORT', aliases: ['токио', 'tokyo'], region: '', country: 'JP' },
  { name: 'Иокогама', type: 'PORT', aliases: ['иокогама', 'yokohama'], region: '', country: 'JP' },
  { name: 'Роттердам', type: 'PORT', aliases: ['роттердам', 'rotterdam'], region: '', country: 'NL' },
  { name: 'Гамбург', type: 'PORT', aliases: ['гамбург', 'hamburg'], region: '', country: 'DE' },
];

// Склады и СВХ
const WAREHOUSES: KnownLocation[] = [
  { name: 'СВХ Шереметьево', type: 'WAREHOUSE', aliases: ['свх шереметьево', 'шереметьево свх'], region: 'Московская обл.', country: 'RU' },
  { name: 'СВХ Домодедово', type: 'WAREHOUSE', aliases: ['свх домодедово', 'домодедово свх'], region: 'Московская обл.', country: 'RU' },
  { name: 'Терминал Ворсино', type: 'WAREHOUSE', aliases: ['терминал ворсино', 'ворсино терминал'], region: 'Калужская обл.', country: 'RU' },
];

// Объединяем все локации
export const ALL_LOCATIONS: KnownLocation[] = [
  ...RUSSIAN_STATIONS,
  ...PORTS,
  ...WAREHOUSES,
];

// Построение индекса для быстрого поиска
const locationIndex = new Map<string, KnownLocation>();

for (const loc of ALL_LOCATIONS) {
  locationIndex.set(loc.name.toLowerCase(), loc);
  for (const alias of loc.aliases) {
    locationIndex.set(alias.toLowerCase(), loc);
  }
}

export interface LocationMatchResult {
  found: boolean;
  location?: KnownLocation;
  matchedText: string;
  confidence: number;
}

/**
 * Поиск локации в тексте
 */
export function findLocation(text: string): LocationMatchResult {
  const lowerText = text.toLowerCase();
  
  // Сначала ищем точное совпадение
  for (const [key, loc] of locationIndex) {
    if (lowerText.includes(key)) {
      return {
        found: true,
        location: loc,
        matchedText: key,
        confidence: 0.95, // Высокая уверенность при точном совпадении
      };
    }
  }
  
  // Ищем паттерны "ст. X" или "станция X"
  const stationMatch = text.match(/(?:ст\.|станци[яи])\s+([А-Яа-яёЁA-Za-z\-]+)/i);
  if (stationMatch) {
    const stationName = stationMatch[1].toLowerCase();
    const loc = locationIndex.get(stationName);
    if (loc) {
      return {
        found: true,
        location: loc,
        matchedText: stationMatch[0],
        confidence: 0.95,
      };
    }
    // Станция найдена но не в справочнике
    return {
      found: true,
      location: {
        name: stationMatch[1],
        type: 'STATION',
        aliases: [],
        country: 'RU',
      },
      matchedText: stationMatch[0],
      confidence: 0.7, // Средняя уверенность - станция найдена но неизвестна
    };
  }
  
  // Ищем паттерны "порт X"
  const portMatch = text.match(/(?:порт|port)\s+([А-Яа-яёЁA-Za-z\-]+)/i);
  if (portMatch) {
    const portName = portMatch[1].toLowerCase();
    const loc = locationIndex.get(portName);
    if (loc) {
      return {
        found: true,
        location: loc,
        matchedText: portMatch[0],
        confidence: 0.95,
      };
    }
    return {
      found: true,
      location: {
        name: portMatch[1],
        type: 'PORT',
        aliases: [],
        country: 'UNKNOWN',
      },
      matchedText: portMatch[0],
      confidence: 0.7,
    };
  }
  
  return {
    found: false,
    matchedText: '',
    confidence: 0,
  };
}

/**
 * Нормализация названия локации
 */
export function normalizeLocationName(text: string): string {
  const lower = text.toLowerCase().trim();
  const loc = locationIndex.get(lower);
  if (loc) {
    return loc.name;
  }
  // Возвращаем с заглавной буквы
  return text.trim().replace(/^\w/, c => c.toUpperCase());
}

/**
 * Определение типа локации по контексту
 */
export function inferLocationType(text: string): LocationType | null {
  const lower = text.toLowerCase();
  
  if (/ст\.|станци|station|жд|ж\/д/.test(lower)) return 'STATION';
  if (/порт|port|гавань|причал/.test(lower)) return 'PORT';
  if (/свх|склад|warehouse|терминал/.test(lower)) return 'WAREHOUSE';
  if (/таможн|customs/.test(lower)) return 'CUSTOMS';
  if (/город|city/.test(lower)) return 'CITY';
  
  return null;
}

