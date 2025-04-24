import React, { useState, useEffect } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import './PokeStop.css';

// Iconos para pokestop normal y girado
const pokestopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41],
  className: ''
});

const spunPokestopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

const gymIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

interface PokeStopProps {
  id: string;
  name: string;
  position: [number, number];
  type: 'pokestop' | 'gym';
  onItemsReceived?: (items: string[]) => void;
}

const PokeStop: React.FC<PokeStopProps> = ({ id, name, position, type, onItemsReceived }) => {
  const [isSpun, setIsSpun] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rewards, setRewards] = useState<string[]>([]);
  const [lastSpinTime, setLastSpinTime] = useState<number | null>(null);
  const cooldownTime = 2 * 60 * 1000; // 2 minutos en milisegundos (cambiado de 5 a 2)

  useEffect(() => {
    // Cargar el estado anterior del pokestop si existe
    const savedState = localStorage.getItem(`pokestop_${id}`);
    if (savedState) {
      const { isSpun, lastSpinTime, rewards } = JSON.parse(savedState);
      setIsSpun(isSpun);
      setLastSpinTime(lastSpinTime);
      setRewards(rewards);
      
      // Comprobar si ha pasado el tiempo de cooldown
      if (isSpun && lastSpinTime) {
        const now = Date.now();
        if (now - lastSpinTime > cooldownTime) {
          setIsSpun(false);
          setLastSpinTime(null);
          setRewards([]);
        } else {
          // Programar reset cuando termine el cooldown
          const remainingTime = cooldownTime - (now - lastSpinTime);
          const timerId = setTimeout(() => {
            setIsSpun(false);
            setLastSpinTime(null);
            setRewards([]);
            localStorage.setItem(`pokestop_${id}`, JSON.stringify({
              isSpun: false,
              lastSpinTime: null,
              rewards: []
            }));
          }, remainingTime);
          
          return () => clearTimeout(timerId);
        }
      }
    }
  }, [id, cooldownTime]);

  const spinPokeStop = () => {
    if (!isSpun && type === 'pokestop') {
      // Iniciar animación
      setSpinning(true);
      
      setTimeout(() => {
        // Generar recompensas aleatorias
        const possibleRewards = ["Poké Ball", "Super Ball", "Ultra Ball", "Poción", "Super Poción", "Revivir"];
        // Generar entre 2 y 4 recompensas aleatorias
        const numRewards = Math.floor(Math.random() * 3) + 2;
        const randomRewards = Array.from({length: numRewards}, () => 
          possibleRewards[Math.floor(Math.random() * possibleRewards.length)]
        );
        
        // Establecer estado
        setRewards(randomRewards);
        setIsSpun(true);
        setSpinning(false);
        const currentTime = Date.now();
        setLastSpinTime(currentTime);
        
        // Guardar estado en localStorage
        localStorage.setItem(`pokestop_${id}`, JSON.stringify({
          isSpun,
          lastSpinTime: currentTime,
          rewards: randomRewards
        }));
        
        // Notificar al componente padre sobre los items recibidos
        if (onItemsReceived) {
          onItemsReceived(randomRewards);
        }
        
        // Programar reset después del cooldown
        setTimeout(() => {
          setIsSpun(false);
          setLastSpinTime(null);
          setRewards([]);
          localStorage.setItem(`pokestop_${id}`, JSON.stringify({
            isSpun: false,
            lastSpinTime: null,
            rewards: []
          }));
        }, cooldownTime);
      }, 1000); // Duración de la animación de giro
    }
  };

  // Calcular tiempo restante
  const getRemainingTime = () => {
    if (!lastSpinTime) return null;
    
    const now = Date.now();
    const elapsed = now - lastSpinTime;
    if (elapsed > cooldownTime) return null;
    
    const remaining = cooldownTime - elapsed;
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const remainingTime = getRemainingTime();

  // Determinar qué icono usar
  let currentIcon;
  if (type === 'gym') {
    currentIcon = gymIcon;
  } else {
    currentIcon = isSpun ? spunPokestopIcon : pokestopIcon;
  }

  return (
    <Marker 
      position={position}
      icon={currentIcon}
      eventHandlers={{
        click: spinPokeStop
      }}
    >
      <Popup>
        <div className="pokestop-popup">
          <h3>{name}</h3>
          <p>{type === 'pokestop' ? 'Poképarada' : 'Gimnasio'}</p>
          
          {type === 'pokestop' && (
            <>
              {isSpun ? (
                <div>
                  <p className="spun-message">✅ ¡Poképarada girada!</p>
                  <p>Has recibido:</p>
                  <ul className="rewards-list">
                    {rewards.map((reward, index) => (
                      <li key={index}>{reward}</li>
                    ))}
                  </ul>
                  {remainingTime && (
                    <p className="cooldown">Disponible en: {remainingTime}</p>
                  )}
                </div>
              ) : (
                <button 
                  className="spin-button"
                  onClick={spinPokeStop}
                  disabled={spinning}
                >
                  {spinning ? 'Girando...' : '¡Toca para girar!'}
                </button>
              )}
            </>
          )}
        </div>
      </Popup>
    </Marker>
  );
};

export default PokeStop; 