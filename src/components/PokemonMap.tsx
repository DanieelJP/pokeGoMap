import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import './PokemonMap.css';

// Arreglar el problema de los iconos de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Iconos personalizados para Pokéstops y gimnasios
const pokestopIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [50, 82],
  iconAnchor: [25, 82],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

const gymIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [50, 82],
  iconAnchor: [25, 82],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  shadowAnchor: [12, 41]
});

// Componente para manejar el zoom
const MapController: React.FC<{ onZoomEnd: (zoom: number) => void }> = ({ onZoomEnd }) => {
  const map = useMap();
  
  useEffect(() => {
    map.on('zoomend', () => {
      onZoomEnd(map.getZoom());
    });
    
    return () => {
      map.off('zoomend');
    };
  }, [map, onZoomEnd]);
  
  return null;
};

interface Pokemon {
  id: number;
  name: string;
  position: [number, number];
  sprite: string;
}

interface PokeStop {
  id: string;
  name: string;
  position: [number, number];
  type: 'pokestop' | 'gym';
}

const PokemonMap: React.FC = () => {
  const [position, setPosition] = useState<[number, number]>([41.3851, 2.1734]); // Barcelona por defecto
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [pokeStops, setPokeStops] = useState<PokeStop[]>([]);
  const [zoom, setZoom] = useState<number>(13);
  const [currentLocationName, setCurrentLocationName] = useState<string>('');

  useEffect(() => {
    // Obtener la ubicación del usuario
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLon = pos.coords.longitude;
          setPosition([userLat, userLon]);
          generateRandomPokemons(userLat, userLon);
          findNearbyPlaces(userLat, userLon);
          getLocationName(userLat, userLon);
        },
        () => {
          console.log('Error al obtener la ubicación');
          generateRandomPokemons(position[0], position[1]);
          findNearbyPlaces(position[0], position[1]);
          getLocationName(position[0], position[1]);
        }
      );
    } else {
      console.log('Geolocalización no soportada por este navegador');
      generateRandomPokemons(position[0], position[1]);
      findNearbyPlaces(position[0], position[1]);
      getLocationName(position[0], position[1]);
    }
  }, []);

  const getLocationName = async (lat: number, lon: number) => {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        {
          headers: {
            'User-Agent': 'PokeGoMap/1.0'
          }
        }
      );
      setCurrentLocationName(response.data.display_name);
    } catch (error) {
      console.error('Error al obtener el nombre del lugar:', error);
      setCurrentLocationName('Ubicación desconocida');
    }
  };

  const generateRandomPokemons = async (lat: number, lon: number) => {
    const newPokemons: Pokemon[] = [];
    for (let i = 0; i < 5; i++) {
      const randomId = Math.floor(Math.random() * 151) + 1;
      try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${randomId}`);
        
        // Generar posición aleatoria
        const randomLat = lat + (Math.random() - 0.5) * 0.1;
        const randomLon = lon + (Math.random() - 0.5) * 0.1;
        
        const pokemon: Pokemon = {
          id: randomId,
          name: response.data.name,
          position: [randomLat, randomLon],
          sprite: response.data.sprites.front_default
        };
        newPokemons.push(pokemon);
      } catch (error) {
        console.error('Error al obtener Pokémon:', error);
      }
    }
    setPokemons(newPokemons);
  };

  const findNearbyPlaces = async (lat: number, lon: number) => {
    try {
      // Buscar lugares cercanos usando Nominatim con diferentes categorías
      const categories = ['tourism', 'amenity', 'leisure', 'historic'];
      let allPlaces: any[] = [];
      
      // Buscar en múltiples categorías para obtener más resultados
      for (const category of categories) {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/search?format=json&q=${category}&lat=${lat}&lon=${lon}&radius=10000`,
          {
            headers: {
              'User-Agent': 'PokeGoMap/1.0'
            }
          }
        );
        
        if (response.data && response.data.length > 0) {
          allPlaces = [...allPlaces, ...response.data];
        }
      }

      // Asegurarse de que hay resultados
      if (allPlaces.length > 0) {
        // Dividir los lugares en dos grupos: uno para Pokéstops y otro para gimnasios
        const halfLength = Math.ceil(allPlaces.length / 2);
        
        const pokestops = allPlaces
          .slice(0, halfLength)
          .map((place: any) => ({
            id: place.place_id.toString(),
            name: place.display_name,
            position: [parseFloat(place.lat), parseFloat(place.lon)] as [number, number],
            type: 'pokestop' as const
          }));
        
        const gyms = allPlaces
          .slice(halfLength, halfLength * 2)
          .map((place: any) => ({
            id: place.place_id.toString(),
            name: place.display_name,
            position: [parseFloat(place.lat), parseFloat(place.lon)] as [number, number],
            type: 'gym' as const
          }));
        
        // Combinar los dos grupos
        const newPokeStops = [...pokestops, ...gyms];
        
        setPokeStops(newPokeStops);
        console.log('Pokéstops y gimnasios encontrados:', newPokeStops.length);
      } else {
        // Si no hay resultados, crear algunos Pokéstops y gimnasios de ejemplo
        createGlobalPokeStops();
      }
    } catch (error) {
      console.error('Error al buscar lugares cercanos:', error);
      // Crear Pokéstops y gimnasios de ejemplo en caso de error
      createGlobalPokeStops();
    }
  };

  // Función para crear Poképaradas y gimnasios en todo el mapa
  const createGlobalPokeStops = () => {
    // Definir una cuadrícula global para cubrir todo el mapa
    const gridSize = 5; // 5x5 cuadrícula (menos elementos pero más visibles)
    const examplePokeStops: PokeStop[] = [];
    
    // Definir un área más amplia para cubrir todo el mapa
    const minLat = 41.0; // Latitud mínima
    const maxLat = 41.5; // Latitud máxima
    const minLon = 1.8;  // Longitud mínima
    const maxLon = 2.3;  // Longitud máxima
    
    // Calcular el espaciado basado en el área
    const latSpacing = (maxLat - minLat) / gridSize;
    const lonSpacing = (maxLon - minLon) / gridSize;
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const lat = minLat + i * latSpacing;
        const lon = minLon + j * lonSpacing;
        
        // Alternar entre Poképaradas y gimnasios
        const isGym = (i + j) % 2 === 0;
        
        examplePokeStops.push({
          id: `${i}-${j}`,
          name: isGym ? `Gimnasio ${i}-${j}` : `Pokéstop ${i}-${j}`,
          position: [lat, lon],
          type: isGym ? 'gym' : 'pokestop'
        });
      }
    }
    
    // Añadir algunos Poképaradas y gimnasios adicionales en puntos específicos
    const additionalStops: PokeStop[] = [
      {
        id: 'extra-1',
        name: 'Pokéstop Sagrada Familia',
        position: [41.4036, 2.1744],
        type: 'pokestop'
      },
      {
        id: 'extra-2',
        name: 'Gimnasio Park Güell',
        position: [41.4145, 2.1527],
        type: 'gym'
      },
      {
        id: 'extra-3',
        name: 'Pokéstop Camp Nou',
        position: [41.3809, 2.1228],
        type: 'pokestop'
      },
      {
        id: 'extra-4',
        name: 'Gimnasio Montjuïc',
        position: [41.3636, 2.1687],
        type: 'gym'
      }
    ];
    
    setPokeStops([...examplePokeStops, ...additionalStops]);
    console.log('Usando Pokéstops y gimnasios globales:', examplePokeStops.length + additionalStops.length);
  };

  const handleZoomEnd = (newZoom: number) => {
    setZoom(newZoom);
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <MapContainer
        center={position}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        maxZoom={18}
        minZoom={3}
      >
        <MapController onZoomEnd={handleZoomEnd} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {pokeStops.map((stop) => (
          <Marker 
            key={stop.id} 
            position={stop.position}
            icon={stop.type === 'pokestop' ? pokestopIcon : gymIcon}
          >
            <Popup>
              <div>
                <h3>{stop.name}</h3>
                <p>{stop.type === 'pokestop' ? 'Pokéstop' : 'Gimnasio'}</p>
              </div>
            </Popup>
          </Marker>
        ))}
        {pokemons.map((pokemon) => (
          <Marker 
            key={pokemon.id} 
            position={pokemon.position}
          >
            <Popup>
              <div>
                <img src={pokemon.sprite} alt={pokemon.name} style={{ width: '100px' }} />
                <h3>{pokemon.name}</h3>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="location-info">
        <h3>Ubicación: {currentLocationName}</h3>
        <p>Poképaradas y gimnasios: {pokeStops.length}</p>
      </div>
    </div>
  );
};

export default PokemonMap; 