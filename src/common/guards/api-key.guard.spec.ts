import { type ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

const API_KEY = 'a-sufficiently-long-test-key';

function contextWithHeaders(headers: Record<string, string>): ExecutionContext {
  const request = { header: (name: string) => headers[name.toLowerCase()] };
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  const guard = new ApiKeyGuard({ port: 3000, apiKey: API_KEY });

  it('lets a request with the right key through', () => {
    expect(guard.canActivate(contextWithHeaders({ 'x-api-key': API_KEY }))).toBe(true);
  });

  it.each([
    ['no key', {}],
    ['a wrong key', { 'x-api-key': 'not-the-right-key' }],
    ['a key with a different length', { 'x-api-key': `${API_KEY}x` }],
    ['an empty key', { 'x-api-key': '' }],
  ])('rejects a request with %s', (_, headers) => {
    expect(() => guard.canActivate(contextWithHeaders(headers))).toThrow(
      new UnauthorizedException('Missing or invalid API key'),
    );
  });

  it('fails closed when no key is configured', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const unconfigured = new ApiKeyGuard({ port: 3000 });

    expect(() => unconfigured.canActivate(contextWithHeaders({ 'x-api-key': API_KEY }))).toThrow(
      UnauthorizedException,
    );
    expect(warn).toHaveBeenCalledWith(
      'API_KEY is not set: write endpoints will refuse every request',
    );
    warn.mockRestore();
  });
});
