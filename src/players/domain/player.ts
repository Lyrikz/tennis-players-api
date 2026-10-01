export enum Sex {
  Male = 'M',
  Female = 'F',
}

export enum MatchResult {
  Loss = 0,
  Win = 1,
}

export interface Country {
  /** ISO 3166-1 alpha-3 code, e.g. `SRB`. */
  readonly code: string;
  readonly pictureUrl: string;
}

/**
 * A tennis player, expressed with explicit units.
 *
 * The raw data source stores weight in grams: conversion happens once, in the
 * infrastructure layer, so the rest of the application only deals with kg/cm.
 */
/** Highest rank that can be stored (5-digit zero-padded sort keys). */
export const MAX_RANK = 99_999;

export interface Player {
  readonly id: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly shortName: string;
  readonly sex: Sex;
  readonly country: Country;
  readonly pictureUrl: string;
  /** Official ranking position (1 = best). */
  readonly rank: number;
  readonly points: number;
  readonly weightKg: number;
  readonly heightCm: number;
  readonly age: number;
  /** Results of the last 5 matches, in the order provided by the data source. */
  readonly lastResults: readonly MatchResult[];
}

/** A player that has not been persisted yet: its id is assigned by the repository. */
export type NewPlayer = Omit<Player, 'id'>;
