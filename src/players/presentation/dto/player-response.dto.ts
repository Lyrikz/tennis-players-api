import { ApiProperty } from '@nestjs/swagger';
import { MatchResult, Sex } from '../../domain';

export class CountryResponseDto {
  @ApiProperty({ description: 'ISO 3166-1 alpha-3 code', example: 'SRB' })
  readonly code: string;

  @ApiProperty({ example: 'https://tenisu.latelier.co/resources/Serbie.png' })
  readonly pictureUrl: string;
}

export class PlayerStatsResponseDto {
  @ApiProperty({ description: 'Official ranking position (1 = best)', example: 2 })
  readonly rank: number;

  @ApiProperty({ example: 2542 })
  readonly points: number;

  @ApiProperty({ description: 'Weight in kilograms', example: 80 })
  readonly weightKg: number;

  @ApiProperty({ description: 'Height in centimetres', example: 188 })
  readonly heightCm: number;

  @ApiProperty({ example: 31 })
  readonly age: number;

  @ApiProperty({
    description: 'Results of the last 5 matches: 1 = win, 0 = loss',
    enum: MatchResult,
    isArray: true,
    example: [1, 1, 1, 1, 1],
  })
  readonly lastResults: MatchResult[];
}

export class PlayerResponseDto {
  @ApiProperty({ example: 52 })
  readonly id: number;

  @ApiProperty({ example: 'Novak' })
  readonly firstName: string;

  @ApiProperty({ example: 'Djokovic' })
  readonly lastName: string;

  @ApiProperty({ example: 'N.DJO' })
  readonly shortName: string;

  @ApiProperty({ enum: Sex, enumName: 'Sex', example: Sex.Male })
  readonly sex: Sex;

  @ApiProperty({ type: CountryResponseDto })
  readonly country: CountryResponseDto;

  @ApiProperty({ example: 'https://tenisu.latelier.co/resources/Djokovic.png' })
  readonly pictureUrl: string;

  @ApiProperty({ type: PlayerStatsResponseDto })
  readonly stats: PlayerStatsResponseDto;
}
