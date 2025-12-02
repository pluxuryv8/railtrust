import { SourceType } from '@prisma/client';
import { emailTextNormalizer, EmailTextNormalizer } from './emailTextNormalizer.js';
import { tableRowNormalizer, TableRowNormalizer } from './tableRowNormalizer.js';
import { NormalizationResult } from './types.js';
import { EmailInput, TableRowInput } from '../types/index.js';

export { EmailTextNormalizer } from './emailTextNormalizer.js';
export { TableRowNormalizer } from './tableRowNormalizer.js';
export { NormalizationResult, ParsedStatusData, STATUS_MAPPINGS, STATUS_LABELS } from './types.js';

/**
 * Сервис нормализации данных
 * 
 * Инкапсулирует логику выбора нужного нормализатора
 * и предоставляет единый интерфейс для обработки данных
 */
export class NormalizerService {
  private emailNormalizer: EmailTextNormalizer;
  private tableNormalizer: TableRowNormalizer;

  constructor() {
    this.emailNormalizer = emailTextNormalizer;
    this.tableNormalizer = tableRowNormalizer;
  }

  /**
   * Нормализация email-сообщения
   */
  normalizeEmail(input: EmailInput): NormalizationResult {
    return this.emailNormalizer.normalize(input);
  }

  /**
   * Нормализация строки таблицы (1С/Excel)
   */
  normalizeTableRow(input: TableRowInput): NormalizationResult {
    return this.tableNormalizer.normalize(input);
  }

  /**
   * Автоматический выбор нормализатора на основе типа источника
   */
  normalize(sourceType: SourceType, data: EmailInput | TableRowInput): NormalizationResult {
    switch (sourceType) {
      case SourceType.EMAIL:
        return this.normalizeEmail(data as EmailInput);
      case SourceType.EXCEL:
        return this.normalizeTableRow(data as TableRowInput);
      case SourceType.API:
        // TODO: Добавить нормализатор для API-данных
        return this.normalizeTableRow(data as TableRowInput);
      case SourceType.MANUAL:
        // Ручной ввод - ожидаем структурированные данные
        return this.normalizeTableRow(data as TableRowInput);
      default:
        return {
          success: false,
          error: `Unsupported source type: ${sourceType}`,
        };
    }
  }

  /**
   * ============================================
   * TODO: Batch Processing
   * ============================================
   * 
   * Метод для пакетной обработки данных (например, импорт Excel-файла)
   * 
   * async normalizeExcelFile(filePath: string): Promise<NormalizationResult[]> {
   *   const workbook = xlsx.readFile(filePath);
   *   const sheet = workbook.Sheets[workbook.SheetNames[0]];
   *   const rows = xlsx.utils.sheet_to_json(sheet);
   *   
   *   return rows.map(row => this.normalizeTableRow(row as TableRowInput));
   * }
   */
}

// Singleton instance
export const normalizerService = new NormalizerService();

