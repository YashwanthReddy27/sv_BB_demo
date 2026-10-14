import { useEffect, useRef } from "react";
import {
  comparePlayer,
  poseChart,
  shotAnalysis,
  type ComparePlayerOptions,
  type PoseChartOptions,
  type ShotAnalysisOptions,
} from "./sportsvision.js";
import "./sportsvision.css";

// Props are read when the component mounts. To swap the content, change `key`.

export function ComparePlayer({ className, ...options }: ComparePlayerOptions & { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(options);
  useEffect(() => {
    const mounted = comparePlayer(ref.current!, latest.current);
    return () => mounted.destroy();
  }, []);
  return (
    <div className={`sv-root ${className ?? ""}`}>
      <div className="sv-card" ref={ref} />
    </div>
  );
}

export function PoseChart({ className, ...options }: PoseChartOptions & { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(options);
  useEffect(() => {
    const mounted = poseChart(ref.current!, latest.current);
    return () => mounted.destroy();
  }, []);
  return (
    <div className={`sv-root ${className ?? ""}`}>
      <div className="sv-card" ref={ref} />
    </div>
  );
}

export function ShotAnalysis({ className, ...options }: ShotAnalysisOptions & { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(options);
  useEffect(() => {
    const mounted = shotAnalysis(ref.current!, latest.current);
    return () => mounted.destroy();
  }, []);
  return (
    <div className={`sv-root ${className ?? ""}`}>
      <div ref={ref} />
    </div>
  );
}
