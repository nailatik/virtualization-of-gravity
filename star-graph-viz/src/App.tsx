import { useEffect, useMemo, useRef, useState } from 'react';
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
  FormControlLabel,
  TextField,
  Slider
} from '@mui/material';
import { Add as AddIcon, Refresh, Close as CloseIcon } from '@mui/icons-material';
import IconButton from '@mui/material/IconButton';

type GraphState = { stars: Star[]; links: GraphLink[] };

const SUN_ID = '1';

// ---------- helpers ----------
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

function layoutInitialOnOrbits(input: GraphState): GraphState {
  const sun = input.stars.find((s) => s.id === SUN_ID);
  if (!sun) return input;

  const others = input.stars.filter((s) => s.id !== SUN_ID);

  const baseR = 140;
  const stepR = 110;

  const laidOutOthers = others.map((s, i) => {
    const r = baseR + i * stepR;
    const angle = (i / Math.max(1, others.length)) * Math.PI * 2;
    return { ...s, x: sun.x + Math.cos(angle) * r, y: sun.y + Math.sin(angle) * r };
  });

  const extraLinks: GraphLink[] = [];
  for (const s of laidOutOthers) {
    if (!hasLink(input.links, SUN_ID, s.id)) {
      extraLinks.push({ source: SUN_ID, target: s.id, distance: dist(sun, s) });
    }
  }

  return { stars: [sun, ...laidOutOthers], links: [...input.links, ...extraLinks] };
}

function pickSpawnPositionOnNewOrbit(stars: Star[]) {
  const sun = getSun(stars);
  if (!sun) return { x: 0, y: 0, r: 200 };

  const baseR = 140;
  const stepR = 110;

  // max радиус
  let maxR = 0;
  for (const s of stars) {
    if (s.id === SUN_ID) continue;
    maxR = Math.max(maxR, dist({ x: s.x, y: s.y }, { x: sun.x, y: sun.y }));
  }

  const r = Math.max(baseR, maxR + stepR);
  const angle = Math.random() * Math.PI * 2;

  return { r, x: sun.x + Math.cos(angle) * r, y: sun.y + Math.sin(angle) * r };
}

// ---------- orbit sim (not gravity) ----------
type OrbitState = {
  radius: Map<string, number>;
  theta: Map<string, number>;
  omega: Map<string, number>;
};

const BASE_PERIOD_SEC = 5;
const baseOmega = (Math.PI * 2) / BASE_PERIOD_SEC;

function computeMinR(stars: Star[], sun: Star) {
  let minR = Infinity;
  for (const s of stars) {
    if (s.id === SUN_ID) continue;
    minR = Math.min(minR, dist({ x: s.x, y: s.y }, { x: sun.x, y: sun.y }));
  }
  return isFinite(minR) ? minR : 200;
}

function omegaForRadius(r: number, minR0: number) {
  // Kepler-like: omega ~ (1/r)^(3/2), где minR0 — фиксированная калибровка
  return baseOmega * Math.pow(minR0 / Math.max(1, r), 1.5);
}

function buildOrbitState(stars: Star[], minR0: number): OrbitState {
  const sun = getSun(stars);
  const radius = new Map<string, number>();
  const theta = new Map<string, number>();
  const omega = new Map<string, number>();

  if (!sun) return { radius, theta, omega };

  for (const s of stars) {
    if (s.id === SUN_ID) continue;

    const r = dist({ x: s.x, y: s.y }, { x: sun.x, y: sun.y });
    const th = Math.atan2(s.y - sun.y, s.x - sun.x);

    radius.set(s.id, r);
    theta.set(s.id, th);
    omega.set(s.id, omegaForRadius(r, minR0));
  }

  return { radius, theta, omega };
}

export default function App() {
  const initial = useMemo(() => layoutInitialOnOrbits(generateInitialGraph()), []);
  const [graph, setGraph] = useState<GraphState>(initial);

  // drag flag (so tick doesn't overwrite drag)
  const isDraggingRef = useRef(false);

  const [showEdges, setShowEdges] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [controlsEnabled, setControlsEnabled] = useState(true);

  const [selectedStarId, setSelectedStarId] = useState<string | null>(null);
  const selectedStar = graph.stars.find((s) => s.id === selectedStarId) ?? null;

  const [isSimRunning, setIsSimRunning] = useState(true);
  const [speed, setSpeed] = useState(1);

  const sliderValue = Math.log10(speed);

  // fixed calibration radius (does NOT jump when you move the closest planet)
  const sun0 = getSun(initial.stars);
  const minR0Init = sun0 ? computeMinR(initial.stars, sun0) : 200;

  const orbitCalibRef = useRef<{ minR0: number }>({ minR0: minR0Init });
  const orbitRef = useRef<OrbitState>(buildOrbitState(initial.stars, minR0Init));

  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number>(performance.now());

  // rebuild only when number of stars changes (add/reset)
  useEffect(() => {
    const sun = getSun(graph.stars);
    if (!sun) return;

    orbitCalibRef.current.minR0 = computeMinR(graph.stars, sun);
    orbitRef.current = buildOrbitState(graph.stars, orbitCalibRef.current.minR0);
  }, [graph.stars.length]);

  // animation loop (RAF)
  useEffect(() => {
    if (!isSimRunning) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTRef.current) / 1000);
      lastTRef.current = now;

      if (!isDraggingRef.current) {
        setGraph((prev) => {
          const sun2 = getSun(prev.stars);
          if (!sun2) return prev;

          const orbit = orbitRef.current;

          const nextStars = prev.stars.map((s) => {
            if (s.id === SUN_ID) return s;

            const r = orbit.radius.get(s.id) ?? dist(s, sun2);
            const th = orbit.theta.get(s.id) ?? Math.atan2(s.y - sun2.y, s.x - sun2.x);
            const w = orbit.omega.get(s.id) ?? (Math.PI * 2) / 10;

            const newTh = th + w * dt * speed;

            orbit.theta.set(s.id, newTh);
            orbit.radius.set(s.id, r);
            orbit.omega.set(s.id, w);

            return { ...s, x: sun2.x + Math.cos(newTh) * r, y: sun2.y + Math.sin(newTh) * r };
          });

          return { ...prev, stars: nextStars };
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    lastTRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isSimRunning, speed]);

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

      const nextStars = [...prev.stars, newStar];

      // update calibration and rebuild orbit state (simple + reliable)
      orbitCalibRef.current.minR0 = computeMinR(nextStars, sun);
      orbitRef.current = buildOrbitState(nextStars, orbitCalibRef.current.minR0);

      return { stars: nextStars, links: updatedLinks };
    });
  };

  const handleReset = () => {
    const g = layoutInitialOnOrbits(generateInitialGraph());
    setGraph(g);
    setSelectedStarId(null);

    const sun = getSun(g.stars);
    orbitCalibRef.current.minR0 = sun ? computeMinR(g.stars, sun) : 200;
    orbitRef.current = buildOrbitState(g.stars, orbitCalibRef.current.minR0);
  };

  const handleStarMove = (id: string, x: number, y: number) => {
    setGraph((prev) => {
      const next: GraphState = {
        ...prev,
        stars: prev.stars.map((s) => (s.id === id ? { ...s, x, y } : s))
      };

      const sun = getSun(next.stars);
      if (sun && id !== SUN_ID) {
        const r = dist({ x, y }, { x: sun.x, y: sun.y });
        const th = Math.atan2(y - sun.y, x - sun.x);

        orbitRef.current.radius.set(id, r);
        orbitRef.current.theta.set(id, th);

        // key fix: use fixed minR0 (doesn't change when "closest" changes)
        const minR0 = orbitCalibRef.current.minR0;
        orbitRef.current.omega.set(id, omegaForRadius(r, minR0));
      }

      return next;
    });
  };

  const handleMassChange = (mass: number) => {
    if (!selectedStarId) return;
    setGraph((prev) => ({
      ...prev,
      stars: prev.stars.map((s) => (s.id === selectedStarId ? { ...s, mass } : s))
    }));
  };

  // ---------- UI styles (make text white) ----------
  const whiteTextFieldSx = {
    width: 180,
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.85)' },
    '& .MuiInputLabel-root.Mui-focused': { color: '#fff' },
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.65)' },
      '&.Mui-focused fieldset': { borderColor: '#fff' }
    }
  };

  const whiteSliderSx = {
    color: '#fff',
    '& .MuiSlider-markLabel': { color: '#fff' },
    '& .MuiSlider-valueLabel': { color: '#111' }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#0B0D17', position: 'relative' }}>
      {selectedStar && (
        <Paper
          sx={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            bgcolor: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
            p: 2,
            minWidth: 420
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>
                {selectedStar.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, color: '#fff' }}>
                id: {selectedStar.id}
              </Typography>
            </Box>

            <IconButton onClick={() => setSelectedStarId(null)} sx={{ color: '#fff' }}>
              <CloseIcon />
            </IconButton>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
            <TextField
              label="Масса"
              value={selectedStar.mass}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) handleMassChange(v);
              }}
              size="small"
              variant="outlined"
              sx={whiteTextFieldSx}
            />
            <Typography variant="body2" sx={{ opacity: 0.9, color: '#fff' }}>
              x={selectedStar.x.toFixed(1)} y={selectedStar.y.toFixed(1)}
            </Typography>
          </Stack>
        </Paper>
      )}

      {/* Scene */}
      <Box sx={{ flexGrow: 1, width: 'calc(100vw - 380px)', height: '100vh' }}>
        <StarScene
          stars={graph.stars}
          links={graph.links}
          showEdges={showEdges}
          showOrbits={showOrbits}
          sunId={SUN_ID}
          controlsEnabled={controlsEnabled}
          onDragStart={() => {
            setControlsEnabled(false);
            isDraggingRef.current = true;
          }}
          onDragEnd={() => {
            setControlsEnabled(true);
            isDraggingRef.current = false;
          }}
          onStarMove={handleStarMove}
          onStarSelect={(id) => setSelectedStarId(id)}
          selectedStarId={selectedStarId}
        />
      </Box>

      {/* Panel */}
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
            color: '#fff',
            p: 3,
            boxSizing: 'border-box',
            overflowY: 'auto',

            // make all text white by default
            '& .MuiTypography-root': { color: '#fff' },
            '& .MuiFormControlLabel-label': { color: '#fff' },
            '& .MuiSvgIcon-root': { color: '#fff' }
          }
        }}
      >
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 700, color: '#fff' }}>
          Звёздная Система
        </Typography>

        <Stack spacing={3}>
          <Paper sx={{ bgcolor: 'rgba(255, 255, 255, 0.05)', p: 2, borderRadius: 2 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Звёзд: {graph.stars.length}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Связей: {graph.links.length}
              </Typography>
            </Stack>
          </Paper>

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
              <FormControlLabel
                control={<Switch checked={isSimRunning} onChange={(e) => setIsSimRunning(e.target.checked)} />}
                label="Симуляция (орбиты)"
              />
            </Stack>
          </Paper>

          <Paper sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ opacity: 0.9, mb: 1 }}>
              Скорость симуляции
            </Typography>

            <Slider
              sx={whiteSliderSx}
              value={sliderValue}
              onChange={(_, v) => setSpeed(Math.pow(10, v as number))}
              min={Math.log10(0.1)}
              max={Math.log10(20)}
              step={0.05}
              marks={[
                { value: Math.log10(0.1), label: '0.1x' },
                { value: Math.log10(0.5), label: '0.5x' },
                { value: Math.log10(1), label: '1x' },
                { value: Math.log10(2), label: '2x' },
                { value: Math.log10(5), label: '5x' },
                { value: Math.log10(10), label: '10x' },
                { value: Math.log10(20), label: '20x' }
              ]}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${Math.pow(10, v as number).toFixed(1)}x`}
            />

            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              {speed < 1 ? `Замедление: ${speed.toFixed(1)}x` : `Ускорение: ${speed.toFixed(0)}x`}
            </Typography>
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
            Добавить планету
          </Button>

          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleReset}
            fullWidth
            sx={{
              color: '#fff',
              borderColor: 'rgba(255, 255, 255, 0.3)',
              py: 1.5,
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              '&:hover': { borderColor: 'rgba(255, 255, 255, 0.7)' }
            }}
          >
            Сбросить систему
          </Button>
        </Stack>
      </Drawer>
    </Box>
  );
}
