/**
 * ============================================
 * MIDDLEWARE LAYER - Единая точка входа
 * ============================================
 * 
 * Экспортирует все компоненты middleware-слоя
 * для обработки входящих данных.
 */

export { InputProcessor, inputProcessor, RawInput, ProcessingResult } from './inputProcessor.js';
export { FormatDetector, DetectedFormat, FormatType } from './formatDetector.js';
export { UniversalParser, ParsedItem, ParseResult } from './universalParser.js';
export { DataValidator, ValidationResult } from './dataValidator.js';
export { ProcessingLogger, ProcessingLogEntry, processingLogger } from './processingLogger.js';
export { validateContainerNumber, extractContainerNumbers, ContainerValidationResult } from './containerValidator.js';
export { findLocation, normalizeLocationName, ALL_LOCATIONS, KnownLocation, LocationType } from './locationDictionary.js';

