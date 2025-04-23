import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

interface PokeStopProps {
  position: [number, number];
  name: string;
  type: 'pokestop' | 'gym';
  onSpin: () => void;
}

// Iconos personalizados para Pokéstops y gimnasios
const pokestopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

const gymIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

const PokeStop: React.FC<PokeStopProps> = ({ position, name, type, onSpin }) => {
  return (
    <Marker 
      position={position} 
      icon={type === 'pokestop' ? pokestopIcon : gymIcon}
      eventHandlers={{
        click: () => {
          console.log(`Clicked on ${type}: ${name}`);
        }
      }}
    >
      <Popup>
        <div>
          <h3>{name}</h3>
          <p>{type === 'pokestop' ? 'Pokéstop' : 'Gimnasio'}</p>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onSpin();
            }}
            className={type === 'pokestop' ? 'pokestop-button' : 'gym-button'}
          >
            {type === 'pokestop' ? 'Girar Pokéstop' : 'Luchar en Gimnasio'}
          </button>
        </div>
      </Popup>
    </Marker>
  );
};

export default PokeStop; 