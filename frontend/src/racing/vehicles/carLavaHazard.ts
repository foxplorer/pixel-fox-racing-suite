/**
 * Pure lava-contact test for the car. A track opts in by passing a `CarLavaHazard`
 * (e.g. the Volcanoes central basin + the jump pits); tracks that pass nothing are
 * unaffected — `isCarOverLava` returns false.
 *
 * Two region kinds:
 * - `polygons`: arbitrary closed outlines (the central lava lake), tested by ray
 *   casting in the XZ plane.
 * - `pits`: the molten gaps the car jumps over, as oriented boxes centred on the
 *   pit. `halfLength` runs along travel (the gap between the ramp lips) and
 *   `halfWidth` across the track. Only the open gap counts as lava — the ramps
 *   flanking it (beyond `halfLength`) are solid ground.
 */

export interface LavaPolygonZone {
  boundary: ReadonlyArray<{ x: number; z: number }>
  /**
   * Y of the visible lava sheet over this polygon, when known. The footprint is a
   * flat 2D outline, but the lava sheet sits at one height while the terrain inside
   * the outline varies — where rock rises above the sheet the lava is buried and
   * apparently-solid ground must NOT burn the car. With `surfaceY` set, the car only
   * burns here when the ground beneath it sits at or below the sheet (plus a small
   * shoreline margin). Omit to keep the pure 2D test (any point inside = lava).
   */
  surfaceY?: number
}

export interface LavaPitZone {
  x: number
  z: number
  /** Unit forward axis (direction of travel across the pit). */
  forwardX: number
  forwardZ: number
  /** Half the open gap along travel (lip to centre). */
  halfLength: number
  /** Half the molten width across the track. */
  halfWidth: number
}

export interface CarLavaHazard {
  polygons: LavaPolygonZone[]
  pits: LavaPitZone[]
}

export interface LavaContactHeights {
  groundY?: number
  vehicleY?: number
}

const isPointInPolygon = (
  x: number,
  z: number,
  boundary: ReadonlyArray<{ x: number; z: number }>
): boolean => {
  let inside = false
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const a = boundary[i]
    const b = boundary[j]
    const intersects =
      a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

// How far the ground may rise above the lava sheet and still count as molten
// shoreline. The sheet's float offset is already baked into `surfaceY`, so this is
// only a thin lip for the lava lapping the rock edge — kept small so the kill zone
// hugs the *visible* waterline. A larger value made a tall band of dry rock above
// the shore still blow the car up even though it was plainly not on the lava.
export const LAVA_SURFACE_CONTACT_MARGIN = 0.18
export const LAVA_VEHICLE_CONTACT_MARGIN = 0.28
export const LAVA_PIT_VEHICLE_CLEARANCE_MARGIN = 1.25

/**
 * True when (x, z) sits over molten lava in any of the hazard's regions.
 *
 * `contactHeights` is used only to gate polygon regions that carry a `surfaceY`:
 * where the ground or vehicle sits above the lava sheet, the flat sheet is buried
 * under solid rock or the car is simply near/above it and must not burn. Pits and
 * bare polygons (no `surfaceY`) ignore height entirely.
 */
export const isCarOverLava = (
  x: number,
  z: number,
  hazard: CarLavaHazard | undefined,
  contactHeights?: number | LavaContactHeights
): boolean => {
  if (!hazard) return false
  const heights = typeof contactHeights === 'number'
    ? { groundY: contactHeights }
    : contactHeights

  for (const pit of hazard.pits) {
    const dx = x - pit.x
    const dz = z - pit.z
    const along = Math.abs(dx * pit.forwardX + dz * pit.forwardZ)
    const across = Math.abs(dx * pit.forwardZ - dz * pit.forwardX)
    if (along <= pit.halfLength && across <= pit.halfWidth) {
      if (
        heights?.groundY !== undefined &&
        heights?.vehicleY !== undefined &&
        heights.vehicleY > heights.groundY + LAVA_PIT_VEHICLE_CLEARANCE_MARGIN
      ) {
        // The pit's X/Z footprint can extend under launch ramps; being above that
        // buried lava sheet on ramp concrete is not touching lava.
        continue
      }
      return true
    }
  }
  for (const polygon of hazard.polygons) {
    if (!isPointInPolygon(x, z, polygon.boundary)) continue
    if (
      polygon.surfaceY !== undefined &&
      heights?.groundY !== undefined &&
      heights.groundY > polygon.surfaceY + LAVA_SURFACE_CONTACT_MARGIN
    ) {
      // Terrain pokes above the lava sheet here — solid rock, not molten.
      continue
    }
    if (
      polygon.surfaceY !== undefined &&
      heights?.vehicleY !== undefined &&
      heights.vehicleY > polygon.surfaceY + LAVA_VEHICLE_CONTACT_MARGIN
    ) {
      // The car is above or beside a buried flat lava sheet, not touching visible lava.
      continue
    }
    return true
  }
  return false
}
