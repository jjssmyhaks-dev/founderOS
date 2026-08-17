import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

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

    if (status >= 500) {
      this.logger.error(`${status} ${error}: ${message}`, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(`${status} ${error}: ${message}`);
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
