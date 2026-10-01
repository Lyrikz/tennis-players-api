import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { DomainException, EntityNotFoundException } from '../domain/domain.exception';
import type { ErrorResponseDto } from './error-response.dto';

interface ResolvedError {
  statusCode: number;
  message: string;
  details?: string[];
}

/**
 * Single translation point from exceptions to HTTP responses:
 * - Nest `HttpException`s keep their status (validation errors → 400 with details);
 * - domain exceptions are mapped to their HTTP equivalent;
 * - 4xx errors raised by Express middlewares (body parser: payload too large…)
 *   keep their status when flagged as safe to expose;
 * - anything else is a 500 whose internals are logged but never exposed.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly now: () => Date = () => new Date()) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const { statusCode, message, details } = this.resolve(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseDto = {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message,
      ...(details && { details }),
      path: request.originalUrl,
      timestamp: this.now().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): ResolvedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    if (exception instanceof EntityNotFoundException) {
      return { statusCode: HttpStatus.NOT_FOUND, message: exception.message };
    }
    if (exception instanceof DomainException) {
      return { statusCode: HttpStatus.UNPROCESSABLE_ENTITY, message: exception.message };
    }
    if (isExposableClientError(exception)) {
      return { statusCode: exception.status, message: exception.message };
    }
    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }

  private fromHttpException(exception: HttpException): ResolvedError {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    const message: unknown =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? payload.message
        : payload;

    // ValidationPipe reports one message per constraint violation.
    if (Array.isArray(message)) {
      return { statusCode, message: 'Validation failed', details: message.map(String) };
    }
    return { statusCode, message: typeof message === 'string' ? message : exception.message };
  }
}

/**
 * `http-errors` convention used by Express middlewares (e.g. body-parser):
 * `expose` marks a message that is safe to send to the client.
 */
function isExposableClientError(
  exception: unknown,
): exception is Error & { status: number; expose: true } {
  if (!(exception instanceof Error)) {
    return false;
  }
  const { status, expose } = exception as Error & { status?: unknown; expose?: unknown };
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}
