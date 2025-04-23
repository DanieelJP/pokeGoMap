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
  const [capturedPokemons, setCapturedPokemons] = useState<Pokemon[]>([]);
  const [showCollection, setShowCollection] = useState(false);

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
      
      console.log("Intentando obtener lugares de la API...");
      
      // Variable para controlar si usamos datos de la API
      let usingApiData = false;
      let apiLocations: PokeStop[] = [];
      
      try {
        // Intentar obtener exactamente 4 resultados de la API
        const response = await axios.get('https://nominatim.openstreetmap.org/search?format=json&q=madrid+españa&limit=4', {
          headers: {
            'User-Agent': 'PokeGoMap/1.0 (test application)'
          },
          timeout: 5000
        });
        
        if (response.data && response.data.length === 4) {
          console.log(`API devolvió ${response.data.length} resultados`);
          usingApiData = true;
          
          // Dividir exactamente: 2 pokestops y 2 gimnasios
          const pokestops = response.data
            .slice(0, 2)
            .map((place: any) => ({
              id: place.place_id ? place.place_id.toString() : `place-${Math.random()}`,
              name: place.display_name ? place.display_name.split(',')[0] : "Pokéstop",
              position: [parseFloat(place.lat), parseFloat(place.lon)] as [number, number],
              type: 'pokestop' as const
            }));
          
          const gyms = response.data
            .slice(2, 4)
            .map((place: any) => ({
              id: place.place_id ? place.place_id.toString() : `gym-${Math.random()}`,
              name: place.display_name ? place.display_name.split(',')[0] : "Gimnasio",
              position: [parseFloat(place.lat), parseFloat(place.lon)] as [number, number],
              type: 'gym' as const
            }));
          
          apiLocations = [...pokestops, ...gyms];
        }
      } catch (apiError) {
        console.error("Error al consultar la API, usando datos estáticos:", apiError);
        usingApiData = false;
      }
      
      // Si tenemos exactamente 4 ubicaciones de la API, usarlas
      if (usingApiData && apiLocations.length === 4) {
        console.log(`Usando ${apiLocations.length} ubicaciones de la API: 2 pokestops y 2 gimnasios`);
        setPokeStops(apiLocations);
        return;
      }
      
      // Si no, usar datos estáticos simplificados (2 pokestops y 2 gimnasios)
      console.log("Usando datos estáticos para pokeparadas y gimnasios");
      
      // Crear datos de pokeparadas y gimnasios fijos en España - versión simplificada
      const staticLocations: PokeStop[] = [
        // 2 Gimnasios principales
        {
          id: 'gym-madrid',
          name: 'Gimnasio de Madrid',
          position: [40.4168, -3.7038],
          type: 'gym'
        },
        {
          id: 'gym-barcelona',
          name: 'Gimnasio de Barcelona',
          position: [41.3851, 2.1734],
          type: 'gym'
        },
        
        // 2 Pokéstops principales
        {
          id: 'pokestop-madrid-1',
          name: 'Plaza Mayor',
          position: [40.4154, -3.7071],
          type: 'pokestop'
        },
        {
          id: 'pokestop-barcelona-1',
          name: 'Sagrada Familia',
          position: [41.4036, 2.1744],
          type: 'pokestop'
        }
      ];
      
      setPokeStops(staticLocations);
      console.log(`Generados 2 pokéstops y 2 gimnasios estáticos`);
      
    } catch (error: any) {
      console.error('Error general:', error);
      
      // En caso de cualquier error, también usar datos estáticos simplificados
      const emergencyLocations: PokeStop[] = [
        {
          id: 'emergency-gym-1',
          name: 'Gimnasio de Emergencia 1',
          position: [40.4168, -3.7038], // Madrid
          type: 'gym'
        },
        {
          id: 'emergency-gym-2',
          name: 'Gimnasio de Emergencia 2',
          position: [41.3851, 2.1734], // Barcelona
          type: 'gym'
        },
        {
          id: 'emergency-pokestop-1',
          name: 'Pokéstop de emergencia 1',
          position: [40.4154, -3.7071],
          type: 'pokestop'
        },
        {
          id: 'emergency-pokestop-2',
          name: 'Pokéstop de emergencia 2',
          position: [41.4036, 2.1744],
          type: 'pokestop'
        }
      ];
      
      setPokeStops(emergencyLocations);
      console.log("Usando ubicaciones de emergencia debido a un error grave");
    }
  };

  const handleZoomEnd = (newZoom: number) => {
    setZoom(newZoom);
  };

  const attemptCapture = async (pokemon: Pokemon) => {
    // Probabilidad del 70% de capturar el Pokémon
    const captureSuccess = Math.random() < 0.7;
    
    if (captureSuccess) {
      // Añadir a la colección de capturados
      setCapturedPokemons([...capturedPokemons, pokemon]);
      // Mostrar mensaje de éxito
      alert(`¡Has capturado a ${pokemon.name}!`);
    } else {
      // Mostrar mensaje de fallo
      alert(`¡${pokemon.name} se ha escapado!`);
    }
    
    // Eliminar del mapa en ambos casos (capturado o escapado)
    setPokemons(pokemons.filter(p => p.id !== pokemon.id));
    
    // Cerrar ventana de información
    setSelectedPokemon(null);
    
    // Generar un nuevo Pokémon para reemplazar el que se fue
    await generateNewPokemon();
  };

  // Función para generar un solo Pokémon nuevo
  const generateNewPokemon = async () => {
    // Definimos los límites de España
    const spainBounds = {
      north: 43.8,
      south: 36.0,
      east: 3.3,
      west: -9.3
    };

    const randomId = Math.floor(Math.random() * 151) + 1;
    try {
      const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${randomId}`);
      
      // Posición aleatoria dentro de España
      const randomLat = spainBounds.south + (Math.random() * (spainBounds.north - spainBounds.south));
      const randomLon = spainBounds.west + (Math.random() * (spainBounds.east - spainBounds.west));
      
      // Extraer toda la información relevante
      const newPokemon: Pokemon = {
        id: Date.now(), // Usar timestamp para garantizar un ID único
        name: response.data.name,
        position: [randomLat, randomLon],
        sprite: response.data.sprites.front_default,
        types: response.data.types.map((t: any) => t.type.name),
        height: response.data.height,
        weight: response.data.weight
      };
      
      // Añadir el nuevo Pokémon a la lista existente
      setPokemons(currentPokemons => [...currentPokemons, newPokemon]);
    } catch (error) {
      console.error('Error al obtener nuevo Pokémon:', error);
    }
  };

  useEffect(() => {
    const savedPokemon = localStorage.getItem('capturedPokemons');
    if (savedPokemon) {
      setCapturedPokemons(JSON.parse(savedPokemon));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('capturedPokemons', JSON.stringify(capturedPokemons));
  }, [capturedPokemons]);

  useEffect(() => {
    // Verificar si hay pokeparadas, y si no, crearlas
    if (pokeStops.length === 0) {
      console.log("No se encontraron pokeparadas, generando globales...");
      findNearbyPlaces(position[0], position[1]);
    }
  }, [pokeStops, position]);

  // Añade una función para recargar manualmente
  const reloadPokestopsAndGyms = () => {
    console.log("Recargando pokeparadas y gimnasios...");
    findNearbyPlaces(position[0], position[1]);
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
        <p>Poképaradas: {pokeStops.filter(s => s.type === 'pokestop').length}</p>
        <p>Gimnasios: {pokeStops.filter(s => s.type === 'gym').length}</p>
        
        <button 
          onClick={reloadPokestopsAndGyms}
          className="reload-button"
        >
          Recargar pokeparadas y gimnasios
        </button>
      </div>

      <div className="capture-counter">
        <span>Pokémon capturados: {capturedPokemons.length}</span>
        <button 
          onClick={() => setShowCollection(!showCollection)}
          style={{
            backgroundColor: '#ff9800',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginLeft: '10px'
          }}
        >
          {showCollection ? 'Ocultar colección' : 'Ver colección'}
        </button>
      </div>

      {/* Panel de colección de Pokémon */}
      {showCollection && (
        <div className="captured-collection">
          <h3>Mi colección de Pokémon</h3>
          <div className="pokemon-grid">
            {capturedPokemons.length > 0 ? (
              capturedPokemons.map(pokemon => (
                <div key={pokemon.id} className="captured-pokemon-card">
                  <img src={pokemon.sprite} alt={pokemon.name} style={{ width: '80px' }} />
                  <p>{pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1)}</p>
                </div>
              ))
            ) : (
              <p>No has capturado ningún Pokémon todavía</p>
            )}
          </div>
        </div>
      )}

      {/* Mostrar información del Pokémon seleccionado */}
      {selectedPokemon && (
        <PokemonInfo 
          pokemon={selectedPokemon} 
          onClose={() => {
            console.log("Cerrando PokemonInfo");
            setSelectedPokemon(null);
          }}
          onCapture={() => attemptCapture(selectedPokemon)}
        />
      )}
    </div>
  );
};

export default PokemonMap; 