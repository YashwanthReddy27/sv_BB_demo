export type PoseRow = Record<string, number>;
export type Joint = 'Shoulder' | 'Elbow' | 'Wrist' | 'Hip' | 'Knee' | 'Ankle';
export type Side = 'Left' | 'Right';

export interface Mounted {
  destroy(): void;
}

export interface VideoSource {
  label: string;
  src: string;
}

export interface ComparePlayerOptions {
  /** First source is the master clock; the second follows it. */
  sources: VideoSource[];
}

export interface PoseChartOptions {
  rows: PoseRow[];
  joint: Joint;
  side: Side;
  title?: string;
  /** Flip the pixel Y axis so "up" in the video is up in the chart. Default true. */
  invertY?: boolean;
}

export interface Shot {
  label: string;
  raw: string;
  overlay: string;
  /** URL of the pose CSV for this shot. */
  data: string;
}

export interface ShotAnalysisOptions {
  shots: Shot[];
  joints?: Joint[];
  sides?: Side[];
  rawLabel?: string;
  overlayLabel?: string;
}

export function loadCsv(url: string): Promise<PoseRow[]>;
export function comparePlayer(
  el: HTMLElement,
  options: ComparePlayerOptions
): Mounted & { play(): void; pause(): void };
export function poseChart(el: HTMLElement, options: PoseChartOptions): Mounted;
export function shotAnalysis(
  el: HTMLElement,
  options: ShotAnalysisOptions
): Mounted & { select(index: number): void };
