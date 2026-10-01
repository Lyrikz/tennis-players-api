import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ErrorResponseDto } from '../../common/filters/error-response.dto';
import { API_KEY_SECURITY_SCHEME, ApiKeyGuard } from '../../common/guards/api-key.guard';
import { API_PREFIX } from '../../common/http/api-prefix';
import { RawParam } from '../../common/http/raw-param.decorator';
import { ParsePositiveIntPipe } from '../../common/pipes/parse-positive-int.pipe';
import { PlayersService } from '../application/players.service';
import { CreatePlayerRequestDto } from './dto/create-player.request.dto';
import { ListPlayersQueryDto } from './dto/list-players.query.dto';
import { PlayerResponseDto } from './dto/player-response.dto';
import { PlayerMapper } from './player.mapper';

const PLAYERS_PATH = 'players';

@ApiTags('players')
@Controller(PLAYERS_PATH)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @ApiOperation({ summary: 'List players, from best to worst official rank' })
  @ApiOkResponse({ type: [PlayerResponseDto] })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Invalid or unknown filter' })
  async findAll(@Query() query: ListPlayersQueryDto): Promise<PlayerResponseDto[]> {
    const players = await this.playersService.findAll(PlayerMapper.toCriteria(query));
    return players.map((player) => PlayerMapper.toResponse(player));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a player by id' })
  @ApiParam({ name: 'id', type: Number, description: 'Positive integer', example: 52 })
  @ApiOkResponse({ type: PlayerResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'id is not a positive integer' })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Player not found' })
  async findOne(@RawParam('id', ParsePositiveIntPipe) id: number): Promise<PlayerResponseDto> {
    return PlayerMapper.toResponse(await this.playersService.findById(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity(API_KEY_SECURITY_SCHEME)
  @ApiOperation({ summary: 'Add a player (requires an API key)' })
  @ApiCreatedResponse({
    type: PlayerResponseDto,
    description: 'Player created; its id is assigned by the server',
    headers: { Location: { description: 'URL of the created player', schema: { type: 'string' } } },
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Invalid body' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Missing or invalid API key' })
  async create(
    @Body() body: CreatePlayerRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PlayerResponseDto> {
    const player = await this.playersService.create(PlayerMapper.toNewPlayer(body));
    response.location(`/${API_PREFIX}/${PLAYERS_PATH}/${player.id}`);
    return PlayerMapper.toResponse(player);
  }
}
