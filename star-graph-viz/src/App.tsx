import { useMemo, useState } from 'react';
import type { Star, GraphLink } from './models/Star';
import { generateInitialGraph } from './utils/generateInitialGraph';
import StarScene from './components/StarScene';
import {
  Box,
  Drawer,
  Button,
  Typography,
  Stack,
  Divider,
  Paper,
  Switch,
  FormControlLabel
} from '@mui/material';
import { Add as AddIcon, Refresh } from '@mui/icons-material';

type GraphState = { stars: Star[]; links: GraphLink[] };

const SUN_ID = '1';

function hasLink(links: GraphLink[], source: string, target: string) {
  return links.some((l) => l.source === source && l.target === target);
}

function getSun(stars: Star[]) {
  return stars.find((s) => s.id === SUN_ID);
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Разложить стартовые звёзды по разным орбитам вокруг Солнца (аккуратно)
function layoutInitialOnOrbits(input: GraphState): GraphState {
  const sun = input.stars.find((s) => s.id === SUN_ID);
  if (!sun) return input;

  const others = input.stars.filter((s) => s.id !== SUN_ID);

  const baseR = 140;
  const stepR = 110;

  const laidOutOthers = others.map((s, i) => {
    const r = baseR + i * stepR;
    const angle = (i / Math.max(1, others.length)) * Math.PI * 2;
    return {
      ...s,
      x: sun.x + Math.cos(angle) * r,
      y: sun.y + Math.sin(angle) * r
    };
  });

  // Плюс: гарантируем, что у каждой звезды есть связь с Солнцем
  const extraLinks: GraphLink[] = [];
  for (const s of laidOutOthers) {
    if (!hasLink(input.links, SUN_ID, s.id)) {
      extraLinks.push({ source: SUN_ID, target: s.id, distance: dist(sun, s) });
    }
  }

  return {
    stars: [sun, ...laidOutOthers],
    links: [...input.links, ...extraLinks]
  };
}

function pickSpawnPositionOnNewOrbit(stars: Star[]) {
  const sun = getSun(stars);
  if (!sun) return { x: 0, y: 0, r: 200 };

  // собираем занятые радиусы (примерно)
  const radii = stars
    .filter((s) => s.id !== SUN_ID)
    .map((s) => dist({ x: s.x, y: s.y }, { x: sun.x, y: sun.y }))
    .sort((a, b) => a - b);

  const baseR = 140;
  const stepR = 110;

  // выбираем следующий радиус по сетке baseR + k*stepR, который не близко к существующим
  let k = Math.max(0, Math.floor((radii[radii.length - 1] ?? (baseR - stepR)) / stepR));
  let r = baseR + (k + 1) * stepR;

  // случайный угол
  const angle = Math.random() * Math.PI * 2;

  return {
    r,
    x: sun.x + Math.cos(angle) * r,
    y: sun.y + Math.sin(angle) * r
  };
}

export default function App() {
  const initial = useMemo(() => layoutInitialOnOrbits(generateInitialGraph()), []);
  const [graph, setGraph] = useState<GraphState>(initial);

  const [showEdges, setShowEdges] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);

  // Чтобы во время перетаскивания не вращалась камера
  const [controlsEnabled, setControlsEnabled] = useState(true);

  const handleAddStar = () => {
    setGraph((prev) => {
      const sun = getSun(prev.stars);
      if (!sun) return prev;

      const starColors = ['#FDB813', '#FF6B6B', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3'];

      const spawn = pickSpawnPositionOnNewOrbit(prev.stars);

      const newStar: Star = {
        id: String(Date.now()),
        name: `Звезда ${prev.stars.length + 1}`,
        mass: Math.random() * 50 + 30,
        x: spawn.x,
        y: spawn.y,
        color: starColors[Math.floor(Math.random() * starColors.length)]
      };

      const newLink: GraphLink = { source: SUN_ID, target: newStar.id, distance: spawn.r };
      const updatedLinks = hasLink(prev.links, newLink.source, newLink.target)
        ? prev.links
        : [...prev.links, newLink];

      return {
        stars: [...prev.stars, newStar],
        links: updatedLinks
      };
    });
  };

  const handleReset = () => {
    setGraph(layoutInitialOnOrbits(generateInitialGraph()));
  };

  // Колбэк из 3D сцены: обновляем координаты звезды в state
  const handleStarMove = (id: string, x: number, y: number) => {
    setGraph((prev) => ({
      ...prev,
      stars: prev.stars.map((s) => (s.id === id ? { ...s, x, y } : s))
    }));
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#0B0D17', position: 'relative' }}>
      <Box sx={{ flexGrow: 1, width: 'calc(100vw - 380px)', height: '100vh' }}>
        <StarScene
          stars={graph.stars}
          links={graph.links}
          showEdges={showEdges}
          showOrbits={showOrbits}
          sunId={SUN_ID}
          controlsEnabled={controlsEnabled}
          onDragStart={() => setControlsEnabled(false)}
          onDragEnd={() => setControlsEnabled(true)}
          onStarMove={handleStarMove}
        />
      </Box>

      <Drawer
        variant="permanent"
        anchor="right"
        sx={{
          width: 380,
          flexShrink: 0,
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
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 700, color: '#8ab4ff' }}>
          Звёздная Система
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, opacity: 0.7 }}>
          3D визуализация
        </Typography>

        <Stack spacing={3}>
          <Paper sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', p: 2, borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Звёзд: {graph.stars.length}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Связей: {graph.links.length}
              </Typography>
            </Stack>
          </Paper>

          <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />

          <Paper sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', p: 2, borderRadius: 2 }}>
            <Stack spacing={1}>
              <FormControlLabel
                control={<Switch checked={showOrbits} onChange={(e) => setShowOrbits(e.target.checked)} />}
                label="Показывать орбиты"
              />
              <FormControlLabel
                control={<Switch checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} />}
                label="Показывать рёбра"
              />
            </Stack>
          </Paper>

          <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddStar}
            fullWidth
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              py: 1.5,
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2
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
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2
            }}
          >
            Сбросить систему
          </Button>

          <Paper sx={{ bgcolor: 'rgba(96, 165, 250, 0.1)', p: 2, borderRadius: 2 }}>
            <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 1 }}>
              Управление 3D
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.75, display: 'block' }}>
              • Вращай мышью (ЛКМ)
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.75, display: 'block' }}>
              • Zoom колёсиком
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.75, display: 'block' }}>
              • Перетаскивай звёзды ЛКМ (камера временно блокируется)
            </Typography>
          </Paper>
        </Stack>
      </Drawer>
    </Box>
  );
}
