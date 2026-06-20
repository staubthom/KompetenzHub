import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Wandelt geworfene Exceptions in RFC-7807 (application/problem+json) um.
 * Vereinheitlicht 401/403/404/500 für die gesamte API.
 */
@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let title = 'Internal Server Error';
    let detail: string | undefined;

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        title = body;
      } else if (body && typeof body === 'object') {
        const obj = body as Record<string, unknown>;
        title = (obj.error as string) ?? exception.message;
        const msg = obj.message;
        detail = Array.isArray(msg) ? msg.join(', ') : (msg as string | undefined);
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      detail = 'Ein unerwarteter Fehler ist aufgetreten.';
    }

    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title,
        status,
        detail,
        instance: req.originalUrl,
      });
  }
}
