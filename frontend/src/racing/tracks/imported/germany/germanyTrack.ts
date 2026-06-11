import germanyGeoJson from './germany.raw-elevated.json'
import { createImportedCarTrackDefinition } from '../../importedCarTrackDefinition'

export const germanyTrackDefinition = createImportedCarTrackDefinition({
  authoring: {
    id: 'germany',
    displayName: 'Germany',
    location: 'Germany',
    environment: 'forest',
    layoutSource: 'custom',
    geoJson: {
      jsonPath: 'frontend/src/racing/tracks/imported/germany/germany.raw-elevated.json',
      worldSize: 2500,
      coordinateElevationScale: 0.7,
      sourceNotes: 'Custom browser-drawn mountain layout with authored elevation from the route editor.'
    },
    startGate: {
      position: [517.49906803647, 0.1, 663.3846005305669],
      direction: [0.9994086641472743, 0, -0.034384909878615345],
      gateWidth: 20
    },
    scenery: {
      preset: 'belgium-forest'
    },
    terrain: {
      heightProvider: 'terrain-system',
      currentElevationSource: 'authored',
      plannedElevationSource: 'authored',
      roadBlendDistance: 72,
      notes: 'Road centerline follows custom authored elevation. The road corridor stays laterally level and blends into the surrounding mountain terrain.'
    },
    spatialIndex: {
      samples: 7200
    },
    notes: 'Custom Germany mountain layout authored in the route editor. Start Y is derived from the terrain sampler.'
  },
  geoJsonData: germanyGeoJson,
  trackSegments: 3600,
  curveArcLengthDivisions: 14400,
  appendClosurePoint: false
})
