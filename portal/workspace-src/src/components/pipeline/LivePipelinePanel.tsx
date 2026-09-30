import React, { useRef, useState } from 'react';
import { ExternalLink, FileUp, LoaderCircle, Play, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../state/appStore';
import { useProjectStore } from '../../state/projectStore';
import {
  artifactUrl,
  evaluateReference,
  startPipeline,
  uploadInput,
  uploadReference,
  viewerUrl,
  waitForJob,
  type EvaluationReport,
  type InputInfo,
  type PipelineResult,
} from '../../integration/api';

type Status = 'idle' | 'uploading' | 'ready' | 'running' | 'complete' | 'error';

export const LivePipelinePanel: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);
  const gcpRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('Upload a PNG, JPG, or GeoTIFF to use the real pipeline.');
  const [inputPath, setInputPath] = useState<string | null>(null);
  const [inputInfo, setLocalInputInfo] = useState<InputInfo | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [referencePath, setReferencePath] = useState<string | null>(null);
  const [gcpPath, setGcpPath] = useState<string | null>(null);
  const [referenceName, setReferenceName] = useState<string | null>(null);
  const [gcpName, setGcpName] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null);
  const notify = useAppStore((state) => state.notify);
  const setInput = useProjectStore((state) => state.setInputInfo);
  const setLiveResult = useProjectStore((state) => state.setLiveResult);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus('uploading');
    setResult(null);
    setViewer(null);
    setMessage(`Uploading ${file.name}...`);
    try {
      const uploaded = await uploadInput(file);
      setInputPath(uploaded.path);
      setLocalInputInfo(uploaded.input);
      setInput(uploaded.filename, uploaded.input);
      setStatus('ready');
      setMessage(`${uploaded.filename} is ready. Start the height pipeline.`);
      notify('Input uploaded and checked', 'success');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
      notify('Input upload failed', 'warning');
    } finally {
      event.target.value = '';
    }
  };

  const handleRun = async () => {
    if (!inputPath) return;
    setStatus('running');
    setMessage('Running depth inference, calibration, DEM fusion, and mesh export...');
    try {
      const started = await startPipeline(inputPath);
      const finished = await waitForJob(started.id, (job) => setMessage(job.message));
      if (finished.status === 'failed') throw new Error(finished.message);
      const nextResult = finished.result;
      const nextViewer = viewerUrl(nextResult);
      setResult(nextResult);
      setViewer(nextViewer);
      setEvaluation(null);
      setLiveResult(nextResult, nextViewer);
      setStatus('complete');
      setMessage('Finished. These are real outputs from the Python pipeline.');
      notify('Terrain generation complete', 'success');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Pipeline failed.');
      notify('Pipeline failed', 'warning');
    }
  };

  const handleReferenceUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: 'reference' | 'gcp',
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadReference(file);
      if (kind === 'reference') {
        setReferencePath(uploaded.path);
        setReferenceName(file.name);
      } else {
        setGcpPath(uploaded.path);
        setGcpName(file.name);
      }
      notify(`${file.name} added for validation`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Reference upload failed', 'warning');
    } finally {
      event.target.value = '';
    }
  };

  const handleEvaluate = async () => {
    if (!result?.dsm || (!referencePath && !gcpPath)) return;
    setStatus('running');
    setMessage('Comparing the DSM with the supplied reference...');
    try {
      const started = await evaluateReference(result.dsm, referencePath, gcpPath);
      const finished = await waitForJob(started.id, (job) => setMessage(job.message));
      if (finished.status === 'failed') throw new Error(finished.message);
      setEvaluation(finished.result as unknown as EvaluationReport);
      setStatus('complete');
      setMessage('Validation finished. The report uses only the supplied reference points/data.');
      notify('Validation report ready', 'success');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Validation failed.');
      notify('Validation failed', 'warning');
    }
  };

  const statusColor = status === 'error' ? '#fb7185' : status === 'complete' ? '#6ee7b7' : '#9aa8b8';

  return (
    <section className="live-pipeline-panel" aria-label="Live HeightNet pipeline">
      <div className="live-pipeline-heading">
        <div>
          <div className="live-pipeline-kicker">LIVE PIPELINE</div>
          <strong>Sentinel / image to terrain</strong>
        </div>
        {status === 'running' || status === 'uploading' ? <LoaderCircle className="live-pipeline-spin" size={16} /> : null}
      </div>
      <p className="live-pipeline-copy">This workspace is connected to the Python model server. The mountain preview disappears once a real mesh is ready.</p>
      <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.tif,.tiff" hidden onChange={handleUpload} />
      <input ref={referenceRef} type="file" accept=".tif,.tiff" hidden onChange={(event) => handleReferenceUpload(event, 'reference')} />
      <input ref={gcpRef} type="file" accept=".csv" hidden onChange={(event) => handleReferenceUpload(event, 'gcp')} />
      <div className="live-pipeline-actions">
        <button className="live-pipeline-button" onClick={() => inputRef.current?.click()} disabled={status === 'uploading' || status === 'running'}>
          <FileUp size={14} /> Choose image
        </button>
        <button className="live-pipeline-button live-pipeline-primary" onClick={handleRun} disabled={!inputPath || status === 'running' || status === 'uploading'}>
          <Play size={14} /> Run model
        </button>
      </div>
      <div className="live-pipeline-status" style={{ color: statusColor }}>
        {status === 'complete' ? <CheckCircle2 size={14} /> : status === 'error' ? <AlertTriangle size={14} /> : null}
        <span>{message}</span>
      </div>
      {inputInfo ? <div className="live-pipeline-meta">{inputInfo.kind} · {inputInfo.width}×{inputInfo.height} · {inputInfo.crs ?? 'no CRS'}</div> : null}
      {result ? (
        <div className="live-pipeline-outputs">
          <strong>Outputs</strong>
          {(['relative', 'agl', 'dsm', 'confidence'] as const).map((key) => result[key] ? (
            <a key={key} href={artifactUrl(result[key]) ?? '#'} target="_blank" rel="noreferrer">
              {key === 'relative' ? 'Relative depth' : key.toUpperCase()}
            </a>
          ) : null)}
          {viewer ? <a className="live-pipeline-viewer" href={viewer} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open actual 3D terrain</a> : null}
          {result.stats?.dsm ? <div className="live-pipeline-stats">
            DSM range {result.stats.dsm.min.toFixed(1)}–{result.stats.dsm.max.toFixed(1)} m · median {result.stats.dsm.median.toFixed(1)} m
          </div> : null}
        </div>
      ) : null}
      {result?.dsm ? (
        <div className="live-pipeline-validation">
          <strong>Check accuracy</strong>
          <span className="live-pipeline-help">Add a reference DSM or a CSV of surveyed points. Without either, we can only show the model output, not claim accuracy.</span>
          <div className="live-pipeline-actions">
            <button className="live-pipeline-button" onClick={() => referenceRef.current?.click()} disabled={status === 'running'}>Add reference DSM</button>
            <button className="live-pipeline-button" onClick={() => gcpRef.current?.click()} disabled={status === 'running'}>Add GCP CSV</button>
          </div>
          {referenceName ? <div className="live-pipeline-file">DSM: {referenceName}</div> : null}
          {gcpName ? <div className="live-pipeline-file">GCP: {gcpName}</div> : null}
          <button className="live-pipeline-button live-pipeline-primary" onClick={handleEvaluate} disabled={!referencePath && !gcpPath || status === 'running'}>Run validation</button>
          {evaluation ? <div className="live-pipeline-metrics">
            {evaluation.raster_metrics ? <MetricBlock label="Reference raster" metrics={evaluation.raster_metrics} /> : null}
            {evaluation.gcp_raw_metrics ? <MetricBlock label="GCP raw" metrics={evaluation.gcp_raw_metrics} /> : null}
            {evaluation.gcp_calibration?.holdout_metrics ? <MetricBlock label="GCP holdout after calibration" metrics={evaluation.gcp_calibration.holdout_metrics} /> : null}
            {evaluation.report_path ? <a href={artifactUrl(evaluation.report_path) ?? '#'} target="_blank" rel="noreferrer">Open full JSON report</a> : null}
          </div> : null}
        </div>
      ) : null}
    </section>
  );
};

const MetricBlock: React.FC<{ label: string; metrics: NonNullable<EvaluationReport['raster_metrics']> }> = ({ label, metrics }) => (
  <div className="live-pipeline-metric-block">
    <span>{label}</span>
    <span>MAE {metrics.mae_m.toFixed(2)} m · RMSE {metrics.rmse_m.toFixed(2)} m · bias {metrics.bias_m.toFixed(2)} m</span>
    <span>n={metrics.sample_count} · correlation {metrics.correlation == null ? 'n/a' : metrics.correlation.toFixed(3)}</span>
  </div>
);
