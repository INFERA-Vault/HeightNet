export interface InputInfo {
  kind: string;
  width: number;
  height: number;
  crs: string | null;
}

export interface PipelineResult {
  relative?: string;
  agl?: string;
  dsm?: string;
  uncertainty?: string;
  confidence?: string;
  scene_risk?: string;
  scene_quality?: string;
  metadata?: string;
  mesh?: string;
  material?: string;
  texture?: string;
  mesh_metadata?: string;
  mesh_rgb?: string;
  stats?: Record<string, RasterStats>;
}

export interface RasterStats {
  path: string;
  shape: [number, number];
  count: number;
  dtype: string;
  crs: string | null;
  valid_fraction: number;
  min: number;
  p01: number;
  median: number;
  p99: number;
  max: number;
  mean: number;
  std: number;
}

export interface InspectionResult {
  row: number;
  column: number;
  value_m: number;
  slope_degrees: number | null;
  map_x: number;
  map_y: number;
  crs: string | null;
}

export interface EvaluationReport {
  prediction: string;
  report_path?: string;
  raster_metrics?: {
    sample_count: number;
    mae_m: number;
    rmse_m: number;
    bias_m: number;
    correlation: number | null;
    r2: number | null;
  };
  gcp_raw_metrics?: EvaluationReport['raster_metrics'];
  gcp_calibration?: {
    calibration_metrics: NonNullable<EvaluationReport['raster_metrics']>;
    holdout_metrics: NonNullable<EvaluationReport['raster_metrics']>;
    calibration_count: number;
    holdout_count: number;
  };
}

export interface JobResponse {
  id: string;
  kind: string;
  status: 'queued' | 'running' | 'complete' | 'failed' | string;
  message: string;
  result: PipelineResult;
}

export const API_BASE = window.location.origin.startsWith('http')
  ? window.location.origin
  : 'http://127.0.0.1:8000';

export function artifactUrl(path: string | undefined): string | null {
  if (!path) return null;
  return `${API_BASE}/api/file?path=${encodeURIComponent(path)}`;
}

export function viewerUrl(result: PipelineResult): string | null {
  if (!result.mesh) return null;
  const params = new URLSearchParams({
    obj: artifactUrl(result.mesh) ?? '',
    mtl: artifactUrl(result.material) ?? '',
    texture: artifactUrl(result.texture) ?? '',
    metadata: artifactUrl(result.mesh_metadata) ?? '',
  });
  return `${API_BASE}/viewer/?${params.toString()}`;
}

export async function uploadReference(file: File): Promise<{ path: string; filename: string; reference: { kind: string } }> {
  const response = await fetch(`${API_BASE}/api/upload-reference`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': file.name,
    },
    body: file,
  });
  return readJson(response);
}

export async function inspectRaster(
  path: string,
  x: number,
  y: number,
): Promise<InspectionResult> {
  const query = new URLSearchParams({ path, x: String(x), y: String(y), mode: 'pixel' });
  const response = await fetch(`${API_BASE}/api/inspect?${query.toString()}`);
  return readJson(response);
}

export async function evaluateReference(
  predictionPath: string,
  referencePath: string | null,
  gcpPath: string | null,
): Promise<JobResponse> {
  const response = await fetch(`${API_BASE}/api/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prediction_path: predictionPath,
      reference_path: referencePath,
      gcp_csv: gcpPath,
    }),
  });
  return readJson(response);
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (payload && typeof payload === 'object' && 'error' in payload)) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String(payload.error)
      : `Request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function uploadInput(file: File): Promise<{ path: string; filename: string; input: InputInfo }> {
  const response = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Filename': file.name,
    },
    body: file,
  });
  return readJson(response);
}

export async function startPipeline(inputPath: string): Promise<JobResponse> {
  const response = await fetch(`${API_BASE}/api/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_path: inputPath }),
  });
  return readJson(response);
}

export async function getJob(jobId: string): Promise<JobResponse> {
  const response = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}`);
  return readJson(response);
}

export async function waitForJob(
  jobId: string,
  onUpdate: (job: JobResponse) => void,
): Promise<JobResponse> {
  for (;;) {
    const job = await getJob(jobId);
    onUpdate(job);
    if (job.status === 'complete' || job.status === 'failed') return job;
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }
}
