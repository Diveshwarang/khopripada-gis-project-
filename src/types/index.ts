export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected';
export type UserRole = 'admin' | 'officer' | 'user';

export type OperationalStatus = 'functional' | 'partially_functional' | 'non_functional' | string;

export interface BaseEntity {
  approval_status: ApprovalStatus;
  submitted_by?: string;
  approved_by?: string;
  approved_at?: number;
}

/**
 * Strict 6-Stage Civic Issue Verification Lifecycle
 * Step 1: 'pending_initial_approval' — Resident submitted; hidden from public map and Officer worklist
 * Step 2: 'assigned_for_inspection' — Admin approved & assigned to Field Officer
 * Step 3: 'pending_inspection_verification' — Officer tapped "Begin Inspection"; waiting for Admin authorization
 * Step 4: 'under_inspection' — Admin authorized; marker renders in AMBER on public map across all devices
 * Step 5: 'pending_resolution_approval' — Officer uploaded repair proof; waiting for Admin audit
 * Step 6: 'resolved' — Admin verified photo proof; marker turns GREEN on public map across all devices
 */
export type IssueVerificationStatus =
  | 'pending_initial_approval'
  | 'assigned_for_inspection'
  | 'pending_inspection_verification'
  | 'under_inspection'
  | 'pending_resolution_approval'
  | 'resolved';

export interface CivicIssue {
  id?: string | number;
  issue_id?: string;
  title: string;
  category: 'water' | 'electricity' | 'roads' | 'sanitation' | 'health' | 'other' | string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  status: IssueVerificationStatus | string;
  latitude: number;
  longitude: number;
  description?: string;
  notes?: string;
  reporter_name?: string;
  reported_by?: string;
  submitted_by?: string;
  photo_url?: string;
  photoBase64?: string;
  resolution_photo_url?: string;
  officer_notes?: string;
  assigned_to?: string;
  verified_by?: string;
  approval_status?: ApprovalStatus;
  ai_priority_score?: number;
  ai_rank?: number;
  estimated_budget_inr?: number;
  ai_recommendation?: string;
  created_at?: string;
  updated_at?: string;
  timestamp?: number;
}

export interface Facility {
  id?: string | number;
  facility_id: string;
  name: string;
  category: string;
  operational_status: 'functional' | 'partially_functional' | 'non_functional' | string;
  latitude: number;
  longitude: number;
  monsoon_accessible?: string;
  upi_available?: boolean;
  notes?: string;
  photo_url?: string;
  photoBase64?: string;
  approval_status?: ApprovalStatus;
  status?: string;
  submitted_by?: string;
  verified_by?: string;
  business_hours?: string;
  service_type?: string;
  health_services?: string;
  operational_hours?: string;
  grade_levels?: string;
  midday_meal_available?: boolean;
  drinking_water_available?: boolean;
  water_supply_timings?: string;
  water_potability?: string;
  maintenance_authority?: string;
  community_usage?: string;
  seating_capacity?: string;
  lighting_fixture_type?: string;
  power_grid_feeder?: string;
  created_at?: string;
  updated_at?: string;
}
