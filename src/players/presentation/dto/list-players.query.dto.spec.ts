import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListPlayersQueryDto } from './list-players.query.dto';

function validate(query: Record<string, unknown>) {
  const dto = plainToInstance(ListPlayersQueryDto, query);
  return {
    dto,
    errors: validateSync(dto).flatMap((error) => Object.values(error.constraints ?? {})),
  };
}

describe('ListPlayersQueryDto', () => {
  it('accepts an empty query', () => {
    expect(validate({}).errors).toEqual([]);
  });

  it('normalises filters to upper case', () => {
    const { dto, errors } = validate({ sex: 'f', country: 'usa' });

    expect(errors).toEqual([]);
    expect(dto).toEqual({ sex: 'F', country: 'USA' });
  });

  it.each([
    [{ sex: 'X' }, 'sex must be one of the following values: M, F'],
    [{ sex: ['M', 'F'] }, 'sex must be one of the following values: M, F'],
    [{ country: 'FR' }, 'country must be an ISO 3166-1 alpha-3 code (e.g. SRB)'],
    [{ country: 'FR4' }, 'country must be an ISO 3166-1 alpha-3 code (e.g. SRB)'],
  ])('rejects %p', (query, message) => {
    expect(validate(query).errors).toEqual([message]);
  });
});
