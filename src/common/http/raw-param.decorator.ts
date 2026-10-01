import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Route parameter exactly as it appears in the URL.
 *
 * `@Param('id') id: number` lets the global ValidationPipe (`transform: true`)
 * coerce the value with `Number()` before any parameter pipe runs, so `01`,
 * `+1` or `1e3` would already be numbers. Custom decorators are not touched by
 * global pipes: the pipes passed here receive the raw string.
 */
export const RawParam = createParamDecorator(
  (name: string, context: ExecutionContext): string | undefined => {
    const value = context.switchToHttp().getRequest<Request>().params[name];
    // Only wildcard segments are arrays; a named parameter is always a string.
    return typeof value === 'string' ? value : undefined;
  },
);
