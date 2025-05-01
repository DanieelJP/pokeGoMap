import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import './PokemonMap.css';
import './common.css';
import PokemonInfo from './PokemonInfo';
import PokeStop from './PokeStop';
import Gym from './Gym';
import { Pokemon, PokeStop as PokeStopType } from './types';
import { saveToLocalStorage, getFromLocalStorage } from '../utils/storage';

// Arreglar el problema de los iconos de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
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

const PokemonMap: React.FC = () => {
  const [position, setPosition] = useState<[number, number]>([41.3851, 2.1734]); // Barcelona por defecto
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [pokeStops, setPokeStops] = useState<PokeStopType[]>([]);
  const [zoom, setZoom] = useState<number>(13);
  const [currentLocationName, setCurrentLocationName] = useState<string>('');
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(null);
  const [capturedPokemons, setCapturedPokemons] = useState<Pokemon[]>([]);
  const [showCollection, setShowCollection] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [inventory, setInventory] = useState<{[key: string]: number}>({
    'Poké Ball': 0,
    'Super Ball': 0,
    'Ultra Ball': 0,
    'Poción': 0,
    'Super Poción': 0,
    'Revivir': 0
  });
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerXp, setPlayerXp] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);

  useEffect(() => {
    // Obtener la ubicación del usuario
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLon = pos.coords.longitude;
          setPosition([userLat, userLon]);
          generateRandomPokemons(userLat, userLon);
          findNearbyPlaces();
          getLocationName(userLat, userLon);
        },
        () => {
          console.log('Error al obtener la ubicación');
          generateRandomPokemons(position[0], position[1]);
          findNearbyPlaces();
          getLocationName(position[0], position[1]);
        }
      );
    } else {
      console.log('Geolocalización no soportada por este navegador');
      generateRandomPokemons(position[0], position[1]);
      findNearbyPlaces();
      getLocationName(position[0], position[1]);
    }
  }, []);

  // Cargar datos guardados
  useEffect(() => {
    // Cargar pokémon capturados
    const savedPokemon = getFromLocalStorage('capturedPokemons', []);
    if (savedPokemon) {
      setCapturedPokemons(savedPokemon);
    }
    
    // Cargar datos del jugador
    const savedPlayerData = getFromLocalStorage('playerData', { level: 1, xp: 0, badges: [] });
    if (savedPlayerData) {
      setPlayerLevel(savedPlayerData.level || 1);
      setPlayerXp(savedPlayerData.xp || 0);
      setBadges(savedPlayerData.badges || []);
    }
    
    // Inicializar inventario
    setInventory({
      'Poké Ball': 0,
      'Super Ball': 0,
      'Ultra Ball': 0,
      'Poción': 0,
      'Super Poción': 0,
      'Revivir': 0
    });
  }, []);

  // Guardar datos cuando cambien
  useEffect(() => {
    saveToLocalStorage('capturedPokemons', capturedPokemons);
  }, [capturedPokemons]);

  useEffect(() => {
    saveToLocalStorage('playerData', {
      level: playerLevel,
      xp: playerXp,
      badges: badges
    });
  }, [playerLevel, playerXp, badges]);

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

  const findNearbyPlaces = async () => {
    // Definir interfaz para los items de WikiData al inicio de la función
    interface WikiDataItem {
      id: string;
      name: string;
      position: [number, number];
    }

    try {
      console.log("Consultando WikiData para obtener monumentos en España...");
      
      // Consulta SPARQL específica para monumentos en España
      const sparqlQuery = `
        SELECT ?item ?itemLabel ?coord WHERE {
          ?item wdt:P31 wd:Q570116;  # Instancia de "monumento emblemático"
                wdt:P17 wd:Q29;      # En España (wdt:P17 es "país", wd:Q29 es "España")
                wdt:P625 ?coord.
          SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
        }
        LIMIT 10
      `;
      
      // URL-encode la consulta
      const encodedQuery = encodeURIComponent(sparqlQuery);
      
      // Endpoint de WikiData para consultas SPARQL
      const url = `https://query.wikidata.org/sparql?query=${encodedQuery}&format=json`;
      
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'PokeGoMap/1.0 (educational project)'
        },
        timeout: 8000
      });
      
      if (response.data && 
          response.data.results && 
          response.data.results.bindings && 
          response.data.results.bindings.length > 0) {
        
        console.log(`WikiData devolvió ${response.data.results.bindings.length} monumentos`);
        
        // Procesar los resultados
        const monuments = response.data.results.bindings.map((item: any) => {
          // Extraer coordenadas del formato 'Point(lon lat)'
          const coordValue = item.coord.value;
          const match = coordValue.match(/Point\(([^ ]+) ([^ ]+)\)/);
          
          if (match) {
            const lon = parseFloat(match[1]);
            const lat = parseFloat(match[2]);
            
            return {
              id: item.item.value.split('/').pop(),
              name: item.itemLabel.value,
              position: [lat, lon] as [number, number]
            };
          }
          return null;
        }).filter((item: WikiDataItem | null) => item !== null) as WikiDataItem[];
        
        // Si tenemos al menos 6 monumentos
        if (monuments.length >= 6) {
          // Mezclar para obtener diferentes cada vez
          const shuffled = [...monuments].sort(() => 0.5 - Math.random());
          
          // Limitar a 6 monumentos en lugar de 4
          const selectedMonuments = shuffled.slice(0, 6);
          
          // Dividir: los primeros 3 son pokeparadas, los otros 3 son gimnasios
          const processedLocations = [
            ...selectedMonuments.slice(0, 3).map(monument => ({
              ...monument,
              type: 'pokestop' as const
            })),
            ...selectedMonuments.slice(3, 6).map(monument => ({
              ...monument,
              type: 'gym' as const
            }))
          ];
          
          console.log(`Generados 3 pokestops y 3 gimnasios de WikiData`);
          
          setPokeStops(processedLocations);
          return;
        }
      }
      
      // Si no hay suficientes resultados, probar con otra consulta
      // Esta consulta alternativa busca lugares destacados en España
      const altSparqlQuery = `
        SELECT ?item ?itemLabel ?coord WHERE {
          ?item wdt:P31/wdt:P279* wd:Q839954;  # Instancia o subclase de "estructura arquitectónica"
                wdt:P17 wd:Q29;                # En España
                wdt:P625 ?coord.
          SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
        }
        LIMIT 10
      `;
      
      const altEncodedQuery = encodeURIComponent(altSparqlQuery);
      const altUrl = `https://query.wikidata.org/sparql?query=${altEncodedQuery}&format=json`;
      
      const altResponse = await axios.get(altUrl, {
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': 'PokeGoMap/1.0 (educational project)'
        },
        timeout: 8000
      });
      
      if (altResponse.data && 
          altResponse.data.results && 
          altResponse.data.results.bindings && 
          altResponse.data.results.bindings.length > 0) {
        
        console.log(`Consulta alternativa devolvió ${altResponse.data.results.bindings.length} lugares`);
        
        // Procesar los resultados igual que antes
        const places = altResponse.data.results.bindings.map((item: any) => {
          const coordValue = item.coord.value;
          const match = coordValue.match(/Point\(([^ ]+) ([^ ]+)\)/);
          
          if (match) {
            const lon = parseFloat(match[1]);
            const lat = parseFloat(match[2]);
            
            return {
              id: item.item.value.split('/').pop(),
              name: item.itemLabel.value,
              position: [lat, lon] as [number, number]
            };
          }
          return null;
        }).filter((item: WikiDataItem | null) => item !== null) as WikiDataItem[];
        
        if (places.length >= 6) {
          const shuffled = [...places].sort(() => 0.5 - Math.random());
          const selectedPlaces = shuffled.slice(0, 6);
          
          const processedLocations = [
            ...selectedPlaces.slice(0, 3).map(place => ({
              ...place,
              type: 'pokestop' as const
            })),
            ...selectedPlaces.slice(3, 6).map(place => ({
              ...place,
              type: 'gym' as const
            }))
          ];
          
          console.log(`Generados 3 pokestops y 3 gimnasios de la consulta alternativa`);
          
          setPokeStops(processedLocations);
          return;
        }
      }
      
      throw new Error("No se pudieron obtener suficientes lugares de WikiData");
      
    } catch (error) {
      console.error("Error al consultar WikiData:", error);
      
      // En caso de error, intentar una última consulta muy simple
      try {
        const simpleQuery = `
          SELECT ?item ?itemLabel ?coord WHERE {
            ?item wdt:P17 wd:Q29;      # En España
                  wdt:P625 ?coord.
            SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". }
          }
          LIMIT 8
        `;
        
        const simpleEncodedQuery = encodeURIComponent(simpleQuery);
        const simpleUrl = `https://query.wikidata.org/sparql?query=${simpleEncodedQuery}&format=json`;
        
        const simpleResponse = await axios.get(simpleUrl, {
          headers: {
            'Accept': 'application/sparql-results+json',
            'User-Agent': 'PokeGoMap/1.0 (educational project)'
          },
          timeout: 5000
        });
        
        interface BasicPlace {
          id: string;
          name: string;
          position: [number, number];
        }
        
        if (simpleResponse.data?.results?.bindings?.length > 0) {
          const basicPlaces = simpleResponse.data.results.bindings
            .map((item: any) => {
              const coordValue = item.coord.value;
              const match = coordValue.match(/Point\(([^ ]+) ([^ ]+)\)/);
              
              if (match) {
                return {
                  id: item.item.value.split('/').pop(),
                  name: item.itemLabel.value,
                  position: [parseFloat(match[2]), parseFloat(match[1])] as [number, number]
                };
              }
              return null;
            })
            .filter((item: BasicPlace | null) => item !== null)
            .slice(0, 6) as BasicPlace[];
          
          if (basicPlaces.length >= 6) {
            const finalLocations = [
              ...basicPlaces.slice(0, 3).map(place => ({
                ...place,
                type: 'pokestop' as const
              })),
              ...basicPlaces.slice(3, 6).map(place => ({
                ...place,
                type: 'gym' as const
              }))
            ];
            
            setPokeStops(finalLocations);
            return;
          }
        }
      } catch (fallbackError) {
        console.error("Error en consulta de emergencia:", fallbackError);
      }
      
      setPokeStops([]);
      console.log("No se pudieron obtener lugares de WikiData. El mapa funcionará sin pokeparadas ni gimnasios.");
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
    // Verificar si hay pokeparadas, y si no, crearlas
    if (pokeStops.length === 0) {
      console.log("No se encontraron pokeparadas, generando globales...");
      findNearbyPlaces();
    }
  }, [pokeStops, position]);

  // Añade una función para recargar manualmente
  const reloadPokestopsAndGyms = () => {
    console.log("Recargando pokeparadas y gimnasios...");
    
    // Limpiar datos de gimnasios antes de recargar
    pokeStops.forEach(stop => {
      if (stop.type === 'gym') {
        localStorage.removeItem(`gym_${stop.id}`);
      }
    });
    
    // También podemos reiniciar las medallas si queremos
    // setBadges([]);
    
    findNearbyPlaces();
  };

  const handleItemsReceived = (items: string[]) => {
    const newInventory = {...inventory};
    items.forEach(item => {
      if (newInventory[item]) {
        newInventory[item] += 1;
      } else {
        newInventory[item] = 1;
      }
    });
    setInventory(newInventory);
    
    // Guardar en localStorage
    localStorage.setItem('inventory', JSON.stringify(newInventory));
    
    // Mostrar mensaje
    alert(`¡Has recibido ${items.length} objetos!\n${items.join(', ')}`);
  };

  useEffect(() => {
    // Reiniciar inventario a cero al iniciar la aplicación
    setInventory({
      'Poké Ball': 0,
      'Super Ball': 0,
      'Ultra Ball': 0,
      'Poción': 0,
      'Super Poción': 0,
      'Revivir': 0
    });
    
    // Opcional: Limpiar el localStorage
    localStorage.removeItem('inventory');
  }, []);

  const toggleCollection = () => {
    setShowCollection(true);
    setShowInventory(false); // Cerrar inventario si está abierto
  };

  const toggleInventory = () => {
    setShowInventory(true);
    setShowCollection(false); // Cerrar colección si está abierta
  };

  const handleGymBattleWon = (badge: string, xp: number) => {
    if (!badges.includes(badge)) {
      setBadges([...badges, badge]);
    }
    
    // Añadir XP y subir nivel si es necesario
    const newXp = playerXp + xp;
    setPlayerXp(newXp);
    
    // Aumentar nivel cada 1000 XP
    const newLevel = Math.floor(newXp / 1000) + 1;
    if (newLevel > playerLevel) {
      setPlayerLevel(newLevel);
      alert(`¡Has subido al nivel ${newLevel}!`);
    }
  };

  // Añadir una función para reiniciar el progreso
  const resetGymProgress = () => {
    // Limpiar todos los datos de gimnasios
    pokeStops.forEach(stop => {
      if (stop.type === 'gym') {
        localStorage.removeItem(`gym_${stop.id}`);
      }
    });
    
    // Reiniciar medallas
    setBadges([]);
    
    // Guardar en localStorage
    localStorage.setItem('playerData', JSON.stringify({
      level: playerLevel,
      xp: playerXp,
      badges: []
    }));
    
    alert("Progreso de gimnasios reiniciado");
  };

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
      <div className="app-title">
        <h1>PokeGoMap</h1>
      </div>
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
        {pokeStops.map((stop) => 
          stop.type === 'pokestop' ? (
            <PokeStop
              key={stop.id}
              id={stop.id}
              name={stop.name}
              position={stop.position}
              type={stop.type}
              onItemsReceived={handleItemsReceived}
            />
          ) : (
            <Gym
              key={stop.id}
              id={stop.id}
              name={stop.name}
              position={stop.position}
              onBattleWon={handleGymBattleWon}
              capturedPokemons={capturedPokemons}
            />
          )
        )}
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

      <div className="top-controls">
        <div className="tabs-container">
          <button 
            onClick={toggleCollection}
            className={`tab-button ${showCollection ? 'active-tab' : ''}`}
          >
            Colección ({capturedPokemons.length})
          </button>
          <button 
            onClick={toggleInventory}
            className={`tab-button ${showInventory ? 'active-tab' : ''}`}
          >
            Inventario
          </button>
        </div>
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

      {showInventory && (
        <div className="inventory-panel">
          <h3>Mi Inventario</h3>
          <div className="inventory-items">
            {Object.entries(inventory).map(([item, quantity]) => (
              <div key={item} className="inventory-item">
                <span className="item-name">{item}:</span>
                <span className="item-quantity">{quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="player-info-panel">
        <div className="player-level">
          <span className="level-number">{playerLevel}</span>
          <div className="xp-bar">
            <div 
              className="xp-fill"
              style={{ width: `${(playerXp % 1000) / 10}%` }}
            ></div>
          </div>
          <span className="xp-text">{playerXp % 1000}/1000 XP</span>
        </div>
        <div className="player-badges">
          {badges.length > 0 ? (
            <div className="badges-container">
              {badges.map((badge, index) => (
                <div key={index} className="badge-item" title={badge}>
                  <span className="badge-icon">🏅</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-badges">Sin medallas</p>
          )}
        </div>
        <button 
          onClick={resetGymProgress} 
          className="reset-gym-button"
        >
          Reiniciar Gimnasios
        </button>
      </div>
    </div>
  );
};

export default PokemonMap; 