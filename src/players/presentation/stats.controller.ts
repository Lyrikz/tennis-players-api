import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatsService } from '../application/stats.service';
import { StatsResponseDto } from './dto/stats-response.dto';
import { PlayerMapper } from './player.mapper';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @ApiOperation({
    summary: 'Global statistics: best country by win ratio, average BMI, median height',
  })
  @ApiOkResponse({ type: StatsResponseDto })
  async getStatistics(): Promise<StatsResponseDto> {
    return PlayerMapper.toStatsResponse(await this.statsService.getStatistics());
  }
}
