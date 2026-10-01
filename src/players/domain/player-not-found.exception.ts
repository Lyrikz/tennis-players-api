import { EntityNotFoundException } from '../../common/domain/domain.exception';

export class PlayerNotFoundException extends EntityNotFoundException {
  constructor(readonly playerId: number) {
    super(`Player with id ${playerId} not found`);
  }
}
