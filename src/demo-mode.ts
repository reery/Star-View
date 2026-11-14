import { Vector3 } from 'three'
import { LIGHT_YEARS_PER_PARSEC } from './astronomy'
import type { Star } from './catalog-model'

export interface DemoPose { position: Vector3; target: Vector3 }
/** A camera pose, and the point brightness is rated from while the camera flies as an imaginary ship; null rates from the selection. */
export interface DemoFrame extends DemoPose { observer: Vector3 | null }

export interface DemoHost {
  /** Objects visible on the map. */
  objects(): readonly Star[]
  /** Current world position, following simulated motion. */
  position(id: string): Vector3 | null
  view(): { position: ArrayLike<number>; target: ArrayLike<number> }
  selectedId(): string | null
  select(id: string): void
}

type MoveKind = 'glide' | 'cruise' | 'voyage' | 'journey' | 'orbit' | 'reveal' | 'flyby' | 'pass' | 'gaze'
const TRAVEL_MOVES = ['glide', 'cruise'] as const
const LOCAL_MOVES = ['orbit', 'reveal', 'flyby', 'pass', 'gaze'] as const

interface Move {
  seconds: number
  /** Move seconds per demo second. */
  pace?: number
  pose(t: number, out: DemoPose): void
  /** Selects the destination this many seconds in. */
  select?: { id: string; at: number }
  /** Rates brightness from the camera, as an imaginary ship, rather than from the selection. */
  ship?: boolean
}

/** Each move eases in from where the previous one, or a drag, left the camera. */
const BLEND_S = 4
/** It starts at the speed the camera had, which fades over about this time while the move takes over, so it never halts. */
const MOMENTUM_S = 2.5
/** Flights keep up to this share of their average speed at both ends instead of coming to rest; short hops fly almost evenly. */
const CRUISING = 0.8
/**
 * At their ends flights move about as fast as local moves, in framing distances per second, so a long, fast
 * flight slows seamlessly into the calm move after it.
 */
const LOCAL_SPEED = 0.15
/** Each move runs a little faster or slower than the speed setting, within this calm range. */
const PACE_RANGE = [0.8, 1.2] as const
/** OrbitControls keeps the camera at least 0.08 pc from its target. */
const MIN_LOOK_PC = 0.12
/** Destinations are drawn from the nearest unvisited objects, so hops stay short until the area is explored. */
const CANDIDATES = 6
/** Now and then a hop goes a bit farther, to one of these nearest beyond the closest dozen; ranks scale with how crowded the area is. */
const DISTANT_RANKS = [12, 48] as const
const DISTANT_CHANCE = 0.2
/** After this many hops in one area, such as a cluster, the next leaves for the nearest object well outside it. */
const AREA_HOPS = [5, 8] as const
/** Well outside: beyond this many times the area's radius from its center, and at least this far. */
const AREA_ESCAPE = 3
const AREA_MIN_ESCAPE_PC = 3
/** Now and then a travel pulls far back, until the Milky Way fades in from 3,000 ly, then dives into an object elsewhere. */
const VOYAGE_CHANCE = 0.07
/** About 6,000 to 15,000 ly back: its puffs show, and the disk a little. */
const VOYAGE_DISTANCE_PC = [1_800, 4_600] as const
/** The far view looks down on the Galactic plane from this elevation. */
const VOYAGE_ELEVATION = 0.5
/** About one travel in five is a journey: 30 to 300 ly straight on, turning gently now and then, with no destination. */
const JOURNEY_CHANCE = 0.2
const JOURNEY_LY = [30, 300] as const
/** Seconds over which brightness ratings move between the selection and the camera as an imaginary ship. */
const SHIP_VIEW_S = 4
/**
 * Up stays the map's up, so a view near straight up or down spins its heading and seems to roll. The view tilts
 * freely up to the knee, then flattens out softly before the limit; ship orbits stay within the tilt of level.
 */
const PITCH_KNEE = 0.6
const PITCH_LIMIT = 1
const ORBIT_TILT = 0.5
const UP = new Vector3(0, 1, 0)

const smooth = (u: number) => u * u * (3 - 2 * u)
const easeInOut = (u: number) => u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
/** The share of a flight's average speed it keeps at its ends: a local move's speed, within the cruising share. */
const cruisingShare = (framing: number, seconds: number, distance: number) => clamp(LOCAL_SPEED * framing * seconds / Math.max(distance, 1e-9), 0, CRUISING)
const travelEase = (u: number, cruising: number) => (1 - cruising) * easeInOut(u) + cruising * u
/** Eases a turn without stopping at its ends. */
const turnEase = (u: number) => (smooth(u) + u) / 2

function perpendicular(v: Vector3, out = new Vector3()): Vector3 {
  out.crossVectors(v, UP)
  if (out.lengthSq() < 1e-12) out.set(1, 0, 0)
  return out.normalize()
}

const lookVector = new Vector3()
/** Softly limits how steeply the view looks up or down, keeping its heading or, looking straight along up, the given one. */
function limitPitch(pose: DemoPose, heading: Vector3): void {
  lookVector.subVectors(pose.target, pose.position)
  const length = lookVector.length()
  const level = Math.hypot(lookVector.x, lookVector.z)
  const pitch = Math.atan2(lookVector.y, level)
  if (Math.abs(pitch) <= PITCH_KNEE) return
  const span = PITCH_LIMIT - PITCH_KNEE
  const limited = Math.sign(pitch) * (PITCH_KNEE + span * Math.tanh((Math.abs(pitch) - PITCH_KNEE) / span))
  if (level < 1e-9 * length) lookVector.set(heading.x, 0, heading.z)
  let horizontal = Math.hypot(lookVector.x, lookVector.z)
  if (horizontal < 1e-12) [lookVector.x, lookVector.z, horizontal] = [0, -1, 1]
  const scale = Math.cos(limited) * length / horizontal
  pose.target.set(pose.position.x + lookVector.x * scale, pose.position.y + Math.sin(limited) * length, pose.position.z + lookVector.z * scale)
}

/** Extended objects are framed from farther away. */
function extentPc(star: Star): number {
  if (star.nebula) return Math.max(...star.nebula.shape.semi_axes_pc)
  if (star.molecular_cloud) return star.molecular_cloud.equivalent_radius_pc
  if (star.bubble) return star.bubble.average_radius_pc
  return 0
}

/** Picks random camera moves: travels between nearby objects and local moves around each of them. */
export function createDemoTour(host: DemoHost, random = Math.random) {
  const visited = new Set<string>()
  const start: DemoPose = { position: new Vector3(), target: new Vector3() }
  const pose: DemoPose = { position: new Vector3(), target: new Vector3() }
  const output: DemoFrame = { position: new Vector3(), target: new Vector3(), observer: null }
  const observer = new Vector3()
  /** How far brightness ratings have moved from the selection to the camera. */
  let shipView = 0
  const previous: DemoPose = { position: new Vector3(), target: new Vector3() }
  /** In demo seconds: the camera's speed over the last frame, and at the start of the current move. */
  const velocity: DemoPose = { position: new Vector3(), target: new Vector3() }
  const startVelocity: DemoPose = { position: new Vector3(), target: new Vector3() }
  const coasting: DemoPose = { position: new Vector3(), target: new Vector3() }
  let tracked = false
  let move: Move | null = null
  let time = 0
  let idle = Infinity
  let lastKind: MoveKind | null = null
  let localMoves = 0
  let localTarget = 1
  /** Destinations since the tour last moved on to a new area. */
  const area: Vector3[] = []
  let areaHops = AREA_HOPS[0]
  const heading = new Vector3(0, 0, -1)
  let lastTravel: MoveKind | null = null

  const sign = () => random() < 0.5 ? -1 : 1
  /** Turns a local move the way the camera already goes, so the handover flows; random when it barely moves. */
  const along = (direction: Vector3, moving: Vector3) => {
    const share = direction.dot(moving)
    return Math.abs(share) > 1e-3 * moving.length() + 1e-9 ? Math.sign(share) : sign()
  }
  const randomUnit = () => new Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize()
  const framingPc = (star: Star) => Math.max(extentPc(star) * 3, 0.4 + random() * 1.2)
  const pick = <T extends MoveKind>(kinds: readonly T[]) => {
    const options = kinds.filter((kind) => kind !== lastKind)
    return options[Math.floor(random() * options.length)]!
  }

  /**
   * One of the nearest unvisited objects, closer ones and those ahead more likely, or now and then one a bit
   * farther away; all visited starts over.
   */
  function destination(objects: readonly Star[], from: Vector3, forward: Vector3, currentId: string | null, avoid?: { center: Vector3; radius: number }): Star | null {
    const nearest: { star: Star; distanceSq: number; ahead: boolean }[] = []
    for (const star of objects) {
      if (star.id === currentId || visited.has(star.id)) continue
      // World axes are Galactic x, z and -y.
      if (avoid && Math.hypot(star.x_pc - avoid.center.x, star.z_pc - avoid.center.y, -star.y_pc - avoid.center.z) < avoid.radius) continue
      const dx = star.x_pc - from.x, dy = star.z_pc - from.y, dz = -star.y_pc - from.z
      const distanceSq = dx * dx + dy * dy + dz * dz
      const kept = DISTANT_RANKS[1]
      if (nearest.length === kept && distanceSq >= nearest[kept - 1]!.distanceSq) continue
      const index = nearest.findIndex((candidate) => candidate.distanceSq > distanceSq)
      nearest.splice(index < 0 ? nearest.length : index, 0, { star, distanceSq, ahead: dx * forward.x + dy * forward.y + dz * forward.z > 0 })
      nearest.length = Math.min(nearest.length, kept)
    }
    if (!nearest.length) {
      if (!visited.size) return null
      visited.clear()
      return destination(objects, from, forward, currentId, avoid)
    }
    if (nearest.length > DISTANT_RANKS[0] && random() < DISTANT_CHANCE) {
      return nearest[DISTANT_RANKS[0] + Math.floor(random() * (nearest.length - DISTANT_RANKS[0]))]!.star
    }
    nearest.length = Math.min(nearest.length, CANDIDATES)
    const weights = nearest.map((candidate, rank) => (candidate.ahead ? 2 : 1) / (rank + 1))
    let roll = random() * weights.reduce((sum, weight) => sum + weight, 0)
    return nearest.find((_, index) => (roll -= weights[index]!) < 0)?.star ?? nearest[0]!.star
  }

  /** Any unvisited object a fair way off, picked at random across the map. */
  function farDestination(objects: readonly Star[], from: Vector3, currentId: string | null): Star | null {
    for (let attempt = 0; attempt < 32 && objects.length; attempt++) {
      const star = objects[Math.floor(random() * objects.length)]!
      if (star.id === currentId || visited.has(star.id)) continue
      if (Math.hypot(star.x_pc - from.x, star.z_pc - from.y, -star.y_pc - from.z) >= AREA_MIN_ESCAPE_PC * 3) return star
    }
    return null
  }

  function nextMove(view: DemoPose): Move | null {
    const objects = host.objects()
    const selectedId = host.selectedId()
    const current = selectedId === null ? undefined : objects.find((star) => star.id === selectedId)
    const at = current && host.position(current.id)
    const near = at && view.position.distanceTo(at) < Math.max(extentPc(current!) * 3, 1.6) * 8
    if (current && at && near && localMoves < localTarget) {
      localMoves++
      const kind = pick(LOCAL_MOVES)
      lastKind = kind
      // A look around ends facing away, so a flight follows, setting off the way it looks.
      if (kind === 'gaze') localMoves = localTarget
      visited.add(current.id)
      return localMove(kind, view, at, framingPc(current))
    }
    const forward = new Vector3().subVectors(view.target, view.position).normalize()
    // A journey leaves the selection far behind, so the tour carries on from where the camera is.
    const afterJourney = lastTravel === 'journey'
    const from = afterJourney ? view.position : at ?? view.position
    let next = current && at && !near && !afterJourney ? current : null
    if (!next && !afterJourney && lastTravel !== 'voyage' && random() < JOURNEY_CHANCE) {
      lastKind = lastTravel = 'journey'
      localMoves = localTarget = 0
      area.length = 0
      return journey(view)
    }
    let voyaging = false
    if (!next && at && !afterJourney && lastTravel !== 'voyage' && random() < VOYAGE_CHANCE) {
      next = farDestination(objects, at, selectedId)
      voyaging = next !== null
    }
    if (!next && area.length >= areaHops) {
      // Enough of this area: on to the nearest object well outside it.
      const center = area.reduce((sum, position) => sum.add(position), new Vector3()).divideScalar(area.length)
      const radius = Math.max(...area.map((position) => position.distanceTo(center)))
      next = destination(objects, from, forward, selectedId, { center, radius: Math.max(radius * AREA_ESCAPE, AREA_MIN_ESCAPE_PC) })
      if (next) {
        area.length = 0
        areaHops = AREA_HOPS[0] + Math.floor(random() * (AREA_HOPS[1] - AREA_HOPS[0] + 1))
      }
    }
    next ??= destination(objects, from, forward, selectedId)
    const to = next && host.position(next.id)
    if (!next || !to) return null
    visited.add(next.id)
    if (voyaging) area.length = 0
    area.push(to.clone())
    localMoves = 0
    // It moves on quickly: often straight to the next object, rarely with two moves around this one.
    const stay = random()
    localTarget = stay < 0.3 ? 0 : stay < 0.85 ? 1 : 2
    const kind = voyaging ? 'voyage' : pick(TRAVEL_MOVES)
    lastKind = lastTravel = kind
    if (kind === 'voyage') return voyage(view, at!, next.id, to, framingPc(next))
    return kind === 'glide' ? glide(view, next.id, to, framingPc(next)) : cruise(view, next.id, to, framingPc(next))
  }

  return {
    /** Advances by demo seconds, already scaled by the speed, and returns the camera pose; null while nothing can be shown. */
    advance(seconds: number): DemoFrame | null {
      time += seconds * (move?.pace ?? 1)
      if (!move || time >= move.seconds) {
        // Without a destination, look again once a second rather than every frame.
        idle += seconds
        if (!move && idle < 1) return null
        const view = host.view()
        start.position.fromArray(view.position)
        start.target.fromArray(view.target)
        move = nextMove(start)
        idle = 0
        if (!move) return null
        move.pace = PACE_RANGE[0] + random() * (PACE_RANGE[1] - PACE_RANGE[0])
        // The first frame is a frame into the move; at its very start it would repeat the last one.
        time = seconds * move.pace
        // The earlier speed carries over in the move's own seconds.
        startVelocity.position.copy(velocity.position).divideScalar(move.pace)
        startVelocity.target.copy(velocity.target).divideScalar(move.pace)
      }
      const selection = move.select
      if (selection && time >= selection.at) {
        move.select = undefined
        host.select(selection.id)
      }
      move.pose(time, pose)
      const blend = smooth(Math.min(1, time / BLEND_S))
      // The start keeps drifting with the camera's earlier speed, fading, so the handover has no stop.
      const coast = MOMENTUM_S * (1 - Math.exp(-time / MOMENTUM_S))
      coasting.position.copy(start.position).addScaledVector(startVelocity.position, coast)
      coasting.target.copy(start.target).addScaledVector(startVelocity.target, coast)
      output.position.lerpVectors(coasting.position, pose.position, blend)
      output.target.lerpVectors(coasting.target, pose.target, blend)
      const look = output.target.distanceTo(output.position)
      if (look < 1e-9) output.target.set(output.position.x, output.position.y, output.position.z - MIN_LOOK_PC)
      else if (look < MIN_LOOK_PC) output.target.sub(output.position).multiplyScalar(MIN_LOOK_PC / look).add(output.position)
      limitPitch(output, heading)
      if (Math.hypot(output.target.x - output.position.x, output.target.z - output.position.z) > 1e-9) heading.subVectors(output.target, output.position)
      if (tracked && seconds > 0) {
        velocity.position.subVectors(output.position, previous.position).divideScalar(seconds)
        velocity.target.subVectors(output.target, previous.target).divideScalar(seconds)
      }
      previous.position.copy(output.position)
      previous.target.copy(output.target)
      tracked = true
      // Brightness ratings glide from the selection to the camera and back, rather than switching at once.
      shipView = clamp(shipView + (move.ship ? 1 : -1) * seconds / SHIP_VIEW_S, 0, 1)
      const selectedId = host.selectedId()
      const base = shipView > 0 && selectedId !== null ? host.position(selectedId) : null
      output.observer = shipView > 0 ? observer.copy(output.position) : null
      if (base) observer.lerpVectors(base, output.position, smooth(shipView))
      return output
    },
    /** Drops the current move, so the next one starts from the camera as the visitor left it, at rest. */
    restart(): void {
      move = null
      idle = Infinity
      tracked = false
      velocity.position.set(0, 0, 0)
      velocity.target.set(0, 0, 0)
    },
  }

  /**
   * Cruises 30 to 300 ly straight on, looking ahead, with a gentle turn here and there; brightness is rated
   * from the camera as if from a ship.
   */
  function journey(view: DemoPose): Move {
    const from = view.position.clone()
    const forward = view.target.clone().sub(from)
    if (forward.lengthSq() < 1e-12) forward.copy(randomUnit())
    forward.normalize()
    // Evenly spread in proportion, so long and short journeys both come up.
    const distance = JOURNEY_LY[0] * (JOURNEY_LY[1] / JOURNEY_LY[0]) ** random() / LIGHT_YEARS_PER_PARSEC
    const seconds = 8 + 5 * Math.log2(1 + distance)
    const cruising = cruisingShare(1, seconds, distance)
    // Two wide, gentle turns of 15° to 35°, each spread over a quarter of the way.
    const turns = [0.1 + random() * 0.2, 0.5 + random() * 0.2].map((at) => ({ at, yaw: sign() * (0.26 + random() * 0.35), pitch: (random() - 0.5) * 0.3 }))
    const sideways = new Vector3(), heading = new Vector3()
    const direction = (share: number, out: Vector3) => {
      let yaw = 0, pitch = 0
      for (const turn of turns) {
        const done = smooth(clamp((share - turn.at) / 0.25, 0, 1))
        yaw += turn.yaw * done
        pitch += turn.pitch * done
      }
      out.copy(forward).applyAxisAngle(UP, yaw)
      return out.applyAxisAngle(perpendicular(out, sideways), pitch)
    }
    // The path, traced in even steps along the turning direction.
    const steps = 240
    const path = [from]
    for (let step = 0; step < steps; step++) path.push(path[step]!.clone().addScaledVector(direction((step + 0.5) / steps, heading), distance / steps))
    const carried = velocity.position.clone().multiplyScalar(seconds)
    if (carried.length() > distance * 0.3) carried.setLength(distance * 0.3)
    const lookAhead = Math.max(0.5, distance * 0.05)
    return {
      seconds,
      ship: true,
      pose(t, out) {
        const u = Math.min(1, t / seconds), travelled = travelEase(u, cruising) * steps
        const step = Math.min(steps - 1, Math.floor(travelled))
        out.position.lerpVectors(path[step]!, path[step + 1]!, travelled - step).addScaledVector(carried, u * (1 - u) ** 2)
        out.target.copy(out.position).addScaledVector(direction(travelled / steps, heading), lookAhead)
      },
    }
  }

  /** Flies to the object in an arc that rises above the map, turning to it early. */
  function glide(view: DemoPose, id: string, to: Vector3, framing: number): Move {
    const from = view.position.clone(), lookFrom = view.target.clone()
    const offset = from.clone().sub(to)
    const approach = (offset.lengthSq() > 1e-12 ? offset.normalize() : randomUnit()).addScaledVector(randomUnit(), 0.6).normalize()
    const end = to.clone().addScaledVector(approach, framing)
    const distance = from.distanceTo(end)
    const travel = end.clone().sub(from).normalize()
    const lift = UP.clone().addScaledVector(travel, -UP.dot(travel))
    if (lift.lengthSq() < 1e-6) perpendicular(travel, lift)
    lift.normalize().multiplyScalar(distance * 0.25)
    const seconds = 8 + 5 * Math.log2(1 + distance)
    const cruising = cruisingShare(framing, seconds, distance)
    // The path bows out the way the camera already moves, starting at that speed, so it never turns back from a halt.
    const carried = velocity.position.clone().multiplyScalar(seconds)
    if (carried.length() > distance * 0.5) carried.setLength(distance * 0.5)
    return {
      seconds,
      select: { id, at: 0 },
      pose(t, out) {
        const u = Math.min(1, t / seconds), eased = travelEase(u, cruising)
        out.position.lerpVectors(from, end, eased).addScaledVector(lift, Math.sin(Math.PI * eased)).addScaledVector(carried, u * (1 - u) ** 2)
        out.target.lerpVectors(lookFrom, to, smooth(Math.min(1, u * 2)))
      },
    }
  }

  /**
   * Glides backward and up from the object until the Milky Way shows, lingers, then speeds down into another
   * object far away. Distances change in proportion, so each doubling takes as long.
   */
  function voyage(view: DemoPose, from: Vector3, id: string, to: Vector3, framing: number): Move {
    const offset = view.position.clone().sub(from)
    const startRadius = Math.max(offset.length(), 1e-3)
    if (offset.lengthSq() < 1e-12) offset.copy(randomUnit())
    offset.normalize()
    const azimuth = Math.atan2(offset.z, offset.x)
    const elevation = Math.asin(clamp(offset.y, -0.95, 0.95))
    // It keeps drifting sideways the way the camera moves, even at the far point, and arrives a little around from there.
    const spin = along(new Vector3(-offset.z, 0, offset.x), velocity.position) * 0.8
    const arrivalTurn = (random() - 0.5) * 1.6
    const arrivalElevation = (random() - 0.5) * 0.6
    const far = VOYAGE_DISTANCE_PC[0] + random() * (VOYAGE_DISTANCE_PC[1] - VOYAGE_DISTANCE_PC[0])
    const [nearLog, farLog, endLog] = [Math.log(startRadius), Math.log(far), Math.log(framing)]
    const seconds = 48 + random() * 12
    const peak = 0.45
    const center = new Vector3()
    return {
      seconds,
      select: { id, at: seconds * peak },
      pose(t, out) {
        const u = Math.min(1, t / seconds)
        const rise = smooth(Math.min(1, u / peak))
        const arrive = smooth(clamp((u - peak) / (1 - peak), 0, 1))
        const radius = Math.exp(arrive > 0 ? farLog + (endLog - farLog) * arrive : nearLog + (farLog - nearLog) * rise)
        const turn = azimuth + spin * u + arrivalTurn * arrive
        const tilt = (elevation + (VOYAGE_ELEVATION - elevation) * rise) * (1 - arrive) + arrivalElevation * arrive
        // It crosses over to the destination while still far out, where that is slow on screen, not while closing in.
        center.lerpVectors(from, to, smooth(Math.min(1, arrive * 1.6)))
        out.position.set(Math.cos(tilt) * Math.cos(turn), Math.sin(tilt), Math.cos(tilt) * Math.sin(turn)).multiplyScalar(radius).add(center)
        // The view swings to the destination early in the dive.
        out.target.lerpVectors(from, to, smooth(clamp((u - peak * 0.9) / 0.35, 0, 1)))
      },
    }
  }

  /** Flies like a ship: out along the view, then curving onto the object, which it picks on the way. */
  function cruise(view: DemoPose, id: string, to: Vector3, framing: number): Move {
    const from = view.position.clone()
    const forward = view.target.clone().sub(from).normalize()
    const approach = to.clone().sub(from)
    if (approach.lengthSq() < 1e-12) approach.copy(forward)
    approach.normalize()
    // It arrives beside the object rather than through it.
    const end = to.clone().addScaledVector(perpendicular(approach).applyAxisAngle(approach, random() * Math.PI * 2), framing)
    const distance = from.distanceTo(end)
    const seconds = 9 + 5 * Math.log2(1 + distance)
    const cruising = cruisingShare(framing, seconds, distance)
    // The flight sets off along the view, bent the way the camera already moves, so it picks up that speed.
    const carried = velocity.position.clone().multiplyScalar(seconds / (3 * Math.max(cruising, 1e-3)))
    if (carried.length() > distance * 0.6) carried.setLength(distance * 0.6)
    const control1 = from.clone().addScaledVector(forward, distance * 0.45).add(carried)
    const control2 = end.clone().addScaledVector(approach, -distance * 0.35)
    // Bézier derivative legs.
    const leg0 = control1.clone().sub(from), leg1 = control2.clone().sub(control1), leg2 = end.clone().sub(control2)
    const tangent = new Vector3(), toObject = new Vector3()
    const lookAhead = Math.max(0.5, distance * 0.1)
    return {
      seconds,
      select: { id, at: seconds * 0.3 },
      pose(t, out) {
        const u = travelEase(Math.min(1, t / seconds), cruising), v = 1 - u
        out.position.copy(from).multiplyScalar(v ** 3).addScaledVector(control1, 3 * v * v * u).addScaledVector(control2, 3 * v * u * u).addScaledVector(end, u ** 3)
        tangent.copy(leg0).multiplyScalar(3 * v * v).addScaledVector(leg1, 6 * v * u).addScaledVector(leg2, 3 * u * u)
        if (tangent.lengthSq() < 1e-12) tangent.copy(forward)
        tangent.normalize()
        toObject.subVectors(to, out.position)
        const objectDistance = toObject.length()
        // The view swings from the flight path onto the object for the arrival, ending on it.
        const turn = smooth(clamp((u - 0.55) / 0.45, 0, 1))
        tangent.lerp(toObject.divideScalar(objectDistance || 1), turn).normalize()
        out.target.copy(out.position).addScaledVector(tangent, lookAhead + (objectDistance - lookAhead) * turn)
      },
    }
  }

  function localMove(kind: typeof LOCAL_MOVES[number], view: DemoPose, at: Vector3, framing: number): Move {
    if (kind === 'flyby') return flyby(view, at, framing)
    if (kind === 'pass') return pass(view, at, framing)
    if (kind === 'gaze') return gaze(view)
    return circle(view, at, framing, kind === 'reveal')
  }

  /** Orbits the object; a reveal pulls far back over the region and returns. */
  function circle(view: DemoPose, at: Vector3, framing: number, reveal: boolean): Move {
    const offset = view.position.clone().sub(at)
    if (offset.lengthSq() < 1e-12) offset.set(framing, 0, 0)
    // It starts at the camera's distance, easing to the framing one, so it never pulls the camera back.
    const radius = offset.length()
    const azimuth = Math.atan2(offset.z, offset.x)
    const elevation = Math.asin(clamp(offset.y / offset.length(), -0.95, 0.95))
    const finalElevation = (random() - 0.5) * 0.8
    const zoom = reveal ? 6 + random() * 8 : 1.3
    const spin = along(new Vector3(-offset.z, 0, offset.x), velocity.position) * Math.PI * 2 / (reveal ? 70 : 50)
    const seconds = reveal ? 20 + random() * 4 : 12 + random() * 6
    return {
      seconds,
      pose(t, out) {
        // The zoom eases in and out, so a reveal settles into its orbit rather than arriving at speed.
        const u = Math.min(1, t / seconds), arc = Math.sin(Math.PI * smooth(u))
        const distance = (radius + (framing - radius) * smooth(u)) * zoom ** arc
        const tilt = clamp(elevation + (finalElevation - elevation) * smooth(u) + (reveal ? 0.3 * arc : 0), -1.2, 1.2)
        const turn = azimuth + spin * t
        out.position.set(Math.cos(tilt) * Math.cos(turn), Math.sin(tilt), Math.cos(tilt) * Math.sin(turn)).multiplyScalar(distance).add(at)
        out.target.copy(at)
      },
    }
  }

  /** Circles the object like a ship in a tilted orbit, looking ahead with the object off to the side. */
  function flyby(view: DemoPose, at: Vector3, framing: number): Move {
    const offset = view.position.clone().sub(at)
    const axisA = offset.lengthSq() > 1e-12 ? offset.clone().normalize() : randomUnit()
    // The orbit starts at the camera, in the plane of its motion, so the flight carries straight on;
    // a still camera gets a gently tilted orbit.
    const normal = new Vector3().crossVectors(axisA, velocity.position)
    if (normal.lengthSq() < 1e-12) {
      normal.copy(UP).addScaledVector(randomUnit(), 0.5)
      normal.addScaledVector(axisA, -normal.dot(axisA))
      if (normal.lengthSq() < 1e-12) perpendicular(axisA, normal)
    }
    normal.normalize()
    if (normal.y < 0) normal.negate()
    const tilt = normal.angleTo(UP)
    if (tilt > ORBIT_TILT) {
      // Leveled toward the map's plane, still through the camera, so the ship does not heel over the poles.
      const hinge = new Vector3().crossVectors(normal, UP)
      if (hinge.lengthSq() > 1e-12) normal.applyAxisAngle(hinge.normalize(), tilt - ORBIT_TILT)
      normal.addScaledVector(axisA, -normal.dot(axisA))
      if (normal.lengthSq() < 1e-12) perpendicular(axisA, normal)
      normal.normalize()
    }
    const axisB = new Vector3().crossVectors(normal, axisA)
    // It starts at the camera's distance, easing into a comfortable orbit.
    const radius = offset.length(), orbit = clamp(radius, framing, framing * 2.5)
    const spin = along(axisB, velocity.position)
    const seconds = 12 + random() * 5
    const radial = new Vector3(), ahead = new Vector3()
    return {
      seconds,
      pose(t, out) {
        const angle = spin * t * Math.PI * 2 / 28
        radial.copy(axisA).multiplyScalar(Math.cos(angle)).addScaledVector(axisB, Math.sin(angle))
        ahead.copy(axisB).multiplyScalar(Math.cos(angle)).addScaledVector(axisA, -Math.sin(angle)).multiplyScalar(spin)
        const u = Math.min(1, t / seconds)
        const distance = (radius + (orbit - radius) * smooth(u)) * (1 - 0.3 * Math.sin(Math.PI * u))
        out.position.copy(at).addScaledVector(radial, distance)
        // About 30° toward the object keeps it in view beside the flight path.
        ahead.multiplyScalar(Math.cos(0.5)).addScaledVector(radial, -Math.sin(0.5))
        out.target.copy(out.position).addScaledVector(ahead, distance)
      },
    }
  }

  /** A tracking shot: from where the camera is, it sweeps past the object in a straight line, keeping it centered. */
  function pass(view: DemoPose, at: Vector3, framing: number): Move {
    const from = view.position.clone()
    const inward = at.clone().sub(from)
    const range = inward.length()
    if (range > 1e-9) inward.divideScalar(range)
    else inward.copy(randomUnit())
    // It sweeps the way the camera was heading across the line of sight, or any way across it when heading straight in or out.
    const moving = velocity.position
    const across = moving.clone().addScaledVector(inward, -moving.dot(inward))
    if (across.length() < 0.2 * moving.length() || across.lengthSq() < 1e-12) perpendicular(inward, across).applyAxisAngle(inward, random() * Math.PI * 2)
    across.normalize()
    // Aimed to miss the object by the closest distance halfway along, leaning toward it, or away while already leaving.
    const closest = Math.min(range, framing * (0.6 + random() * 0.6))
    const aside = range > 1e-9 ? Math.asin(closest / range) : Math.PI / 2
    const lean = moving.dot(inward) < -0.2 * moving.length() ? -1 : 1
    const side = across.dot(moving) < 0 ? -1 : 1
    const direction = inward.multiplyScalar(lean * Math.cos(aside)).addScaledVector(across, side * Math.sin(aside))
    const length = Math.max(lean > 0 ? 2 * range * Math.cos(aside) + closest : 0, closest * 3)
    const seconds = 10 + random() * 4
    return {
      seconds,
      pose(t, out) {
        const u = Math.min(1, t / seconds)
        // Half eased: it glides out at the end, but keeps moving throughout.
        out.position.copy(from).addScaledVector(direction, length * (u + smooth(u)) / 2)
        out.target.copy(at)
      },
    }
  }

  /** Stays near the object and slowly looks about half way around the sky; a flight then sets off the way it faces. */
  function gaze(view: DemoPose): Move {
    const from = view.position.clone()
    const look = view.target.clone().sub(from)
    const distance = Math.max(0.5, look.length())
    look.normalize()
    const heading = Math.atan2(look.x, look.z)
    const pitch = Math.asin(clamp(look.y, -0.95, 0.95))
    const turning = new Vector3().subVectors(velocity.target, velocity.position)
    const sweep = along(new Vector3(Math.cos(heading), 0, -Math.sin(heading)), turning) * Math.PI * (0.8 + random() * 0.3)
    const seconds = 15 + random() * 5
    return {
      seconds,
      pose(t, out) {
        const u = Math.min(1, t / seconds)
        const yaw = heading + sweep * turnEase(u)
        const tilt = clamp(pitch * (1 - Math.sin(Math.PI * u)) + 0.25 * Math.sin(Math.PI * 2 * u), -0.9, 0.9)
        out.position.copy(from).addScaledVector(look, distance * 0.15 * turnEase(u))
        out.target.set(Math.cos(tilt) * Math.sin(yaw), Math.sin(tilt), Math.cos(tilt) * Math.cos(yaw)).multiplyScalar(distance).add(out.position)
      },
    }
  }
}
