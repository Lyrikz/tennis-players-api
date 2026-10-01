import { BadRequestException } from '@nestjs/common';
import { ParsePositiveIntPipe } from './parse-positive-int.pipe';

describe('ParsePositiveIntPipe', () => {
  const pipe = new ParsePositiveIntPipe();
  const metadata = { type: 'param', data: 'id' } as const;

  it.each([
    ['1', 1],
    ['52', 52],
    ['9007199254740991', Number.MAX_SAFE_INTEGER],
  ])('parses %p', (value, expected) => {
    expect(pipe.transform(value, metadata)).toBe(expected);
  });

  it.each(['0', '-1', '+1', '01', '1.5', '1e3', 'abc', '', ' 1', '9007199254740992'])(
    'rejects %p',
    (value) => {
      expect(() => pipe.transform(value, metadata)).toThrow(
        new BadRequestException('id must be a positive integer'),
      );
    },
  );

  it.each([1, undefined, null])('rejects a value that is not the raw string (%p)', (value) => {
    expect(() => pipe.transform(value, metadata)).toThrow('id must be a positive integer');
  });

  it('uses a generic name when the parameter is anonymous', () => {
    expect(() => pipe.transform('x', { type: 'custom' })).toThrow(
      'value must be a positive integer',
    );
  });
});
