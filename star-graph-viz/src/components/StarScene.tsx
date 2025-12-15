import { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars as BgStars, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Star, GraphLink } from '../models/Star';

function distance2D(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function OrbitCircle({
  center,
  radius
}: {
  center: { x: number; y: number; z?: number };
  radius: number;
}) {
  const points = useMemo(() => {
    const segments = 128;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      pts.push([
        center.x + Math.cos(t) * radius,
        center.y + Math.sin(t) * radius,
        center.z ?? 0
      ]);
    }
    return pts;
  }, [center.x, center.y, center.z, radius]);

  return <Line points={points} color="#ffffff" transparent opacity={0.22} lineWidth={1} />;
}

function EdgeLine({
  a,
  b
}: {
  a: { x: number; y: number; z?: number };
  b: { x: number; y: number; z?: number };
}) {
  const points = useMemo(
    () =>
      [
        [a.x, a.y, a.z ?? 0],
        [b.x, b.y, b.z ?? 0]
      ] as [number, number, number][],
    [a.x, a.y, a.z, b.x, b.y, b.z]
  );

  return <Line points={points} color="#6b7280" transparent opacity={0.55} lineWidth={1} />;
}

function SystemGroup({ children }: { children: React.ReactNode }) {
  return <group rotation={[-Math.PI / 4.2, 0, 0]}>{children}</group>;
}

// Drag по локальной плоскости z=0 (в координатах SystemGroup)
function DraggableStar({
  star,
  selected,
  onMove,
  onDragStart,
  onDragEnd,
  onSelect
}: {
  star: Star;
  selected: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onSelect: (id: string) => void;
}) {
  const radius = Math.max(2, star.mass / 10);
  const color = star.color ?? '#ffffff';

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(radius, 48, 48), [radius]);
  const wireGeo = useMemo(() => new THREE.WireframeGeometry(sphereGeo), [sphereGeo]);

  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const dragPoint = useMemo(() => new THREE.Vector3(), []);
  const draggingRef = useRef(false);

  return (
    <group position={[star.x, star.y, 0]}>
      <mesh
        geometry={sphereGeo}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect(star.id);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          draggingRef.current = true;
          (e.target as any).setPointerCapture?.(e.pointerId);
          onDragStart();
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          draggingRef.current = false;
          (e.target as any).releasePointerCapture?.(e.pointerId);
          onDragEnd();
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          e.stopPropagation();
          if (e.ray.intersectPlane(dragPlane, dragPoint)) {
            onMove(star.id, dragPoint.x, dragPoint.y);
          }
        }}
      >
        <meshStandardMaterial
          color={color}
          roughness={0.25}
          metalness={0.05}
          emissive={selected ? '#ffffff' : color}
          emissiveIntensity={selected ? 0.35 : 0.15}
        />
      </mesh>

      <lineSegments geometry={wireGeo}>
        <lineBasicMaterial color="#ffffff" transparent opacity={selected ? 0.45 : 0.25} />
      </lineSegments>

      {/* Название */}
      <Html position={[0, radius + 10, 0]} center distanceFactor={12}>
        <div
          style={{
            color: 'white',
            fontSize: '14px',
            fontWeight: 700,
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
        >
          {star.name}
        </div>
      </Html>
    </group>
  );
}

export default function StarScene({
  stars,
  links,
  showEdges,
  showOrbits,
  sunId = '1',
  controlsEnabled,
  onDragStart,
  onDragEnd,
  onStarMove,
  onStarSelect,
  selectedStarId
}: {
  stars: Star[];
  links: GraphLink[];
  showEdges: boolean;
  showOrbits: boolean;
  sunId?: string;
  controlsEnabled: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onStarMove: (id: string, x: number, y: number) => void;
  onStarSelect: (id: string | null) => void;
  selectedStarId: string | null;
}) {
  const sun = stars.find((s) => s.id === sunId);

  return (
    <Canvas
      shadows
      camera={{ position: [260, 140, 420], fov: 50, near: 0.1, far: 5000 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={() => onStarSelect(null)}
    >
      <BgStars radius={2000} depth={60} count={4000} factor={2} fade speed={0.5} />

      <ambientLight intensity={0.25} />
      <directionalLight
        position={[-300, 300, 200]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[300, -100, 200]} intensity={0.6} />
      <directionalLight position={[0, 100, -400]} intensity={0.5} color={'#88aaff'} />

      <OrbitControls
        makeDefault
        enabled={controlsEnabled}
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
        zoomSpeed={0.9}
        panSpeed={0.6}
        maxDistance={1400}
        minDistance={120}
      />

      <SystemGroup>
        {/* Орбиты */}
        {showOrbits && sun &&
          stars
            .filter((s) => s.id !== sun.id)
            .map((s) => {
              const r = distance2D({ x: s.x, y: s.y }, { x: sun.x, y: sun.y });
              return (
                <OrbitCircle
                  key={`orbit-${s.id}`}
                  center={{ x: sun.x, y: sun.y, z: 0 }}
                  radius={Math.max(8, r)}
                />
              );
            })}

        {/* Рёбра */}
        {showEdges &&
          links.map((e, idx) => {
            const a = stars.find((n) => n.id === e.source);
            const b = stars.find((n) => n.id === e.target);
            if (!a || !b) return null;
            return <EdgeLine key={`edge-${idx}`} a={{ x: a.x, y: a.y }} b={{ x: b.x, y: b.y }} />;
          })}

        {/* Звёзды */}
        {stars.map((s) => (
          <DraggableStar
            key={s.id}
            star={s}
            selected={selectedStarId === s.id}
            onMove={onStarMove}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onSelect={(id) => onStarSelect(id)}
          />
        ))}
      </SystemGroup>
    </Canvas>
  );
}
