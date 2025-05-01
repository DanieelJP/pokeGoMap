export interface Pokemon {
  id: number;
  name: string;
  position: [number, number];
  sprite: string;
  types?: string[];
  height?: number;
  weight?: number;
  hp?: number;
  maxHp?: number;
}

export interface PokeStop {
  id: string;
  name: string;
  position: [number, number];
  type: 'pokestop' | 'gym';
}

export interface GymPokemon {
  id: number;
  name: string;
  sprite: string;
  hp: number;
  maxHp: number;
  level: number;
} 