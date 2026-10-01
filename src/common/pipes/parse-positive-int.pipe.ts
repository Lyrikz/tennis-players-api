import { BadRequestException, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';

const POSITIVE_INTEGER = /^[1-9]\d*$/;

/**
 * Stricter `ParseIntPipe`: only accepts strictly positive integers written in
 * canonical decimal form. `ParseIntPipe` lets `-1`, `0` or `+1` through, which
 * are never valid identifiers.
 *
 * Must receive the raw string (see `RawParam`): anything else is rejected.
 */
export class ParsePositiveIntPipe implements PipeTransform<unknown, number> {
  transform(value: unknown, { data }: ArgumentMetadata): number {
    const parsed = Number(value);
    if (
      typeof value !== 'string' ||
      !POSITIVE_INTEGER.test(value) ||
      !Number.isSafeInteger(parsed)
    ) {
      throw new BadRequestException(`${data ?? 'value'} must be a positive integer`);
    }
    return parsed;
  }
}
