import { Catch, HttpStatus, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { DomainError, type DomainErrorKind } from '../../shared/domain-error';

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  invalid_input: HttpStatus.BAD_REQUEST,
  forbidden: HttpStatus.FORBIDDEN,
  precondition_failed: HttpStatus.PRECONDITION_FAILED,
};

/**
 * Traduce el vocabulario del dominio a HTTP. Es el único lugar del backend que
 * conoce las dos cosas a la vez.
 */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    void reply.status(STATUS_BY_KIND[exception.kind]).send({
      code: exception.code,
      message: exception.message,
      details: exception.details,
    });
  }
}
