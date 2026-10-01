import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Uniform error payload returned by every endpoint. */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  readonly statusCode: number;

  @ApiProperty({ description: 'HTTP reason phrase', example: 'Not Found' })
  readonly error: string;

  @ApiProperty({ example: 'Player with id 42 not found' })
  readonly message: string;

  @ApiPropertyOptional({
    description: 'Field-level details, e.g. validation errors',
    example: ['sex must be one of the following values: M, F'],
    type: [String],
  })
  readonly details?: string[];

  @ApiProperty({ example: '/api/v1/players/42' })
  readonly path: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T12:00:00.000Z' })
  readonly timestamp: string;
}
