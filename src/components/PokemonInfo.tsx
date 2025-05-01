import React from 'react';
import './PokemonInfo.css';
import './common.css';
import { Pokemon } from './types';

interface PokemonInfoProps {
  pokemon: Pokemon;
  onClose: () => void;
  onCapture: () => void;
}

const PokemonInfo: React.FC<PokemonInfoProps> = ({ pokemon, onClose, onCapture }) => {
  console.log("Renderizando PokemonInfo para:", pokemon.name);
  
  return (
    <div className="pokemon-info">
      <button onClick={onClose} className="close-button">×</button>
      <div className="pokemon-content">
        <h2 style={{ color: 'red' }}>¡Información del Pokémon!</h2>
        <img src={pokemon.sprite} alt={pokemon.name} className="pokemon-sprite" />
        <h2>{pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}</h2>
        
        {pokemon.types && (
          <div className="pokemon-types">
            {pokemon.types.map((type, index) => (
              <span key={index} className={`type-badge ${type}`}>
                {type}
              </span>
            ))}
          </div>
        )}
        
        {pokemon.height && <p><strong>Altura:</strong> {pokemon.height / 10}m</p>}
        {pokemon.weight && <p><strong>Peso:</strong> {pokemon.weight / 10}kg</p>}
        
        <button 
          onClick={onCapture}
          className="capture-button"
        >
          Intentar capturar
        </button>
      </div>
    </div>
  );
};

export default PokemonInfo; 