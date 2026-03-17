import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker, Line } from 'react-simple-maps';
import { feature } from 'topojson-client';
import { geoCentroid, geoDistance } from 'd3-geo';
import { Shield, Swords, Coins, Users, Play, Pause, FastForward, TrendingUp, XCircle, ArrowRight, Crosshair, Trophy, Globe, Menu, Settings, Info } from 'lucide-react';

const NUTS_URL = "https://raw.githubusercontent.com/eurostat/Nuts2json/master/pub/v2/2021/4326/60M/nutsrg_2.json";
const HIGHCHARTS_URLS = [
  "https://code.highcharts.com/mapdata/countries/ru/ru-all.topo.json",
  "https://code.highcharts.com/mapdata/countries/ua/ua-all.topo.json",
  "https://code.highcharts.com/mapdata/countries/by/by-all.topo.json",
  "https://code.highcharts.com/mapdata/countries/md/md-all.topo.json",
  "https://code.highcharts.com/mapdata/countries/ba/ba-all.topo.json",
  "https://code.highcharts.com/mapdata/countries/ge/ge-all.topo.json",
  "https://code.highcharts.com/mapdata/countries/am/am-all.topo.json",
  "https://code.highcharts.com/mapdata/countries/az/az-all.topo.json"
];

const NUTS_COUNTRY_MAP: Record<string, string> = {
  'PT': 'Portugal', 'ES': 'Spain', 'FR': 'France', 'IT': 'Italy', 'CH': 'Switzerland',
  'UK': 'United Kingdom', 'LI': 'Liechtenstein', 'AT': 'Austria', 'DE': 'Germany',
  'LU': 'Luxembourg', 'BE': 'Belgium', 'NL': 'Netherlands', 'CY': 'Cyprus',
  'EL': 'Greece', 'TR': 'Turkey', 'AL': 'Albania', 'MT': 'Malta', 'BG': 'Bulgaria',
  'MK': 'North Macedonia', 'ME': 'Montenegro', 'RS': 'Serbia', 'HR': 'Croatia',
  'RO': 'Romania', 'SI': 'Slovenia', 'HU': 'Hungary', 'CZ': 'Czechia',
  'IE': 'Ireland', 'DK': 'Denmark', 'NO': 'Norway', 'IS': 'Iceland',
  'SK': 'Slovakia', 'PL': 'Poland', 'LT': 'Lithuania', 'LV': 'Latvia',
  'SE': 'Sweden', 'EE': 'Estonia', 'FI': 'Finland'
};

type Owner = string;

type UnitType = 'infantry' | 'cavalry' | 'artillery';

type CountryData = {
  id: string;
  name: string;
  owner: Owner;
  units: Record<UnitType, number>;
  economy: number;
  resources: { iron: number, food: number };
  visible: boolean;
  terrain: 'plains' | 'mountains' | 'forest';
  religion: 'Catholic' | 'Protestant' | 'Orthodox' | 'Sunni';
  government: 'Monarchy' | 'Republic' | 'Theocracy';
  ruler: { name: string, portrait: string };
  population: string;
  populationNum: number;
  prestige: number;
  stability: number;
  battle?: {
    attacker: Owner;
    units: Record<UnitType, number>;
  };
};

const UNIT_STATS: Record<UnitType, { cost: number, attack: number, defense: number, speed: number }> = {
  infantry: { cost: 10, attack: 1, defense: 2, speed: 1 },
  cavalry: { cost: 25, attack: 3, defense: 1, speed: 3 },
  artillery: { cost: 50, attack: 5, defense: 1, speed: 0.5 },
};

const OWNER_COLORS: Record<string, string> = {
  'France': '#4a5d23',
  'Germany': '#5d4037',
  'United Kingdom': '#8b0000',
  'Italy': '#2e4a31',
  'Spain': '#a0522d',
  'Russia': '#2c3e50',
  'Poland': '#b22222',
  'Turkey': '#4b0082',
  'Ukraine': '#daa520',
  'Sweden': '#4682b4',
  'Neutral': '#555555'
};

const INITIAL_OWNERS: Record<string, string> = {
  'France': 'France',
  'Germany': 'Germany',
  'United Kingdom': 'United Kingdom',
  'Italy': 'Italy',
  'Spain': 'Spain',
  'Russia': 'Russia',
  'Poland': 'Poland',
  'Turkey': 'Turkey',
  'Ukraine': 'Ukraine',
  'Sweden': 'Sweden',
};

const NATION_FLAGS: Record<string, string> = {
  'France': '🇫🇷',
  'Germany': '🇩🇪',
  'United Kingdom': '🇬🇧',
  'Italy': '🇮🇹',
  'Spain': '🇪🇸',
  'Russia': '🇷🇺',
  'Poland': '🇵🇱',
  'Turkey': '🇹🇷',
  'Ukraine': '🇺🇦',
  'Sweden': '🇸🇪',
};

const MemoizedCountry = React.memo(({ geo, country, isSelected, isHighlighted, onClick, graphicsQuality }: any) => {
  if (!country) return null;
  const baseColor = OWNER_COLORS[country.owner as Owner];
  const fill = isHighlighted ? '#ffd700' : baseColor;
  const strokeWidth = graphicsQuality === 'low' ? 0 : 0.2;
  return (
    <Geography
      geography={geo}
      onClick={() => onClick(geo)}
      className={isSelected ? "gold-outline" : ""}
      style={{
        default: { fill, outline: 'none', stroke: '#1a1a1a', strokeWidth },
        hover: { fill: '#ffd700', outline: 'none', stroke: '#ffd700', strokeWidth: 0.8, cursor: 'pointer' },
        pressed: { fill: '#b8860b', outline: 'none' }
      }}
    />
  );
}, (prev, next) => {
  return prev.isSelected === next.isSelected && 
         prev.isHighlighted === next.isHighlighted &&
         prev.country.owner === next.country.owner &&
         prev.graphicsQuality === next.graphicsQuality;
});

const MemoizedArmyMarker = React.memo(({ id, coords, country, color, isWar, isPlayer, graphicsQuality }: any) => {
  if (!country) return null;
  if (graphicsQuality === 'low' && !country.battle) return null;
  const totalUnits = country.units.infantry + country.units.cavalry + country.units.artillery;
  
  if (totalUnits === 0 && !country.battle) return null;
  if (country.owner === 'Neutral' && totalUnits < 50 && !country.battle) return null;
  if (!isPlayer && !isWar && totalUnits < 20 && !country.battle) return null;

  return (
    <Marker coordinates={coords}>
      {country.battle ? (
        <g transform="translate(-8, -8)">
          <circle r="8" fill="#ef4444" className="animate-pulse" />
          <text y="3" textAnchor="middle" fill="white" fontSize="10px" fontWeight="bold">⚔️</text>
        </g>
      ) : (
        <g transform="translate(-8, -12)" className="flag-marker">
          <line y2="12" stroke="#3d2b1f" strokeWidth="1" />
          <rect width="14" height="8" fill={color} stroke="#fff" strokeWidth="0.5" />
          <text x="7" y="6.5" textAnchor="middle" fill="white" fontSize="6px" fontWeight="bold" style={{ pointerEvents: 'none' }}>
            {totalUnits > 999 ? `${(totalUnits / 1000).toFixed(1)}K` : totalUnits}
          </text>
        </g>
      )}
    </Marker>
  );
}, (prev, next) => {
  const prevTotal = prev.country.units.infantry + prev.country.units.cavalry + prev.country.units.artillery;
  const nextTotal = next.country.units.infantry + next.country.units.cavalry + next.country.units.artillery;
  return prevTotal === nextTotal && 
         prev.country.owner === next.country.owner && 
         !!prev.country.battle === !!next.country.battle &&
         prev.isWar === next.isWar &&
         prev.isPlayer === next.isPlayer &&
         prev.graphicsQuality === next.graphicsQuality;
});

const MemoizedRegionLabel = React.memo(({ id, coords, name, units, quality }: any) => {
  if (quality === 'low' || units < 50) return null;
  return (
    <Marker coordinates={coords}>
      <text
        textAnchor="middle"
        fill="#3d2b1f"
        fillOpacity="0.05"
        fontSize="20px"
        fontFamily="serif"
        fontWeight="bold"
        style={{ pointerEvents: 'none', textTransform: 'uppercase', letterSpacing: '4px' }}
        transform="rotate(-15)"
      >
        {name.split(' (')[0]}
      </text>
    </Marker>
  );
}, (prev, next) => prev.units === next.units && prev.quality === next.quality);

export default function App() {
  const [countries, setCountries] = useState<Record<string, { id: string, name: string, owner: Owner, battle?: any, units: { infantry: number, cavalry: number, artillery: number } }>>({});
  const gameDataRef = useRef<Record<string, CountryData>>({});
  const [centroids, setCentroids] = useState<Record<string, [number, number]>>({});
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
  const [selectedCountryData, setSelectedCountryData] = useState<CountryData | null>(null);
  const [sourceCountryId, setSourceCountryId] = useState<string | null>(null);
  const [day, setDay] = useState(1);
  const dayRef = useRef(1);
  const [relations, setRelations] = useState<Record<string, Record<string, number>>>({});
  const relationsRef = useRef<Record<string, Record<string, number>>>({});
  const [warCooldowns, setWarCooldowns] = useState<Record<string, number>>({});
  const warCooldownsRef = useRef<Record<string, number>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 5>(1);
  const [playerGold, setPlayerGold] = useState(100);
  const [logs, setLogs] = useState<string[]>(['Welcome to Imperial Command. Select a nation to begin your campaign.']);
  const [geographies, setGeographies] = useState<any[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [view, setView] = useState<'menu' | 'game' | 'settings' | 'whatsnew' | 'selection'>('menu');
  const [playerNation, setPlayerNation] = useState<string | null>(null);
  const [hoveredNation, setHoveredNation] = useState<string | null>(null);
  const [showAnimations, setShowAnimations] = useState(true);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [deviceType, setDeviceType] = useState<'mobile' | 'pc'>('pc');
  const [graphicsQuality, setGraphicsQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('medium');
  const [fpsLock, setFpsLock] = useState<30 | 60 | 90 | 120 | 144>(60);
  const [currentFps, setCurrentFps] = useState(0);
  const [attacks, setAttacks] = useState<{ id: string, source: [number, number], target: [number, number], color: string }[]>([]);
  const attacksRef = useRef<{ id: string, source: [number, number], target: [number, number], color: string }[]>([]);

  useEffect(() => {
    attacksRef.current = attacks;
  }, [attacks]);
  const [wars, setWars] = useState<string[]>([]);
  const warsRef = useRef<string[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const addLog = useCallback((msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 8));
  }, []);

  const lastTickTime = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);
  const frameCount = useRef<number>(0);
  const fpsUpdateTimer = useRef<number>(0);

  useEffect(() => {
    if (selectedCountryId) {
      setSelectedCountryData(gameDataRef.current[selectedCountryId] || null);
    } else {
      setSelectedCountryData(null);
    }
  }, [selectedCountryId]);

  useEffect(() => {
    if (!isPlaying) return;

    let requestRef: number;
    
    const tick = (time: number) => {
      if (!lastFrameTime.current) lastFrameTime.current = time;
      if (!lastTickTime.current) lastTickTime.current = time;

      const deltaTime = time - lastFrameTime.current;
      
      // FPS Calculation
      frameCount.current++;
      fpsUpdateTimer.current += deltaTime;
      if (fpsUpdateTimer.current >= 1000) {
        setCurrentFps(frameCount.current);
        frameCount.current = 0;
        fpsUpdateTimer.current = 0;
      }

      // FPS Lock logic
      const targetFrameTime = fpsLock > 0 ? 1000 / fpsLock : 0;
      if (deltaTime < targetFrameTime) {
        requestRef = requestAnimationFrame(tick);
        return;
      }
      lastFrameTime.current = time;

      // Game Logic Tick (1 second / speed)
      const tickInterval = 1000 / speed;
      if (time - lastTickTime.current >= tickInterval) {
        lastTickTime.current = time;
        
        const nextGameData = { ...gameDataRef.current };
        const nextLogs: string[] = [];
        const nextAttacks: any[] = [];
        let totalIncome = 0;
        let visualChanged = false;
        const countryIds = Object.keys(nextGameData);

        // 1. Economy & Population Update
        countryIds.forEach(id => {
          const c = nextGameData[id];
          
          // Population Growth (0.05% per day)
          const newPopNum = c.populationNum * 1.0005;
          nextGameData[id] = {
            ...c,
            populationNum: newPopNum,
            population: newPopNum > 1000000 
              ? `${(newPopNum / 1000000).toFixed(2)}M` 
              : `${(newPopNum / 1000).toFixed(0)}K`
          };

          if (c.owner === playerNation) {
            totalIncome += c.economy * 2;
          }
        });

        // 2. AI Logic
        const activeWars = countryIds.filter(id => nextGameData[id].battle).length;
        const currentDay = dayRef.current;

        countryIds.forEach(id => {
          const c = nextGameData[id];
          if (c.owner !== playerNation && c.owner !== 'Neutral' && !c.battle) {
            const neighbors = countryIds.filter(nid => 
              nid !== id && geoDistance(centroids[id], centroids[nid]) < 0.08
            );
            
            const totalUnits = c.units.infantry + c.units.cavalry + c.units.artillery;

            // Probability Lock: Check every 500 ticks
            // Aggression Cap: Max 3 wars
            // Global War Cooldown: Check if nation is on cooldown
            if (currentDay > 0 && currentDay % 500 === 0 && activeWars < 3 && (warCooldownsRef.current[c.owner] || 0) <= currentDay) {
              
              // 5% chance it actually happens
              if (Math.random() < 0.05) {
                const targetId = neighbors
                  .filter(nid => {
                    const target = nextGameData[nid];
                    // Diplomatic Relations: AI will NEVER attack someone they have positive relations with
                    const rel = (relationsRef.current[c.owner] && relationsRef.current[c.owner][target.owner]) || 0;
                    return target.owner !== c.owner && rel <= 0;
                  })
                  .sort((a, b) => {
                    const powerA = nextGameData[a].units.infantry + nextGameData[a].units.cavalry + nextGameData[a].units.artillery;
                    const powerB = nextGameData[b].units.infantry + nextGameData[b].units.cavalry + nextGameData[b].units.artillery;
                    return powerA - powerB;
                  })[0];

                if (targetId) {
                  const targetPower = nextGameData[targetId].units.infantry + nextGameData[targetId].units.cavalry + nextGameData[targetId].units.artillery;
                  
                  // Army Requirement: AI can only declare war if it has at least 3 times more army than its neighbor
                  if (totalUnits >= targetPower * 3) {
                    const attackingUnits = { ...c.units };
                    nextGameData[id] = { ...nextGameData[id], units: { infantry: 1, cavalry: 0, artillery: 0 } };
                    nextGameData[targetId] = {
                      ...nextGameData[targetId],
                      battle: { attacker: c.owner, units: attackingUnits }
                    };
                    visualChanged = true;
                    
                    if (showAnimations && graphicsQuality !== 'low') {
                      nextAttacks.push({
                        id: Math.random().toString(),
                        source: centroids[id],
                        target: centroids[targetId],
                        color: OWNER_COLORS[c.owner]
                      });
                    }
                  }
                }
              }
            }
            else if (Math.random() < 0.08) {
              if (totalUnits > 15) {
                const weakOwnedNeighbor = neighbors.find(nid => 
                  nextGameData[nid].owner === c.owner && 
                  (nextGameData[nid].units.infantry + nextGameData[nid].units.cavalry + nextGameData[nid].units.artillery) < totalUnits / 3
                );

                if (weakOwnedNeighbor) {
                  const moveAmount = Math.floor(c.units.infantry * 0.4);
                  if (moveAmount > 0) {
                    nextGameData[id] = {
                      ...nextGameData[id],
                      units: { ...c.units, infantry: c.units.infantry - moveAmount }
                    };
                    nextGameData[weakOwnedNeighbor] = {
                      ...nextGameData[weakOwnedNeighbor],
                      units: { 
                        ...nextGameData[weakOwnedNeighbor].units, 
                        infantry: nextGameData[weakOwnedNeighbor].units.infantry + moveAmount 
                      }
                    };
                    visualChanged = true;
                  }
                }
              }
            }
          }
        });

        // 3. Battle Resolution
        countryIds.forEach(id => {
          const c = nextGameData[id];
          if (c.battle) {
            const attacker = c.battle;
            const aPower = attacker.units.infantry * 1 + attacker.units.cavalry * 3 + attacker.units.artillery * 5;
            const dPower = (c.units.infantry * 2 + c.units.cavalry * 1 + c.units.artillery * 1) * (c.terrain === 'mountains' ? 1.5 : 1);
            
            const aLoss = Math.max(1, Math.floor(dPower * 0.12 * Math.random()));
            const dLoss = Math.max(1, Math.floor(aPower * 0.12 * Math.random()));

            const newDUnits = { ...c.units, infantry: Math.max(0, c.units.infantry - dLoss) };
            const newAUnits = { ...attacker.units, infantry: Math.max(0, attacker.units.infantry - aLoss) };

            const totalA = newAUnits.infantry + newAUnits.cavalry + newAUnits.artillery;
            const totalD = newDUnits.infantry + newDUnits.cavalry + newDUnits.artillery;

            visualChanged = true;

            if (totalD <= 0) {
              nextGameData[id] = {
                ...c,
                owner: attacker.attacker,
                units: newAUnits,
                battle: undefined
              };
              if (nextGameData[id].owner === playerNation) nextLogs.push(`Captured ${c.name}!`);
              warCooldownsRef.current[attacker.attacker] = currentDay + 300;
              warCooldownsRef.current[c.owner] = currentDay + 300;
            } else if (totalA <= 0) {
              nextGameData[id] = { ...c, units: newDUnits, battle: undefined };
              warCooldownsRef.current[attacker.attacker] = currentDay + 300;
              warCooldownsRef.current[c.owner] = currentDay + 300;
            } else {
              nextGameData[id] = { ...c, units: newDUnits, battle: { ...attacker, units: newAUnits } };
            }
          }
        });

        gameDataRef.current = nextGameData;

        if (visualChanged) {
          setCountries(prev => {
            const next = { ...prev };
            let actuallyChanged = false;
            countryIds.forEach(id => {
              const c = nextGameData[id];
              const p = prev[id];
              
              const hasBattleChanged = !!p?.battle !== !!c.battle || 
                (c.battle && (
                  p.battle.attacker !== c.battle.attacker || 
                  p.battle.units.infantry !== c.battle.units.infantry
                ));

              if (!p || p.owner !== c.owner || hasBattleChanged || 
                  p.units.infantry !== c.units.infantry) {
                next[id] = { 
                  id: c.id, 
                  name: c.name,
                  owner: c.owner, 
                  battle: c.battle,
                  units: c.units
                };
                actuallyChanged = true;
              }
            });
            return actuallyChanged ? next : prev;
          });
        }

        if (nextLogs.length > 0) setLogs(prev => [...nextLogs, ...prev].slice(0, 8));
        if (nextAttacks.length > 0) {
          setAttacks(prev => [...prev, ...nextAttacks]);
          setTimeout(() => setAttacks(prev => prev.filter(a => !nextAttacks.find(na => na.id === a.id))), 800);
        }
        
        setPlayerGold(prev => prev + totalIncome);
        setDay(prev => {
          const next = prev + 1;
          dayRef.current = next;
          return next;
        });
      }

      requestRef = requestAnimationFrame(tick);
    };

    requestRef = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(requestRef);
  }, [isPlaying, speed, centroids, showAnimations, fpsLock, graphicsQuality]);

  useEffect(() => {
    Promise.all([
      fetch(NUTS_URL).then(res => res.json()),
      ...HIGHCHARTS_URLS.map(url => fetch(url).then(res => res.json()))
    ]).then(([nutsData, ...hcDataList]) => {
      let allFeatures: any[] = [];

      // Process NUTS2 GeoJSON
      nutsData.features.forEach((f: any) => {
        const id = f.properties.id;
        // Filter out outermost regions (French Guiana, Canary Islands, Azores, Madeira)
        if (id.startsWith('FRY') || id.startsWith('ES7') || id.startsWith('PT2') || id.startsWith('PT3')) {
          return;
        }
        const countryCode = id.substring(0, 2);
        const countryName = NUTS_COUNTRY_MAP[countryCode] || 'Unknown';
        f.id = id;
        f.properties = {
          ...f.properties,
          name: f.properties.na,
          country: countryName
        };
        allFeatures.push(f);
      });

      // Process Highcharts TopoJSONs
      const moldovaCount = { count: 0 };
      hcDataList.forEach(hcData => {
        const { features } = feature(hcData, hcData.objects.default as any) as any;
        features.forEach((f: any) => {
          f.id = f.properties['hc-key'];
          f.properties = {
            ...f.properties,
            name: f.properties.name || f.properties['hc-key'],
            country: f.properties.country
          };
          
          const countryName = f.properties.country;
          if (countryName === 'Russia') {
            const centroid = geoCentroid(f);
            // Keep more of Russia (longitude < 60)
            if (centroid[0] > 60) return;
          }
          
          if (countryName === 'Moldova') {
            if (moldovaCount.count >= 6) return;
            moldovaCount.count++;
          }
          
          allFeatures.push(f);
        });
      });

      setGeographies(allFeatures);
      
      const initialCountries: Record<string, CountryData> = {};
      const initialCentroids: Record<string, [number, number]> = {};
      const ownerCapitals: Partial<Record<Owner, string>> = {};
      
      allFeatures.forEach((f: any) => {
        const countryName = f.properties.country;
        console.log('Country:', countryName, 'ID:', f.id);
        const owner = INITIAL_OWNERS[countryName] || 'Neutral';
        if (!ownerCapitals[owner]) {
          ownerCapitals[owner] = f.id;
        }
      });

      allFeatures.forEach((f: any) => {
        const countryName = f.properties.country;
        const regionName = f.properties.name;
        
        try {
          initialCentroids[f.id] = geoCentroid(f);
        } catch (e) {
          initialCentroids[f.id] = [0, 0];
        }
        
        const owner = INITIAL_OWNERS[countryName] || 'Neutral';
        const isCapital = ownerCapitals[owner] === f.id && owner !== 'Neutral';
        const popBase = Math.random() * 5 + 0.5;
        
        // Determine terrain based on mountain markers
        const isMountain = [
          [10, 47], [0, 42.5], [25, 47], [60, 60], [43, 42], [15, 65], [13, 42], [22, 43]
        ].some(m => geoDistance(m as [number, number], initialCentroids[f.id]) < 0.1);

        initialCountries[f.id] = {
          id: f.id,
          name: `${regionName} (${countryName})`,
          owner: owner,
          units: {
            infantry: isCapital ? 50 : (owner !== 'Neutral' ? 10 : 5),
            cavalry: isCapital ? 10 : 0,
            artillery: isCapital ? 5 : 0
          },
          economy: (owner !== 'Neutral') ? 2 : 1,
          resources: { iron: 0, food: 100 },
          visible: true,
          terrain: isMountain ? 'mountains' : 'plains',
          religion: countryName === 'Turkey' ? 'Sunni' : countryName === 'Russia' || countryName === 'Ukraine' ? 'Orthodox' : 'Catholic',
          government: 'Monarchy',
          ruler: { 
            name: `${owner} Ruler`, 
            portrait: `https://picsum.photos/seed/${f.id}/200/300` 
          },
          population: `${popBase.toFixed(1)}M`,
          populationNum: popBase * 1000000,
          prestige: Math.floor(Math.random() * 100),
          stability: Math.floor(Math.random() * 100),
        };
      });

      setCentroids(initialCentroids);
      gameDataRef.current = initialCountries;
      setCountries(Object.keys(initialCountries).reduce((acc, id) => {
        acc[id] = { 
          id: initialCountries[id].id, 
          name: initialCountries[id].name,
          owner: initialCountries[id].owner, 
          units: initialCountries[id].units 
        };
        return acc;
      }, {} as any));

      const nations = Object.keys(INITIAL_OWNERS);
      const initialRelations: Record<string, Record<string, number>> = {};
      nations.forEach(n1 => {
        initialRelations[n1] = {};
        nations.forEach(n2 => {
          if (n1 === n2) {
            initialRelations[n1][n2] = 100;
          } else {
            initialRelations[n1][n2] = Math.random() < 0.8 ? 50 : 0;
          }
        });
      });
      setRelations(initialRelations);
      relationsRef.current = initialRelations;
    });
  }, []);

  const selectedCountry = selectedCountryId ? gameDataRef.current[selectedCountryId] : null;
  const sourceCountry = sourceCountryId ? gameDataRef.current[sourceCountryId] : null;

  const projectedIncome = useMemo(() => {
    let total = 0;
    const values = Object.values(gameDataRef.current);
    for (let i = 0; i < values.length; i++) {
      if (values[i].owner === playerNation) total += values[i].economy;
    }
    return total * 2;
  }, [day, playerNation]);

  const totalArmy = useMemo(() => {
    let total = 0;
    const values = Object.values(gameDataRef.current);
    for (let i = 0; i < values.length; i++) {
      if (values[i].owner === playerNation) {
        total += values[i].units.infantry + values[i].units.cavalry + values[i].units.artillery;
      }
    }
    return total;
  }, [day, playerNation]);

  const totalRegions = useMemo(() => {
    let total = 0;
    const values = Object.values(gameDataRef.current);
    for (let i = 0; i < values.length; i++) {
      if (values[i].owner === playerNation) total++;
    }
    return total;
  }, [day, playerNation]);

  const nationStats = useMemo(() => {
    const stats: Record<string, { provinces: number, population: number }> = {};
    Object.keys(OWNER_COLORS).forEach(owner => {
      stats[owner] = { provinces: 0, population: 0 };
    });
    Object.values(gameDataRef.current).forEach(c => {
      if (stats[c.owner]) {
        stats[c.owner].provinces++;
        stats[c.owner].population += c.populationNum;
      }
    });
    return stats;
  }, [countries]);

  const leaderboardData = useMemo(() => {
    const stats: Record<string, { count: number, totalUnits: number, totalEcon: number }> = {};
    Object.keys(OWNER_COLORS).forEach(owner => {
      stats[owner] = { count: 0, totalUnits: 0, totalEcon: 0 };
    });
    
    Object.values(gameDataRef.current).forEach(c => {
      if (stats[c.owner]) {
        stats[c.owner].count++;
        stats[c.owner].totalUnits += c.units.infantry + c.units.cavalry + c.units.artillery;
        stats[c.owner].totalEcon += c.economy;
      }
    });
    
    return Object.entries(stats)
      .filter(([_, data]) => data.count > 0)
      .sort((a, b) => b[1].totalUnits - a[1].totalUnits);
  }, [day]);

  const playerCountries = useMemo(() => {
    return Object.values(gameDataRef.current).filter(c => c.owner === playerNation);
  }, [day, playerNation]);

  const mountainMarkers = useMemo(() => [
    { name: "Alps", coords: [10, 47] },
    { name: "Pyrenees", coords: [0, 42.5] },
    { name: "Carpathians", coords: [25, 47] },
    { name: "Urals", coords: [60, 60] },
    { name: "Caucasus", coords: [43, 42] },
    { name: "Scandinavia", coords: [15, 65] },
    { name: "Apennines", coords: [13, 42] },
    { name: "Balkans", coords: [22, 43] }
  ].map((mtn, i) => (
    <Marker key={`mtn-${i}`} coordinates={mtn.coords as [number, number]}>
      <path d="M0 -6 L4 3 L-4 3 Z" fill="#5d4037" stroke="#3e2723" strokeWidth="0.5" opacity="0.4" />
      <path d="M0 -6 L2 -2 L-2 -2 Z" fill="#fff" opacity="0.6" />
    </Marker>
  )), []);

  const regionLabels = useMemo(() => {
    if (graphicsQuality === 'low') return null;
    return Object.entries(centroids).map(([id, coords]) => (
      <MemoizedRegionLabel 
        key={`label-${id}`}
        id={id}
        coords={coords}
        name={countries[id]?.name || ''}
        units={countries[id]?.units.infantry || 0}
        quality={graphicsQuality}
      />
    ));
  }, [countries, centroids, graphicsQuality]);

  const armyMarkers = useMemo(() => Object.entries(centroids).map(([id, coords]) => {
    const country = countries[id];
    if (!country) return null;
    const isWar = wars.some(w => w.includes(country.owner));
    return (
      <MemoizedArmyMarker 
        key={`marker-${id}`}
        id={id}
        coords={coords}
        country={country}
        color={OWNER_COLORS[country.owner] || OWNER_COLORS['Neutral']}
        isWar={isWar}
        isPlayer={country.owner === playerNation}
        graphicsQuality={graphicsQuality}
      />
    );
  }), [countries, centroids, wars, graphicsQuality, playerNation]);

  const handleCountryClick = (geo: any) => {
    const clickedId = geo.id;
    
    if (view === 'selection') {
      setSelectedCountryId(clickedId);
      return;
    }

    if (sourceCountryId) {
      if (sourceCountryId === clickedId) {
        // Cancel targeting
        setSourceCountryId(null);
        return;
      }
      
      executeAction(sourceCountryId, clickedId);
      setSourceCountryId(null);
    } else {
      setSelectedCountryId(clickedId);
    }
  };

  const executeAction = useCallback((sourceId: string, targetId: string) => {
    const source = gameDataRef.current[sourceId];
    const target = gameDataRef.current[targetId];
    
    const totalUnits = source.units.infantry + source.units.cavalry + source.units.artillery;
    if (totalUnits <= 1) {
      addLog(`Not enough units in ${source.name} to take action.`);
      return;
    }

    if (source.battle) {
      addLog(`${source.name} is currently in a battle!`);
      return;
    }

    const attackingUnits = { ...source.units };
    if (attackingUnits.infantry > 1) attackingUnits.infantry -= 1;
    else if (attackingUnits.cavalry > 0) attackingUnits.cavalry -= 1;

    if (target.owner === playerNation) {
      gameDataRef.current[sourceId].units = { infantry: 1, cavalry: 0, artillery: 0 };
      gameDataRef.current[targetId].units = {
        infantry: target.units.infantry + attackingUnits.infantry,
        cavalry: target.units.cavalry + attackingUnits.cavalry,
        artillery: target.units.artillery + attackingUnits.artillery,
      };
      
      setCountries(prev => ({
        ...prev,
        [sourceId]: { ...prev[sourceId], units: { infantry: 1, cavalry: 0, artillery: 0 } },
        [targetId]: { ...prev[targetId], units: gameDataRef.current[targetId].units }
      }));
      addLog(`Moved units from ${source.name} to ${target.name}.`);
    } else {
      const warKey = [playerNation, target.owner].sort().join(':');
      if (target.owner !== 'Neutral' && !wars.includes(warKey)) {
        addLog(`You must declare war on ${target.owner} first!`);
        setSourceCountryId(null);
        return;
      }

      if (target.battle) {
        addLog(`A battle is already happening in ${target.name}!`);
        setSourceCountryId(null);
        return;
      }

      if (showAnimations) {
        const attackAnim = {
          id: Math.random().toString(),
          source: centroids[sourceId],
          target: centroids[targetId],
          color: OWNER_COLORS[playerNation || 'Neutral']
        };
        setAttacks(prev => [...prev, attackAnim]);
        setTimeout(() => {
          setAttacks(prev => prev.filter(a => a.id !== attackAnim.id));
        }, 800);
      }

      gameDataRef.current[sourceId].units = { infantry: 1, cavalry: 0, artillery: 0 };
      gameDataRef.current[targetId].battle = { attacker: playerNation!, units: attackingUnits };

      setCountries(prev => ({
        ...prev,
        [sourceId]: { ...prev[sourceId], units: { infantry: 1, cavalry: 0, artillery: 0 } },
        [targetId]: { ...prev[targetId], battle: { attacker: playerNation!, units: attackingUnits } }
      }));
      addLog(`Attack launched on ${target.name}!`);
    }
  }, [centroids, wars, showAnimations, addLog, playerNation]);

  const handleDeploy = useCallback((targetId: string) => {
    if (!sourceCountryId) return;
    executeAction(sourceCountryId, targetId);
    setSourceCountryId(null);
  }, [sourceCountryId, executeAction]);

  const handleRecruitUnit = (type: UnitType) => {
    if (!selectedCountryId || gameDataRef.current[selectedCountryId].owner !== playerNation) return;
    const stats = UNIT_STATS[type];
    if (playerGold >= stats.cost) {
      setPlayerGold(prev => prev - stats.cost);
      gameDataRef.current[selectedCountryId].units[type] += 1;
      
      setCountries(prev => ({
        ...prev,
        [selectedCountryId]: {
          ...prev[selectedCountryId],
          units: { ...gameDataRef.current[selectedCountryId].units }
        }
      }));
      addLog(`Recruited ${type} in ${gameDataRef.current[selectedCountryId].name}.`);
    } else {
      addLog(`Not enough gold for ${type}.`);
    }
  };

  const handleDeclareWar = () => {
    if (!selectedCountryId || gameDataRef.current[selectedCountryId].owner === playerNation) return;
    const country = gameDataRef.current[selectedCountryId];
    const warKey = [playerNation, country.owner].sort().join(':');
    if (!wars.includes(warKey)) {
      const newWars = [...wars, warKey];
      setWars(newWars);
      warsRef.current = newWars;
      addLog(`⚔️ You declared war on ${country.owner}!`);
    }
  };

  const handleUpgradeEconomy = () => {
    if (!selectedCountryId || gameDataRef.current[selectedCountryId].owner !== playerNation) return;
    const country = gameDataRef.current[selectedCountryId];
    const cost = country.economy * 15;
    if (playerGold >= cost) {
      setPlayerGold(prev => prev - cost);
      gameDataRef.current[selectedCountryId].economy += 1;
      addLog(`Upgraded economy in ${country.name} to ${country.economy + 1}.`);
    } else {
      addLog(`Not enough gold. Need ${cost} to upgrade.`);
    }
  };

  if (Object.keys(countries).length === 0) {
    return <div className="flex items-center justify-center h-screen bg-[#1a3a5a] text-white font-serif text-xl animate-pulse italic tracking-widest">Cartographing Europe...</div>;
  }

  return (
    <div className="relative w-screen h-screen bg-[#1a3a5a] text-stone-800 font-sans overflow-hidden paper-texture">
      {/* Map Area */}
      <div className="absolute inset-0 cursor-crosshair map-container z-0">
        <ComposableMap
          projection="geoAzimuthalEqualArea"
          projectionConfig={{
            rotate: [-20.0, -52.0, 0],
            scale: 1000
          }}
          className="w-full h-full outline-none"
        >
          <ZoomableGroup center={[15, 50]} minZoom={1} maxZoom={8} zoom={1.5}>
            {/* Water Background */}
            <rect width="1000%" height="1000%" x="-500%" y="-500%" fill="#0a1a2a" />
            
            <Geographies geography={geographies}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <MemoizedCountry
                    key={geo.rsmKey}
                    geo={geo}
                    country={countries[geo.id]}
                    isSelected={selectedCountryId === geo.id}
                    isHighlighted={hoveredNation && countries[geo.id]?.owner === hoveredNation}
                    onClick={handleCountryClick}
                    graphicsQuality={graphicsQuality}
                  />
                ))
              }
            </Geographies>
            
            {/* Mountains */}
            {mountainMarkers}

            {/* Large Region Labels (Atmospheric) */}
            {regionLabels}

            {/* Army Markers (Flags) */}
            {armyMarkers}
          </ZoomableGroup>
        </ComposableMap>
        <canvas ref={canvasRef} className="absolute inset-0 z-10 pointer-events-none" />
      </div>

      {/* Navigation System (Compass & Scale) */}
      <div className="absolute bottom-8 left-8 z-20 pointer-events-none flex flex-col items-center space-y-4">
        <div className="compass-rose relative w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 border-2 border-stone-400 rounded-full opacity-50" />
          <div className="absolute inset-2 border border-stone-400 rounded-full opacity-30" />
          <div className="relative w-1 h-20 bg-stone-800 rounded-full" style={{ transform: 'rotate(0deg)' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-10 bg-red-700 clip-triangle" />
          </div>
        </div>
      </div>

      {/* Top Bar (Floating) */}
      <div className="absolute top-0 left-0 right-0 p-2 md:p-4 pointer-events-none z-30 flex flex-col md:flex-row justify-between items-start gap-2">
        <div className="pointer-events-auto flex flex-col gap-2 w-full md:w-auto">
          <div className="flex items-center space-x-3 realistic-panel px-4 py-2 rounded-sm w-fit">
            <Globe className="w-5 h-5 text-stone-700" />
            <h1 className="text-sm md:text-lg font-serif font-bold text-stone-900 tracking-tight uppercase">Imperial Command</h1>
            {isPlaying && (
              <div className="flex items-center space-x-1 text-[8px] font-mono text-stone-500 ml-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>{currentFps} FPS</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] md:text-xs font-serif">
            <div className="flex items-center space-x-2 realistic-panel px-3 py-1.5 rounded-sm">
              <span className="text-stone-500 uppercase tracking-widest">Day</span>
              <span className="text-stone-900 font-bold">{day}</span>
            </div>
            <div className="flex items-center space-x-2 realistic-panel px-3 py-1.5 rounded-sm">
              <Coins className="w-4 h-4 text-amber-700" />
              <span className="text-stone-900 font-bold">{playerGold}</span>
              <span className="text-stone-500 text-[8px] md:text-[10px] tracking-tighter">+{projectedIncome}</span>
            </div>
            <div className="flex items-center space-x-2 realistic-panel px-3 py-1.5 rounded-sm">
              <Users className="w-4 h-4 text-stone-700" />
              <span className="text-stone-900 font-bold">
                {totalArmy >= 1000 ? `${(totalArmy / 1000).toFixed(1)}K` : totalArmy}
              </span>
            </div>
            <div className="flex items-center space-x-2 realistic-panel px-3 py-1.5 rounded-sm">
              <Globe className="w-4 h-4 text-stone-700" />
              <span className="text-stone-900 font-bold">{totalRegions}</span>
            </div>
          </div>
        </div>
        
        <div className="pointer-events-auto flex flex-row md:flex-col items-center md:items-end gap-2 w-full md:w-auto justify-between md:justify-start">
          <div className="flex gap-2">
            <button
              onClick={() => setView('settings')}
              className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 realistic-panel hover:bg-stone-100 transition-all active:scale-95"
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={() => setView('menu')}
              className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 realistic-panel hover:bg-stone-100 transition-all active:scale-95"
            >
              <Menu className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <div className="flex items-center space-x-2 realistic-panel p-1 rounded-sm">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-sm transition-all active:scale-90 ${isPlaying ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
              >
                {isPlaying ? <Pause className="w-3 h-3 md:w-4 md:h-4" /> : <Play className="w-3 h-3 md:w-4 md:h-4" />}
              </button>
              <div className="h-4 md:h-6 w-px bg-stone-300 mx-1"></div>
              <div className="flex items-center space-x-1">
                {[1, 2, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s as 1 | 2 | 5)}
                    className={`px-1.5 md:px-2 py-0.5 md:py-1 text-[8px] md:text-[10px] font-serif font-bold rounded-sm transition-all ${speed === s ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  >
                    {s}X
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="flex items-center space-x-1 realistic-panel px-3 py-1.5 rounded-sm font-serif font-bold transition-all hover:bg-stone-100 text-[8px] md:text-[10px] uppercase tracking-widest"
          >
            <Trophy className="w-3 h-3" />
            <span className="hidden md:inline">Power Rankings</span>
            <span className="md:hidden">Ranks</span>
          </button>
        </div>
      </div>

      {/* Side Panel (Diplomacy & Military) */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto z-10 md:flex">
        <button className="realistic-panel p-2 rounded-sm shadow-md transition-all hover:bg-stone-100 group relative active:scale-95">
          <Globe className="w-5 h-5 text-stone-700" />
          <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-stone-800 text-white text-[10px] px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-serif uppercase tracking-widest">Diplomacy</span>
        </button>
        <button className="realistic-panel p-2 rounded-sm shadow-md transition-all hover:bg-stone-100 group relative active:scale-95">
          <Swords className="w-5 h-5 text-stone-700" />
          <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-stone-800 text-white text-[10px] px-2 py-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-serif uppercase tracking-widest">Military</span>
        </button>
      </div>

      {/* Logs */}
      <div className="absolute bottom-24 md:bottom-40 left-4 md:left-8 w-48 md:w-56 pointer-events-none z-10">
        <div className="flex flex-col-reverse space-y-reverse space-y-2">
          {logs.map((log, i) => (
            <div key={i} className="realistic-panel text-[9px] md:text-[10px] text-stone-700 px-3 py-2 rounded-sm shadow-sm border-stone-200 animate-in fade-in slide-in-from-left-2 font-serif italic leading-tight bg-white/80">
              {log}
            </div>
          ))}
        </div>
      </div>

      {/* Target Indicator */}
      {sourceCountryId && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 bg-red-800/90 backdrop-blur-md text-white px-4 py-2 rounded-sm font-serif font-bold shadow-xl flex items-center space-x-3 animate-pulse text-[10px] border border-red-900 pointer-events-auto uppercase tracking-widest">
          <Crosshair className="w-4 h-4 shrink-0" />
          <span className="truncate">Deploying from {countries[sourceCountryId].name}</span>
          <button 
            onClick={() => setSourceCountryId(null)}
            className="bg-white/20 hover:bg-white/30 p-1 rounded-full transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Leaderboard Panel */}
      {showLeaderboard && (
        <div className="absolute top-24 right-4 left-4 md:left-auto md:w-64 realistic-panel z-30 flex flex-col max-h-[50vh] md:max-h-[60vh] animate-in slide-in-from-right-4">
          <div className="p-3 border-b border-stone-300 flex justify-between items-center bg-stone-100">
            <h2 className="text-xs font-serif font-bold text-stone-800 uppercase tracking-widest">Power Rankings</h2>
            <button onClick={() => setShowLeaderboard(false)} className="text-stone-400 hover:text-stone-600">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="p-2 overflow-y-auto space-y-2">
            {leaderboardData.map(([owner, data]) => {
              const color = OWNER_COLORS[owner as Owner];
              return (
                <div key={owner} className="flex flex-col space-y-1 bg-stone-50 p-2 rounded-sm border border-stone-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-sm border border-stone-400" style={{ backgroundColor: color }} />
                      <span className="text-[10px] font-serif font-bold text-stone-800 truncate uppercase tracking-tight">{owner.replace('AI_', '')}</span>
                    </div>
                    <span className="text-[9px] font-serif text-stone-500">{data.count} REGIONS</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-serif text-stone-600 pl-5">
                    <span title="Total Army">⚔️ {data.totalUnits}</span>
                    <span title="Total Economy">🪙 {data.totalEcon}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Bottom/Side Panel for Selected Country (Bohemia Style) */}
      {selectedCountryData && (
        <div className="absolute bottom-0 md:top-4 right-0 md:right-4 h-[60vh] md:max-h-[90vh] w-full md:w-80 realistic-panel z-50 rounded-t-xl md:rounded-lg pointer-events-auto flex flex-col overflow-hidden animate-in slide-in-from-bottom md:slide-in-from-right-8 duration-500">
          {/* Header */}
          <div className="p-4 panel-header flex flex-col items-center relative">
            <button 
              onClick={() => setSelectedCountryId(null)} 
              className="absolute top-2 right-2 text-stone-500 hover:text-stone-200 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
            
            <h2 className="text-base md:text-lg font-serif font-bold text-stone-100 tracking-widest uppercase mb-2 md:mb-4">
              {selectedCountryData.name.split(' (')[0]}
            </h2>
            
            <div className="flex w-full justify-around items-center mb-2 md:mb-4">
              {/* Flag Placeholder */}
              <div className="w-12 h-8 md:w-16 md:h-12 bg-red-900 border border-[#b8860b] flex items-center justify-center shadow-lg">
                <div className="text-white font-bold text-[8px] md:text-xs">FLAG</div>
              </div>
              
              {/* Ruler Portrait */}
              <div className="w-12 h-16 md:w-16 md:h-20 bg-stone-800 border-2 border-[#3d2b1f] overflow-hidden shadow-xl">
                <img 
                  src={selectedCountryData.ruler.portrait} 
                  alt="Ruler" 
                  className="w-full h-full object-cover grayscale sepia"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 w-full gap-1 md:gap-2 text-[8px] md:text-[10px] font-serif">
              <div className="flex items-center space-x-2 bg-black/30 p-1 rounded">
                <Info className="w-3 h-3 md:stat-icon" />
                <span>{selectedCountryData.religion}</span>
              </div>
              <div className="flex items-center space-x-2 bg-black/30 p-1 rounded">
                <Trophy className="w-3 h-3 md:stat-icon" />
                <span>{selectedCountryData.government}</span>
              </div>
              <div className="flex items-center space-x-2 bg-black/30 p-1 rounded">
                <Users className="w-3 h-3 md:stat-icon" />
                <span className="truncate">{selectedCountryData.ruler.name}</span>
              </div>
              <div className="flex items-center space-x-2 bg-black/30 p-1 rounded">
                <Globe className="w-3 h-3 md:stat-icon" />
                <span>Capital</span>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex justify-around bg-black/50 py-2 border-y border-[#3d2b1f]">
            <div className="flex flex-col items-center">
              <Trophy className="stat-icon" />
              <span className="text-[10px] font-bold">13</span>
            </div>
            <div className="flex flex-col items-center">
              <Users className="stat-icon" />
              <span className="text-[10px] font-bold">{selectedCountryData.population}</span>
            </div>
            <div className="flex flex-col items-center">
              <Coins className="stat-icon" />
              <span className="text-[10px] font-bold">{selectedCountryData.prestige}</span>
            </div>
            <div className="flex flex-col items-center">
              <TrendingUp className="stat-icon" />
              <span className="text-[10px] font-bold">{selectedCountryData.stability}</span>
            </div>
          </div>

          {/* Description */}
          <div className="p-4 flex-1 overflow-y-auto">
            <p className="text-[11px] font-serif leading-relaxed text-stone-400 italic mb-4">
              {selectedCountryData.name} reigns as a significant region within the realm, a land of strategic importance and cultural heritage. Its history is written in the stones of its fortresses...
            </p>
            
            <div className="flex space-x-2 mb-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex-1 aspect-square bg-stone-800 border border-[#3d2b1f] rounded overflow-hidden">
                  <img src={`https://picsum.photos/seed/img${i}/100/100`} alt="feature" className="w-full h-full object-cover grayscale" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#b8860b] border-b border-[#3d2b1f] pb-1">Diplomacy</h3>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="w-8 h-6 bg-stone-700 border border-stone-600 rounded-sm" />
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 bg-black/40 border-t border-[#3d2b1f] space-y-2">
            {view === 'selection' ? (
              <button 
                onClick={() => {
                  if (selectedCountryData.owner === 'Neutral') {
                    addLog("Cannot play as a neutral territory.");
                    return;
                  }
                  setPlayerNation(selectedCountryData.owner);
                  setView('game');
                  setIsPlaying(true);
                  addLog(`Campaign started as ${selectedCountryData.owner}.`);
                }}
                className="w-full py-3 bg-[#b8860b] hover:bg-[#daa520] text-stone-900 font-serif font-bold text-sm uppercase tracking-widest transition-all shadow-lg"
              >
                Play as {selectedCountryData.owner}
              </button>
            ) : selectedCountryData.owner === playerNation ? (
              <>
                <button 
                  onClick={() => setSourceCountryId(selectedCountryData.id)}
                  className="w-full py-2 bg-[#3d2b1f] hover:bg-[#4d3b2f] text-stone-200 font-serif font-bold text-xs uppercase tracking-widest transition-all"
                >
                  Deploy Forces
                </button>
                <div className="grid grid-cols-3 gap-1">
                  {(['infantry', 'cavalry', 'artillery'] as UnitType[]).map(type => (
                    <button 
                      key={type}
                      onClick={() => handleRecruitUnit(type)}
                      className="py-1 bg-stone-800 hover:bg-stone-700 text-[9px] uppercase font-bold"
                    >
                      {type.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <button 
                onClick={() => handleDeploy(selectedCountryData.id)}
                className="w-full py-2 bg-red-900/50 hover:bg-red-900 text-stone-200 font-serif font-bold text-xs uppercase tracking-widest transition-all"
              >
                {sourceCountryId ? 'Attack Region' : 'Declare War'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Selection Overlay */}
      {view === 'selection' && (
        <div className="absolute top-20 left-4 z-40 w-72 realistic-panel p-4 animate-in fade-in slide-in-from-left-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-stone-900 mb-4 border-b border-stone-300 pb-2">Select Your Empire</h3>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {Object.keys(OWNER_COLORS).filter(n => n !== 'Neutral').map(nation => (
              <button
                key={nation}
                onMouseEnter={() => setHoveredNation(nation)}
                onMouseLeave={() => setHoveredNation(null)}
                onClick={() => {
                  const provinceId = Object.keys(gameDataRef.current).find(id => gameDataRef.current[id].owner === nation);
                  if (provinceId) setSelectedCountryId(provinceId);
                }}
                className={`w-full text-left p-3 rounded border transition-all flex flex-col space-y-1 ${selectedCountryData?.owner === nation ? 'bg-stone-900 text-white border-stone-900 shadow-lg scale-[1.02]' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 hover:border-stone-400'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{NATION_FLAGS[nation]}</span>
                    <span className="text-[10px] font-bold uppercase tracking-tight">{nation}</span>
                  </div>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: OWNER_COLORS[nation] }} />
                </div>
                <div className="flex justify-between items-center text-[8px] opacity-70 font-mono">
                  <div className="flex items-center space-x-1">
                    <Globe className="w-2 h-2" />
                    <span>{nationStats[nation]?.provinces} Provinces</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Users className="w-2 h-2" />
                    <span>
                      {nationStats[nation]?.population >= 1000000 
                        ? `${(nationStats[nation].population / 1000000).toFixed(1)}M` 
                        : `${(nationStats[nation].population / 1000).toFixed(0)}K`}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-4 text-[9px] text-stone-500 font-serif italic text-center leading-tight">Hover to view borders. Click a region on the map or select from the list above.</p>
        </div>
      )}

      {/* Settings Overlay */}
      {view === 'settings' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-xl overflow-hidden paper-texture">
          <div className="relative realistic-panel p-8 max-w-md w-full mx-4 border-stone-400 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-serif font-bold text-stone-900 uppercase tracking-tight">Settings</h2>
              <button onClick={() => setView('game')} className="text-stone-500 hover:text-stone-900">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Graphics Quality</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['low', 'medium', 'high', 'ultra'] as const).map(q => (
                    <button
                      key={q}
                      onClick={() => setGraphicsQuality(q)}
                      className={`py-2 text-[10px] font-bold uppercase rounded-sm border transition-all ${graphicsQuality === q ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">FPS Lock</label>
                <div className="grid grid-cols-3 gap-2">
                  {([30, 60, 90, 120, 144] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFpsLock(f)}
                      className={`py-2 text-[10px] font-bold uppercase rounded-sm border transition-all ${fpsLock === f ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
                    >
                      {`${f} FPS`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Visual Effects</label>
                <button
                  onClick={() => setShowAnimations(!showAnimations)}
                  className={`w-full py-3 text-[10px] font-bold uppercase rounded-sm border transition-all ${showAnimations ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
                >
                  Animations: {showAnimations ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setView('game')}
                  className="w-full py-4 bg-stone-100 hover:bg-stone-200 text-stone-900 font-serif font-bold uppercase tracking-widest rounded-sm transition-all"
                >
                  Back to Game
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Menu Overlay (Realistic Style) */}
      {view === 'menu' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-xl overflow-hidden paper-texture">
          <div className="relative realistic-panel p-8 md:p-12 max-w-md w-full mx-4 border-stone-400 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center text-center space-y-8">
              <div className="relative">
                <Globe className="w-24 h-24 text-stone-800 relative animate-pulse-slow" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-stone-900 tracking-tight uppercase">
                  Imperial Command
                </h1>
                <p className="text-stone-600 font-serif italic text-sm tracking-widest">Grand Strategy Simulation v4.0</p>
              </div>

              <div className="w-full space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setDeviceType('mobile')}
                    className={`py-3 rounded-sm font-serif text-xs transition-all uppercase tracking-widest font-bold border ${deviceType === 'mobile' ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-200 text-stone-700 border-stone-300 hover:bg-stone-300'}`}
                  >
                    Mobile
                  </button>
                  <button 
                    onClick={() => setDeviceType('pc')}
                    className={`py-3 rounded-sm font-serif text-xs transition-all uppercase tracking-widest font-bold border ${deviceType === 'pc' ? 'bg-stone-900 text-white border-stone-900' : 'bg-stone-200 text-stone-700 border-stone-300 hover:bg-stone-300'}`}
                  >
                    PC
                  </button>
                </div>

                <button 
                  onClick={() => setView('selection')}
                  className="w-full group relative overflow-hidden bg-stone-900 hover:bg-stone-800 text-white py-4 rounded-sm font-serif font-bold transition-all active:scale-95 shadow-xl"
                >
                  <span className="relative tracking-[0.2em] uppercase">Begin Campaign</span>
                </button>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setView('settings')}
                    className="flex items-center justify-center space-x-2 bg-stone-200 hover:bg-stone-300 text-stone-700 border border-stone-300 py-3 rounded-sm font-serif text-xs transition-all uppercase tracking-widest font-bold"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  <button 
                    onClick={() => setView('whatsnew')}
                    className="flex items-center justify-center space-x-2 bg-stone-200 hover:bg-stone-300 text-stone-700 border border-stone-300 py-3 rounded-sm font-serif text-xs transition-all uppercase tracking-widest font-bold"
                  >
                    <Info className="w-4 h-4" />
                    <span>Intel</span>
                  </button>
                </div>
              </div>

              <div className="pt-8 border-t border-stone-300 w-full">
                <div className="flex justify-between items-center text-[8px] font-serif text-stone-500 uppercase tracking-widest font-bold">
                  <span>Status: Ready</span>
                  <span>Region: EU-CENTRAL</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Overlay */}
      {view === 'settings' && (
        <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm z-50 flex items-center justify-center paper-texture">
          <div className="realistic-panel p-8 rounded-sm shadow-2xl max-w-md w-full border border-stone-400 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8 border-b border-stone-200 pb-4">
              <h2 className="text-2xl font-serif font-bold text-stone-900 uppercase tracking-tight">Configuration</h2>
              <button onClick={() => setView('menu')} className="text-stone-400 hover:text-stone-800 transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="font-serif font-bold text-stone-700 uppercase text-xs tracking-widest">Visual Feedback</span>
                  <div className="relative">
                    <input type="checkbox" checked={showAnimations} onChange={e => setShowAnimations(e.target.checked)} className="sr-only peer" />
                    <div className="w-10 h-5 bg-stone-300 rounded-full peer peer-checked:bg-stone-800 transition-colors"></div>
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                </label>
                <p className="text-[10px] text-stone-500 font-serif italic">Toggle deployment lines and combat indicators.</p>
              </div>
              
              <div className="space-y-4">
                <label className="block font-serif font-bold text-stone-700 uppercase text-xs tracking-widest">Strategic Difficulty</label>
                <div className="flex gap-2">
                  {['easy', 'normal', 'hard'].map(d => (
                    <button 
                      key={d}
                      onClick={() => setDifficulty(d as any)}
                      className={`flex-1 py-3 rounded-sm font-serif font-bold capitalize transition-all text-xs tracking-widest ${difficulty === d ? 'bg-stone-800 text-white shadow-md' : 'bg-stone-100 text-stone-500 hover:bg-stone-200 border border-stone-200'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-stone-500 font-serif italic">Adjusts the economic output of rival empires.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* What's New Overlay */}
      {view === 'whatsnew' && (
        <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm z-50 flex items-center justify-center paper-texture">
          <div className="realistic-panel p-8 rounded-sm shadow-2xl max-w-md w-full border border-stone-400 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8 border-b border-stone-200 pb-4">
              <h2 className="text-2xl font-serif font-bold text-stone-900 uppercase tracking-tight">Intelligence Report</h2>
              <button onClick={() => setView('menu')} className="text-stone-400 hover:text-stone-800 transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-6 max-h-80 overflow-y-auto pr-4 custom-scrollbar">
              <div className="border-l-4 border-stone-800 pl-4 py-1">
                <h3 className="font-serif font-bold text-stone-900 uppercase text-sm tracking-tight">v4.1.0 - Performance Overhaul II</h3>
                <ul className="list-disc list-inside text-xs text-stone-600 mt-2 space-y-2 font-serif leading-relaxed">
                  <li>Massive performance optimization for army marker rendering.</li>
                  <li>Intelligent LOD (Level of Detail) for army markers based on graphics settings.</li>
                  <li>Reduced DOM footprint for non-combat regions in low-quality mode.</li>
                  <li>Further refined map data for smoother interactions.</li>
                </ul>
              </div>
              <div className="border-l-4 border-stone-300 pl-4 py-1">
                <h3 className="font-serif font-bold text-stone-500 uppercase text-sm tracking-tight">v4.0.0 - The Great Cartography</h3>
                <ul className="list-disc list-inside text-xs text-stone-400 mt-2 space-y-2 font-serif leading-relaxed">
                  <li>Initial deployment of tactical HUD interface.</li>
                  <li>Real-time combat animations and engagement lines.</li>
                  <li>Performance optimizations for global rendering.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
      `}</style>
    </div>
  );
}
