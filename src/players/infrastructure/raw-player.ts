/** Shape of a player in `data/players.json`, as provided by the client. */
export interface RawPlayer {
  id: number;
  firstname: string;
  lastname: string;
  shortname: string;
  sex: string;
  country: { picture: string; code: string };
  picture: string;
  data: {
    rank: number;
    points: number;
    /** Grams. */
    weight: number;
    /** Centimetres. */
    height: number;
    age: number;
    /** Last 5 matches: 1 = win, 0 = loss. */
    last: number[];
  };
}

export interface RawPlayersFile {
  players: RawPlayer[];
}
