import unitedKingdomGeoJson from './unitedKingdom.source.json'
import { createImportedCarTrackDefinition } from '../../importedCarTrackDefinition'

export const unitedKingdomTrackDefinition = createImportedCarTrackDefinition({
  authoring: {
    id: 'united-kingdom',
    displayName: 'United Kingdom',
    location: 'United Kingdom',
    environment: 'forest',
    layoutSource: 'custom',
    geoJson: {
      jsonPath: 'frontend/src/racing/tracks/imported/unitedKingdom/unitedKingdom.source.json',
      worldSize: 2500,
      coordinateElevationScale: 0.45,
      sourceNotes: 'Custom United Kingdom mountain hairpin GeoJSON layout with softened authored route-editor elevations.'
    },
    startGate: {
      position: [-73.91431932683095, 0.1, -825.8470831976576],
      direction: [-0.9997865363477763, 0, -0.02066111656510051],
      gateWidth: 20
    },
    scenery: {
      preset: 'belgium-forest',
      file: 'frontend/src/racing/tracks/imported/unitedKingdom/unitedKingdomScenery.tsx'
    },
    terrain: {
      heightProvider: 'terrain-system',
      currentElevationSource: 'authored',
      plannedElevationSource: 'authored',
      roadBlendDistance: 72,
      notes: 'Road centerline follows softened custom authored elevation. The road corridor stays laterally level and blends into surrounding mountain terrain.'
    },
    notes: 'Custom United Kingdom mountain hairpin car-track definition with reduced elevation amplitude for smoother racing.'
  },
  geoJsonData: unitedKingdomGeoJson
})
