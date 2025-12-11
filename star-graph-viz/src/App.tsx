import { useState, useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { Star } from './models/Star';
import { generateInitialGraph } from './utils/generateInitialGraph';
import { GravityEngine } from './physics/gravityEngine';
import type { PhysicsState } from './physics/gravityEngine';
import { 
  Box, 
  Drawer, 
  Slider, 
  Button, 
  Typography,
  Stack,
  Divider,
  Paper,
  IconButton,
  Switch,
  FormControlLabel
} from '@mui/material';
import { 
  Add as AddIcon,
  Refresh,
  Close as CloseIcon,
  ZoomIn,
  ZoomOut,
  PlayArrow,
  Pause
} from '@mui/icons-material';

function App() {
  const cyRef = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<any>(null);
  const animationFrameRef = useRef<number>();
  const gravityEngineRef = useRef(new GravityEngine(1.5, 0.016, 0.99));

  const initialData = generateInitialGraph();
  const [graphData, setGraphData] = useState({
    nodes: initialData.stars,
    edges: initialData.links
  });

  const [physicsState, setPhysicsState] = useState<PhysicsState>({
    positions: new Map(initialData.stars.map(s => [s.id, { x: s.x || 0, y: s.y || 0 }])),
    velocities: new Map(initialData.stars.map(s => [s.id, { vx: s.vx || 0, vy: s.vy || 0 }]))
  });

  const [isPhysicsEnabled, setIsPhysicsEnabled] = useState(false);
  const [gravityStrength, setGravityStrength] = useState(1.5);
  const [timeSpeed, setTimeSpeed] = useState(1.0);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // Инициализация Cytoscape
  useEffect(() => {
    if (cyRef.current && !cyInstance.current) {
      cyInstance.current = cytoscape({
        container: cyRef.current,
        elements: [],
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'data(color)',
              'width': (ele: any) => ele.data('mass') * 1.2,
              'height': (ele: any) => ele.data('mass') * 1.2,
              'label': 'data(label)',
              'text-valign': 'bottom',
              'text-halign': 'center',
              'text-margin-y': 5,
              'font-size': '16px',
              'font-weight': 'bold',
              'color': '#ffffff',
              'text-outline-color': '#000000',
              'text-outline-width': 3,
              'border-width': 3,
              'border-color': (ele: any) => ele.data('color'),
              'border-opacity': 0.6,
              'background-opacity': 0.9,
            }
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 5,
              'border-color': '#ffffff',
              'border-opacity': 1,
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#4a5568',
              'curve-style': 'bezier',
              'opacity': 0.6,
            }
          }
        ],
        autoungrabify: false,
        userZoomingEnabled: true,
        userPanningEnabled: true,
      });

      cyInstance.current.on('tap', 'node', (evt: any) => {
        const nodeData = evt.target.data();
        setSelectedNode(nodeData);
      });

      cyInstance.current.on('tap', (evt: any) => {
        if (evt.target === cyInstance.current) {
          setSelectedNode(null);
        }
      });

      // Обработка перетаскивания узлов
      cyInstance.current.on('free', 'node', (evt: any) => {
        const node = evt.target;
        const pos = node.position();
        const id = node.id();
        
        setPhysicsState(prev => {
          const newPositions = new Map(prev.positions);
          newPositions.set(id, { x: pos.x, y: pos.y });
          const newVelocities = new Map(prev.velocities);
          newVelocities.set(id, { vx: 0, vy: 0 });
          return { positions: newPositions, velocities: newVelocities };
        });
      });
    }
  }, []);

  // Синхронизация графа с Cytoscape
  useEffect(() => {
    if (!cyInstance.current) return;

    const cy = cyInstance.current;

    // Удаляем узлы, которых больше нет
    cy.nodes().forEach((node: any) => {
      if (!graphData.nodes.find(n => n.id === node.id())) {
        node.remove();
      }
    });

    // Добавляем или обновляем узлы
    graphData.nodes.forEach(node => {
      const pos = physicsState.positions.get(node.id) || { x: node.x || 0, y: node.y || 0 };
      const existingNode = cy.getElementById(node.id);
      
      if (existingNode.length === 0) {
        // Добавляем новый узел
        cy.add({
          data: {
            id: node.id,
            label: node.name,
            color: node.color,
            mass: node.mass
          },
          position: { x: pos.x, y: pos.y }
        });
      } else {
        // Обновляем данные существующего узла
        existingNode.data('label', node.name);
        existingNode.data('color', node.color);
        existingNode.data('mass', node.mass);
        if (!isPhysicsEnabled) {
          existingNode.position(pos);
        }
      }
    });

    // Удаляем рёбра, которых больше нет
    cy.edges().forEach((edge: any) => {
      const edgeData = edge.data();
      if (!graphData.edges.find(e => e.source === edgeData.source && e.target === edgeData.target)) {
        edge.remove();
      }
    });

    // Добавляем новые рёбра
    graphData.edges.forEach(edge => {
      const existingEdge = cy.edges(`[source="${edge.source}"][target="${edge.target}"]`);
      if (existingEdge.length === 0) {
        cy.add({
          data: { source: edge.source, target: edge.target }
        });
      }
    });

  }, [graphData, physicsState.positions, isPhysicsEnabled]);

  // Физическая симуляция
  useEffect(() => {
    if (!isPhysicsEnabled) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    // Обновляем параметры движка при изменении
    gravityEngineRef.current.setGravity(gravityStrength);

    let lastTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000; // в секундах
      lastTime = now;

      // Обновляем timeStep с учётом скорости времени
      gravityEngineRef.current.setTimeStep(deltaTime * timeSpeed);

      // Выполняем шаг симуляции
      setPhysicsState(prevState => {
        const newState = gravityEngineRef.current.step(graphData.nodes, prevState);
        
        // Обновляем позиции узлов в Cytoscape
        if (cyInstance.current) {
          graphData.nodes.forEach(node => {
            const pos = newState.positions.get(node.id);
            if (pos) {
              const cyNode = cyInstance.current.getElementById(node.id);
              if (cyNode.length > 0 && !cyNode.grabbed()) {
                cyNode.position(pos);
              }
            }
          });
        }
        
        return newState;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPhysicsEnabled, graphData.nodes, gravityStrength, timeSpeed]);

  const handleAddStar = () => {
    const starColors = ['#FDB813', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'];
    const newStar: Star = {
      id: String(Date.now()),
      name: `Звезда ${graphData.nodes.length + 1}`,
      mass: Math.random() * 50 + 30,
      x: Math.random() * 400 - 200,
      y: Math.random() * 400 - 200,
      vx: (Math.random() - 0.5) * 10,
      vy: (Math.random() - 0.5) * 10,
      color: starColors[Math.floor(Math.random() * starColors.length)]
    };
    
    setGraphData(prev => ({
      nodes: [...prev.nodes, newStar],
      edges: prev.edges
    }));

    setPhysicsState(prev => {
      const newPositions = new Map(prev.positions);
      const newVelocities = new Map(prev.velocities);
      newPositions.set(newStar.id, { x: newStar.x, y: newStar.y });
      newVelocities.set(newStar.id, { vx: newStar.vx || 0, vy: newStar.vy || 0 });
      return { positions: newPositions, velocities: newVelocities };
    });
  };

  const handleReset = () => {
    const resetData = generateInitialGraph();
    setGraphData({
      nodes: resetData.stars,
      edges: resetData.links
    });
    setPhysicsState({
      positions: new Map(resetData.stars.map(s => [s.id, { x: s.x || 0, y: s.y || 0 }])),
      velocities: new Map(resetData.stars.map(s => [s.id, { vx: 0, vy: 0 }]))
    });
    setSelectedNode(null);
    setIsPhysicsEnabled(false);
  };

  const handleZoomIn = () => {
    if (cyInstance.current) {
      cyInstance.current.zoom(cyInstance.current.zoom() * 1.2);
      cyInstance.current.center();
    }
  };

  const handleZoomOut = () => {
    if (cyInstance.current) {
      cyInstance.current.zoom(cyInstance.current.zoom() * 0.8);
      cyInstance.current.center();
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#0B0D17', position: 'relative' }}>
      <Box 
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(ellipse at top, #1a1d35 0%, #0B0D17 50%, #000000 100%)',
          zIndex: 0,
        }}
      />
      
      <Box 
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            radial-gradient(2px 2px at 20px 30px, white, transparent),
            radial-gradient(2px 2px at 60px 70px, white, transparent),
            radial-gradient(1px 1px at 50px 50px, white, transparent),
            radial-gradient(1px 1px at 130px 80px, white, transparent),
            radial-gradient(2px 2px at 90px 10px, white, transparent)
          `,
          backgroundSize: '200px 200px',
          opacity: 0.4,
          zIndex: 0,
        }}
      />

      <Box 
        ref={cyRef} 
        sx={{ 
          flexGrow: 1,
          width: 'calc(100vw - 380px)',
          height: '100vh',
          position: 'relative',
          zIndex: 1,
        }} 
      />

      <Box sx={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <Stack spacing={1}>
          <IconButton 
            onClick={handleZoomIn}
            sx={{ 
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
              color: 'white'
            }}
          >
            <ZoomIn />
          </IconButton>
          <IconButton 
            onClick={handleZoomOut}
            sx={{ 
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
              color: 'white'
            }}
          >
            <ZoomOut />
          </IconButton>
        </Stack>
      </Box>

      {selectedNode && (
        <Paper 
          sx={{ 
            position: 'absolute', 
            top: 20, 
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(20px)',
            color: 'white',
            p: 2,
            borderRadius: 2,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            minWidth: 250,
            zIndex: 10,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" sx={{ color: selectedNode.color }}>
              {selectedNode.label}
            </Typography>
            <IconButton size="small" onClick={() => setSelectedNode(null)} sx={{ color: 'white' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.8 }}>
            Масса: {Math.round(selectedNode.mass)}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            ID: {selectedNode.id}
          </Typography>
        </Paper>
      )}

      <Drawer
        variant="permanent"
        anchor="right"
        sx={{
          width: 380,
          flexShrink: 0,
          zIndex: 2,
          '& .MuiDrawer-paper': {
            width: 380,
            bgcolor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
            p: 3,
            boxSizing: 'border-box',
            overflowY: 'auto'
          }
        }}
      >
        <Typography variant="h4" sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 1,
          fontWeight: 700
        }}>
          Звёздная Система
        </Typography>
        
        <Typography variant="body2" sx={{ mb: 3, opacity: 0.7 }}>
          Гравитационная симуляция
        </Typography>

        <Stack spacing={3}>
          <Paper sx={{ 
            bgcolor: 'rgba(255, 255, 255, 0.05)', 
            p: 2, 
            borderRadius: 2,
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <Stack direction="row" spacing={2} justifyContent="space-around">
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ color: '#60a5fa', fontWeight: 700 }}>
                  {graphData.nodes.length}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>Звёзды</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" sx={{ color: '#34d399', fontWeight: 700 }}>
                  {graphData.edges.length}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.7 }}>Связи</Typography>
              </Box>
            </Stack>
          </Paper>

          <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />

          <Paper sx={{ 
            bgcolor: isPhysicsEnabled ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
            p: 2, 
            borderRadius: 2,
            border: `1px solid ${isPhysicsEnabled ? 'rgba(52, 211, 153, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          }}>
            <FormControlLabel
              control={
                <Switch 
                  checked={isPhysicsEnabled} 
                  onChange={(e) => setIsPhysicsEnabled(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#34d399',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#34d399',
                    },
                  }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {isPhysicsEnabled ? <PlayArrow sx={{ color: '#34d399' }} /> : <Pause sx={{ color: '#ef4444' }} />}
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {isPhysicsEnabled ? 'Физика активна' : 'Физика отключена'}
                  </Typography>
                </Box>
              }
            />
          </Paper>

          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ color: '#60a5fa', fontWeight: 600 }}>
              Сила гравитации
            </Typography>
            <Typography variant="h6" sx={{ mb: 1 }}>{gravityStrength.toFixed(2)}</Typography>
            <Slider
              value={gravityStrength}
              onChange={(_, val) => setGravityStrength(val as number)}
              min={0.5}
              max={5}
              step={0.1}
              disabled={!isPhysicsEnabled}
              sx={{ 
                color: '#60a5fa',
                '& .MuiSlider-thumb': {
                  bgcolor: '#60a5fa',
                },
                '& .MuiSlider-track': { bgcolor: '#60a5fa' },
                '& .MuiSlider-rail': { bgcolor: 'rgba(96, 165, 250, 0.2)' }
              }}
            />
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ color: '#f59e0b', fontWeight: 600 }}>
              Скорость времени
            </Typography>
            <Typography variant="h6" sx={{ mb: 1 }}>{timeSpeed.toFixed(1)}x</Typography>
            <Slider
              value={timeSpeed}
              onChange={(_, val) => setTimeSpeed(val as number)}
              min={0.1}
              max={3}
              step={0.1}
              disabled={!isPhysicsEnabled}
              sx={{ 
                color: '#f59e0b',
                '& .MuiSlider-thumb': {
                  bgcolor: '#f59e0b',
                },
                '& .MuiSlider-track': { bgcolor: '#f59e0b' },
                '& .MuiSlider-rail': { bgcolor: 'rgba(245, 158, 11, 0.2)' }
              }}
            />
          </Box>

          <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddStar}
            fullWidth
            sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              py: 1.5,
              fontSize: '16px',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              boxShadow: '0 4px 14px 0 rgba(102, 126, 234, 0.4)',
              '&:hover': { 
                background: 'linear-gradient(135deg, #5568d3 0%, #6b3fa0 100%)',
                boxShadow: '0 6px 20px 0 rgba(102, 126, 234, 0.6)',
              }
            }}
          >
            Добавить звезду
          </Button>

          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleReset}
            fullWidth
            sx={{ 
              color: 'white', 
              borderColor: 'rgba(255, 255, 255, 0.3)',
              py: 1.5,
              fontSize: '16px',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': { 
                borderColor: 'rgba(255, 255, 255, 0.5)',
                bgcolor: 'rgba(255, 255, 255, 0.05)'
              }
            }}
          >
            Сбросить систему
          </Button>

          <Paper sx={{ 
            bgcolor: 'rgba(96, 165, 250, 0.1)', 
            p: 2, 
            borderRadius: 2,
            border: '1px solid rgba(96, 165, 250, 0.2)',
            mt: 2
          }}>
            <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 1 }}>
              💡 Советы:
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
              • Включите физику для симуляции
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
              • Перетаскивайте звёзды для взаимодействия
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7, display: 'block' }}>
              • Добавляйте звёзды и наблюдайте орбиты
            </Typography>
          </Paper>
        </Stack>
      </Drawer>
    </Box>
  );
}

export default App;
