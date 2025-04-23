import React from 'react';

interface PokemonInfoProps {
  pokemon: {
    id: number;
    name: string;
    sprite: string;
    types?: string[];
    height?: number;
    weight?: number;
  };
  onClose: () => void;
  onCapture?: () => void;
}

const PokemonInfo: React.FC<PokemonInfoProps> = ({ pokemon, onClose, onCapture }) => {
  return (
    <div className="pokemon-info">
      <button onClick={onClose} className="close-button">×</button>
      <div className="pokemon-content">
        <img src={pokemon.sprite} alt={pokemon.name} className="pokemon-sprite" />
        <h2>{pokemon.name}</h2>
        {pokemon.types && (
          <div className="pokemon-types">
            {pokemon.types.map((type, index) => (
              <span key={index} className={`type-badge ${type}`}>
                {type}
              </span>
            ))}
          </div>
        )}
        {pokemon.height && (
          <p>Altura: {pokemon.height / 10}m</p>
        )}
        {pokemon.weight && (
          <p>Peso: {pokemon.weight / 10}kg</p>
        )}
        {onCapture && (
          <button 
            className="capture-button"
            onClick={(e) => {
              e.stopPropagation();
              onCapture();
            }}
          >
            ¡Capturar!
          </button>
        )}
      </div>
    </div>
  );
};

export default PokemonInfo; 