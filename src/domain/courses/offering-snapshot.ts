import fs from 'node:fs';
import path from 'node:path';

export type WeekRange = { start: number; end: number };
export type OfferingMeeting = { day: string; startPeriod: number; endPeriod: number; room: string; weeks: WeekRange[] };
export type OfferingTarget = { department: string; grade: string; category: string; rowNumber: number };
export type OfferingSection = {
  id: string;
  courseCode: string;
  section: string;
  title: string;
  credits: number;
  departments: string[];
  targets: OfferingTarget[];
  meetings: OfferingMeeting[];
  weeks: WeekRange[];
  remote: boolean;
  cyber: boolean;
  hasScheduledTime: boolean;
  state: 'listed' | 'cancelled';
  cancellationStatus: 'unknown' | 'confirmed-active' | 'confirmed-cancelled';
  restrictionStatus: 'unknown';
  sourceRows: number[];
  reviewFlags: string[];
};
export type OfferingSnapshot = {
  term: string;
  provenance: { source: string; sourceFile: string; sha256: string; retrievedAt: string; retrievedAtBasis: string; importedAt: string };
  status: 'staged' | 'approved' | 'active';
  sections: OfferingSection[];
  rawRows: Array<{ rowNumber: number; values: string[] }>;
  review: Array<{ rowNumber: number; reason: string }>;
  approval?: { by: string; at: string };
  activatedAt?: string;
};

const snapshotDirectory = path.join(process.cwd(), 'data', 'course-offerings');

export function getActiveOfferingSnapshot(term: string): OfferingSnapshot | null {
  if (!/^\d{4}-[12]$/.test(term)) return null;
  const indexPath = path.join(snapshotDirectory, 'active.json');
  if (!fs.existsSync(indexPath)) return null;
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as Record<string, string>;
  const file = index[term];
  if (!file || !/^[a-zA-Z0-9._-]+\.json$/.test(file)) return null;
  const snapshot = JSON.parse(fs.readFileSync(path.join(snapshotDirectory, file), 'utf8')) as OfferingSnapshot;
  if (snapshot.term !== term || snapshot.status !== 'active' || !snapshot.approval) return null;
  return snapshot;
}
