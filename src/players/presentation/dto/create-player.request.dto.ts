import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MatchResult, MAX_RANK, Sex } from '../../domain';

const toUpperCase = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.toUpperCase() : value;

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const HTTPS_URL = { protocols: ['https'], require_protocol: true };
const MAX_LAST_RESULTS = 5;

export class CreateCountryRequestDto {
  @ApiProperty({ description: 'ISO 3166-1 alpha-3 code, case-insensitive', example: 'ESP' })
  @Transform(toUpperCase)
  @Matches(/^[A-Z]{3}$/, {
    message: '$property must be an ISO 3166-1 alpha-3 code (e.g. SRB)',
  })
  readonly code: string;

  @ApiProperty({ example: 'https://tenisu.latelier.co/resources/Espagne.png' })
  @IsUrl(HTTPS_URL, { message: '$property must be an https URL' })
  readonly pictureUrl: string;
}

export class CreatePlayerStatsRequestDto {
  @ApiProperty({
    description: 'Official ranking position (1 = best)',
    example: 3,
    maximum: MAX_RANK,
  })
  @IsInt()
  @Min(1)
  @Max(MAX_RANK)
  readonly rank: number;

  @ApiProperty({ example: 2000 })
  @IsInt()
  @Min(0)
  readonly points: number;

  @ApiProperty({ description: 'Weight in kilograms', example: 74, minimum: 30, maximum: 200 })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 })
  @Min(30)
  @Max(200)
  readonly weightKg: number;

  @ApiProperty({ description: 'Height in centimetres', example: 183, minimum: 100, maximum: 250 })
  @IsInt()
  @Min(100)
  @Max(250)
  readonly heightCm: number;

  @ApiProperty({ example: 21, minimum: 10, maximum: 80 })
  @IsInt()
  @Min(10)
  @Max(80)
  readonly age: number;

  @ApiProperty({
    description: `Results of the last matches (at most ${MAX_LAST_RESULTS}): 1 = win, 0 = loss`,
    enum: MatchResult,
    isArray: true,
    example: [1, 1, 0, 1, 1],
  })
  @IsArray()
  @ArrayMaxSize(MAX_LAST_RESULTS)
  @IsIn([MatchResult.Win, MatchResult.Loss], {
    each: true,
    message: '$property must only contain 1 (win) or 0 (loss)',
  })
  readonly lastResults: MatchResult[];
}

/** Same shape as `PlayerResponseDto`, without the id, which is assigned by the server. */
export class CreatePlayerRequestDto {
  @ApiProperty({ example: 'Carlos' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  readonly firstName: string;

  @ApiProperty({ example: 'Alcaraz' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  readonly lastName: string;

  @ApiProperty({ example: 'C.ALC' })
  @Transform(trim)
  @IsString()
  @Length(2, 10)
  readonly shortName: string;

  @ApiProperty({ enum: Sex, enumName: 'Sex', description: 'Case-insensitive', example: Sex.Male })
  @Transform(toUpperCase)
  @IsEnum(Sex, { message: 'sex must be one of the following values: M, F' })
  readonly sex: Sex;

  @ApiProperty({ type: CreateCountryRequestDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateCountryRequestDto)
  readonly country: CreateCountryRequestDto;

  @ApiProperty({ example: 'https://tenisu.latelier.co/resources/Alcaraz.png' })
  @IsUrl(HTTPS_URL, { message: '$property must be an https URL' })
  readonly pictureUrl: string;

  @ApiProperty({ type: CreatePlayerStatsRequestDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CreatePlayerStatsRequestDto)
  readonly stats: CreatePlayerStatsRequestDto;
}
