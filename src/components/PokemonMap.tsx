import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import './PokemonMap.css';
import PokemonInfo from './PokemonInfo';

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
  types?: string[];
  height?: number;
  weight?: number;
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
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(null);

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
    
    // Definimos los límites de España
    const spainBounds = {
      north: 43.8,
      south: 36.0,
      east: 3.3,
      west: -9.3
    };

    for (let i = 0; i < 5; i++) {
      const randomId = Math.floor(Math.random() * 151) + 1;
      try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${randomId}`);
        
        // Posición aleatoria dentro de España
        const randomLat = spainBounds.south + (Math.random() * (spainBounds.north - spainBounds.south));
        const randomLon = spainBounds.west + (Math.random() * (spainBounds.east - spainBounds.west));
        
        // Extraer toda la información relevante
        const pokemon: Pokemon = {
          id: randomId,
          name: response.data.name,
          position: [randomLat, randomLon],
          sprite: response.data.sprites.front_default,
          types: response.data.types.map((t: any) => t.type.name),
          height: response.data.height,
          weight: response.data.weight
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
      // Definimos los límites de España
      const spainBounds = {
        north: 43.8,
        south: 36.0,
        east: 3.3,
        west: -9.3
      };

      // Verificar si la ubicación está dentro de España
      const isInSpain = lat >= spainBounds.south && 
                       lat <= spainBounds.north && 
                       lon >= spainBounds.west && 
                       lon <= spainBounds.east;

      // Si no está en España, usar el centro de España
      if (!isInSpain) {
        lat = 40.4637; // Madrid
        lon = -3.7492;
      }

      // Buscar lugares cercanos usando Nominatim con diferentes categorías
      const categories = ['tourism', 'amenity', 'leisure', 'historic'];
      let allPlaces: any[] = [];
      
      // Buscar en múltiples categorías para obtener más resultados
      for (const category of categories) {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/search?` +
          `format=json&q=${category}&` +
          `viewbox=${spainBounds.west},${spainBounds.north},${spainBounds.east},${spainBounds.south}&` +
          `bounded=1`, // Esto fuerza a que los resultados estén dentro del viewbox
          {
            headers: {
              'User-Agent': 'PokeGoMap/1.0'
            }
          }
        );
        
        if (response.data && response.data.length > 0) {
          // Filtrar solo lugares dentro de España
          const placesInSpain = response.data.filter((place: any) => {
            const placeLat = parseFloat(place.lat);
            const placeLon = parseFloat(place.lon);
            return placeLat >= spainBounds.south && 
                   placeLat <= spainBounds.north && 
                   placeLon >= spainBounds.west && 
                   placeLon <= spainBounds.east;
          });
          allPlaces = [...allPlaces, ...placesInSpain];
        }
      }

      // Limitar el número total de lugares para no sobrecargar el mapa
      allPlaces = allPlaces.slice(0, 30); // Limitamos a 30 lugares en total

      if (allPlaces.length > 0) {
        // Dividir los lugares entre Pokéstops y gimnasios
        const halfLength = Math.ceil(allPlaces.length / 2);
        
        const pokestops = allPlaces
          .slice(0, halfLength)
          .map((place: any) => ({
            id: place.place_id.toString(),
            name: place.display_name.split(',')[0], // Solo tomamos la primera parte del nombre
            position: [parseFloat(place.lat), parseFloat(place.lon)] as [number, number],
            type: 'pokestop' as const
          }));
        
        const gyms = allPlaces
          .slice(halfLength)
          .map((place: any) => ({
            id: place.place_id.toString(),
            name: place.display_name.split(',')[0],
            position: [parseFloat(place.lat), parseFloat(place.lon)] as [number, number],
            type: 'gym' as const
          }));
        
        const newPokeStops = [...pokestops, ...gyms];
        setPokeStops(newPokeStops);
        console.log('Pokéstops y gimnasios encontrados en España:', newPokeStops.length);
      } else {
        createGlobalPokeStops(); // Usar el fallback si no se encuentran lugares
      }
    } catch (error) {
      console.error('Error al buscar lugares cercanos:', error);
      createGlobalPokeStops();
    }
  };

  // Función para crear Poképaradas y gimnasios en todo el mapa
  const createGlobalPokeStops = () => {
    const examplePokeStops: PokeStop[] = [];
    
    // Definimos ciudades importantes de España con sus coordenadas
    const spanishCities = [
      { name: 'Madrid', lat: 40.4168, lon: -3.7038 },
      { name: 'Barcelona', lat: 41.3851, lon: 2.1734 },
      { name: 'Valencia', lat: 39.4699, lon: -0.3763 },
      { name: 'Sevilla', lat: 37.3891, lon: -5.9845 },
      { name: 'Bilbao', lat: 43.2630, lon: -2.9350 },
      { name: 'Zaragoza', lat: 41.6488, lon: -0.8891 },
      { name: 'Málaga', lat: 36.7212, lon: -4.4217 },
      { name: 'Murcia', lat: 37.9922, lon: -1.1307 }
    ];

    // Crear Pokéstops y gimnasios en las ciudades
    spanishCities.forEach((city, index) => {
      // Crear un gimnasio en el centro de la ciudad
      examplePokeStops.push({
        id: `gym-${city.name}`,
        name: `Gimnasio de ${city.name}`,
        position: [city.lat, city.lon],
        type: 'gym'
      });

      // Crear 2-3 Pokéstops alrededor de cada ciudad
      for (let i = 0; i < 3; i++) {
        const offset = (Math.random() - 0.5) * 0.05; // Pequeño offset aleatorio
        examplePokeStops.push({
          id: `pokestop-${city.name}-${i}`,
          name: `Pokéstop ${i + 1} de ${city.name}`,
          position: [city.lat + offset, city.lon + offset],
          type: 'pokestop'
        });
      }
    });

    // Lugares emblemáticos adicionales
    const landmarks = [
      { name: 'Sagrada Familia', lat: 41.4036, lon: 2.1744, type: 'pokestop' },
      { name: 'Alhambra', lat: 37.1760, lon: -3.5890, type: 'gym' },
      { name: 'Plaza Mayor', lat: 40.4168, lon: -3.7038, type: 'pokestop' },
      { name: 'La Giralda', lat: 37.3859, lon: -5.9934, type: 'gym' }
    ];

    landmarks.forEach(landmark => {
      examplePokeStops.push({
        id: `landmark-${landmark.name}`,
        name: landmark.name,
        position: [landmark.lat, landmark.lon],
        type: landmark.type as 'pokestop' | 'gym'
      });
    });

    setPokeStops(examplePokeStops);
  };

  const handleZoomEnd = (newZoom: number) => {
    setZoom(newZoom);
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <MapContainer
        center={[40.4637, -3.7492]}
        zoom={6}
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
                <h3>{pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}</h3>
                <button 
                  onClick={(e) => {
                    e.stopPropagation(); // Evitar que el evento se propague
                    console.log("Botón ver info clickeado");
                    setSelectedPokemon(pokemon);
                  }}
                  style={{
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '10px',
                    width: '100%'
                  }}
                >
                  Ver detalles
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="location-info">
        <h3>Ubicación: {currentLocationName}</h3>
        <p>Poképaradas y gimnasios: {pokeStops.length}</p>
      </div>

      {/* Mostrar información del Pokémon seleccionado */}
      {selectedPokemon && (
        <PokemonInfo 
          pokemon={selectedPokemon} 
          onClose={() => {
            console.log("Cerrando PokemonInfo");
            setSelectedPokemon(null);
          }} 
        />
      )}
    </div>
  );
};

export default PokemonMap; 