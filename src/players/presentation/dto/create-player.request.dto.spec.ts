import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import { CreatePlayerRequestDto } from './create-player.request.dto';

const validBody = () => ({
  firstName: 'Carlos',
  lastName: 'Alcaraz',
  shortName: 'C.ALC',
  sex: 'M',
  country: { code: 'ESP', pictureUrl: 'https://example.com/esp.png' },
  pictureUrl: 'https://example.com/alcaraz.png',
  stats: { rank: 3, points: 2000, weightKg: 74, heightCm: 183, age: 21, lastResults: [1, 1, 0] },
});

/** Flattens nested errors into `path: message` strings. */
function messages(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    return [
      ...Object.values(error.constraints ?? {}).map((message) => `${path}: ${message}`),
      ...messages(error.children ?? [], path),
    ];
  });
}

function validate(body: unknown) {
  const dto = plainToInstance(CreatePlayerRequestDto, body);
  return {
    dto,
    errors: messages(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })),
  };
}

describe('CreatePlayerRequestDto', () => {
  it('accepts a valid player', () => {
    expect(validate(validBody()).errors).toEqual([]);
  });

  it('normalises case and whitespace', () => {
    const { dto, errors } = validate({
      ...validBody(),
      firstName: '  Carlos ',
      sex: 'm',
      country: { code: 'esp', pictureUrl: 'https://example.com/esp.png' },
    });

    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ firstName: 'Carlos', sex: 'M', country: { code: 'ESP' } });
  });

  it('accepts a player without any recorded match', () => {
    const body = validBody();
    expect(validate({ ...body, stats: { ...body.stats, lastResults: [] } }).errors).toEqual([]);
  });

  it('requires every field', () => {
    expect(validate({}).errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^firstName: /),
        expect.stringMatching(/^lastName: /),
        expect.stringMatching(/^shortName: /),
        expect.stringMatching(/^sex: /),
        expect.stringMatching(/^country: /),
        expect.stringMatching(/^pictureUrl: /),
        expect.stringMatching(/^stats: /),
      ]),
    );
  });

  it.each<[string, (body: ReturnType<typeof validBody>) => unknown, string]>([
    [
      'a blank name',
      (b) => ({ ...b, firstName: '   ' }),
      'firstName: firstName should not be empty',
    ],
    [
      'an unknown sex',
      (b) => ({ ...b, sex: 'X' }),
      'sex: sex must be one of the following values: M, F',
    ],
    [
      'an invalid country code',
      (b) => ({ ...b, country: { ...b.country, code: 'SPAIN' } }),
      'country.code: code must be an ISO 3166-1 alpha-3 code (e.g. SRB)',
    ],
    [
      'a non-https picture',
      (b) => ({ ...b, pictureUrl: 'http://example.com/a.png' }),
      'pictureUrl: pictureUrl must be an https URL',
    ],
    [
      'a rank of 0',
      (b) => ({ ...b, stats: { ...b.stats, rank: 0 } }),
      'stats.rank: rank must not be less than 1',
    ],
    [
      'a rank as a string',
      (b) => ({ ...b, stats: { ...b.stats, rank: '3' } }),
      'stats.rank: rank must be an integer number',
    ],
    [
      'an unrealistic height',
      (b) => ({ ...b, stats: { ...b.stats, heightCm: 300 } }),
      'stats.heightCm: heightCm must not be greater than 250',
    ],
    [
      'a weight in grams',
      (b) => ({ ...b, stats: { ...b.stats, weightKg: 74000 } }),
      'stats.weightKg: weightKg must not be greater than 200',
    ],
    [
      'an invalid match result',
      (b) => ({ ...b, stats: { ...b.stats, lastResults: [1, 2] } }),
      'stats.lastResults: lastResults must only contain 1 (win) or 0 (loss)',
    ],
    [
      'more than 5 results',
      (b) => ({ ...b, stats: { ...b.stats, lastResults: [1, 1, 1, 1, 1, 1] } }),
      'stats.lastResults: lastResults must contain no more than 5 elements',
    ],
    ['an id', (b) => ({ ...b, id: 1 }), 'id: property id should not exist'],
    [
      'an unknown nested field',
      (b) => ({ ...b, stats: { ...b.stats, titles: 4 } }),
      'stats.titles: property titles should not exist',
    ],
  ])('rejects %s', (_, mutate, expected) => {
    expect(validate(mutate(validBody())).errors).toContain(expected);
  });
});
