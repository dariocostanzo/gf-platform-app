export const safetyInformationSources = [
  "restaurant",
  "community",
  "independently_verified"
] as const;

export type SafetyInformationSource = (typeof safetyInformationSources)[number];

export interface SourcedSafetyClaim<T> {
  value: T;
  source: SafetyInformationSource;
  recordedAt: string;
  independentlyVerifiedAt?: string;
}
