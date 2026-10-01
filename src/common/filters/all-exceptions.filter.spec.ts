import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DomainException, EntityNotFoundException } from '../domain/domain.exception';
import { AllExceptionsFilter } from './all-exceptions.filter';

class ThingNotFoundException extends EntityNotFoundException {
  constructor() {
    super('Thing 42 not found');
  }
}

class InvalidThingException extends DomainException {
  constructor() {
    super('Thing is invalid');
  }
}

describe('AllExceptionsFilter', () => {
  const NOW = new Date('2026-01-01T12:00:00.000Z');
  const filter = new AllExceptionsFilter(() => NOW);

  let json: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    const request = { method: 'GET', originalUrl: '/api/v1/things/42' };
    host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;
  });

  const respond = (exception: unknown) => {
    filter.catch(exception, host);
    return { statusCode: status.mock.calls[0][0] as number, body: json.mock.calls[0][0] };
  };

  it('keeps the status and message of an HttpException', () => {
    expect(respond(new NotFoundException('Cannot GET /nope'))).toEqual({
      statusCode: 404,
      body: {
        statusCode: 404,
        error: 'Not Found',
        message: 'Cannot GET /nope',
        path: '/api/v1/things/42',
        timestamp: '2026-01-01T12:00:00.000Z',
      },
    });
  });

  it('exposes validation errors as details', () => {
    const exception = new BadRequestException(['sex must be one of: M, F', 'foo should not exist']);

    expect(respond(exception).body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: ['sex must be one of: M, F', 'foo should not exist'],
    });
  });

  it('supports HttpExceptions built from a plain string', () => {
    const { statusCode, body } = respond(new HttpException('I am a teapot', 418));

    expect(statusCode).toBe(418);
    expect(body).toMatchObject({ error: "I'm a Teapot", message: 'I am a teapot' });
  });

  it('uses a generic reason phrase for non-standard status codes', () => {
    expect(respond(new HttpException('Client closed request', 499)).body).toMatchObject({
      statusCode: 499,
      error: 'Error',
    });
  });

  it('falls back to the exception message when the payload has no usable message', () => {
    const exception = new HttpException({ reason: 'opaque' }, HttpStatus.CONFLICT);

    expect(respond(exception).body).toMatchObject({ statusCode: 409, message: 'Http Exception' });
  });

  it('translates EntityNotFoundException into a 404', () => {
    expect(respond(new ThingNotFoundException()).body).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
      message: 'Thing 42 not found',
    });
  });

  it('translates other domain exceptions into a 422', () => {
    expect(respond(new InvalidThingException()).body).toMatchObject({
      statusCode: 422,
      message: 'Thing is invalid',
    });
  });

  it('keeps the status of client errors raised by Express middlewares', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      expose: true,
    });

    expect(respond(tooLarge)).toMatchObject({
      statusCode: 413,
      body: { statusCode: 413, error: 'Payload Too Large', message: 'request entity too large' },
    });
  });

  it.each([
    ['not exposable', { status: 400, expose: false }],
    ['a server error', { status: 503, expose: true }],
    ['a non-numeric status', { status: '400', expose: true }],
  ])('treats a middleware error that is %s as unexpected', (_, props) => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    expect(respond(Object.assign(new Error('internal detail'), props)).statusCode).toBe(500);
    logError.mockRestore();
  });

  it.each([new Error('database password is hunter2'), 'a thrown string'])(
    'hides unexpected errors behind a generic 500 and logs them (%p)',
    (exception) => {
      const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      const { statusCode, body } = respond(exception);

      expect(statusCode).toBe(500);
      expect(body).toMatchObject({
        error: 'Internal Server Error',
        message: 'Internal server error',
      });
      expect(JSON.stringify(body)).not.toContain('hunter2');
      expect(logError).toHaveBeenCalledWith('GET /api/v1/things/42 → 500', expect.any(String));
      logError.mockRestore();
    },
  );

  it('uses the current date by default', () => {
    jest.useFakeTimers({ now: NOW });
    new AllExceptionsFilter().catch(new NotFoundException(), host);
    jest.useRealTimers();

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: '2026-01-01T12:00:00.000Z' }),
    );
  });
});
