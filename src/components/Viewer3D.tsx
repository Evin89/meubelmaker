import { Edges, OrbitControls } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { mm, woodHsl } from '../lib/format'
import { boundingBox, cutDims, worldParts } from '../lib/parts'
import type { Project, WorldPart } from '../lib/types'

const S = 0.001 // 1 eenheid = 1 meter

const texCache = new Map<number, THREE.CanvasTexture>()
function grainTexture(t: number) {
  const hit = texCache.get(t)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')!
  const [h, s, l] = woodHsl(t)
  g.fillStyle = `hsl(${h} ${s}% ${l}%)`
  g.fillRect(0, 0, 512, 128)
  let r = t * 97 + 13
  const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280
  for (let i = 0; i < 60; i++) {
    const y = rnd() * 128
    g.strokeStyle = `rgba(100,62,25,${0.03 + rnd() * 0.06})`
    g.lineWidth = 0.5 + rnd() * 2
    g.beginPath()
    g.moveTo(0, y)
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 3 * rnd())
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  texCache.set(t, tex)
  return tex
}

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/** Leest de themakleuren en werkt ze bij als het systeem van licht naar donker gaat. */
function useThemeColors() {
  const read = () => ({ scene: cssVar('--scene'), floor: cssVar('--floor'), grid: cssVar('--gridline'), accent: cssVar('--accent') })
  const [c, setC] = useState(read)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setC(read())
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return c
}

function PartMesh({
  part,
  offset,
  selected,
  edges,
  accent,
  onPick,
}: {
  part: WorldPart
  offset: [number, number, number]
  selected: boolean
  edges: boolean
  accent: string
  onPick: (p: WorldPart) => void
}) {
  const pos: [number, number, number] = [
    (part.x + part.sx / 2 + offset[0]) * S,
    (part.y + part.sy / 2 + offset[1]) * S,
    (part.z + part.sz / 2 + offset[2]) * S,
  ]
  return (
    <mesh
      position={pos}
      castShadow
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 4) return
        e.stopPropagation()
        onPick(part)
      }}
    >
      <boxGeometry args={[part.sx * S, part.sy * S, part.sz * S]} />
      <meshStandardMaterial map={grainTexture(part.t)} roughness={0.75} emissive={selected ? accent : '#000000'} emissiveIntensity={selected ? 0.18 : 0} />
      {edges && <Edges threshold={20} color="#3a2a18" transparent opacity={0.45} />}
    </mesh>
  )
}

function CameraFit({ project, fitKey }: { project: Project; fitKey: number }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null }
  useEffect(() => {
    const b = boundingBox(project.items)
    const c = b ? b.lo.map((v, i) => ((v + b.hi[i]) / 2) * S) : [0, 0.2, 0]
    const size = b ? Math.max(...b.hi.map((v, i) => v - b.lo[i])) * S : 0.6
    const d = Math.max(0.6, size * 2.4)
    camera.position.set(c[0] + d * 0.75, c[1] + d * 0.55, c[2] + d * 0.95)
    controls?.target.set(c[0], c[1], c[2])
    controls?.update()
    // alleen opnieuw passend maken op verzoek of bij een ander project
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, project.id, controls])
  return null
}

export function Viewer3D({
  project,
  selectedId,
  onSelect,
  explode,
  edges,
  fitKey,
}: {
  project: Project
  selectedId: string | null
  onSelect: (id: string | null) => void
  explode: number
  edges: boolean
  fitKey: number
}) {
  const colors = useThemeColors()
  const [pick, setPick] = useState<WorldPart | null>(null)

  const meshes = useMemo(
    () =>
      project.items.flatMap((it) => {
        const w = worldParts(it)
        const c = [it.x + w.fx / 2, it.y + w.fy / 2, it.z + w.fz / 2]
        return w.parts.map((q, i) => {
          const pc = [q.x + q.sx / 2, q.y + q.sy / 2, q.z + q.sz / 2]
          const off: [number, number, number] = explode
            ? [(pc[0] - c[0]) * explode * 0.8, (pc[1] - c[1]) * explode * 0.8 + it.y * explode * 0.5, (pc[2] - c[2]) * explode * 0.8]
            : [0, 0, 0]
          return { key: `${it.id}-${i}`, part: q, off }
        })
      }),
    [project.items, explode],
  )

  const b = boundingBox(project.items)
  const r = b ? Math.max(1, Math.max(...b.hi.map((v, i) => v - b.lo[i])) * S * 1.5) : 1
  const center = b ? b.lo.map((v, i) => ((v + b.hi[i]) / 2) * S) : [0, 0, 0]

  return (
    <div className="relative h-[min(68vh,640px)] min-h-[340px] overflow-hidden rounded-t-md bg-scene" style={{ touchAction: 'none' }}>
      <Canvas shadows camera={{ fov: 35, near: 0.01, far: 200, position: [1.6, 1.2, 2] }} onPointerMissed={() => setPick(null)}>
        <color attach="background" args={[colors.scene]} />
        <hemisphereLight args={['#ffffff', '#8a8070', 0.9]} />
        <directionalLight
          castShadow
          intensity={1.6}
          position={[center[0] + r * 1.2, r * 3, center[2] + r * 1.5]}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-left={-r}
          shadow-camera-right={r}
          shadow-camera-top={r}
          shadow-camera-bottom={-r}
          shadow-camera-far={r * 8}
        />
        <mesh rotation-x={-Math.PI / 2} position-y={-0.0005} receiveShadow>
          <planeGeometry args={[60, 60]} />
          <meshStandardMaterial color={colors.floor} roughness={1} />
        </mesh>
        <gridHelper args={[20, 200, colors.grid, colors.grid]} />
        {meshes.map((m) => (
          <PartMesh
            key={m.key}
            part={m.part}
            offset={m.off}
            selected={m.part.itemId === selectedId}
            edges={edges}
            accent={colors.accent}
            onPick={(p) => {
              setPick(p)
              onSelect(p.itemId)
            }}
          />
        ))}
        <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI * 0.495} />
        <CameraFit project={project} fitKey={fitKey} />
      </Canvas>
      {pick && (
        <div className="pointer-events-none absolute top-2.5 left-2.5 max-w-[calc(100%-20px)] rounded border border-rule bg-sheet px-2.5 py-1.5 text-[0.8rem]">
          <b className="block font-display">
            {pick.itemName} · {pick.name}
          </b>
          <span className="font-mono text-[0.75rem] font-semibold text-accent">
            {cutDims(pick).map(mm).join(' × ')} × {mm(pick.t)} mm
          </span>
        </div>
      )}
      <div className="pointer-events-none absolute right-2.5 bottom-2 text-[0.72rem] text-muted">
        slepen = draaien · rechts slepen = schuiven · scrollen = zoomen · tik = selecteren
      </div>
    </div>
  )
}
