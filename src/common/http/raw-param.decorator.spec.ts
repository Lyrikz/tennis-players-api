import type { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { RawParam } from './raw-param.decorator';

type Factory = (name: string, context: ExecutionContext) => unknown;

/** Extracts the factory Nest registers for a custom parameter decorator. */
function factoryOf(decorator: (name: string) => ParameterDecorator): Factory {
  class Target {
    handler(@decorator('id') _id: string): void {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Target, 'handler') as Record<
    string,
    { factory: Factory }
  >;
  return Object.values(args)[0]!.factory;
}

const contextWithParams = (params: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ params }) }) }) as unknown as ExecutionContext;

describe('RawParam', () => {
  const factory = factoryOf(RawParam);

  it('returns the route parameter exactly as written in the URL', () => {
    expect(factory('id', contextWithParams({ id: '01' }))).toBe('01');
  });

  it('returns undefined for a missing or wildcard (array) parameter', () => {
    expect(factory('id', contextWithParams({}))).toBeUndefined();
    expect(factory('id', contextWithParams({ id: ['a', 'b'] }))).toBeUndefined();
  });
});
