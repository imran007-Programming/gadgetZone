import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  success: false;
  message: string;
  errors?: unknown;
  statusCode: number;
  timestamp: string;
  path: string;
}

/**
 * Global exception filter. Every error leaves the API in one consistent shape:
 * { success: false, message, errors?, statusCode, timestamp, path }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const payload = body as Record<string, unknown>;
        if (Array.isArray(payload.message)) {
          // class-validator / ValidationPipe failures
          message = 'Validation failed';
          errors = payload.message;
        } else {
          message = (payload.message as string | undefined) ?? message;
          if (payload.errors !== undefined) errors = payload.errors;
        }
      }
    } else {
      // eslint-disable-next-line no-console
      console.error(exception);
    }

    const errorBody: ErrorBody = {
      success: false,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };
    if (errors !== undefined) errorBody.errors = errors;

    response.status(status).json(errorBody);
  }
}
