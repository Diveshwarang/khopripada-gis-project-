import Dexie, { type Table } from 'dexie';
import Papa from 'papaparse';
import type { ApprovalStatus } from '../types';

export interface OfflineGrievance {
  id?: number;
  title: string;
  category: 'water' | 'electricity' | 'roads' | 'sanitation' | 'health' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  latitude: number;
  longitude: number;
  timestamp: number;
  synced: boolean;
  description?: string;
  reporterName?: string;
  photoBase64?: string;
  approval_status?: ApprovalStatus;
  submitted_by?: string;
  status?: 'reported' | 'under_inspection' | 'in_progress' | 'resolved' | string;
}

export interface CachedFacility {
  facility_id: string;
  name: string;
  category: string;
  operational_status: 'functional' | 'partially_functional' | 'non_functional' | string;
  upi_available?: boolean;
  monsoon_accessible: string;
  latitude: number;
  longitude: number;
  notes?: string;
  source?: string;
  zone?: string;
  photoBase64?: string;
  photo_url?: string;
  approval_status?: ApprovalStatus;
  submitted_by?: string;
  scheme_name?: string;
  // Context-Aware Attributes
  business_hours?: string;
  service_type?: string;
  health_services?: string;
  operational_hours?: string;
  grade_levels?: string;
  midday_meal?: boolean;
  midday_meal_available?: boolean;
  filtered_water?: boolean;
  drinking_water_available?: boolean;
  supply_timings?: string;
  water_supply_timings?: string;
  potability_status?: string;
  water_potability?: string;
  maintenance_authority?: string;
  community_usage?: string;
  seating_capacity?: string;
  fixture_type?: string;
  lighting_fixture_type?: string;
  power_grid?: string;
  power_grid_feeder?: string;
}


export interface CachedIssue {
  issue_id: string;
  title: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  reported_by?: string;
  latitude: number;
  longitude: number;
  status: 'reported' | 'under_inspection' | 'in_progress' | 'resolved' | string;
  notes?: string;
  ai_priority_score?: number;
  ai_rank?: number;
  estimated_budget_inr?: number;
  ai_recommendation?: string;
  source?: string;
  zone?: string;
  photoBase64?: string;
  photo_url?: string;
  approval_status?: ApprovalStatus;
  submitted_by?: string;
}

export class SmartVillageOfflineDB extends Dexie {
  offline_grievances!: Table<OfflineGrievance, number>;
  cached_facilities!: Table<CachedFacility, string>;
  cached_issues!: Table<CachedIssue, string>;

  constructor() {
    super('SmartVillageOfflineDB');
    this.version(1).stores({
      offline_grievances:
        '++id, title, category, severity, latitude, longitude, timestamp, synced',
      cached_facilities:
        'facility_id, name, category, operational_status, latitude, longitude',
    });
    this.version(2).stores({
      offline_grievances:
        '++id, title, category, severity, latitude, longitude, timestamp, synced',
      cached_facilities:
        'facility_id, name, category, operational_status, latitude, longitude',
      cached_issues:
        'issue_id, title, category, severity, status, latitude, longitude',
    });
    this.version(3).stores({
      offline_grievances:
        '++id, title, category, severity, latitude, longitude, timestamp, synced, approval_status, submitted_by, status',
      cached_facilities:
        'facility_id, name, category, operational_status, latitude, longitude, approval_status, submitted_by',
      cached_issues:
        'issue_id, title, category, severity, status, latitude, longitude, approval_status, submitted_by',
    });
  }
}

export const db = new SmartVillageOfflineDB();

const FACILITIES_DATA_VERSION = 'v3_field_kobo_media';

/**
 * Parses CSV text into array of CachedFacility objects using PapaParse
 */
export const parseFacilitiesCsv = (csvText: string): CachedFacility[] => {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const facilities: CachedFacility[] = [];

  for (const row of result.data) {
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);

    // Filter out any rows with invalid, missing, or zero coordinates
    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat === 0 ||
      lng === 0 ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      !row.facility_id ||
      !row.name
    ) {
      continue;
    }

    const upiRaw = (row.upi_available || '').trim().toLowerCase();
    const upi_available = upiRaw === 'true' || upiRaw === '1' || upiRaw === 'yes';

    // Ingest photo from KoboCollect image columns (photo, image, attachment, photo_url)
    const rawPhoto = (row.photo || row.image || row.attachment || row.photo_url || row.image_url || '').trim();
    let photoUrl: string | undefined = undefined;
    if (rawPhoto) {
      if (rawPhoto.startsWith('http') || rawPhoto.startsWith('data:')) {
        photoUrl = rawPhoto;
      } else {
        photoUrl = `/media/${rawPhoto}`;
      }
    }

    facilities.push({
      facility_id: row.facility_id.trim(),
      name: row.name.trim(),
      category: (row.category || 'other').trim().toLowerCase(),
      operational_status: (row.operational_status || 'functional').trim().toLowerCase(),
      upi_available,
      monsoon_accessible: (row.monsoon_accessible || 'year_round').trim(),
      latitude: lat,
      longitude: lng,
      notes: (row.notes || '').trim(),
      source: (row.source || 'field_survey').trim(),
      zone: (row.zone || '').trim(),
      photoBase64: photoUrl,
      approval_status: 'approved',
      submitted_by: 'Baseline Field Survey',
      business_hours: row.business_hours ? row.business_hours.trim() : undefined,
      service_type: row.service_type ? row.service_type.trim() : undefined,
      health_services: row.health_services ? row.health_services.trim() : undefined,
      operational_hours: row.operational_hours ? row.operational_hours.trim() : undefined,
      grade_levels: row.grade_levels ? row.grade_levels.trim() : undefined,
      midday_meal: row.midday_meal ? row.midday_meal.toLowerCase() === 'true' || row.midday_meal === '1' || row.midday_meal.toLowerCase() === 'yes' : undefined,
      filtered_water: row.filtered_water ? row.filtered_water.toLowerCase() === 'true' || row.filtered_water === '1' || row.filtered_water.toLowerCase() === 'yes' : undefined,
      supply_timings: row.supply_timings ? row.supply_timings.trim() : undefined,
      potability_status: row.potability_status ? row.potability_status.trim() : undefined,
      maintenance_authority: row.maintenance_authority ? row.maintenance_authority.trim() : undefined,
      community_usage: row.community_usage ? row.community_usage.trim() : undefined,
      seating_capacity: row.seating_capacity ? row.seating_capacity.trim() : undefined,
      fixture_type: row.fixture_type ? row.fixture_type.trim() : undefined,
      power_grid: row.power_grid ? row.power_grid.trim() : undefined,
    });
  }

  return facilities;
};

/**
 * Seed cached facilities from CSV if not already present,
 * automatically migrating and purging any legacy mock data.
 */
export const seedFacilitiesFromCsv = async (
  forceRefresh = false,
  csvPath = '/data/facilities.csv'
): Promise<CachedFacility[]> => {
  try {
    const currentVersion = localStorage.getItem('facilities_seeded_version');
    const existingCount = await db.cached_facilities.count();

    // Check if current cached facilities contain old mock data
    let hasLegacyMockData = false;
    if (existingCount > 0) {
      const firstItem = await db.cached_facilities.toCollection().first();
      if (firstItem && firstItem.facility_id.includes('-')) {
        hasLegacyMockData = true;
      }
    }

    if (!forceRefresh && currentVersion === FACILITIES_DATA_VERSION && existingCount > 0 && !hasLegacyMockData) {
      return await db.cached_facilities.toArray();
    }

    const response = await fetch(csvPath);
    if (!response.ok) {
      console.warn(`Could not fetch ${csvPath}:`, response.statusText);
      return await db.cached_facilities.toArray();
    }

    const csvText = await response.text();
    const facilities = parseFacilitiesCsv(csvText);

    if (facilities.length > 0) {
      // Preserve any user-created facilities that are not in the CSV
      const existingAll = await db.cached_facilities.toArray();
      const csvIds = new Set(facilities.map((f) => f.facility_id));
      const userAdded = existingAll.filter(
        (f) => !csvIds.has(f.facility_id) && !f.facility_id.includes('-')
      );

      await db.cached_facilities.clear();
      await db.cached_facilities.bulkPut([...facilities, ...userAdded]);
      localStorage.setItem('facilities_seeded_version', FACILITIES_DATA_VERSION);
      console.log(`Seeded ${facilities.length} real facilities with media into IndexedDB.`);
      return await db.cached_facilities.toArray();
    }

    return await db.cached_facilities.toArray();
  } catch (error) {
    console.error('Error seeding facilities from CSV:', error);
    return await db.cached_facilities.toArray();
  }
};

/**
 * Save or update a new facility directly into IndexedDB
 */
export const saveFacilityToOfflineDb = async (facility: CachedFacility): Promise<void> => {
  await db.cached_facilities.put(facility);
};

const ISSUES_DATA_VERSION = 'v2_field_kobo_media';

/**
 * Parses issues CSV text into array of CachedIssue objects using PapaParse
 */
export const parseIssuesCsv = (csvText: string): CachedIssue[] => {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const issues: CachedIssue[] = [];

  for (const row of result.data) {
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);

    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat === 0 ||
      lng === 0 ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      !row.issue_id ||
      !row.title
    ) {
      continue;
    }

    // Ingest photo from KoboCollect image columns
    const rawPhoto = (row.photo || row.image || row.attachment || row.photo_url || row.image_url || '').trim();
    let photoUrl: string | undefined = undefined;
    if (rawPhoto) {
      if (rawPhoto.startsWith('http') || rawPhoto.startsWith('data:')) {
        photoUrl = rawPhoto;
      } else {
        photoUrl = `/media/${rawPhoto}`;
      }
    }

    issues.push({
      issue_id: row.issue_id.trim(),
      title: row.title.trim(),
      category: (row.category || 'other').trim().toLowerCase(),
      severity: (row.severity || 'medium').trim().toLowerCase(),
      reported_by: (row.reported_by || 'field_observed').trim(),
      latitude: lat,
      longitude: lng,
      status: (row.status || 'reported').trim().toLowerCase(),
      notes: (row.notes || '').trim(),
      ai_priority_score: row.ai_priority_score ? parseFloat(row.ai_priority_score) : undefined,
      ai_rank: row.ai_rank ? parseInt(row.ai_rank, 10) : undefined,
      estimated_budget_inr: row.estimated_budget_inr ? parseFloat(row.estimated_budget_inr) : undefined,
      ai_recommendation: (row.ai_recommendation || '').trim(),
      source: (row.source || 'field_survey').trim(),
      zone: (row.zone || '').trim(),
      photoBase64: photoUrl,
      photo_url: photoUrl,
      approval_status: 'approved',
      submitted_by: 'Baseline Field Survey',
    });
  }

  return issues;
};

/**
 * Seed cached issues from CSV into IndexedDB table cached_issues
 */
export const seedIssuesFromCsv = async (
  forceRefresh = false,
  csvPath = '/data/issues.csv'
): Promise<CachedIssue[]> => {
  try {
    const currentVersion = localStorage.getItem('issues_seeded_version');
    const existingCount = await db.cached_issues.count();

    if (!forceRefresh && currentVersion === ISSUES_DATA_VERSION && existingCount > 0) {
      return await db.cached_issues.toArray();
    }

    const response = await fetch(csvPath);
    if (!response.ok) {
      console.warn(`Could not fetch ${csvPath}:`, response.statusText);
      return await db.cached_issues.toArray();
    }

    const csvText = await response.text();
    const issues = parseIssuesCsv(csvText);

    if (issues.length > 0) {
      await db.cached_issues.clear();
      await db.cached_issues.bulkPut(issues);
      localStorage.setItem('issues_seeded_version', ISSUES_DATA_VERSION);
      console.log(`Seeded ${issues.length} village issues into IndexedDB.`);
      return await db.cached_issues.toArray();
    }

    return await db.cached_issues.toArray();
  } catch (error) {
    console.error('Error seeding issues from CSV:', error);
    return await db.cached_issues.toArray();
  }
};

/**
 * Save or update a new issue directly into IndexedDB
 */
export const saveIssueToOfflineDb = async (issue: CachedIssue): Promise<void> => {
  await db.cached_issues.put(issue);
};

/**
 * Export grievances as standard GeoJSON FeatureCollection for QGIS / ArcGIS
 */
export const exportGrievancesToGeoJson = (grievances: OfflineGrievance[]): string => {
  const featureCollection = {
    type: 'FeatureCollection',
    name: 'Khopripada_Bapane_Field_Grievances',
    crs: {
      type: 'name',
      properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' },
    },
    features: grievances.map((g) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [g.longitude, g.latitude],
      },
      properties: {
        id: g.id,
        title: g.title,
        category: g.category,
        severity: g.severity,
        reporterName: g.reporterName || 'Field Surveyor',
        description: g.description || '',
        timestamp: new Date(g.timestamp).toISOString(),
        synced: g.synced,
      },
    })),
  };
  return JSON.stringify(featureCollection, null, 2);
};

/**
 * Export grievances as formatted CSV for Bapane Gram Panchayat administration & Excel
 */
export const exportGrievancesToCsv = (grievances: OfflineGrievance[]): string => {
  const headers = [
    'ID',
    'Title',
    'Category',
    'Severity',
    'Latitude',
    'Longitude',
    'Reporter',
    'Description',
    'Logged Time (IST)',
    'Status',
  ];

  const rows = grievances.map((g) => [
    g.id ?? '',
    `"${(g.title || '').replace(/"/g, '""')}"`,
    g.category,
    g.severity,
    g.latitude.toFixed(5),
    g.longitude.toFixed(5),
    `"${(g.reporterName || '').replace(/"/g, '""')}"`,
    `"${(g.description || '').replace(/"/g, '""')}"`,
    new Date(g.timestamp).toLocaleString('en-IN'),
    g.synced ? 'Synced' : 'Local IndexedDB',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};

/**
 * Approve a facility proposal (Admin Governance)
 */
export const approveFacility = async (facilityId: string): Promise<void> => {
  await db.cached_facilities.update(facilityId, {
    approval_status: 'approved',
  });
};

/**
 * Reject a facility proposal (Admin Governance)
 */
export const rejectFacility = async (facilityId: string): Promise<void> => {
  await db.cached_facilities.update(facilityId, {
    approval_status: 'rejected',
  });
};

/**
 * Approve a citizen grievance, publishing it and assigning it to the Officer's Field Worklist
 */
export const approveGrievance = async (id: number): Promise<void> => {
  await db.offline_grievances.update(id, {
    approval_status: 'approved',
    status: 'under_inspection',
  });
};

/**
 * Reject a citizen grievance
 */
export const rejectGrievance = async (id: number): Promise<void> => {
  await db.offline_grievances.update(id, {
    approval_status: 'rejected',
  });
};

/**
 * Retrieve all pending submissions (facilities and grievances) awaiting Panchayat review
 */
export const getPendingSubmissions = async () => {
  const allFacilities = await db.cached_facilities.toArray();
  const allGrievances = await db.offline_grievances.toArray();

  const pendingFacilities = allFacilities.filter(
    (f) => f.approval_status === 'pending_approval'
  );
  const pendingGrievances = allGrievances.filter(
    (g) => g.approval_status === 'pending_approval'
  );

  return {
    facilities: pendingFacilities,
    grievances: pendingGrievances,
    total: pendingFacilities.length + pendingGrievances.length,
  };
};

