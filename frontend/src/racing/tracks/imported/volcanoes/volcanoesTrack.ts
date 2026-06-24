import volcanoesGeoJson from './volcanoes.source.json'
import { createImportedCarTrackDefinition } from '../../importedCarTrackDefinition'

export const volcanoesTrackDefinition = createImportedCarTrackDefinition({
  authoring: {
    id: 'volcanoes',
    displayName: 'Volcanoes',
    location: 'Volcanic Highlands',
    environment: 'forest',
    layoutSource: 'custom',
    geoJson: {
      jsonPath: 'frontend/src/racing/tracks/imported/volcanoes/volcanoes.source.json',
      worldSize: 2500,
      coordinateElevationScale: 0.7,
      sourceNotes: 'Browser-edited balanced mountain circuit used as the Volcanoes layout.'
    },
    startGate: {
      position: [-907.677824411937, 0.1, 189.26407093979128],
      direction: [0.5776911018888605, 0, 0.8162554690771966],
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
      notes: 'The initial generated hill-climb elevation follows the road centerline.'
    },
    spatialIndex: {
      samples: 7200
    },
    notes: 'Volcanoes uses the browser-edited balanced mountain layout and generic imported scenery.'
  },
  geoJsonData: volcanoesGeoJson,
  curveArcLengthDivisions: 14400
})
