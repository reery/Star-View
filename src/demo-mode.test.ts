import { expect, it } from 'vitest'
import { Vector3 } from 'three'
import type { Star } from './catalog-model'
import { createDemoTour } from './demo-mode'

/** A repeatable random sequence. */
function seeded(seed: number): () => number {
  return () => (seed = (seed * 1_664_525 + 1_013_904_223) % 2 ** 32) / 2 ** 32
}

it('tours every visible object in finite poses that keep the camera off its target', () => {
  // A loose cluster near the camera and a few outliers far away.
  const stars = Array.from({ length: 24 }, (_, index) => ({
    id: `star-${index}`,
    x_pc: index < 20 ? (index % 5) * 2 : 40 + index * 15,
    y_pc: index < 20 ? Math.floor(index / 5) * 2 : -30,
    z_pc: index % 3 - 1,
  }) as Star)
  const world = (star: Star) => new Vector3(star.x_pc, star.z_pc, -star.y_pc)
  let selectedId: string | null = null
  const camera = { position: [0, 3, 10], target: [0, 0, 0] }
  const reached = new Set<string>()
  const tour = createDemoTour({
    objects: () => stars,
    position: (id) => { const star = stars.find((candidate) => candidate.id === id); return star ? world(star) : null },
    view: () => camera,
    selectedId: () => selectedId,
    select: (id) => { selectedId = id; reached.add(id) },
  }, seeded(7))
  for (let frame = 0; frame < 120_000 && reached.size < stars.length; frame++) {
    const pose = tour.advance(0.1)
    expect(pose).not.toBeNull()
    const values = [...pose!.position.toArray(), ...pose!.target.toArray()]
    expect(values.every(Number.isFinite)).toBe(true)
    expect(pose!.position.distanceTo(pose!.target)).toBeGreaterThanOrEqual(0.119)
    camera.position = pose!.position.toArray()
    camera.target = pose!.target.toArray()
  }
  expect(reached.size).toBe(stars.length)
})

it('continues from the visitor’s selection after a restart', () => {
  const stars = [{ id: 'near', x_pc: 1, y_pc: 0, z_pc: 0 }, { id: 'far', x_pc: 300, y_pc: 0, z_pc: 0 }] as Star[]
  let selectedId: string | null = 'near'
  const tour = createDemoTour({
    objects: () => stars,
    position: (id) => { const star = stars.find((candidate) => candidate.id === id)!; return new Vector3(star.x_pc, star.z_pc, -star.y_pc) },
    view: () => ({ position: [0, 0, 1], target: [1, 0, 0] }),
    selectedId: () => selectedId,
    select: (id) => { selectedId = id },
  }, seeded(3))
  tour.advance(0.1)
  // A far selection becomes the next destination, and the flight starts from the visitor's view.
  selectedId = 'far'
  tour.restart()
  const pose = tour.advance(0.1)!
  expect(selectedId).toBe('far')
  expect(pose.position.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(0.1)
})

it('mostly hops to near neighbors, now and then a bit farther', () => {
  // A 10 × 10 field 2 pc apart: neighbors beyond the closest dozen lie more than 5 pc away.
  const stars = Array.from({ length: 100 }, (_, index) => ({ id: `star-${index}`, x_pc: (index % 10) * 2, y_pc: Math.floor(index / 10) * 2, z_pc: 0 }) as Star)
  const world = (star: Star) => new Vector3(star.x_pc, star.z_pc, -star.y_pc)
  let selectedId: string | null = 'star-44'
  const camera = { position: [8, 1, -8], target: [8, 0, -8.5] }
  const hops: number[] = []
  const tour = createDemoTour({
    objects: () => stars,
    position: (id) => world(stars.find((star) => star.id === id)!),
    view: () => camera,
    selectedId: () => selectedId,
    select: (id) => {
      hops.push(world(stars.find((star) => star.id === selectedId)!).distanceTo(world(stars.find((star) => star.id === id)!)))
      selectedId = id
    },
  }, seeded(11))
  for (let frame = 0; frame < 200_000 && hops.length < 20; frame++) {
    const pose = tour.advance(0.1)!
    camera.position = pose.position.toArray()
    camera.target = pose.target.toArray()
  }
  expect(hops.filter((hop) => hop > 5).length).toBeGreaterThan(0)
  expect(hops.filter((hop) => hop <= 5).length).toBeGreaterThan(hops.length / 2)
})

it('keeps the camera moving through every move and handover', () => {
  const stars = Array.from({ length: 40 }, (_, index) => ({ id: `star-${index}`, x_pc: (index % 8) * 1.5, y_pc: Math.floor(index / 8) * 1.5, z_pc: (index % 3) * 0.5 }) as Star)
  for (const seed of [1, 5, 9, 13, 21, 34]) {
    let selectedId: string | null = null
    const camera = { position: [0, 2, 6], target: [0, 0, 0] }
    const tour = createDemoTour({
      objects: () => stars,
      position: (id) => { const star = stars.find((candidate) => candidate.id === id)!; return new Vector3(star.x_pc, star.z_pc, -star.y_pc) },
      view: () => camera,
      selectedId: () => selectedId,
      select: (id) => { selectedId = id },
    }, seeded(seed))
    // What the eye sees: the view turning, or the camera moving relative to how far it looks, in radians per second.
    let slowest = Infinity, steepest = 0
    for (let frame = 0; frame < 30_000; frame++) {
      const pose = tour.advance(1 / 30)!
      const position = new Vector3(...camera.position), target = new Vector3(...camera.target)
      const look = target.clone().sub(position)
      const turn = look.angleTo(pose.target.clone().sub(pose.position))
      const shift = pose.position.distanceTo(position) / look.length()
      // The demo itself starts from rest, so the check begins once its first move has taken over.
      if (frame > 90) slowest = Math.min(slowest, Math.max(turn, shift) * 30)
      const view = pose.target.clone().sub(pose.position)
      steepest = Math.max(steepest, Math.abs(Math.atan2(view.y, Math.hypot(view.x, view.z))))
      camera.position = pose.position.toArray()
      camera.target = pose.target.toArray()
    }
    // At least about 0.3° a second, even for the instant a move changes direction.
    expect(slowest).toBeGreaterThan(0.005)
    // Never steeper than about 57°, where the heading would spin and the view seem to roll.
    expect(steepest).toBeLessThanOrEqual(1 + 1e-9)
  }
})

it('moves on from a crowded cluster after a few hops', () => {
  // 60 members within 1 pc, and field stars 8 to 40 pc away.
  const members = Array.from({ length: 60 }, (_, index) => ({ id: `member-${index}`, x_pc: Math.cos(index * 2.4) * (index % 10) / 10, y_pc: Math.sin(index * 2.4) * (index % 10) / 10, z_pc: (index % 5 - 2) / 5 }) as Star)
  const field = Array.from({ length: 12 }, (_, index) => ({ id: `field-${index}`, x_pc: Math.cos(index) * (8 + index * 3), y_pc: Math.sin(index) * (8 + index * 3), z_pc: 0 }) as Star)
  const stars = [...members, ...field]
  let selectedId: string | null = 'member-0'
  const camera = { position: [0, 0.5, 1.5], target: [0, 0, 0] }
  const reached: string[] = []
  const tour = createDemoTour({
    objects: () => stars,
    position: (id) => { const star = stars.find((candidate) => candidate.id === id)!; return new Vector3(star.x_pc, star.z_pc, -star.y_pc) },
    view: () => camera,
    selectedId: () => selectedId,
    select: (id) => { selectedId = id; reached.push(id) },
  }, seeded(17))
  for (let frame = 0; frame < 200_000 && reached.length < 10; frame++) {
    const pose = tour.advance(0.1)!
    camera.position = pose.position.toArray()
    camera.target = pose.target.toArray()
  }
  // Nearest-first alone would visit all 60 members before leaving.
  expect(reached.slice(0, 10).some((id) => id.startsWith('field'))).toBe(true)
})

it('now and then pulls back until the Milky Way shows, then dives into another object', () => {
  const stars = Array.from({ length: 200 }, (_, index) => ({ id: `star-${index}`, x_pc: (index % 20) * 3 - 30, y_pc: Math.floor(index / 20) * 3 - 15, z_pc: index % 4 - 2 }) as Star)
  const world = (star: Star) => new Vector3(star.x_pc, star.z_pc, -star.y_pc)
  let selectedId: string | null = 'star-110'
  const camera = { position: [0, 1, 2], target: [0, 0, 0] }
  const tour = createDemoTour({
    objects: () => stars,
    position: (id) => world(stars.find((star) => star.id === id)!),
    view: () => camera,
    selectedId: () => selectedId,
    select: (id) => { selectedId = id },
  }, seeded(3))
  let farthest = 0
  for (let frame = 0; frame < 40_000 && farthest < 1_800; frame++) {
    const pose = tour.advance(0.1)!
    farthest = Math.max(farthest, pose.position.length())
    camera.position = pose.position.toArray()
    camera.target = pose.target.toArray()
  }
  // The Galaxy fades in from 3,000 ly, about 920 pc.
  expect(farthest).toBeGreaterThan(1_800)
})

it('eases between fast and slow moves without jolts', () => {
  // Mixed scales: a tight group, a sparse field and far outliers, so fast flights hand over to slow local moves.
  const stars = [
    ...Array.from({ length: 30 }, (_, index) => ({ id: `group-${index}`, x_pc: Math.cos(index) * (index % 6) * 0.3, y_pc: Math.sin(index) * (index % 6) * 0.3, z_pc: (index % 3 - 1) * 0.2 })),
    ...Array.from({ length: 30 }, (_, index) => ({ id: `field-${index}`, x_pc: Math.cos(index * 1.7) * (5 + index * 2), y_pc: Math.sin(index * 1.7) * (5 + index * 2), z_pc: (index % 5 - 2) * 2 })),
    ...Array.from({ length: 6 }, (_, index) => ({ id: `outlier-${index}`, x_pc: Math.cos(index) * 300, y_pc: Math.sin(index) * 300, z_pc: 10 })),
  ] as Star[]
  for (const seed of [1, 5, 9, 13, 21, 34]) {
    let selectedId: string | null = null
    const camera = { position: [0, 2, 6], target: [0, 0, 0] }
    const tour = createDemoTour({
      objects: () => stars,
      position: (id) => { const star = stars.find((candidate) => candidate.id === id)!; return new Vector3(star.x_pc, star.z_pc, -star.y_pc) },
      view: () => camera,
      selectedId: () => selectedId,
      select: (id) => { selectedId = id },
    }, seeded(seed))
    // Change of velocity per second, in view distances per second: what makes a speed change feel abrupt.
    let harshest = 0, previous: Vector3 | null = null
    for (let frame = 0; frame < 30_000; frame++) {
      const pose = tour.advance(1 / 30)!
      const position = new Vector3(...camera.position)
      const velocity = pose.position.clone().sub(position).multiplyScalar(30)
      if (previous && frame > 90) harshest = Math.max(harshest, velocity.distanceTo(previous) * 30 / position.distanceTo(new Vector3(...camera.target)))
      previous = velocity
      camera.position = pose.position.toArray()
      camera.target = pose.target.toArray()
    }
    expect(harshest).toBeLessThan(1)
  }
})

it('journeys 30 to 300 ly on its own, easing brightness ratings over to the camera and back', () => {
  const stars = Array.from({ length: 200 }, (_, index) => ({ id: `star-${index}`, x_pc: (index % 20) * 3 - 30, y_pc: Math.floor(index / 20) * 3 - 15, z_pc: index % 4 - 2 }) as Star)
  const world = (star: Star) => new Vector3(star.x_pc, star.z_pc, -star.y_pc)
  let selectedId: string | null = 'star-110'
  const camera = { position: [0, 1, 2], target: [0, 0, 0] }
  let lastSelection = new Vector3(), longestUnselected = 0
  const tour = createDemoTour({
    objects: () => stars,
    position: (id) => world(stars.find((star) => star.id === id)!),
    view: () => camera,
    selectedId: () => selectedId,
    select: (id) => { selectedId = id; lastSelection = new Vector3(...camera.position) },
  }, seeded(8))
  // Seconds from the first rating off the selection until it rates from the camera alone, and back.
  let shipStart: number | null = null, toShip = 0, shipEnd: number | null = null, toSelection = 0
  for (let frame = 0; frame < 60_000 && !toSelection; frame++) {
    const pose = tour.advance(0.1)!
    const onCamera = pose.observer !== null && pose.observer.distanceTo(pose.position) < 1e-9
    if (pose.observer && shipStart === null) shipStart = frame
    if (onCamera && shipStart !== null && !toShip) toShip = (frame - shipStart) * 0.1
    if (toShip && !onCamera && shipEnd === null) shipEnd = frame
    if (shipEnd !== null && !pose.observer) toSelection = (frame - shipEnd) * 0.1
    longestUnselected = Math.max(longestUnselected, pose.position.distanceTo(lastSelection))
    camera.position = pose.position.toArray()
    camera.target = pose.target.toArray()
  }
  expect(toShip).toBeGreaterThan(3.5)
  expect(toSelection).toBeGreaterThan(3.5)
  // 30 ly is about 9.2 pc.
  expect(longestUnselected).toBeGreaterThan(9)
})
