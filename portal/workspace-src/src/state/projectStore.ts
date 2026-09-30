import { create } from 'zustand';
import type { ProjectData, ProjectMetadata } from '../types/project';
import { GEO_BOUNDS, ELEVATION_MIN, ELEVATION_MAX } from '../renderer/noise/terrainNoise';
import { artifactUrl, type InputInfo, type PipelineResult } from '../integration/api';

const defaultMetadata: ProjectMetadata = {
  id: 'heightnet-live-session',
  name: 'No live terrain loaded',
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
  crs: 'No CRS loaded',
  bounds: {
    west: GEO_BOUNDS.west,
    east: GEO_BOUNDS.east,
    south: GEO_BOUNDS.south,
    north: GEO_BOUNDS.north,
  },
  dimensions: {
    width: 0,
    height: 0,
    bands: 3,
    dataType: 'Waiting for input',
    resolutionMeters: 10,
  },
  elevationStats: {
    min: ELEVATION_MIN,
    max: ELEVATION_MAX,
    mean: 0,
    unit: 'meters (AMSL)',
  },
  depthModel: {
    name: 'Depth Anything V2 fine-tuned on GAMUS',
    version: 'HeightNet local pipeline',
    confidenceScore: 0,
    inferenceTimeMs: 0,
    checkpoint: 'Configured by the Python pipeline',
  },
};

interface ProjectStore {
  project: ProjectData;
  setProjectName: (name: string) => void;
  updateMetadata: (meta: Partial<ProjectMetadata>) => void;
  setInputInfo: (name: string, info: InputInfo) => void;
  setLiveResult: (result: PipelineResult, viewerUrl: string | null) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: {
    metadata: defaultMetadata,
    sourceRasterUrl: '',
    depthMapUrl: '',
    has3DReady: false,
    liveViewerUrl: null,
    rawOutputPaths: {
      relative: null,
      agl: null,
      dsm: null,
      confidence: null,
      uncertainty: null,
    },
    outputs: {
      relative: null,
      agl: null,
      dsm: null,
      confidence: null,
      uncertainty: null,
      metadata: null,
      mesh: null,
      texture: null,
    },
  },
  setProjectName: (name: string) =>
    set((state) => ({
      project: {
        ...state.project,
        metadata: { ...state.project.metadata, name },
      },
    })),
  updateMetadata: (meta) =>
    set((state) => ({
      project: {
        ...state.project,
        metadata: { ...state.project.metadata, ...meta },
      },
    })),
  setInputInfo: (name, info) =>
    set((state) => ({
      project: {
        ...state.project,
        metadata: {
          ...state.project.metadata,
          name,
          crs: info.crs ?? 'No CRS loaded',
          updated: new Date().toISOString(),
          dimensions: {
            ...state.project.metadata.dimensions,
            width: info.width,
            height: info.height,
            dataType: info.kind === 'georeferenced' ? 'GeoTIFF input' : 'PNG/JPG input',
          },
        },
      },
    })),
  setLiveResult: (result, liveViewerUrl) =>
    set((state) => ({
      project: {
        ...state.project,
        sourceRasterUrl: artifactUrl(result.texture) ?? '',
        depthMapUrl: artifactUrl(result.relative) ?? '',
        has3DReady: Boolean(result.mesh),
        liveViewerUrl,
        rawOutputPaths: {
          relative: result.relative ?? null,
          agl: result.agl ?? null,
          dsm: result.dsm ?? null,
          confidence: result.confidence ?? null,
          uncertainty: result.uncertainty ?? null,
        },
        outputs: {
          relative: artifactUrl(result.relative),
          agl: artifactUrl(result.agl),
          dsm: artifactUrl(result.dsm),
          confidence: artifactUrl(result.confidence),
          uncertainty: artifactUrl(result.uncertainty),
          metadata: artifactUrl(result.metadata),
          mesh: artifactUrl(result.mesh),
          texture: artifactUrl(result.texture),
        },
        metadata: {
          ...state.project.metadata,
          updated: new Date().toISOString(),
        },
      },
    })),
}));
