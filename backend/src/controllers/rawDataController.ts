import { Request, Response } from 'express';
import { statusEventService } from '../services/index.js';
import { ApiResponse, NormalizedStatusEvent, EmailInput, TableRowInput } from '../types/index.js';

/**
 * Контроллер для приёма и обработки сырых данных ОТ ОПЕРАТОРОВ
 * 
 * Это входящие данные от перевозчиков/операторов, а не исходящие клиентам.
 */
export class RawDataController {
  
  /**
   * POST /api/raw/operator-email
   * Приём email-сообщения ОТ ОПЕРАТОРА (перевозчика) для парсинга
   * 
   * Пример входного текста от оператора:
   *   "Контейнер MSKU1234567 на станции Гончарово, 1857 км до Иня-Восточная"
   */
  async processOperatorEmail(req: Request, res: Response): Promise<void> {
    try {
      const input: EmailInput = req.body;

      // Валидация
      if (!input.body || typeof input.body !== 'string') {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Email body is required and must be a string',
        };
        res.status(400).json(response);
        return;
      }

      if (input.body.trim().length === 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Email body cannot be empty',
        };
        res.status(400).json(response);
        return;
      }

      // Обрабатываем
      const result = await statusEventService.processOperatorEmail(input);

      if (!result.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: result.error,
          message: `Raw message saved with ID: ${result.rawMessageId}`,
        };
        res.status(422).json(response);
        return;
      }

      const response: ApiResponse<NormalizedStatusEvent & { rawMessageId?: string }> = {
        success: true,
        data: {
          ...result.data!,
          rawMessageId: result.rawMessageId,
        },
        message: 'Operator email processed successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error processing operator email:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process operator email',
      };
      res.status(500).json(response);
    }
  }

  /**
   * POST /api/raw/table-row
   * Приём строки таблицы (из выгрузки оператора: Excel/1С) для парсинга
   */
  async processTableRow(req: Request, res: Response): Promise<void> {
    try {
      const input: TableRowInput = req.body;

      // Валидация
      if (!input.containerNumber) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Container number is required',
        };
        res.status(400).json(response);
        return;
      }

      // Валидация формата номера контейнера
      const containerPattern = /^[A-Za-z]{4}\s?\d{6,7}$/;
      if (!containerPattern.test(input.containerNumber.trim())) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid container number format. Expected format: XXXX1234567',
        };
        res.status(400).json(response);
        return;
      }

      // Обрабатываем
      const result = await statusEventService.processTableRow(input);

      if (!result.success) {
        const response: ApiResponse<null> = {
          success: false,
          error: result.error,
          message: `Raw message saved with ID: ${result.rawMessageId}`,
        };
        res.status(422).json(response);
        return;
      }

      const response: ApiResponse<NormalizedStatusEvent & { rawMessageId?: string }> = {
        success: true,
        data: {
          ...result.data!,
          rawMessageId: result.rawMessageId,
        },
        message: 'Table row processed successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Error processing table row:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process table row',
      };
      res.status(500).json(response);
    }
  }

  /**
   * POST /api/raw/table-rows
   * Пакетный приём строк таблицы (до 100 строк)
   */
  async processTableRows(req: Request, res: Response): Promise<void> {
    try {
      const { rows } = req.body as { rows: TableRowInput[] };

      if (!Array.isArray(rows) || rows.length === 0) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Rows array is required and must not be empty',
        };
        res.status(400).json(response);
        return;
      }

      if (rows.length > 100) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Maximum 100 rows per request',
        };
        res.status(400).json(response);
        return;
      }

      const results = await Promise.allSettled(
        rows.map(row => statusEventService.processTableRow(row))
      );

      const processed = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return {
            index,
            success: result.value.success,
            data: result.value.data,
            error: result.value.error,
          };
        } else {
          return {
            index,
            success: false,
            error: result.reason?.message || 'Unknown error',
          };
        }
      });

      const successCount = processed.filter(p => p.success).length;
      const failCount = processed.length - successCount;

      const response: ApiResponse<typeof processed> = {
        success: failCount === 0,
        data: processed,
        message: `Processed ${successCount}/${rows.length} rows successfully`,
      };

      res.status(failCount === rows.length ? 422 : 200).json(response);
    } catch (error) {
      console.error('Error processing table rows:', error);
      const response: ApiResponse<null> = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process table rows',
      };
      res.status(500).json(response);
    }
  }
}

export const rawDataController = new RawDataController();
