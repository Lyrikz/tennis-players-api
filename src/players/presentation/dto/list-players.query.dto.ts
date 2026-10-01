import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { Sex } from '../../domain';

const toUpperCase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.toUpperCase() : value;

export class ListPlayersQueryDto {
  @ApiPropertyOptional({ enum: Sex, enumName: 'Sex', description: 'Case-insensitive' })
  @IsOptional()
  @Transform(toUpperCase)
  @IsEnum(Sex, { message: 'sex must be one of the following values: M, F' })
  readonly sex?: Sex;

  @ApiPropertyOptional({
    description: 'ISO 3166-1 alpha-3 country code, case-insensitive',
    example: 'SRB',
  })
  @IsOptional()
  @Transform(toUpperCase)
  @Matches(/^[A-Z]{3}$/, { message: 'country must be an ISO 3166-1 alpha-3 code (e.g. SRB)' })
  readonly country?: string;
}
