export type MetricStatus = "high" | "medium" | "review" | "no_data";
export type MetricConfidence = "draft" | "released" | "deprecated";
export type MetricDisplayMode = "mirror" | "revised";
export type IncidentStatus = "open" | "investigating" | "resolved" | "known_limitation";
export type ValidationStatus = "pass" | "warn" | "fail" | "error";

export interface MetricResultDTO {
  key: string;
  value: number | null;
  status: MetricStatus;
  valueSourceA: number | null;
  valueSourceB: number | null;
  deltaPct: number | null;
  incidentId?: string;
  asOf: string;
}

export interface MetricDefinitionDTO {
  key: string;
  name: string;
  description: string | null;
  formula: string;
  sourceA: string;
  sourceB: string | null;
  tolerancePct: number | null;
  periodicity: string;
  confidence: MetricConfidence;
  displayMode: MetricDisplayMode;
  category: string | null;
}

export interface IncidentDTO {
  id: string;
  metricKey: string;
  detectedAt: string;
  delta: number | null;
  hypothesis: string | null;
  status: IncidentStatus;
  resolvedAt: string | null;
  resolution: string | null;
}

export interface ValidationResult {
  metricKey: string;
  status: ValidationStatus;
  delta: number | null;
  message: string;
}
