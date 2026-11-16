import { Vector3 } from 'three'
import { LIGHT_YEARS_PER_PARSEC } from './astronomy'
import type { Star } from './catalog-model'
import { clamp } from './math'

export interface DemoPose { position: Vector3; target: Vector3 }

export interface DemoHost {
  /** Objects visible on the map. */
  objects(): readonly Star[]
  /** Current world position, following simulated motion. */
  position(id: string): Vector3 | null
  view(): { position: ArrayLike<number>; target: ArrayLike<number> }
  selectedId(): string | null
  select(id: string): void
}

type MoveKind = 'glide' | 'cruise' | 'voyage' | 'journey' | 'orbit' | 'reveal' | 'flyby' | 'pass' | 'gaze' | 'skim'
const TRAVEL_MOVES = ['glide', 'cruise'] as const
const LOCAL_MOVES = ['orbit', 'reveal', 'flyby', 'pass', 'gaze', 'skim'] as const
const NO_SKIM_MOVES = LOCAL_MOVES.filter((kind) => kind !== 'skim')

interface Move {
  seconds: number
  /** Move seconds per demo second. */
  pace?: number
  /** Flights count as travel; the tour keeps travelling more than it lingers at objects. */
  travel?: boolean
  pose(t: number, out: DemoPose): void
  /** Selects the destination this many seconds in. */
  select?: { id: string; at: number }
}

/** Each move eases in from where the previous one, or a drag, left the camera. */
const BLEND_S = 4
/** It starts at the speed the camera had, which fades over about this time while the move takes over, so it never halts. */
const MOMENTUM_S = 2.5
/** A move's starting speed is measured over this many seconds. */
const PROBE_S = 0.01
/**
 * At their ends flights move about as fast as local moves, in framing distances per second, so a long, fast
 * flight slows seamlessly into the calm move after it.
 */
const LOCAL_SPEED = 0.15
/** Each local move runs a little faster or slower than the speed setting, within this calm range. */
const PACE_RANGE = [0.8, 1.2] as const
/** Each flight keeps one pace from this wider range, so some drift and some hurry. */
const TRAVEL_PACE_RANGE = [0.7, 1.5] as const
/** Flights take longer the farther they go, up to this, so far objects are reached at a higher, steady speed. */
const TRAVEL_MAX_S = 30
/** Speeding up and slowing down change speed by about this share a second, so even a fast flight brakes gently near its object. */
const SPEED_CHANGE = 0.5
/** Time at objects stays below this share of time travelling. */
const LOCAL_SHARE = 0.7
/** The view's turning direction is judged over about this time; moves keep turning that way. */
const TURN_MEMORY_S = 1.5
/** Moves are checked for passing through extended objects at this many points along the way. */
const CLEARANCE_SAMPLES = 256
/** A flight leaving an object it looks at sets off at least this far to the side of it. */
const DEPARTURE_ANGLE = 0.5
/** Objects on the side the view turns away from are this much less likely destinations. */
const OFF_SIDE_WEIGHT = 0.2
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
/** About one travel in four is a journey: 30 to 300 ly straight on, turning gently now and then, with no destination. */
const JOURNEY_CHANCE = 0.25
const JOURNEY_LY = [30, 300] as const
/** A close flyby misses its star by about 4,000 to 8,000 AU, beyond the 0.01 pc near plane, where it flares. */
const SKIM_PC = [0.02, 0.04] as const
/** At the star it flies slower by this share of its average speed, so the flare lasts a moment. */
const SKIM_SLOWING = 0.6
/** The view leans this far toward the star, so it stays in sight longer while sliding by. */
const SKIM_LEAN = 0.3
/**
 * Up stays the map's up, so a view near straight up or down spins its heading and seems to roll. The view tilts
 * freely up to the knee, then flattens out softly before the limit; ship orbits stay within the tilt of level.
 */
const PITCH_KNEE = 0.6
const PITCH_LIMIT = 1
const ORBIT_TILT = 0.5
const UP = new Vector3(0, 1, 0)

const smooth = (u: number) => u * u * (3 - 2 * u)
/** Like smooth, but also without a sudden change of acceleration at its ends. */
const smoother = (u: number) => u ** 3 * (u * (6 * u - 15) + 10)
/** Eases a turn without stopping at its ends. */
const turnEase = (u: number) => (smooth(u) + u) / 2
const travelSeconds = (distance: number) => Math.min(TRAVEL_MAX_S, 7 + 5 * Math.log2(1 + distance))
const wrapAngle = (angle: number) => angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI))
/** Headings grow as the view turns left, seen from above. */
const yawOf = (v: Vector3) => Math.atan2(v.x, v.z)
const pitchOf = (v: Vector3) => Math.atan2(v.y, Math.hypot(v.x, v.z))

function perpendicular(v: Vector3, out = new Vector3()): Vector3 {
  out.crossVectors(v, UP)
  if (out.lengthSq() < 1e-12) out.set(1, 0, 0)
  return out.normalize()
}

/** Turns from one look to another by heading and pitch, so the view turns evenly and never swings through the camera. */
function lookBetween(from: Vector3, to: Vector3, share: number, out: Vector3): Vector3 {
  const yaw = yawOf(from) + wrapAngle(yawOf(to) - yawOf(from)) * share
  const pitch = pitchOf(from) + (pitchOf(to) - pitchOf(from)) * share
  const length = from.length() + (to.length() - from.length()) * share
  return out.set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)).multiplyScalar(length)
}

/**
 * A flight's share of its distance over time: it speeds up from the camera's speed, keeps one steady speed for
 * most of the way, and slows down to the calm speed at objects. Speed changes in proportion, so a fast flight
 * brakes as smoothly near its object as far from it. It takes about the given seconds.
 */
function travelProfile(distance: number, seconds: number, startSpeed: number, endSpeed: number): { seconds: number; share(t: number): number } {
  const cruise = Math.max(distance / (seconds * 0.75), endSpeed)
  const last = endSpeed, first = clamp(startSpeed, last * 0.2, cruise)
  if (distance < 1e-9 || cruise <= last * 1.01) return { seconds: distance / cruise || seconds, share: (t) => clamp(t * cruise / distance, 0, 1) }
  // Faster when needed, so speeding up and slowing down cover at most two thirds of the way.
  const rate = Math.max(SPEED_CHANGE, (2 * cruise - first - last) / (distance * 2 / 3))
  const up = Math.log(cruise / first) / rate, down = Math.log(cruise / last) / rate
  const upDistance = (cruise - first) / rate, downDistance = (cruise - last) / rate
  const total = up + down + (distance - upDistance - downDistance) / cruise
  return {
    seconds: total,
    share(t) {
      if (t <= up) return first * (Math.exp(rate * Math.max(t, 0)) - 1) / rate / distance
      if (t >= total - down) return clamp(1 - last * (Math.exp(rate * Math.max(total - t, 0)) - 1) / rate / distance, 0, 1)
      return (upDistance + (t - up) * cruise) / distance
    },
  }
}

/** Traces a curve in even steps of its parameter, so it can be flown by distance at a steady speed. */
function tracePath(curve: (s: number, out: Vector3) => Vector3, steps = 256) {
  const points = Array.from({ length: steps + 1 }, (_, index) => curve(index / steps, new Vector3()))
  const lengths = [0]
  for (let index = 1; index <= steps; index++) lengths.push(lengths[index - 1]! + points[index]!.distanceTo(points[index - 1]!))
  return {
    length: lengths[steps]!,
    /** Places out at this share of the length and returns the curve's parameter there. */
    at(share: number, out: Vector3): number {
      const distance = clamp(share, 0, 1) * lengths[steps]!
      let low = 0, high = steps
      while (high - low > 1) {
        const middle = (low + high) >> 1
        if (lengths[middle]! <= distance) low = middle
        else high = middle
      }
      const segment = lengths[high]! - lengths[low]!
      const s = (low + (segment > 0 ? (distance - lengths[low]!) / segment : 0)) / steps
      curve(s, out)
      return s
    },
  }
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
  const output: DemoPose = { position: new Vector3(), target: new Vector3() }
  const previous: DemoPose = { position: new Vector3(), target: new Vector3() }
  /** In demo seconds: the camera's speed over the last frame, and at the start of the current move. */
  const velocity: DemoPose = { position: new Vector3(), target: new Vector3() }
  const startVelocity: DemoPose = { position: new Vector3(), target: new Vector3() }
  /** The camera's start relative to the move's, and its earlier speed relative to the move's own. */
  const startOffset = new Vector3(), startMismatch = new Vector3(), startSwerve = new Vector3()
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
  /** Seconds spent travelling and at objects, at the speed setting. */
  let travelTime = 0
  let localTime = 0
  /** The way the view turns, 1 to the left and -1 to the right; moves keep turning this way instead of turning back. */
  let sense = random() < 0.5 ? -1 : 1
  let turnRate = 0
  const look = new Vector3(), lastLook = new Vector3(), poseLook = new Vector3()
  const probe: DemoPose = { position: new Vector3(), target: new Vector3() }

  /** Across the line of sight the way the camera already moves, or any way across it when heading straight in or out. */
  const acrossMotion = (inward: Vector3) => {
    const moving = velocity.position
    const across = moving.clone().addScaledVector(inward, -moving.dot(inward))
    if (across.length() < 0.2 * moving.length() || across.lengthSq() < 1e-12) perpendicular(inward, across).applyAxisAngle(inward, random() * Math.PI * 2)
    return across.normalize()
  }
  const randomUnit = () => new Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize()
  const framingPc = (star: Star) => Math.max(extentPc(star) * 3, 0.4 + random() * 1.2)
  const pick = <T extends MoveKind>(kinds: readonly T[]) => {
    const options = kinds.filter((kind) => kind !== lastKind)
    return options[Math.floor(random() * options.length)]!
  }

  /**
   * One of the nearest unvisited objects, closer ones, those ahead and those the way the view turns more likely,
   * or now and then one a bit farther away; all visited starts over.
   */
  function destination(objects: readonly Star[], from: Vector3, forward: Vector3, currentId: string | null, avoid?: { center: Vector3; radius: number }): Star | null {
    const nearest: { star: Star; distanceSq: number; ahead: boolean; onSide: boolean }[] = []
    for (const star of objects) {
      // Galaxies are scenery: flights to them would last far longer than the tour's pace allows.
      if (star.id === currentId || visited.has(star.id) || star.galaxy) continue
      // World axes are Galactic x, z and -y.
      if (avoid && Math.hypot(star.x_pc - avoid.center.x, star.z_pc - avoid.center.y, -star.y_pc - avoid.center.z) < avoid.radius) continue
      const dx = star.x_pc - from.x, dy = star.z_pc - from.y, dz = -star.y_pc - from.z
      const distanceSq = dx * dx + dy * dy + dz * dz
      const kept = DISTANT_RANKS[1]
      if (nearest.length === kept && distanceSq >= nearest[kept - 1]!.distanceSq) continue
      const index = nearest.findIndex((candidate) => candidate.distanceSq > distanceSq)
      nearest.splice(index < 0 ? nearest.length : index, 0, {
        star, distanceSq, ahead: dx * forward.x + dy * forward.y + dz * forward.z > 0, onSide: (forward.z * dx - forward.x * dz) * sense >= 0,
      })
      nearest.length = Math.min(nearest.length, kept)
    }
    if (!nearest.length) {
      if (!visited.size) return null
      visited.clear()
      return destination(objects, from, forward, currentId, avoid)
    }
    if (nearest.length > DISTANT_RANKS[0] && random() < DISTANT_CHANCE) {
      const distant = nearest.slice(DISTANT_RANKS[0])
      const onSide = distant.filter((candidate) => candidate.onSide)
      const options = onSide.length ? onSide : distant
      return options[Math.floor(random() * options.length)]!.star
    }
    nearest.length = Math.min(nearest.length, CANDIDATES)
    const weights = nearest.map((candidate, rank) => (candidate.ahead ? 2 : 1) * (candidate.onSide ? 1 : OFF_SIDE_WEIGHT) / (rank + 1))
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
    if (current && at && near && localMoves < localTarget && localTime < travelTime * LOCAL_SHARE) {
      localMoves++
      // A close flyby heads for the object, so it does not follow a move leaving it, nor suit extended objects.
      const leaving = velocity.position.dot(at.clone().sub(view.position)) < 0
      const kind = pick(extentPc(current!) > 0 || leaving ? NO_SKIM_MOVES : LOCAL_MOVES)
      lastKind = kind
      // A look around and a close flyby end facing away, so a flight follows, setting off the way it looks.
      if (kind === 'gaze' || kind === 'skim') localMoves = localTarget
      visited.add(current.id)
      return clearOf(() => localMove(kind, view, at, framingPc(current!)), current.id)
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
      return clearOf(() => journey(view, at), selectedId)
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
    // A cruise would turn back on the spot to an object behind, where a glide turns the view first. A close flyby
    // leaves fast, so otherwise a cruise carries straight on.
    const behind = forward.dot(to.clone().sub(view.position).normalize()) < -0.2
    const kind = voyaging ? 'voyage' : behind ? 'glide' : lastKind === 'skim' ? 'cruise' : pick(TRAVEL_MOVES)
    lastKind = lastTravel = kind
    const framing = framingPc(next)
    if (kind === 'voyage') return voyage(view, at!, next.id, to, framing)
    return clearOf(() => kind === 'glide' ? glide(view, next.id, to, framing) : cruise(view, next.id, to, framing, at), next.id, selectedId)
  }

  return {
    /** Advances by demo seconds, already scaled by the speed, and returns the camera pose; null while nothing can be shown. */
    advance(seconds: number): DemoPose | null {
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
        // A voyage's pull-back already spans every scale, so it keeps the calm range.
        const [slowest, fastest] = move.travel && lastKind !== 'voyage' ? TRAVEL_PACE_RANGE : PACE_RANGE
        move.pace = slowest * (fastest / slowest) ** random()
        if (move.travel) travelTime += move.seconds / move.pace
        else localTime += move.seconds / move.pace
        // The first frame is a frame into the move; at its very start it would repeat the last one.
        time = seconds * move.pace
        // The earlier speed carries over in the move's own seconds.
        startVelocity.position.copy(velocity.position).divideScalar(move.pace)
        startVelocity.target.copy(velocity.target).divideScalar(move.pace)
        // How far the move starts from the camera, and how its own starting speed differs from the camera's.
        move.pose(PROBE_S, pose)
        startMismatch.copy(pose.position)
        move.pose(0, pose)
        startOffset.subVectors(start.position, pose.position)
        startMismatch.sub(pose.position).divideScalar(-PROBE_S).add(startVelocity.position)
        // Setting off against the earlier motion, it swerves aside on the way, turning round instead of stopping to reverse.
        const own = startVelocity.position.clone().sub(startMismatch)
        const opposed = clamp(-own.dot(startVelocity.position) / (own.length() * startVelocity.position.length() + 1e-12), 0, 1)
        perpendicular(startMismatch, startSwerve).multiplyScalar(-sense * opposed * startMismatch.length())
      }
      const selection = move.select
      if (selection && time >= selection.at) {
        move.select = undefined
        host.select(selection.id)
      }
      move.pose(time, pose)
      const blend = smooth(Math.min(1, time / BLEND_S))
      // The camera follows the move, carrying on at its earlier speed while the difference fades, so the handover neither stops nor lurches.
      const fading = Math.exp(-time / MOMENTUM_S)
      output.position.copy(pose.position).addScaledVector(startOffset, 1 - blend)
        .addScaledVector(startMismatch, time * fading).addScaledVector(startSwerve, time * time * fading / MOMENTUM_S)
      // The view drifts on as it turned, then turns to the move's by heading, rather than its target sliding across.
      const coast = MOMENTUM_S * (1 - Math.exp(-time / MOMENTUM_S))
      look.copy(start.target).addScaledVector(startVelocity.target, coast).sub(start.position).addScaledVector(startVelocity.position, -coast)
      lookBetween(look, poseLook.subVectors(pose.target, pose.position), blend, look)
      output.target.copy(output.position).add(look)
      const lookLength = look.length()
      if (lookLength < 1e-9) output.target.set(output.position.x, output.position.y, output.position.z - MIN_LOOK_PC)
      else if (lookLength < MIN_LOOK_PC) output.target.sub(output.position).multiplyScalar(MIN_LOOK_PC / lookLength).add(output.position)
      limitPitch(output, heading)
      if (Math.hypot(output.target.x - output.position.x, output.target.z - output.position.z) > 1e-9) heading.subVectors(output.target, output.position)
      look.subVectors(output.target, output.position)
      if (tracked && seconds > 0) {
        velocity.position.subVectors(output.position, previous.position).divideScalar(seconds)
        velocity.target.subVectors(output.target, previous.target).divideScalar(seconds)
        turnRate += (wrapAngle(yawOf(look) - yawOf(lastLook)) / seconds - turnRate) * Math.min(1, seconds / TURN_MEMORY_S)
        if (Math.abs(turnRate) > 0.02) sense = Math.sign(turnRate)
      }
      lastLook.copy(look)
      previous.position.copy(output.position)
      previous.target.copy(output.target)
      tracked = true
      return output
    },
    /** Drops the current move, so the next one starts from the camera as the visitor left it, at rest. */
    restart(): void {
      move = null
      idle = Infinity
      tracked = false
      turnRate = 0
      velocity.position.set(0, 0, 0)
      velocity.target.set(0, 0, 0)
    },
  }

  /**
   * Makes a move whose camera keeps clear of extended objects other than the one it leaves or heads for, trying
   * again a few times, so the tour never flies through a nebula or bubble on its way.
   */
  function clearOf(make: () => Move, ...ends: (string | null | undefined)[]): Move {
    const extended = host.objects().filter((star) => extentPc(star) > 0 && !ends.includes(star.id))
    let move = make()
    for (let attempt = 1; attempt < 4 && extended.length; attempt++) {
      const points = Array.from({ length: CLEARANCE_SAMPLES + 1 }, (_, index) => {
        move.pose(move.seconds * index / CLEARANCE_SAMPLES, probe)
        return probe.position.clone()
      })
      const spacing = Math.max(...points.slice(1).map((point, index) => point.distanceTo(points[index]!)))
      const crosses = extended.some((star) => {
        const at = host.position(star.id), clearance = extentPc(star) * 1.5 + spacing
        return at !== null && points.some((point) => point.distanceToSquared(at) < clearance * clearance)
      })
      if (!crosses) break
      move = make()
    }
    return move
  }

  /** Leaving an object it looks at, within this reach, a flight veers off rather than flying through it. */
  function veerOff(forward: Vector3, from: Vector3, leaving: Vector3 | null | undefined, reach: number): void {
    const past = leaving?.clone().sub(from)
    if (!past || past.lengthSq() < 1e-12 || past.length() > reach || forward.angleTo(past) >= DEPARTURE_ANGLE) return
    past.normalize()
    const away = forward.clone().addScaledVector(past, -forward.dot(past))
    if (away.lengthSq() < 1e-12) perpendicular(past, away).multiplyScalar(-sense)
    forward.copy(past).multiplyScalar(Math.cos(DEPARTURE_ANGLE)).addScaledVector(away.normalize(), Math.sin(DEPARTURE_ANGLE))
  }

  /** Cruises 30 to 300 ly straight on at a steady speed, looking ahead, with a gentle turn here and there. */
  function journey(view: DemoPose, leaving: Vector3 | null | undefined): Move {
    const from = view.position.clone()
    const forward = view.target.clone().sub(from)
    if (forward.lengthSq() < 1e-12) forward.copy(randomUnit())
    forward.normalize()
    // Evenly spread in proportion, so long and short journeys both come up.
    const distance = JOURNEY_LY[0] * (JOURNEY_LY[1] / JOURNEY_LY[0]) ** random() / LIGHT_YEARS_PER_PARSEC
    veerOff(forward, from, leaving, distance)
    const { seconds, share } = travelProfile(distance, travelSeconds(distance), velocity.position.length(), LOCAL_SPEED)
    // Two wide, gentle turns of 15° to 35°, each spread over a quarter of the way, both the way the view already turns.
    const turns = [0.1 + random() * 0.2, 0.5 + random() * 0.2].map((at) => ({ at, yaw: sense * (0.26 + random() * 0.35), pitch: (random() - 0.5) * 0.3 }))
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
    const lookAhead = Math.max(1, distance * 0.1)
    return {
      seconds,
      travel: true,
      pose(t, out) {
        const travelled = share(t) * steps
        const step = Math.min(steps - 1, Math.floor(travelled))
        out.position.lerpVectors(path[step]!, path[step + 1]!, travelled - step)
        out.target.copy(out.position).addScaledVector(direction(travelled / steps, heading), lookAhead)
      },
    }
  }

  /** Flies to the object at a steady speed in an arc that rises above the map, turning to it early. */
  function glide(view: DemoPose, id: string, to: Vector3, framing: number): Move {
    const from = view.position.clone(), lookFrom = view.target.clone().sub(from)
    const offset = from.clone().sub(to)
    const approach = (offset.lengthSq() > 1e-12 ? offset.normalize() : randomUnit()).addScaledVector(randomUnit(), 0.6).normalize()
    const end = to.clone().addScaledVector(approach, framing)
    const distance = from.distanceTo(end)
    const travel = end.clone().sub(from).normalize()
    const lift = UP.clone().addScaledVector(travel, -UP.dot(travel))
    if (lift.lengthSq() < 1e-6) perpendicular(travel, lift)
    lift.normalize().multiplyScalar(distance * 0.25)
    const path = tracePath((s, out) => out.lerpVectors(from, end, s).addScaledVector(lift, Math.sin(Math.PI * s)))
    const { seconds, share } = travelProfile(path.length, travelSeconds(distance), velocity.position.length(), LOCAL_SPEED * framing)
    const toObject = new Vector3(), turned = new Vector3()
    return {
      seconds,
      travel: true,
      select: { id, at: 0 },
      pose(t, out) {
        path.at(share(t), out.position)
        lookBetween(lookFrom, toObject.subVectors(to, out.position), smooth(Math.min(1, t / seconds * 2)), turned)
        out.target.copy(out.position).add(turned)
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
    // It keeps circling the way the view turns, even at the far point, and arrives a little farther around.
    const spin = -sense * 0.8
    const arrivalTurn = -sense * random() * 0.8
    const arrivalElevation = (random() - 0.5) * 0.6
    const far = VOYAGE_DISTANCE_PC[0] + random() * (VOYAGE_DISTANCE_PC[1] - VOYAGE_DISTANCE_PC[0])
    const [nearLog, farLog, endLog] = [Math.log(startRadius), Math.log(far), Math.log(framing)]
    const seconds = 48 + random() * 12
    const peak = 0.45
    const center = new Vector3()
    return {
      seconds,
      travel: true,
      select: { id, at: seconds * peak },
      pose(t, out) {
        const u = Math.min(1, t / seconds)
        const rise = smooth(Math.min(1, u / peak))
        const arrive = smooth(clamp((u - peak) / (1 - peak), 0, 1))
        const radius = Math.exp(arrive > 0 ? farLog + (endLog - farLog) * arrive : nearLog + (farLog - nearLog) * rise)
        const turn = azimuth + spin * u + arrivalTurn * arrive
        const tilt = (elevation + (VOYAGE_ELEVATION - elevation) * rise) * (1 - arrive) + arrivalElevation * arrive
        // It crosses over to the destination while still far out, where that is slow on screen, not while closing in.
        center.lerpVectors(from, to, smoother(Math.min(1, arrive * 1.6)))
        out.position.set(Math.cos(tilt) * Math.cos(turn), Math.sin(tilt), Math.cos(tilt) * Math.sin(turn)).multiplyScalar(radius).add(center)
        // The view swings to the destination early in the dive.
        out.target.lerpVectors(from, to, smooth(clamp((u - peak * 0.9) / 0.35, 0, 1)))
      },
    }
  }

  /** Flies like a ship at a steady speed: out along the view, then curving onto the object, which it picks on the way. */
  function cruise(view: DemoPose, id: string, to: Vector3, framing: number, leaving?: Vector3 | null): Move {
    const from = view.position.clone()
    const forward = view.target.clone().sub(from).normalize()
    veerOff(forward, from, leaving, from.distanceTo(to))
    const approach = to.clone().sub(from)
    if (approach.lengthSq() < 1e-12) approach.copy(forward)
    approach.normalize()
    // It arrives beside the object rather than through it, on the side that lets the view keep turning the same way onto it.
    const aside = perpendicular(approach).applyAxisAngle(approach, random() * Math.PI * 2)
    if ((approach.z * aside.x - approach.x * aside.z) * sense > 0) aside.negate()
    const end = to.clone().addScaledVector(aside, framing)
    const distance = from.distanceTo(end)
    // It sets off along the view, and comes in from where that leg points, so the turn spreads over the whole way.
    const control1 = from.clone().addScaledVector(forward, distance * 0.45)
    const control2 = end.clone().addScaledVector(end.clone().sub(control1).normalize(), -distance * 0.35)
    const path = tracePath((s, out) => {
      const r = 1 - s
      return out.copy(from).multiplyScalar(r ** 3).addScaledVector(control1, 3 * r * r * s).addScaledVector(control2, 3 * r * s * s).addScaledVector(end, s ** 3)
    })
    const { seconds, share } = travelProfile(path.length, travelSeconds(distance), velocity.position.length(), LOCAL_SPEED * framing)
    // Bézier derivative legs.
    const leg0 = control1.clone().sub(from), leg1 = control2.clone().sub(control1), leg2 = end.clone().sub(control2)
    const tangent = new Vector3(), toObject = new Vector3()
    const lookAhead = Math.max(0.5, distance * 0.1)
    return {
      seconds,
      travel: true,
      select: { id, at: seconds * 0.3 },
      pose(t, out) {
        const u = path.at(share(t), out.position), v = 1 - u
        tangent.copy(leg0).multiplyScalar(3 * v * v).addScaledVector(leg1, 6 * v * u).addScaledVector(leg2, 3 * u * u)
        if (tangent.lengthSq() < 1e-12) tangent.copy(forward)
        tangent.normalize()
        toObject.subVectors(to, out.position)
        const objectDistance = toObject.length()
        // The view swings from the flight path onto the object for the arrival, ending on it.
        const turn = smooth(clamp((t / seconds - 0.55) / 0.45, 0, 1))
        tangent.lerp(toObject.divideScalar(objectDistance || 1), turn).normalize()
        out.target.copy(out.position).addScaledVector(tangent, lookAhead + (objectDistance - lookAhead) * turn)
      },
    }
  }

  function localMove(kind: typeof LOCAL_MOVES[number], view: DemoPose, at: Vector3, framing: number): Move {
    if (kind === 'flyby') return flyby(view, at, framing)
    if (kind === 'pass') return pass(view, at, framing)
    if (kind === 'gaze') return gaze(view)
    if (kind === 'skim') return skim(view, at, framing)
    return circle(view, at, framing, kind === 'reveal')
  }

  /**
   * Orbits the object slowly while pulling back, so its surroundings come into view; a reveal pulls far back
   * over the region and returns.
   */
  function circle(view: DemoPose, at: Vector3, framing: number, reveal: boolean): Move {
    const offset = view.position.clone().sub(at)
    if (offset.lengthSq() < 1e-12) offset.set(framing, 0, 0)
    // It starts at the camera's distance, easing to its own.
    const radius = offset.length()
    const azimuth = Math.atan2(offset.z, offset.x)
    // Within the tilt limit from the start, so the orbit never runs into it; the handover covers the difference.
    const elevation = clamp(Math.asin(clamp(offset.y / offset.length(), -1, 1)), -1.1, 1.1)
    const finalElevation = (random() - 0.5) * 0.8
    const zoom = reveal ? 6 + random() * 8 : 1
    const settled = reveal ? framing : framing * (2.5 + random() * 2)
    // Orbiting turns the view against the orbit.
    const spin = -sense * Math.PI * 2 / (reveal ? 70 : 90)
    const seconds = reveal ? 20 + random() * 4 : 12 + random() * 6
    return {
      seconds,
      pose(t, out) {
        // The zoom eases in and out, so a reveal settles into its orbit rather than arriving at speed.
        const u = Math.min(1, t / seconds), arc = Math.sin(Math.PI * smooth(u))
        const distance = (radius + (settled - radius) * smooth(u)) * zoom ** arc
        const tilt = elevation + (finalElevation - elevation) * smooth(u) + (reveal ? 0.3 * arc : 0)
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
    // The orbit plane faces up, so the view turns with the orbit.
    const spin = sense
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
    const moving = velocity.position
    const across = acrossMotion(inward)
    // Aimed to miss the object by the closest distance halfway along, leaning toward it, or away while already leaving.
    const closest = Math.min(range, framing * (0.6 + random() * 0.6))
    const aside = range > 1e-9 ? Math.asin(closest / range) : Math.PI / 2
    const lean = moving.dot(inward) < -0.2 * moving.length() ? -1 : 1
    // It passes on the side that keeps the view turning the way it does, unless it passes over or under.
    const crossing = inward.z * across.x - inward.x * across.z
    const side = Math.abs(crossing) > 0.1 ? -sense * Math.sign(crossing) : across.dot(moving) < 0 ? -1 : 1
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

  /**
   * A close flyby: like a ship, it heads for the star and skims past it a few thousand AU out, slowing as it
   * passes, looking ahead while the star flares and slides by to the side.
   */
  function skim(view: DemoPose, at: Vector3, framing: number): Move {
    const from = view.position.clone()
    const inward = at.clone().sub(from)
    const range = inward.length()
    if (range > 1e-9) inward.divideScalar(range)
    else inward.copy(randomUnit())
    const closest = Math.min(range / 3, SKIM_PC[0] + random() * (SKIM_PC[1] - SKIM_PC[0]))
    const aside = range > 1e-9 ? Math.asin(closest / range) : 0
    const direction = inward.multiplyScalar(Math.cos(aside)).addScaledVector(acrossMotion(inward), Math.sin(aside))
    // It ends as far beyond the star as it started.
    const length = 2 * range * Math.cos(aside)
    const toward = at.clone().sub(from).addScaledVector(direction, -length / 2).normalize()
    const ahead = direction.clone().multiplyScalar(Math.cos(SKIM_LEAN)).addScaledVector(toward, Math.sin(SKIM_LEAN)).multiplyScalar(Math.max(0.5, framing))
    // Longer from farther away, so it never speeds up or slows down sharply.
    const seconds = 10 + 5 * Math.log2(1 + range) + random() * 3
    return {
      seconds,
      pose(t, out) {
        const u = Math.min(1, t / seconds)
        out.position.copy(from).addScaledVector(direction, length * (u - SKIM_SLOWING * Math.sin(2 * Math.PI * u) / (2 * Math.PI)))
        out.target.copy(out.position).add(ahead)
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
    const sweep = sense * Math.PI * (0.8 + random() * 0.3)
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
