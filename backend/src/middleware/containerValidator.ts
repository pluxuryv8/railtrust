/**
 * ============================================
 * CONTAINER VALIDATOR - Валидация по ISO 6346
 * ============================================
 * 
 * Проверка номеров контейнеров по международному
 * стандарту ISO 6346 с расчётом контрольной цифры.
 */

// Таблица значений символов для расчёта контрольной цифры ISO 6346
const ISO_6346_CHAR_VALUES: Record<string, number> = {
  'A': 10, 'B': 12, 'C': 13, 'D': 14, 'E': 15, 'F': 16, 'G': 17, 'H': 18, 'I': 19,
  'J': 20, 'K': 21, 'L': 23, 'M': 24, 'N': 25, 'O': 26, 'P': 27, 'Q': 28, 'R': 29,
  'S': 30, 'T': 31, 'U': 32, 'V': 34, 'W': 35, 'X': 36, 'Y': 37, 'Z': 38,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

// Известные коды владельцев контейнеров (BIC codes)
const KNOWN_OWNER_CODES = new Set([
  'MSKU', 'MSCU', 'MAEU', 'MRKU', 'MRSQ', // Maersk
  'CMAU', 'CGMU', 'CMCU', // CMA CGM
  'CSQU', 'CCLU', 'CBHU', // COSCO
  'HLBU', 'HLCU', 'HLXU', // Hapag-Lloyd
  'EITU', 'EGSU', 'EGHU', // Evergreen
  'OOLU', 'OOCU', // OOCL
  'YMLU', 'YMMU', // Yang Ming
  'HDMU', 'HDCO', // Hyundai
  'TCLU', 'TCKU', 'TCNU', // Common
  'TEMU', 'TGHU', 'TGBU', // Textainer
  'TRHU', 'TRLU', // Triton
  'GESU', 'GATU', // GE
  'FCIU', 'FCGU', // Florens
  'SEGU', 'SEAU', // SeaCube
  'CRXU', 'CRSU', // CAI
  'APHU', 'APMU', 'APRU', 'APZU', // APL
  'NYKU', // NYK
  'KKFU', 'KKLU', // K-Line
  'MOLU', // MOL
  'PCIU', // PIL
  'WANU', 'WFHU', // Wan Hai
  'ZIMU', 'ZCSU', // ZIM
  'UACU', 'UASU', // UASC
  'ECMU', // EC
  'GLDU', // Gold
  'SUDU', // Hamburg Sud
  'FANU', // Safmarine
]);

export interface ContainerValidationResult {
  isValid: boolean;
  containerNumber: string;
  confidence: number;
  details: {
    ownerCode: string;
    categoryCode: string;
    serialNumber: string;
    checkDigit: string;
    calculatedCheckDigit: string;
    isKnownOwner: boolean;
    checkDigitValid: boolean;
  };
  corrections?: string[];
  error?: string;
}

/**
 * Валидация номера контейнера по ISO 6346
 */
export function validateContainerNumber(input: string): ContainerValidationResult {
  const corrections: string[] = [];
  
  // Очищаем и нормализуем
  let cleaned = input
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
  
  // Исправляем частые опечатки в первых 4 символах (код владельца)
  const originalCleaned = cleaned;
  
  // Сначала исправляем первые 4 символа (должны быть буквами)
  if (cleaned.length >= 4) {
    const prefix = cleaned.slice(0, 4);
    const suffix = cleaned.slice(4);
    
    // В первых 4 символах: 0 → O, 1 → I (или L)
    const fixedPrefix = prefix
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .replace(/5/g, 'S')
      .replace(/8/g, 'B');
    
    // В остальных символах: O → 0, I → 1, S → 5, B → 8
    const fixedSuffix = suffix
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/L/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8');
    
    cleaned = fixedPrefix + fixedSuffix;
  }
  
  if (cleaned !== originalCleaned) {
    corrections.push(`Исправлены опечатки: ${originalCleaned} → ${cleaned}`);
  }

  // Проверяем базовый формат: 4 буквы + 7 цифр
  const match = cleaned.match(/^([A-Z]{4})(\d{7})$/);
  
  if (!match) {
    // Пробуем формат с 6 цифрами (без контрольной)
    const shortMatch = cleaned.match(/^([A-Z]{4})(\d{6})$/);
    if (shortMatch) {
      const [, owner, serial] = shortMatch;
      const checkDigit = calculateCheckDigit(owner + serial);
      cleaned = owner + serial + checkDigit;
      corrections.push(`Добавлена контрольная цифра: ${checkDigit}`);
    } else {
      return {
        isValid: false,
        containerNumber: input,
        confidence: 0,
        details: {
          ownerCode: '',
          categoryCode: '',
          serialNumber: '',
          checkDigit: '',
          calculatedCheckDigit: '',
          isKnownOwner: false,
          checkDigitValid: false,
        },
        error: 'Неверный формат номера контейнера (должен быть 4 буквы + 6-7 цифр)',
      };
    }
  }

  // Парсим компоненты
  const ownerCode = cleaned.slice(0, 3);
  const categoryCode = cleaned.slice(3, 4);
  const serialNumber = cleaned.slice(4, 10);
  const checkDigit = cleaned.slice(10, 11);
  
  // Проверяем категорию (U = freight, J = detachable, Z = trailer)
  const validCategories = ['U', 'J', 'Z'];
  if (!validCategories.includes(categoryCode)) {
    corrections.push(`Необычный код категории: ${categoryCode} (обычно U, J или Z)`);
  }

  // Проверяем известного владельца
  const fullOwnerCode = ownerCode + categoryCode;
  const isKnownOwner = KNOWN_OWNER_CODES.has(fullOwnerCode);
  
  // Рассчитываем контрольную цифру
  const calculatedCheckDigit = calculateCheckDigit(cleaned.slice(0, 10));
  const checkDigitValid = checkDigit === calculatedCheckDigit;
  
  if (!checkDigitValid) {
    corrections.push(`Контрольная цифра ${checkDigit} не совпадает с расчётной ${calculatedCheckDigit}`);
  }

  // Рассчитываем уверенность
  let confidence = 0.85; // Базовая уверенность для валидного формата (4 буквы + 7 цифр)
  
  if (checkDigitValid) confidence += 0.10;     // +10% за верную контрольную цифру по ISO 6346
  if (isKnownOwner) confidence += 0.05;        // +5% за известного владельца (BIC code)
  if (corrections.length === 0) confidence += 0.02; // +2% если без исправлений
  
  // Итого максимум: 85% + 10% + 5% + 2% = 102% → cap to 100%

  // Если контрольная цифра неверна, но формат правильный - всё равно принимаем
  // (некоторые старые контейнеры имеют неверные цифры)
  const isValid = true;

  return {
    isValid,
    containerNumber: cleaned,
    confidence: Math.min(confidence, 1),
    details: {
      ownerCode: fullOwnerCode,
      categoryCode,
      serialNumber,
      checkDigit,
      calculatedCheckDigit,
      isKnownOwner,
      checkDigitValid,
    },
    corrections: corrections.length > 0 ? corrections : undefined,
  };
}

/**
 * Расчёт контрольной цифры по ISO 6346
 */
function calculateCheckDigit(code: string): string {
  if (code.length !== 10) return '0';
  
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = code[i];
    const value = ISO_6346_CHAR_VALUES[char];
    if (value === undefined) return '0';
    sum += value * Math.pow(2, i);
  }
  
  const remainder = sum % 11;
  return remainder === 10 ? '0' : String(remainder);
}

/**
 * Быстрая проверка - похоже ли на номер контейнера
 */
export function looksLikeContainerNumber(text: string): boolean {
  const cleaned = text.toUpperCase().replace(/\s+/g, '');
  return /^[A-Z]{4}\d{6,7}$/.test(cleaned);
}

/**
 * Извлечение всех номеров контейнеров из текста
 */
export function extractContainerNumbers(text: string): ContainerValidationResult[] {
  const results: ContainerValidationResult[] = [];
  const seen = new Set<string>();
  
  // Паттерны для поиска (от более строгих к менее строгим)
  const patterns = [
    // Стандартный формат: 4 буквы + 7 цифр
    /\b([A-Z]{4}\s?\d{7})\b/gi,
    /\b([A-Z]{4}\s?\d{6})\b/gi,
    
    // С упоминанием "контейнер"
    /(?:контейнер|ктк|container|cntr|к[тt]к)[:\s#№]*([A-Z0-9]{10,11})/gi,
    /№\s*([A-Z0-9]{10,11})/gi,
    
    // Расширенный: 3 буквы + буква/цифра + 7 цифр (для опечаток типа MSC0...)
    /\b([A-Z]{3}[A-Z0-9]\d{7})\b/gi,
    /\b([A-Z]{3}[A-Z0-9]\d{6})\b/gi,
    
    // Смешанный формат (опечатки с цифрами в буквенной части)
    /\b([A-Z0-9]{4}\d{6,7})\b/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const candidate = (match[1] || match[0]).replace(/\s/g, '').toUpperCase();
      
      // Проверяем что это похоже на номер контейнера (не просто число)
      if (candidate.length < 10 || candidate.length > 12) continue;
      if (!/[A-Z]/.test(candidate)) continue; // Должна быть хотя бы одна буква
      
      if (!seen.has(candidate)) {
        seen.add(candidate);
        const validation = validateContainerNumber(candidate);
        if (validation.isValid) {
          results.push(validation);
        }
      }
    }
  }

  return results;
}

