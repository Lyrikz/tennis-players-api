import { ApiProperty } from '@nestjs/swagger';

export class BestCountryResponseDto {
  @ApiProperty({ description: 'ISO 3166-1 alpha-3 code', example: 'SRB' })
  readonly code: string;

  @ApiProperty({
    description:
      'Wins / matches over the last matches of all the players of the country, 2 decimals',
    example: 1,
  })
  readonly winRatio: number;

  @ApiProperty({ example: 5 })
  readonly wins: number;

  @ApiProperty({ example: 5 })
  readonly matches: number;
}

export class StatsResponseDto {
  @ApiProperty({
    type: BestCountryResponseDto,
    nullable: true,
    description: 'Country with the best win ratio; null when no match is recorded',
  })
  readonly bestCountry: BestCountryResponseDto | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Mean of the players BMI (kg/m²), 2 decimals; null when there is no player',
    example: 23.36,
  })
  readonly averageBmi: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Median height in centimetres; null when there is no player',
    example: 185,
  })
  readonly medianHeightCm: number | null;
}
