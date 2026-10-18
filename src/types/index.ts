export type ApprovalStatus = 'pending_approval' | 'approved' | 'rejected';
export type UserRole = 'admin' | 'officer' | 'user';

export type OperationalStatus = 'functional' | 'partially_functional' | 'non_functional' | string;

export interface BaseEntity {
  approval_status: ApprovalStatus;
  submitted_by?: string;
  approved_by?: string;
  approved_at?: number;
}
