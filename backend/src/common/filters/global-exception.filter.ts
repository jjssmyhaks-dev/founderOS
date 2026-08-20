import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Generate or extract request ID
    const requestId = (request as any).requestId || randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exRes = exception.getResponse();
      if (typeof exRes === 'string') {
        message = exRes;
      } else if (typeof exRes === 'object' && exRes !== null) {
        const obj = exRes as any;
        message = obj.message || exception.message;
        error = obj.error || HttpStatus[status] || 'ERROR';
        if (Array.isArray(message)) message = message.join('; ');
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = 'INTERNAL_ERROR';
    }

    // Structured logging
    const logContext = {
      requestId,
      method: request.method,
      path: request.path,
      ip: request.ip || request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      status,
      error,
    };

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.path} → ${status} ${error}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.path} → ${status} ${error}: ${message}`,
      );
    }

    // Never expose internal error details in production
    const safeMessage = status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : message;

    response.status(status).json({
      statusCode: status,
      error,
      message: safeMessage,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
