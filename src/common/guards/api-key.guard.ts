import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { AppConfig } from '../../config/app.config';
import { APP_CONFIG } from '../../config/config.module';

export const API_KEY_HEADER = 'x-api-key';
/** Name of the OpenAPI security scheme describing the header. */
export const API_KEY_SECURITY_SCHEME = 'api-key';

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();

/**
 * Protects write endpoints with a shared secret sent in the `x-api-key` header.
 *
 * Fails closed: when no key is configured, every request is refused. Keys are
 * compared through their SHA-256 digests in constant time, so the response time
 * leaks neither the key nor its length.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  private readonly expectedDigest?: Buffer;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    if (config.apiKey === undefined) {
      this.logger.warn('API_KEY is not set: write endpoints will refuse every request');
    } else {
      this.expectedDigest = sha256(config.apiKey);
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const provided = context.switchToHttp().getRequest<Request>().header(API_KEY_HEADER);

    if (
      this.expectedDigest === undefined ||
      provided === undefined ||
      !timingSafeEqual(sha256(provided), this.expectedDigest)
    ) {
      throw new UnauthorizedException('Missing or invalid API key');
    }
    return true;
  }
}
