import { Edges, Line, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { mm, woodHsl } from '../lib/format'
import { dragTarget, type DragMode } from '../lib/snap'
import { boundingBox, cutDims, worldParts } from '../lib/parts'
import type { Project, WorldPart } from '../lib/types'

const S = 0.001 // 1 eenheid = 1 meter

export type ViewPreset = 'iso' | 'voor' | 'zij' | 'boven'
const VIEW_DIR: Record<ViewPreset, [number, number, number]> = {
  iso: [0.75, 0.55, 0.95],
  voor: [0, 0, 1],
  zij: [1, 0, 0],
  boven: [0, 1, 0.0001],
}

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
  drag,
  openRef,
}: {
  part: WorldPart
  offset: [number, number, number]
  selected: boolean
  edges: boolean
  accent: string
  onPick: (p: WorldPart) => void
  drag?: DragHandlers
  /** 0 = lades dicht, 1 = open (geanimeerd) */
  openRef: React.RefObject<number>
}) {
  const pos: [number, number, number] = [
    (part.x + part.sx / 2 + offset[0]) * S,
    (part.y + part.sy / 2 + offset[1]) * S,
    (part.z + part.sz / 2 + offset[2]) * S,
  ]
  const meshRef = useRef<THREE.Mesh>(null)
  const slide = part.slide
  useFrame(() => {
    if (!slide || !meshRef.current) return
    const k = openRef.current ?? 0
    meshRef.current.position.set(pos[0] + slide[0] * k * S, pos[1], pos[2] + slide[1] * k * S)
  })
  return (
    <mesh
      ref={meshRef}
      position={pos}
      castShadow
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 4) return
        e.stopPropagation()
        onPick(part)
      }}
      onPointerDown={drag && ((e) => drag.down(part, e))}
      onPointerMove={drag?.move}
      onPointerUp={drag?.up}
      onPointerOver={drag && (() => selected && drag.hover(true))}
      onPointerOut={drag && (() => drag.hover(false))}
    >
      <boxGeometry args={[part.sx * S, part.sy * S, part.sz * S]} />
      <meshStandardMaterial map={grainTexture(part.t)} roughness={0.75} emissive={selected ? accent : '#000000'} emissiveIntensity={selected ? 0.18 : 0} />
      {edges && <Edges threshold={20} color="#3a2a18" transparent opacity={0.45} />}
    </mesh>
  )
}

/** Laat de lades soepel open- en dichtschuiven. */
function DrawerAnimator({ open, onStep }: { open: boolean; onStep: (v: number) => void }) {
  const cur = useRef(open ? 1 : 0)
  useFrame((_, dt) => {
    const target = open ? 1 : 0
    if (cur.current === target) return
    const next = cur.current + (target - cur.current) * Math.min(1, dt * 5)
    cur.current = Math.abs(next - target) < 0.002 ? target : next
    onStep(cur.current)
  })
  return null
}

type DragHandlers = {
  down: (part: WorldPart, e: ThreeEvent<PointerEvent>) => void
  move: (e: ThreeEvent<PointerEvent>) => void
  up: (e: ThreeEvent<PointerEvent>) => void
  hover: (on: boolean) => void
}

type DragState = {
  id: string
  start: { x: number; y: number; z: number }
  plane: THREE.Plane
  origin: THREE.Vector3
  client: [number, number]
  mode: DragMode
  active: boolean
  last: string
  session: number
}

type Box = { lo: [number, number, number]; hi: [number, number, number] }

type DimLine = { from: THREE.Vector3; to: THREE.Vector3; ext: [THREE.Vector3, THREE.Vector3][]; label: string }

/** Maatlijnen langs breedte, diepte en hoogte van een kader. */
function dimLines(box: Box): DimLine[] {
  const [x0, y0, z0] = box.lo
  const [x1, y1, z1] = box.hi
  const size = Math.max(x1 - x0, y1 - y0, z1 - z0)
  const o = Math.max(25, size * 0.07)
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x * S, y * S, z * S)
  return [
    {
      from: v(x0, y0, z1 + o),
      to: v(x1, y0, z1 + o),
      ext: [
        [v(x0, y0, z1), v(x0, y0, z1 + o * 1.25)],
        [v(x1, y0, z1), v(x1, y0, z1 + o * 1.25)],
      ],
      label: mm(x1 - x0),
    },
    {
      from: v(x1 + o, y0, z0),
      to: v(x1 + o, y0, z1),
      ext: [
        [v(x1, y0, z0), v(x1 + o * 1.25, y0, z0)],
        [v(x1, y0, z1), v(x1 + o * 1.25, y0, z1)],
      ],
      label: mm(z1 - z0),
    },
    {
      from: v(x1 + o, y0, z1 + o),
      to: v(x1 + o, y1, z1 + o),
      ext: [[v(x1, y1, z1), v(x1 + o * 1.25, y1, z1 + o * 1.25)]],
      label: mm(y1 - y0),
    },
  ]
}

function DimensionLines({ lines, color }: { lines: DimLine[]; color: string }) {
  return (
    <group>
      {lines.map((l, i) => (
        <group key={i}>
          <Line points={[l.from, l.to]} color={color} lineWidth={1.6} depthTest={false} renderOrder={10} />
          {l.ext.map((e, j) => (
            <Line key={j} points={e} color={color} lineWidth={1} transparent opacity={0.6} depthTest={false} renderOrder={10} />
          ))}
        </group>
      ))}
    </group>
  )
}

/** Plaatst HTML-labels elk frame op de schermpositie van een 3D-punt. */
function LabelProjector({ points, refs }: { points: THREE.Vector3[]; refs: React.RefObject<(HTMLSpanElement | null)[]> }) {
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    points.forEach((p, i) => {
      const el = refs.current?.[i]
      if (!el) return
      tmp.copy(p).project(camera)
      const hidden = tmp.z > 1
      el.style.display = hidden ? 'none' : 'block'
      el.style.transform = `translate(${((tmp.x + 1) / 2) * size.width}px, ${((1 - tmp.y) / 2) * size.height}px) translate(-50%, -50%)`
    })
  })
  return null
}

function CameraFit({ box, fitKey, view, projectId }: { box: Box | null; fitKey: number; view: ViewPreset; projectId: string }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null }
  useEffect(() => {
    const c = box ? box.lo.map((v, i) => ((v + box.hi[i]) / 2) * S) : [0, 0.2, 0]
    const size = box ? Math.max(...box.hi.map((v, i) => v - box.lo[i])) * S : 0.6
    const d = Math.max(0.6, size * (view === 'iso' ? 2.4 : 2.9))
    const [dx, dy, dz] = VIEW_DIR[view]
    const len = Math.hypot(dx, dy, dz)
    camera.position.set(c[0] + (dx / len) * d, c[1] + (dy / len) * d, c[2] + (dz / len) * d)
    controls?.target.set(c[0], c[1], c[2])
    controls?.update()
    // alleen opnieuw passend maken op verzoek, bij een ander aanzicht of een ander project
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, view, controls, projectId])
  return null
}

export function Viewer3D({
  project,
  selectedId,
  onSelect,
  explode,
  edges,
  dims,
  view,
  fitKey,
  onMove,
  drawersOpen = false,
}: {
  project: Project
  selectedId: string | null
  onSelect: (id: string | null) => void
  explode: number
  edges: boolean
  dims: boolean
  view: ViewPreset
  fitKey: number
  /** Lades open tonen */
  drawersOpen?: boolean
  /** Nieuwe positie (mm) tijdens slepen van een geselecteerde bouwsteen. */
  onMove?: (id: string, pos: { x: number; y: number; z: number }, session: number) => void
}) {
  const colors = useThemeColors()
  const [pick, setPick] = useState<WorldPart | null>(null)
  const visible = useMemo(() => project.items.filter((i) => !i.hidden), [project.items])

  const meshes = useMemo(
    () =>
      visible.flatMap((it) => {
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
    [visible, explode],
  )

  const all = boundingBox(visible)
  const selItem = visible.find((i) => i.id === selectedId)
  const dimBox = dims && explode === 0 ? (selItem ? boundingBox([selItem]) : all) : null
  const lines = dimBox ? dimLines(dimBox) : []
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
  const r = all ? Math.max(1, Math.max(...all.hi.map((v, i) => v - all.lo[i])) * S * 1.5) : 1
  const center = all ? all.lo.map((v, i) => ((v + all.hi[i]) / 2) * S) : [0, 0, 0]

  // Slepen: alleen de geselecteerde bouwsteen, en niet als hij uit elkaar is geschoven.
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const openRef = useRef(drawersOpen ? 1 : 0)
  const dragRef = useRef<DragState | null>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const setCursor = (c: string) => {
    document.body.style.cursor = c
  }
  const drag: DragHandlers | undefined =
    onMove && explode === 0
      ? {
          down(part, e) {
            if (e.button !== 0 || part.itemId !== selectedId) return
            const it = visible.find((i) => i.id === part.itemId)
            if (!it) return
            e.stopPropagation()
            const mode: DragMode = e.shiftKey ? 'hoogte' : 'vlak'
            const plane = new THREE.Plane()
            if (mode === 'vlak') plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), e.point)
            else {
              const n = new THREE.Vector3()
              e.camera.getWorldDirection(n)
              n.y = 0
              if (n.lengthSq() < 1e-6) n.set(0, 0, 1)
              plane.setFromNormalAndCoplanarPoint(n.normalize(), e.point)
            }
            dragRef.current = { id: it.id, start: { x: it.x, y: it.y, z: it.z }, plane, origin: e.point.clone(), client: [e.clientX, e.clientY], mode, active: false, last: '', session: Date.now() }
            ;(e.target as unknown as Element).setPointerCapture(e.pointerId)
            if (controlsRef.current) controlsRef.current.enabled = false
          },
          move(e) {
            const d = dragRef.current
            if (!d) return
            if (!d.active && Math.hypot(e.clientX - d.client[0], e.clientY - d.client[1]) < 4) return
            d.active = true
            setCursor('grabbing')
            if (!e.ray.intersectPlane(d.plane, tmp)) return
            const delta = { x: (tmp.x - d.origin.x) / S, y: (tmp.y - d.origin.y) / S, z: (tmp.z - d.origin.z) / S }
            const pos = dragTarget(d.start, delta, e.altKey ? 1 : 10, d.mode)
            const key = `${pos.x}|${pos.y}|${pos.z}`
            if (key !== d.last) {
              d.last = key
              onMove(d.id, pos, d.session)
            }
          },
          up(e) {
            if (!dragRef.current) return
            ;(e.target as unknown as Element).releasePointerCapture?.(e.pointerId)
            dragRef.current = null
            if (controlsRef.current) controlsRef.current.enabled = true
            setCursor('')
          },
          hover(on) {
            if (!dragRef.current) setCursor(on ? 'grab' : '')
          },
        }
      : undefined

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
            drag={drag}
            openRef={openRef}
          />
        ))}
        <DimensionLines lines={lines} color={colors.accent} />
        <LabelProjector points={lines.map((l) => l.from.clone().lerp(l.to, 0.5))} refs={labelRefs} />
        <DrawerAnimator
          open={drawersOpen}
          onStep={(v) => {
            openRef.current = v
          }}
        />
        <OrbitControls ref={controlsRef} makeDefault enableDamping maxPolarAngle={Math.PI / 2} />
        <CameraFit box={all} fitKey={fitKey} view={view} projectId={project.id} />
      </Canvas>
      {lines.map((l, i) => (
        <span
          key={i}
          ref={(el) => {
            labelRefs.current[i] = el
          }}
          className="pointer-events-none absolute top-0 left-0 rounded-sm border border-accent bg-sheet px-1 font-mono text-[11px] font-bold whitespace-nowrap text-accent"
          style={{ display: 'none' }}
        >
          {l.label}
        </span>
      ))}
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
      {project.items.length > 0 && !visible.length && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center text-muted">Alle bouwstenen zijn verborgen. Zet ze aan met het oogje in de lijst.</p>
      )}
    </div>
  )
}
