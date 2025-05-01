import React, { useState, useEffect, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import './Gym.css';
import './common.css';
import { gymIcon } from './icons';
import { saveToLocalStorage, getFromLocalStorage } from '../utils/storage';
import { GymPokemon } from './types';

interface GymProps {
  id: string;
  name: string;
  position: [number, number];
  onBattleWon: (reward: string, xp: number) => void;
  capturedPokemons: any[];
}

const Gym: React.FC<GymProps> = ({ id, name, position, onBattleWon, capturedPokemons }) => {
  const [gymLeader, setGymLeader] = useState<GymPokemon | null>(null);
  const [inBattle, setInBattle] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState<any | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [playerTurn, setPlayerTurn] = useState(true);
  const [cooldown, setCooldown] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [badge, setBadge] = useState<string | null>(null);

  // Añadir referencias para controlar el Popup
  const popupRef = useRef<L.Popup | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const map = useMap();

  // Cargar el estado del gimnasio desde localStorage
  useEffect(() => {
    const savedState = getFromLocalStorage(`gym_${id}`, null);
    if (savedState) {
      const { completed, badge, lastBattleTime } = savedState;
      setCompleted(completed);
      setBadge(badge);
      
      // Si la última batalla fue hace menos de 30 minutos, mantener el cooldown
      if (lastBattleTime) {
        const now = Date.now();
        if (now - lastBattleTime < 30 * 60 * 1000) {
          setCooldown(true);
          // Programar el fin del cooldown
          setTimeout(() => {
            setCooldown(false);
          }, 30 * 60 * 1000 - (now - lastBattleTime));
        }
      }
    }
  }, [id]);

  // Generar un Pokémon líder de gimnasio aleatorio
  const generateGymLeader = async () => {
    try {
      // ID aleatorio entre 1 y 151 (primera generación)
      const randomId = Math.floor(Math.random() * 151) + 1;
      const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${randomId}`);
      
      // Nivel aleatorio entre 15 y 30
      const level = Math.floor(Math.random() * 16) + 15;
      
      // HP basado en el nivel y las stats base
      const baseHp = response.data.stats.find((stat: any) => stat.stat.name === 'hp').base_stat;
      const maxHp = Math.floor(baseHp * (1 + level / 50));
      
      setGymLeader({
        id: randomId,
        name: response.data.name,
        sprite: response.data.sprites.front_default,
        hp: maxHp,
        maxHp,
        level
      });
    } catch (error) {
      console.error('Error al generar líder de gimnasio:', error);
    }
  };

  // Función para mantener el Popup abierto
  const keepPopupOpen = () => {
    if (markerRef.current) {
      markerRef.current.openPopup();
    }
  };

  // Modificar la función startBattle para mantener el popup abierto
  const startBattle = (pokemon: any) => {
    if (!gymLeader || cooldown || completed) return;
    
    // Evitar que el evento se propague y cierre el popup
    setTimeout(() => {
      keepPopupOpen();
    }, 10);
    
    setSelectedPokemon({
      ...pokemon,
      hp: 100,
      maxHp: 100
    });
    setInBattle(true);
    setBattleLog([`¡Comienza la batalla entre ${pokemon.name.toUpperCase()} y ${gymLeader.name.toUpperCase()}!`]);
    setPlayerTurn(true);
  };

  // Atacar al líder del gimnasio
  const attackGymLeader = () => {
    if (!gymLeader || !selectedPokemon || !playerTurn) return;
    
    // Evitar que el evento se propague y cierre el popup
    setTimeout(() => {
      keepPopupOpen();
    }, 10);
    
    // Daño aleatorio entre 10 y 25
    const damage = Math.floor(Math.random() * 16) + 10;
    const newHp = Math.max(0, gymLeader.hp - damage);
    
    setBattleLog(prev => [...prev, `¡${selectedPokemon.name.toUpperCase()} ataca y causa ${damage} de daño!`]);
    
    setGymLeader({
      ...gymLeader,
      hp: newHp
    });
    
    setPlayerTurn(false);
    
    // Comprobar si el líder ha sido derrotado
    if (newHp <= 0) {
      handleBattleWon();
      return;
    }
    
    // Turno del líder (después de un pequeño retraso)
    setTimeout(() => {
      if (!selectedPokemon) return;
      
      // Daño aleatorio entre 5 y 20
      const leaderDamage = Math.floor(Math.random() * 16) + 5;
      const newPlayerHp = Math.max(0, selectedPokemon.hp - leaderDamage);
      
      setBattleLog(prev => [...prev, `¡${gymLeader.name.toUpperCase()} contraataca y causa ${leaderDamage} de daño!`]);
      
      setSelectedPokemon({
        ...selectedPokemon,
        hp: newPlayerHp
      });
      
      // Comprobar si el Pokémon del jugador ha sido derrotado
      if (newPlayerHp <= 0) {
        setBattleLog(prev => [...prev, `¡${selectedPokemon.name.toUpperCase()} ha sido derrotado!`]);
        setTimeout(() => {
          setInBattle(false);
          setSelectedPokemon(null);
          // Regenerar la salud del líder
          setGymLeader({
            ...gymLeader,
            hp: gymLeader.maxHp
          });
        }, 2000);
        return;
      }
      
      setPlayerTurn(true);
    }, 1000);
  };

  // Manejar la victoria en la batalla
  const handleBattleWon = () => {
    setBattleLog(prev => [...prev, `¡Has derrotado a ${gymLeader?.name.toUpperCase()}!`]);
    
    // Generar una medalla basada en el nombre del gimnasio
    const badgeName = `Medalla ${name.split(' ')[0]}`;
    
    // Otorgar experiencia y medalla
    const xpGained = Math.floor(Math.random() * 500) + 500;
    
    setTimeout(() => {
      setBattleLog(prev => [
        ...prev, 
        `¡Has ganado ${xpGained} puntos de experiencia!`,
        `¡Has obtenido la ${badgeName}!`
      ]);
      
      // Guardar estado en localStorage
      saveToLocalStorage(`gym_${id}`, {
        completed: true,
        badge: badgeName,
        lastBattleTime: Date.now()
      });
      
      setCompleted(true);
      setBadge(badgeName);
      setCooldown(true);
      
      // Notificar al componente padre
      onBattleWon(badgeName, xpGained);
      
      // Cerrar batalla después de un tiempo
      setTimeout(() => {
        setInBattle(false);
        setSelectedPokemon(null);
      }, 3000);
      
      // Establecer cooldown de 30 minutos
      setTimeout(() => {
        setCooldown(false);
      }, 30 * 60 * 1000);
    }, 2000);
  };

  // Cargar un líder de gimnasio cuando el componente monta
  useEffect(() => {
    generateGymLeader();
  }, []);

  // Añadir una función de limpieza que se ejecute cuando el componente se desmonte
  useEffect(() => {
    return () => {
      // Limpiar el estado del gimnasio cuando el componente se desmonta
      saveToLocalStorage(`gym_${id}`, null);
    };
  }, [id]);

  return (
    <Marker
      position={position}
      icon={gymIcon}
      eventHandlers={{
        popupopen: (e) => {
          popupRef.current = e.popup;
          markerRef.current = e.target;
        }
      }}
      ref={markerRef}
    >
      <Popup 
        className="gym-popup"
        closeButton={false}
        autoClose={false}
        closeOnClick={false}
      >
        <div className="gym-container" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => popupRef.current?.close()} className="close-gym-button">×</button>
          <h3>{name}</h3>
          <p className="gym-title">Gimnasio Pokémon</p>
          
          {!inBattle ? (
            // Vista de selección de Pokémon o información
            <div className="gym-info">
              {completed ? (
                <div className="gym-completed">
                  <p className="badge-earned">¡Has conseguido la {badge}!</p>
                  {cooldown ? (
                    <p className="cooldown-message">Vuelve más tarde para otro desafío</p>
                  ) : (
                    <p className="challenge-again">¿Quieres volver a desafiar este gimnasio?</p>
                  )}
                </div>
              ) : (
                <div className="gym-challenge">
                  <p>¡Desafía a este gimnasio con uno de tus Pokémon!</p>
                  
                  {gymLeader && (
                    <div className="gym-leader">
                      <p>Líder del gimnasio:</p>
                      <div className="leader-pokemon">
                        <img src={gymLeader.sprite} alt={gymLeader.name} />
                        <div>
                          <p className="pokemon-name">{gymLeader.name.toUpperCase()}</p>
                          <p className="pokemon-level">Nv. {gymLeader.level}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {capturedPokemons.length > 0 ? (
                    <div className="pokemon-selection">
                      <p>Selecciona un Pokémon para la batalla:</p>
                      <div className="pokemon-list">
                        {capturedPokemons.slice(0, 3).map((pokemon) => (
                          <div 
                            key={pokemon.id} 
                            className="pokemon-option"
                            onClick={() => startBattle(pokemon)}
                          >
                            <img src={pokemon.sprite} alt={pokemon.name} />
                            <p>{pokemon.name.toUpperCase()}</p>
                          </div>
                        ))}
                      </div>
                      {capturedPokemons.length > 3 && (
                        <p className="more-pokemon">+{capturedPokemons.length - 3} más</p>
                      )}
                    </div>
                  ) : (
                    <p className="no-pokemon">Necesitas capturar Pokémon primero</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Vista de batalla
            <div className="battle-screen">
              <div className="opponent">
                {gymLeader && (
                  <>
                    <div className="health-bar">
                      <div 
                        className="health-fill"
                        style={{ width: `${(gymLeader.hp / gymLeader.maxHp) * 100}%` }}
                      ></div>
                    </div>
                    <img src={gymLeader.sprite} alt={gymLeader.name} className="pokemon-sprite" />
                  </>
                )}
              </div>
              
              <div className="player">
                {selectedPokemon && (
                  <>
                    <img src={selectedPokemon.sprite} alt={selectedPokemon.name} className="pokemon-sprite back" />
                    <div className="health-bar">
                      <div 
                        className="health-fill"
                        style={{ width: `${(selectedPokemon.hp / selectedPokemon.maxHp) * 100}%` }}
                      ></div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Asegurarnos de que haya espacio suficiente entre los elementos */}
              <div style={{ height: '10px' }}></div>
              
              <div className="battle-participants">
                <div className="opponent-name simple">
                  {gymLeader && (
                    <span>{gymLeader.name.toUpperCase()}</span>
                  )}
                </div>
                <span className="vs">VS</span>
                <div className="player-name simple">
                  {selectedPokemon && <span>{selectedPokemon.name.toUpperCase()}</span>}
                </div>
              </div>
              
              <div className="battle-controls">
                <button 
                  onClick={attackGymLeader}
                  disabled={!playerTurn || !gymLeader || gymLeader.hp <= 0 || !selectedPokemon || selectedPokemon.hp <= 0}
                  className="attack-button"
                >
                  ¡Atacar!
                </button>
              </div>
              
              {/* Añadir un espacio extra para evitar que el triángulo o cualquier otro elemento se superponga */}
              <div style={{ height: '10px' }}></div>
              
              <div className="battle-log-container">
                <div className="battle-log">
                  <p>{battleLog[battleLog.length - 1]}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
};

export default Gym; 