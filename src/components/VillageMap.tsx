import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import {
  Layers,
  MapPin,
  Building2,
  Locate,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  Plus,
  Flame,
  Maximize2,
  Minimize2,
  FileText,
  ClipboardList,
  ClipboardCheck,
  BarChart3,
  Activity,
  CheckCircle2,
  X,
  ShieldCheck,
  Download,
  LogOut,
  User,
  Shield,
  SlidersHorizontal,
  Image as ImageIcon,
  Droplets,
  GraduationCap,
  Store,
  Landmark,
} from 'lucide-react';
import {
  getCurrentPosition,
  isCoordInStudyCorridor,
  type GeolocationResult,
} from '../services/geolocation';
import {
  runDBSCANClustering,
  type ClusterPoint,
} from '../services/dbscanService';
import {
  classifyFacilityTier,
  createPOIDivIcon,
  createIssueDivIcon,
  resolveFacilityAttributes,
} from '../utils/mapIconHelper';
import {
  db,
  saveFacilityToOfflineDb,
  approveFacility,
  rejectFacility,
  rejectGrievance,
  type CachedFacility,
  type CachedIssue,
  type OfflineGrievance,
} from '../services/offlineDb';
import type { CivicIssue, FacilityAsset, IssueStatus } from '../types';
import { updateIssueStatus } from '../services/issueService';
import { PREDEFINED_SURVEY_ISSUES } from '../data/seedIssues';
import {
  fetchIssues,
  fetchFacilities,
  normalizeIssue,
  subscribeToPanchayatSync,
  transitionToAssignedForInspection,
  transitionToInspectionVerification,
  transitionToUnderInspection,
  transitionToResolutionApproval,
  transitionToResolved,
  upsertIssue,
  upsertFacility,
} from '../services/dataService';
import { GrievanceModal } from './GrievanceModal';
import { GrievanceListDrawer } from './GrievanceListDrawer';
import { AddFacilityModal } from './AddFacilityModal';
import { Navbar } from './Navbar';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types/auth';
import { PanchayatAdminPanel } from './PanchayatAdminPanel';
import { PhotoLightboxModal } from './PhotoLightboxModal';
import { ExportAuditModal } from './ExportAuditModal';
import { DEFAULT_INSPECTION_PLACEHOLDER, compressImageToBase64 } from '../utils/imageUtils';
import {
  generatePanchayatPDF,
  generateOfficerWorklistPDF,
  exportMasterDataCSV,
} from '../utils/reportGenerator';
import {
  buildFacilityContextAttributesHtml,
  getCategoryTheme,
} from '../utils/facilityUtils';

import {
  KHOPRIPADA_CORE,
  JUCHANDRA_STN,
  DEFAULT_ZOOM,
} from '../constants/gis';
import { ErrorBoundary } from './ErrorBoundary';

// Key Landmarks & POIs in Khopripada, Bapane, and Naigaon East
interface LandmarkPOI {
  id: string;
  name: string;
  category: 'village' | 'heritage' | 'transit' | 'corridor' | 'civic';
  coords: [number, number];
  zoom: number;
  description: string;
}

const LANDMARKS: LandmarkPOI[] = [
  {
    id: 'khopripada-core',
    name: 'Khopripada Core (Primary)',
    category: 'village',
    coords: KHOPRIPADA_CORE,
    zoom: 17,
    description: 'Exact central core of Khopripada settlement, residential clusters, and local padas.',
  },
  {
    id: 'juchandra-station',
    name: 'Juchandra Stn (Naigaon E)',
    category: 'transit',
    coords: JUCHANDRA_STN,
    zoom: 17,
    description: 'Central Railway commuter node (19.36001°N, 72.87285°E) serving Khopripada & Bapane.',
  },
  {
    id: 'bapane-gaothan',
    name: 'Bapane Village Gaothan',
    category: 'civic',
    coords: [19.366, 72.89225],
    zoom: 16,
    description: 'Bapane Gram Panchayat administrative center & civic office.',
  },
  {
    id: 'chandika-mandir',
    name: 'Chandika Devi Mandir',
    category: 'heritage',
    coords: [19.3603, 72.8817],
    zoom: 17,
    description: 'Historical community landmark along the Juchandra-Bapane village boundary.',
  },
  {
    id: 'nh48-junction',
    name: 'NH-48 Highway Junction',
    category: 'corridor',
    coords: [19.35098, 72.89347],
    zoom: 16,
    description: 'Western corridor connecting Mumbai-Ahmedabad National Highway.',
  },
];

// Khopripada-Bapane Study Corridor Boundary Polygon
const VILLAGE_BOUNDARY_COORDS: [number, number][] = [
  [19.370, 72.880],
  [19.372, 72.895],
  [19.366, 72.900],
  [19.352, 72.898],
  [19.345, 72.890],
  [19.348, 72.872],
  [19.362, 72.868],
  [19.370, 72.880],
];

type BasemapType = 'satellite' | 'osm' | 'esri';
export type FacilityCategoryFilter = 'all' | 'water' | 'education' | 'commerce' | 'health' | 'civic' | 'issues';

function buildFacilityPopupHTML(fac: FacilityAsset | any): string {
  const attrs = resolveFacilityAttributes(fac);

  const cond =
    fac.condition ||
    (fac.operational_status === 'non_functional'
      ? 'degraded'
      : fac.operational_status === 'partially_functional'
      ? 'partial'
      : 'functional');

  const conditionColor =
    cond === 'functional'
      ? '#10B981'
      : cond === 'partial'
      ? '#F59E0B'
      : '#EF4444';

  const conditionLabel = (cond || 'functional').toUpperCase();

  const paymentBadges = (attrs.payment_modes || [])
    .map(
      (mode) =>
        `<span style="background: #E2E8F0; color: #1E293B; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-right: 4px; margin-bottom: 2px;">${mode}</span>`
    )
    .join('');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 275px; padding: 4px; color: #0F172A; background: #FFFFFF; border-radius: 8px;">
      <!-- Category Badge & Condition -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #0284C7; background: #E0F2FE; padding: 2px 6px; border-radius: 4px;">
          ${fac.category || 'Public Amenity'}
        </span>
        <span style="font-size: 10px; font-weight: 700; color: ${conditionColor}; background: ${conditionColor}15; padding: 2px 6px; border-radius: 4px; border: 1px solid ${conditionColor}40;">
          ${conditionLabel}
        </span>
      </div>

      <!-- Title & Core Description -->
      <div style="font-size: 14px; font-weight: 700; color: #0F172A; line-height: 1.25; margin-bottom: 4px;">
        ${fac.name}
      </div>
      <p style="font-size: 11px; color: #475569; margin: 0 0 8px 0; line-height: 1.4;">
        ${fac.description || fac.notes || 'Public facility mapped under Bapane Gram Panchayat GIS registry.'}
      </p>

      <!-- Practical Utility Details Section -->
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 6px 8px; font-size: 10.5px; color: #334155; margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px;">
        ${
          attrs.operating_hours
            ? `<div><span style="color: #64748B;">Hours:</span> <b style="color: #0F172A;">${attrs.operating_hours}</b></div>`
            : ''
        }
        ${
          attrs.water_facility
            ? `<div><span style="color: #64748B;">Drinking Water:</span> <b style="color: #0369A1;">${attrs.water_facility}</b></div>`
            : ''
        }
        ${
          attrs.sanitation_facility
            ? `<div><span style="color: #64748B;">Sanitation:</span> <b style="color: #0F172A;">${attrs.sanitation_facility}</b></div>`
            : ''
        }
        ${
          attrs.power_backup
            ? `<div><span style="color: #64748B;">Power Backup:</span> <b style="color: #0F172A;">${attrs.power_backup}</b></div>`
            : ''
        }
        ${
          attrs.payment_modes && attrs.payment_modes.length > 0
            ? `<div style="margin-top: 2px;"><span style="color: #64748B; display: block; margin-bottom: 3px;">Accepted Payment Modes:</span><div>${paymentBadges}</div></div>`
            : ''
        }
      </div>

      <!-- Administrative & Contact Footer -->
      <div style="font-size: 10px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
        <div>Scheme: <b style="color: #1E293B;">${fac.scheme_name || 'ZP Gram Nidhi'}</b></div>
        <div>Ward: <b style="color: #1E293B;">${fac.ward_no ? 'Ward ' + fac.ward_no : 'General'}</b></div>
        ${attrs.contact_person ? `<div style="grid-column: span 2;">Contact: <b style="color: #1E293B;">${attrs.contact_person}</b></div>` : ''}
        ${attrs.emergency_number ? `<div style="grid-column: span 2; color: #DC2626; font-weight: 700;">Emergency: ${attrs.emergency_number}</div>` : ''}
      </div>
    </div>
  `;
}

function buildIssuePopupHTML(issue: CivicIssue | any, userRole: string): string {
  const isOfficerOrAdmin = userRole === 'officer' || userRole === 'admin';

  const statusConfig: Record<string, { label: string; bg: string; text: string; step: number }> = {
    reported: { label: 'Step 1: Registered', bg: '#FEF2F2', text: '#DC2626', step: 1 },
    pending_initial_approval: { label: 'Step 1: Registered', bg: '#FEF2F2', text: '#DC2626', step: 1 },
    assigned: { label: 'Step 2: Assigned', bg: '#FFFBEB', text: '#D97706', step: 2 },
    assigned_for_inspection: { label: 'Step 2: Assigned', bg: '#FFFBEB', text: '#D97706', step: 2 },
    under_inspection: { label: 'Step 3: Field Inspection', bg: '#EFF6FF', text: '#2563EB', step: 3 },
    pending_inspection_verification: { label: 'Step 3: Field Inspection', bg: '#EFF6FF', text: '#2563EB', step: 3 },
    resolved: { label: 'Step 4: Repaired', bg: '#F0FDF4', text: '#16A34A', step: 4 },
    pending_resolution_approval: { label: 'Step 4: Repaired', bg: '#F0FDF4', text: '#16A34A', step: 4 },
    verified_closed: { label: 'Step 5: Verified & Closed', bg: '#ECFDF5', text: '#059669', step: 5 },
  };

  const rawStatus = (issue.status || 'reported').toLowerCase();
  const currentStatus = statusConfig[rawStatus] || statusConfig.reported;
  const issueId = String(issue.id || issue.issue_id || '');

  let selectVal: IssueStatus = 'reported';
  if (rawStatus === 'assigned' || rawStatus === 'assigned_for_inspection') selectVal = 'assigned';
  else if (rawStatus === 'under_inspection' || rawStatus === 'pending_inspection_verification') selectVal = 'under_inspection';
  else if (rawStatus === 'resolved' || rawStatus === 'pending_resolution_approval') selectVal = 'resolved';
  else if (rawStatus === 'verified_closed') selectVal = 'verified_closed';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; width: 260px; padding: 4px; color: #0F172A; background: #FFFFFF; border-radius: 8px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #DC2626; background: #FEF2F2; padding: 2px 6px; border-radius: 4px;">
          ${issue.category || 'Grievance'}
        </span>
        <span style="font-size: 10px; font-weight: 700; color: ${currentStatus.text}; background: ${currentStatus.bg}; padding: 2px 6px; border-radius: 4px; border: 1px solid ${currentStatus.text}40;">
          ${currentStatus.label}
        </span>
      </div>

      <div style="font-size: 14px; font-weight: 700; color: #0F172A; line-height: 1.25; margin-bottom: 4px;">
        ${issue.title}
      </div>

      <p style="font-size: 11px; color: #475569; margin: 0 0 8px 0; line-height: 1.4;">
        ${issue.description || 'No additional field notes provided for this issue.'}
      </p>

      ${
        issue.resolution_notes || issue.officer_notes
          ? `<div style="background: #F8FAFC; border-left: 2px solid #0284C7; padding: 4px 8px; font-size: 10px; color: #334155; margin-bottom: 8px;">
               <b>Officer Note:</b> ${issue.resolution_notes || issue.officer_notes}
             </div>`
          : ''
      }

      <div style="font-size: 10px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 6px; margin-bottom: 8px;">
        <div>Severity: <b style="color: #0F172A; text-transform: capitalize;">${issue.severity || 'Medium'}</b></div>
        <div>Reported: <b style="color: #0F172A;">${issue.created_at ? new Date(issue.created_at).toLocaleDateString() : 'Active'}</b></div>
      </div>

      ${
        isOfficerOrAdmin
          ? `
        <div style="background: #F1F5F9; border-radius: 6px; padding: 6px; margin-top: 6px;">
          <label style="display: block; font-size: 10px; font-weight: 700; color: #475569; margin-bottom: 4px;">
            Update Fix Status:
          </label>
          <select 
            id="status-select-${issueId}" 
            data-issue-id="${issueId}"
            class="issue-status-dropdown"
            style="width: 100%; font-size: 11px; padding: 4px 6px; border: 1px solid #CBD5E1; border-radius: 4px; background: #FFFFFF; color: #0F172A; font-weight: 600; cursor: pointer;"
          >
            <option value="reported" ${selectVal === 'reported' ? 'selected' : ''}>Step 1: Registered</option>
            <option value="assigned" ${selectVal === 'assigned' ? 'selected' : ''}>Step 2: Assigned to Officer</option>
            <option value="under_inspection" ${selectVal === 'under_inspection' ? 'selected' : ''}>Step 3: Field Inspection</option>
            <option value="resolved" ${selectVal === 'resolved' ? 'selected' : ''}>Step 4: Work Repaired</option>
            <option value="verified_closed" ${selectVal === 'verified_closed' ? 'selected' : ''}>Step 5: Verified & Closed</option>
          </select>
        </div>
      `
          : `
        <div style="font-size: 10px; color: #059669; font-weight: 600; text-align: center; background: #ECFDF5; padding: 4px; border-radius: 4px;">
          Live Tracking Active: Monitored by Bapane Gram Panchayat
        </div>
      `
      }
    </div>
  `;
}

export interface VillageMapProps {
  heatmapActive?: boolean;
  setHeatmapActive?: React.Dispatch<React.SetStateAction<boolean>>;
  issues?: CivicIssue[];
  setIssues?: React.Dispatch<React.SetStateAction<CivicIssue[]>>;
}

export const VillageMap: React.FC<VillageMapProps> = ({
  heatmapActive: propHeatmapActive,
  setHeatmapActive: propSetHeatmapActive,
  issues: propIssues,
  setIssues: propSetIssues,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const boundaryLayerRef = useRef<L.Polygon | null>(null);
  const landmarksLayerRef = useRef<L.LayerGroup | null>(null);
  const facilitiesLayerRef = useRef<L.LayerGroup | null>(null);
  const issuesLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const grievancesLayerRef = useRef<L.LayerGroup | null>(null);
  const gpsLocationLayerRef = useRef<L.LayerGroup | null>(null);
  const inspectMarkerRef = useRef<L.Marker | null>(null);
  const esriLayerRef = useRef<L.TileLayer | null>(null);
  const osmLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const heatmapGroupRef = useRef<L.LayerGroup>(L.layerGroup());

  // Isolated Tiered LayerGroups for Google Maps style progressive density throttling
  const tierGroupsRef = useRef<{
    tier1: L.LayerGroup;
    tier2: L.LayerGroup;
    tier3: L.LayerGroup;
    tier4: L.LayerGroup;
  } | null>(null);

  if (!tierGroupsRef.current) {
    tierGroupsRef.current = {
      tier1: L.layerGroup(),
      tier2: L.layerGroup(),
      tier3: L.layerGroup(),
      tier4: L.layerGroup(),
    };
  }

  const allFacilitiesRef = useRef<CachedFacility[]>([]);
  const allIssuesRef = useRef<CachedIssue[]>([]);

  // Available roles for dedicated Portal Switcher
  const AVAILABLE_ROLES: { id: Role; label: string; desc: string }[] = [
    { id: 'user', label: 'Resident Portal', desc: 'Public Asset Registry & Grievance Reporting' },
    { id: 'officer', label: 'Field Operations', desc: 'Task Execution & Ground Inspection Verification' },
    { id: 'admin', label: 'Panchayat Executive', desc: 'Administrative Approvals & ML Decision Console' },
  ];

  // Auth Context & Role
  const { session, loginAsDemoRole, logout } = useAuth();
  const userRole = session?.role || 'user';
  const userRoleRef = useRef(userRole);
  userRoleRef.current = userRole;
  const isAdminOrOfficer = userRole === 'admin' || userRole === 'officer';

  const getRoleIcon = (roleId: Role) => {
    if (roleId === 'admin') return <Shield className="w-5 h-5 text-[#F59E0B]" />;
    if (roleId === 'officer') return <ClipboardCheck className="w-5 h-5 text-[#38BDF8]" />;
    return <User className="w-5 h-5 text-[#10B981]" />;
  };

  // Mobile Log Out handler (cleans up any open sheet first to prevent visual ghosts)
  const handleMobileLogout = () => {
    setMobileSheet(null);
    logout();
  };

  // Official Panchayat Identifiers
  const getPanchayatId = (role: Role) => {
    if (role === 'admin') return 'Panchayat ID: GP-KHOP-001 • Sarpanch Admin';
    if (role === 'officer') return 'Officer ID: GS-MH-4012 • Gram Sevak Field Desk';
    return 'Resident Portal • Khopripada Ward 1';
  };

  // Portal Switcher state & click-outside ref
  const [isPortalSwitcherOpen, setIsPortalSwitcherOpen] = useState<boolean>(false);
  const portalSwitcherRef = useRef<HTMLDivElement>(null);

  // Close portal switcher dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (portalSwitcherRef.current && !portalSwitcherRef.current.contains(e.target as Node)) {
        setIsPortalSwitcherOpen(false);
      }
    };
    if (isPortalSwitcherOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isPortalSwitcherOpen]);

  // Handler for direct 1-click role/portal switching
  const handlePortalSwitch = (targetRole: Role, roleLabel?: string) => {
    loginAsDemoRole(targetRole);
    setIsPortalSwitcherOpen(false);
    const label = roleLabel || AVAILABLE_ROLES.find((r) => r.id === targetRole)?.label || targetRole;
    showToast(`Switched to ${label}`);
  };

  // Spatial ML: DBSCAN Clusters & Heatmap layers
  const dbscanLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const [internalHeatmapActive, setInternalHeatmapActive] = useState<boolean>(false);
  const heatmapActive = propHeatmapActive !== undefined ? propHeatmapActive : internalHeatmapActive;
  const setHeatmapActive = propSetHeatmapActive || setInternalHeatmapActive;
  const showHeatmap = heatmapActive;
  const handleUpdateIssueStatusRef = useRef<((id: string, st: string) => Promise<void>) | null>(null);
  const refreshGrievanceMarkersRef = useRef<(() => Promise<void>) | null>(null);

  // Map state
  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_ZOOM);
  const [centerCoords, setCenterCoords] = useState<[number, number]>(KHOPRIPADA_CORE);
  const [cursorCoords, setCursorCoords] = useState<[number, number] | null>(null);
  const [activeBasemap, setActiveBasemap] = useState<BasemapType>('satellite');
  const [showBoundary, setShowBoundary] = useState<boolean>(true);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [showFacilities, setShowFacilities] = useState<boolean>(true);
  const [showIssuesLayer, setShowIssuesLayer] = useState<boolean>(true);
  const [facilityFilter, setFacilityFilter] = useState<FacilityCategoryFilter>('all');
  const [facilitiesList, setFacilitiesList] = useState<CachedFacility[]>([]);
  const [issuesList, setIssuesList] = useState<CachedIssue[]>([]);

  // Defensive safe arrays & unified issues list
  const safeIssues = useMemo(() => (Array.isArray(issuesList) ? issuesList.filter(Boolean) : []), [issuesList]);
  const issues = useMemo(() => {
    const merged = new Map<string, CivicIssue>();
    for (const item of safeIssues) {
      const key = String(item.issue_id || (item as any).id);
      if (key) merged.set(key, item as any);
    }
    if (propIssues && Array.isArray(propIssues)) {
      for (const item of propIssues) {
        const key = String(item.issue_id || item.id);
        if (key) merged.set(key, item);
      }
    }
    const result = Array.from(merged.values());
    return result.length > 0 ? result : PREDEFINED_SURVEY_ISSUES;
  }, [propIssues, safeIssues]);
  const safeFacilities = useMemo(() => (Array.isArray(facilitiesList) ? facilitiesList.filter(Boolean) : []), [facilitiesList]);

  // Inspection and Point Selection
  const [inspectedPoint, setInspectedPoint] = useState<{
    lat: number;
    lng: number;
    distKm: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // High-Resolution Field Photo Lightbox Modal State
  const [lightboxData, setLightboxData] = useState<{
    isOpen: boolean;
    photoUrl: string | null;
    title: string;
    category?: string;
    coords?: [number, number] | null;
  }>({
    isOpen: false,
    photoUrl: null,
    title: '',
    category: undefined,
    coords: null,
  });

  // Offline and Field Modals
  const [isLocating, setIsLocating] = useState(false);
  const [toastWarning, setToastWarning] = useState<string | null>(null);
  const [isGrievanceModalOpen, setIsGrievanceModalOpen] = useState(false);
  const [isGrievanceDrawerOpen, setIsGrievanceDrawerOpen] = useState(false);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isLiveConnected = isOnline && !isSimulatedOffline;
  const [facilityCount, setFacilityCount] = useState(0);
  const [gpsWarningModal, setGpsWarningModal] = useState<{
    open: boolean;
    lat: number;
    lng: number;
  } | null>(null);

  // Add Facility Mode State
  const [isAddFacilityMode, setIsAddFacilityMode] = useState<boolean>(false);
  const [isAddFacilityModalOpen, setIsAddFacilityModalOpen] = useState<boolean>(false);
  const [newFacilityCoords, setNewFacilityCoords] = useState<[number, number] | null>(null);
  const [isExportAuditModalOpen, setIsExportAuditModalOpen] = useState<boolean>(false);
  const tempFacilityMarkerRef = useRef<L.Marker | null>(null);
  const isAddFacilityModeRef = useRef<boolean>(false);
  isAddFacilityModeRef.current = isAddFacilityMode;

  // Operational status breakdown counts for village facilities (defensive reads)
  const operationalCounts = useMemo(() => {
    return {
      functional: safeFacilities.filter(
        (f) =>
          (f?.operational_status || 'functional').toLowerCase().includes('functional') &&
          !(f?.operational_status || '').toLowerCase().includes('partial') &&
          !(f?.operational_status || '').toLowerCase().includes('non')
      ).length,
      partial: safeFacilities.filter((f) =>
        (f?.operational_status || '').toLowerCase().includes('partial')
      ).length,
      nonFunctional: safeFacilities.filter(
        (f) =>
          (f?.operational_status || '').toLowerCase().includes('non') ||
          (f?.operational_status || '').toLowerCase().includes('repair') ||
          (f?.operational_status || '').toLowerCase().includes('broken') ||
          (f?.operational_status || '').toLowerCase().includes('degraded')
      ).length,
    };
  }, [safeFacilities]);

  // Priority breakdown counts for village issues (defensive reads)
  const issueCounts = useMemo(() => {
    return {
      total: safeIssues.length,
      high: safeIssues.filter(
        (i) => i?.severity === 'high' || i?.severity === 'critical' || i?.severity === 'urgent'
      ).length,
      medium: safeIssues.filter((i) => i?.severity === 'medium').length,
      low: safeIssues.filter((i) => i?.severity === 'low').length,
    };
  }, [safeIssues]);

  // Category breakdown counts for village facilities (defensive reads)
  const categoryCounts = useMemo(() => {
    const counts = {
      all: safeFacilities.length,
      water: 0,
      education: 0,
      commerce: 0,
      health: 0,
      civic: 0,
    };
    safeFacilities.forEach((f) => {
      const cat = (f?.category || '').toLowerCase();
      if (
        cat.includes('water') ||
        cat.includes('handpump') ||
        cat.includes('well') ||
        cat.includes('tank') ||
        cat.includes('borewell')
      ) {
        counts.water++;
      } else if (
        cat.includes('school') ||
        cat.includes('education') ||
        cat.includes('anganwadi') ||
        cat.includes('college') ||
        cat.includes('balwadi') ||
        cat.includes('coaching') ||
        cat.includes('academy')
      ) {
        counts.education++;
      } else if (
        cat.includes('shop') ||
        cat.includes('commerce') ||
        cat.includes('store') ||
        cat.includes('ration') ||
        cat.includes('dairy') ||
        cat.includes('hardware') ||
        cat.includes('market') ||
        cat.includes('vendor') ||
        cat.includes('saloon') ||
        cat.includes('laundry')
      ) {
        counts.commerce++;
      } else if (
        cat.includes('health') ||
        cat.includes('clinic') ||
        cat.includes('hospital') ||
        cat.includes('sub-center')
      ) {
        counts.health++;
      } else if (
        cat.includes('civic') ||
        cat.includes('social') ||
        cat.includes('mandir') ||
        cat.includes('temple') ||
        cat.includes('graveyard') ||
        cat.includes('chwal') ||
        cat.includes('chawl') ||
        cat.includes('panchayat') ||
        cat.includes('admin')
      ) {
        counts.civic++;
      }
    });
    return counts;
  }, [safeFacilities]);

  // Dynamically computed DBSCAN clusters and reactive hotspot count
  const computedClusters = useMemo(() => {
    const validIssues: ClusterPoint[] = (issues || []).map((issue, idx) => ({
      id: String(issue.issue_id || (issue as any).id || `issue-${idx}`),
      latitude: Number(issue.latitude),
      longitude: Number(issue.longitude),
      title: issue.title || 'Civic Grievance',
      category: issue.category,
      severity: issue.severity,
    }));
    return runDBSCANClustering(validIssues, 90, 2);
  }, [issues]);

  const computedClustersCount = computedClusters.length;

  // Mobile Touch Interface States (< 768px viewports)
  const [mobileSheet, setMobileSheet] = useState<'action' | 'analytics' | 'worklist' | 'layers' | 'role' | null>(null);
  const [mobileGrievanceList, setMobileGrievanceList] = useState<OfflineGrievance[]>([]);
  const [mobileAdminQueueStep, setMobileAdminQueueStep] = useState<1 | 2 | 3>(1);
  const [officerNotesMap, setOfficerNotesMap] = useState<Record<string | number, string>>({});
  const [officerPhotoMap, setOfficerPhotoMap] = useState<Record<string | number, string>>({});
  const [pendingSubmissionsList, setPendingSubmissionsList] = useState<{
    id: string | number;
    type: 'facility' | 'grievance';
    title: string;
    category: string;
    submitted_by: string;
    coords: [number, number];
    photoUrl?: string;
    description?: string;
    status?: string;
  }[]>([]);

  // Function to refresh mobile worklist data
  const refreshMobileWorklist = useCallback(async () => {
    try {
      const records = await db.offline_grievances.reverse().toArray();
      if (userRole === 'officer') {
        const fieldTasks = records.filter(
          (g) =>
            g.status === 'assigned_for_inspection' ||
            g.status === 'pending_inspection_verification' ||
            g.status === 'under_inspection' ||
            g.status === 'pending_resolution_approval'
        );
        setMobileGrievanceList(fieldTasks);
      } else {
        setMobileGrievanceList(records);
      }
    } catch (err) {
      console.error('Failed to query mobile grievances:', err);
    }
  }, [userRole]);

  // Load pending submissions for Admin Step 1 on mobile
  const loadMobilePendingSubmissions = useCallback(async () => {
    try {
      const grievances = await db.offline_grievances.toArray();
      const pendingGrievances = grievances
        .filter(
          (g) =>
            g.status === 'pending_initial_approval' ||
            (g.approval_status === 'pending_approval' && (!g.status || g.status === 'reported'))
        )
        .map((g) => ({
          id: g.id!,
          type: 'grievance' as const,
          title: g.title,
          category: g.category,
          submitted_by: g.submitted_by || 'Resident',
          coords: [g.latitude, g.longitude] as [number, number],
          photoUrl: g.photoBase64,
          description: g.description,
          status: 'pending_initial_approval',
        }));

      const pendingFacilities = facilitiesList
        .filter((f) => f.approval_status === 'pending_approval')
        .map((f) => ({
          id: f.facility_id,
          type: 'facility' as const,
          title: f.name,
          category: f.category,
          submitted_by: f.submitted_by || 'Resident',
          coords: [f.latitude, f.longitude] as [number, number],
          photoUrl: f.photoBase64 || f.photo_url,
          description: f.notes,
          status: 'pending_initial_approval',
        }));

      setPendingSubmissionsList([...pendingFacilities, ...pendingGrievances]);
    } catch (err) {
      console.error('Failed to load pending submissions for mobile:', err);
    }
  }, [facilitiesList]);

  useEffect(() => {
    if (mobileSheet === 'worklist') {
      if (userRole === 'admin') {
        loadMobilePendingSubmissions();
      }
      refreshMobileWorklist();
    }
  }, [mobileSheet, userRole, loadMobilePendingSubmissions, refreshMobileWorklist]);

  // Decision Support: Top 5 ML Priority Failures for Mobile Analytics
  const topMLIssues = useMemo(() => {
    return [...issuesList]
      .filter((iss) => (iss.status || '').toLowerCase() !== 'resolved')
      .sort((a, b) => {
        const scoreA = a.ai_priority_score ?? (a.severity === 'critical' ? 95 : a.severity === 'high' ? 85 : 55);
        const scoreB = b.ai_priority_score ?? (b.severity === 'critical' ? 95 : b.severity === 'high' ? 85 : 55);
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }, [issuesList]);

  // Step 1: Admin [Approve & Assign to Officer]
  const handleMobileAssignToOfficer = async (item: { id: string | number; type: 'facility' | 'grievance'; title: string }) => {
    try {
      if (item.type === 'facility') {
        await approveFacility(item.id as string);
        await upsertFacility({ facility_id: item.id as string, approval_status: 'approved' });
        const updated = allFacilitiesRef.current.map((f) =>
          f.facility_id === item.id ? { ...f, approval_status: 'approved' as const } : f
        );
        allFacilitiesRef.current = updated;
        setFacilitiesList(updated);
        renderFacilityMarkers(updated, facilityFilter);
        showToast(`Facility "${item.title}" approved & published to map.`);
      } else {
        await transitionToAssignedForInspection(item.id, 'Field Officer Rahul');
        showToast(`Assigned "${item.title}" to Field Officer for ground inspection.`);
        refreshGrievanceMarkers();
      }
      await loadMobilePendingSubmissions();
      await refreshMobileWorklist();
    } catch (err) {
      console.error('Failed to assign to officer on mobile:', err);
    }
  };

  // Step 2: Admin [Authorize Inspection Phase]
  const handleMobileAuthorizeInspection = async (item: { id: string | number; title: string }) => {
    try {
      await transitionToUnderInspection(item.id, 'Sarpanch Admin');
      showToast(`Inspection phase authorized for "${item.title}". Marker live in AMBER.`);
      refreshGrievanceMarkers();
      await refreshMobileWorklist();
    } catch (err) {
      console.error('Failed to authorize inspection on mobile:', err);
    }
  };

  // Step 3: Admin [Verify & Mark Officially Resolved]
  const handleMobileVerifyResolution = async (item: { id: string | number; title: string }) => {
    try {
      await transitionToResolved(item.id, 'Sarpanch Admin');
      showToast(`"${item.title}" verified & marked Officially Resolved. Marker turned GREEN.`);
      refreshGrievanceMarkers();
      await refreshMobileWorklist();
    } catch (err) {
      console.error('Failed to verify resolution on mobile:', err);
    }
  };

  // Officer Action 1: [Start Field Inspection]
  const handleOfficerStartInspection = async (item: { id: string | number; title: string }) => {
    try {
      await transitionToInspectionVerification(item.id, 'Field Officer');
      showToast('Inspection request sent to Admin for sign-off');
      refreshGrievanceMarkers();
      await refreshMobileWorklist();
    } catch (err) {
      console.error('Failed to start field inspection:', err);
    }
  };

  // Officer Action 2: Photo evidence selection
  const handleOfficerPhotoSelect = async (itemId: string | number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file, 800, 800, 0.75);
      setOfficerPhotoMap((prev) => ({ ...prev, [itemId]: compressed }));
      showToast('Repair proof photo attached.');
    } catch (err) {
      console.error('Failed to compress repair photo:', err);
      showToast('Failed to process image file.');
    }
  };

  // Officer Action 3: [Submit Resolution & Photo]
  const handleOfficerSubmitResolution = async (item: { id: string | number; title: string }) => {
    const photo = officerPhotoMap[item.id];
    const notes = officerNotesMap[item.id] || 'Field repair completed as per standard specification.';
    if (!photo) {
      showToast('Please capture or attach repair proof photo before submitting.');
      return;
    }
    try {
      await transitionToResolutionApproval(item.id, photo, notes, 'Field Officer');
      showToast('Resolution & photo proof submitted for Admin audit.');
      setOfficerPhotoMap((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
      setOfficerNotesMap((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
      refreshGrievanceMarkers();
      await refreshMobileWorklist();
    } catch (err) {
      console.error('Failed to submit resolution on mobile:', err);
    }
  };

  const handleMobileReject = async (item: { id: string | number; type: 'facility' | 'grievance'; title: string }) => {
    try {
      if (item.type === 'facility') {
        await rejectFacility(item.id as string);
        const updated = allFacilitiesRef.current.map((f) =>
          f.facility_id === item.id ? { ...f, approval_status: 'rejected' as const } : f
        );
        allFacilitiesRef.current = updated;
        setFacilitiesList(updated);
        renderFacilityMarkers(updated, facilityFilter);
      } else {
        await rejectGrievance(item.id as number);
        refreshGrievanceMarkers();
      }
      showToast(`Rejected "${item.title}".`);
      loadMobilePendingSubmissions();
      refreshMobileWorklist();
    } catch (err) {
      console.error('Failed to reject on mobile:', err);
    }
  };

  // Show Toast Warning with auto-dismiss
  const showToast = useCallback((msg: string) => {
    setToastWarning(msg);
    setTimeout(() => {
      setToastWarning(null);
    }, 5000);
  }, []);

  // Cancel / Cleanup Add Facility Mode and remove temporary marker
  const cleanupAddFacilityMode = useCallback(() => {
    setIsAddFacilityMode(false);
    isAddFacilityModeRef.current = false;
    setIsAddFacilityModalOpen(false);
    setNewFacilityCoords(null);
    if (tempFacilityMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(tempFacilityMarkerRef.current);
      tempFacilityMarkerRef.current = null;
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.getContainer().classList.remove('facility-crosshair-active');
      mapInstanceRef.current.invalidateSize();
    }
  }, []);

  // Handle ESC key to dismiss Add Facility mode or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddFacilityMode || isAddFacilityModalOpen) {
          cleanupAddFacilityMode();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddFacilityMode, isAddFacilityModalOpen, cleanupAddFacilityMode]);

  // Handle map crosshair cursor styling when Add Facility Mode is active
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const container = mapInstanceRef.current.getContainer();
    if (isAddFacilityMode) {
      container.classList.add('facility-crosshair-active');
    } else {
      container.classList.remove('facility-crosshair-active');
    }
    // Prevent any layout jump or tile freeze
    mapInstanceRef.current.invalidateSize();
  }, [isAddFacilityMode]);

  // 1. ResizeObserver for map container size changes (drawers, touch sheets, orientation)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Window and orientation resize handlers for Leaflet canvas normalization
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  // 3. Invalidate size on drawer, bottom sheet, or mobile tab toggles
  useEffect(() => {
    const runInvalidate = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    const t1 = setTimeout(runInvalidate, 50);
    const t2 = setTimeout(runInvalidate, 200);
    const t3 = setTimeout(runInvalidate, 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [sidebarOpen, mobileSheet, isGrievanceDrawerOpen]);

  // Global Photo Lightbox trigger hook for Leaflet popup HTML
  useEffect(() => {
    (window as any).openPhotoLightbox = (
      photoUrl: string,
      title: string,
      category?: string,
      coords?: [number, number]
    ) => {
      setLightboxData({
        isOpen: true,
        photoUrl,
        title,
        category,
        coords: coords || null,
      });
    };
    return () => {
      delete (window as any).openPhotoLightbox;
    };
  }, []);



  // Render / Re-render Status-Coded Facility Markers & Polished Inspection Popups
  const renderFacilityMarkers = useCallback(
    (facilities: CachedFacility[], filter: FacilityCategoryFilter = 'all') => {
      if (!facilitiesLayerRef.current) return;
      const group = facilitiesLayerRef.current;
      group.clearLayers();

      if (filter === 'issues') {
        return; // Clear facility markers when focusing specifically on village issues
      }

      const safeList = Array.isArray(facilities) ? facilities.filter(Boolean) : [];

      const filtered = safeList.filter((fac) => {
        if (!fac) return false;
        // Strict approval filter: user and officer ONLY see approved facilities
        const isApproved = fac.approval_status === 'approved' || fac.approval_status === undefined;
        if ((userRoleRef.current === 'user' || userRoleRef.current === 'officer') && !isApproved) {
          return false;
        }
        if (fac.approval_status === 'rejected') {
          return false;
        }

        if (filter === 'all') return true;
        const cat = (fac.category || 'general').toLowerCase();
        const facNameLower = (fac.name || '').toLowerCase();
        if (filter === 'water') {
          return (
            cat.includes('water') ||
            cat.includes('borewell') ||
            cat.includes('standpost') ||
            cat.includes('pump') ||
            cat.includes('well') ||
            cat.includes('tank') ||
            facNameLower.includes('lake')
          );
        }
        if (filter === 'education') {
          return (
            cat.includes('education') ||
            cat.includes('school') ||
            cat.includes('anganwadi') ||
            cat.includes('childcare') ||
            cat.includes('college') ||
            cat.includes('balwadi') ||
            cat.includes('coaching') ||
            cat.includes('academy')
          );
        }
        if (filter === 'commerce') {
          return (
            cat.includes('shop') ||
            cat.includes('commerce') ||
            cat.includes('store') ||
            cat.includes('ration') ||
            cat.includes('dairy') ||
            cat.includes('hardware') ||
            cat.includes('market') ||
            cat.includes('vendor') ||
            cat.includes('saloon') ||
            cat.includes('laundry')
          );
        }
        if (filter === 'health') {
          return (
            cat.includes('health') ||
            cat.includes('clinic') ||
            cat.includes('hospital') ||
            cat.includes('sub-center')
          );
        }
        if (filter === 'civic') {
          return (
            cat.includes('civic') ||
            cat.includes('social') ||
            cat.includes('mandir') ||
            cat.includes('temple') ||
            cat.includes('graveyard') ||
            cat.includes('chwal') ||
            cat.includes('chawl') ||
            cat.includes('panchayat') ||
            cat.includes('admin')
          );
        }
        return false;
      });

      filtered.forEach((fac) => {
        if (!fac || typeof fac.latitude !== 'number' || typeof fac.longitude !== 'number') return;
        // Status Coding:
        // functional: Teal/Cyan (#38BDF8)
        // partially_functional: Warm Gold (#F59E0B)
        // non_functional: Coral Terracotta (#E05A47)
        const status = (fac.operational_status || 'functional').toLowerCase();
        let statusColor = '#38BDF8'; // Functional Facilities: Teal/Cyan
        let statusLabel = 'Functional';
        let statusBadge = 'bg-[#38BDF8]/20 text-[#7DD3FC] border border-[#38BDF8]/60 font-semibold text-xs px-2.5 py-0.5 rounded-full';

        if (status.includes('partial')) {
          statusColor = '#F59E0B'; // Partially Functional Warm Gold
          statusLabel = 'Partially Functional';
          statusBadge = 'bg-[#F59E0B]/20 text-[#FDE68A] border border-[#F59E0B]/60 font-semibold text-xs px-2.5 py-0.5 rounded-full';
        } else if (
          status.includes('non') ||
          status.includes('repair') ||
          status.includes('broken') ||
          status.includes('degraded')
        ) {
          statusColor = '#E05A47'; // Broken / Urgent Terracotta
          statusLabel = 'Broken / Non-functional';
          statusBadge = 'bg-[#E05A47]/20 text-[#FCA5A5] border border-[#E05A47]/60 font-semibold text-xs px-2.5 py-0.5 rounded-full';
        }

        const cat = (fac.category || 'general').toLowerCase();
        const facName = fac.name || 'Public Asset';
        const facNameLower = facName.toLowerCase();
        const isWater =
          cat.includes('water') ||
          cat.includes('borewell') ||
          cat.includes('standpost') ||
          cat.includes('tank') ||
          cat.includes('pump') ||
          cat.includes('well') ||
          facNameLower.includes('lake');

        const glyph = isWater
          ? `<svg class="w-3.5 h-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>`
          : cat.includes('edu') || cat.includes('school') || cat.includes('coaching') || cat.includes('academy')
          ? `<svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>`
          : cat.includes('health') || cat.includes('clinic') || cat.includes('hospital')
          ? `<svg class="w-3.5 h-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>`
          : cat.includes('shop') || cat.includes('store') || cat.includes('commerce') || cat.includes('kirana')
          ? `<svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>`
          : `<svg class="w-3.5 h-3.5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`;

        // Custom divIcon with high-contrast outer ring and pulse animation for water
        const customIcon = L.divIcon({
          className: 'custom-facility-marker',
          html: `
            <div class="relative flex items-center justify-center group cursor-pointer">
              ${
                isWater
                  ? `<span class="absolute w-8 h-8 rounded-full animate-ping opacity-60" style="background-color: ${statusColor};"></span>`
                  : ''
              }
              <div class="relative w-8 h-8 rounded-full bg-[#132228] border-2 shadow-2xl flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-125" style="border-color: ${statusColor}; box-shadow: 0 0 14px ${statusColor}80;">
                <span class="flex items-center justify-center">${glyph}</span>
                <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#132228] flex items-center justify-center" style="background-color: ${statusColor}">
                  <span class="w-1 h-1 rounded-full bg-white"></span>
                </span>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([fac.latitude, fac.longitude], { icon: customIcon });

        // Clean lightweight Leaflet tooltip that immediately disappears on mouseout
        marker.bindTooltip(
          `<div class="font-sans font-semibold text-xs text-[#F8FAFC]">${facName}</div>`,
          {
            direction: 'top',
            offset: [0, -18],
            className: 'gis-clean-tooltip',
            opacity: 0.95,
          }
        );

        // Polished Inspection Popup with Photo Thumbnail & Slate-Marine Palette
        const monsoonLower = (fac.monsoon_accessible || '').toLowerCase();
        const isFloods =
          monsoonLower.includes('cut') ||
          monsoonLower.includes('inaccessible') ||
          monsoonLower.includes('waterlog') ||
          monsoonLower.includes('flood') ||
          monsoonLower.includes('isolated');

        const monsoonPill = isFloods
          ? `<span class="px-2.5 py-0.5 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] font-semibold text-[10px] flex items-center gap-1">Floods / Isolated</span>`
          : `<span class="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] font-semibold text-[10px] flex items-center gap-1">Year-round Accessible</span>`;

        // Check KoboToolbox / Survey Photo evidence
        const rawPhoto = fac.photoBase64 || fac.photo_url || (fac as any).photo || '';
        let resolvedPhoto = '';
        if (rawPhoto) {
          if (
            rawPhoto.startsWith('data:') ||
            rawPhoto.startsWith('http://') ||
            rawPhoto.startsWith('https://') ||
            rawPhoto.startsWith('/')
          ) {
            resolvedPhoto = rawPhoto;
          } else {
            resolvedPhoto = `/media/${rawPhoto}`;
          }
        }

        const safeFacName = facName.replace(/'/g, "\\'");
        const safeFacCategory = (fac.category || 'General').replace(/'/g, "\\'");

        const photoMarkup = resolvedPhoto
          ? `
            <div
              onclick="window.openPhotoLightbox && window.openPhotoLightbox('${resolvedPhoto}', '${safeFacName}', '${safeFacCategory}', [${fac.latitude}, ${fac.longitude}])"
              class="relative w-full h-32 mb-2 rounded-xl overflow-hidden border border-[#334B56] bg-[#0C171C] shadow-inner group cursor-pointer"
              title="Click to inspect high-resolution field survey evidence"
            >
              <img src="${resolvedPhoto}" alt="${safeFacName}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <div class="absolute inset-0 bg-[#132228]/20 group-hover:bg-transparent transition-colors flex items-center justify-center">
                <span class="opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1 rounded-lg bg-[#132228]/95 text-[10px] font-bold text-[#38BDF8] border border-[#38BDF8]/60 shadow-md">
                  Inspect Ground-Truth
                </span>
              </div>
              <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#132228]/90 text-[#94A3B8] border border-[#334B56]">
                KoboCollect Field Photo
              </span>
            </div>
          `
          : `
            <div class="mb-2 p-2 rounded-xl bg-[#1B2F38] border border-[#334B56] text-center flex items-center justify-center gap-1.5 text-[#94A3B8] text-xs">
              <span class="text-[10px] font-semibold text-[#94A3B8]">No Field Photo Recorded</span>
            </div>
          `;

        const catTheme = getCategoryTheme(fac.category || '', facName);
        const contextAttributesHtml = buildFacilityContextAttributesHtml(fac);

        const popupHtml = `
          <div class="font-sans text-[#F8FAFC] p-1 min-w-[270px] max-w-[320px]">
            <!-- Inspection Thumbnail / Fallback -->
            ${photoMarkup}

            <!-- 1. Asset Title & ID -->
            <div class="flex items-start justify-between gap-2 mb-1.5">
              <h3 class="text-sm font-semibold text-[#F8FAFC] tracking-tight leading-snug">
                ${facName}
              </h3>
              <span class="text-[9px] font-mono text-[#38BDF8] font-bold bg-[#1B2F38] px-2 py-0.5 rounded border border-[#334B56] flex-shrink-0">
                ${fac.facility_id || 'ID-GEN'}
              </span>
            </div>

            <!-- 2. Category Badge (Colored by Category) -->
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[10px] font-bold capitalize mb-2 ${catTheme.badgeClass}">
              <span>${catTheme.glyph}</span>
              <span>${(fac.category || 'General').replace(/_/g, ' ')}</span>
            </div>

            <!-- 3. Status Pill & Monsoon Access Condition -->
            <div class="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-[#1B2F38] border border-[#334B56] text-[10px] mb-2 shadow-sm">
              <div>
                <span class="text-[#94A3B8] block text-[9px] uppercase tracking-wider mb-0.5">Functional Status</span>
                <span class="inline-block ${statusBadge}">
                  ● ${statusLabel}
                </span>
              </div>
              <div>
                <span class="text-[#94A3B8] block text-[9px] uppercase tracking-wider mb-0.5">Monsoon Access</span>
                ${monsoonPill}
              </div>
            </div>

            <!-- 4. Category-Specific Context Attributes (Never Generic / No False UPI) -->
            ${contextAttributesHtml}

            <!-- 5. Coordinate Telemetry & Copy Coords -->
            <div class="pt-1.5 border-t border-[#334B56]/50 flex items-center justify-between gap-2 text-[10px] font-mono">
              <span class="text-[#F8FAFC] truncate font-medium">
                ${Number(fac.latitude || 0).toFixed(5)}°N, ${Number(fac.longitude || 0).toFixed(5)}°E
              </span>
              <button
                onclick="navigator.clipboard.writeText('${Number(fac.latitude || 0).toFixed(5)}, ${Number(fac.longitude || 0).toFixed(5)}'); this.innerText='Copied!'; setTimeout(() => this.innerText='Copy Coords', 1500);"
                class="px-2 py-0.5 rounded bg-[#1B2F38] hover:bg-[#233B46] text-[#38BDF8] border border-[#334B56] font-sans font-semibold transition active:scale-95 cursor-pointer text-[10px]"
              >
                Copy Coords
              </button>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml, {
          className: 'gis-dark-popup',
          closeButton: true,
          autoPanPadding: [15, 80],
        });

        group.addLayer(marker);
      });
    },
    []
  );

  // 5-Stage Visual Progress Tracker for Issue/Grievance Popups
  const buildStepTrackerHtml = (status: string = 'pending_initial_approval') => {
    const st = (status || '').toLowerCase();
    let currentStage = 1;
    if (st === 'assigned_for_inspection') currentStage = 2;
    else if (st === 'pending_inspection_verification') currentStage = 2;
    else if (st === 'under_inspection') currentStage = 3;
    else if (st === 'pending_resolution_approval') currentStage = 4;
    else if (st === 'resolved') currentStage = 5;

    const stages = [
      { num: 1, label: 'Reported' },
      { num: 2, label: 'Assigned' },
      { num: 3, label: 'Insp. Auth' },
      { num: 4, label: 'Repaired' },
      { num: 5, label: 'Audit Closed' },
    ];

    const stageNodes = stages
      .map((s) => {
        const isCompleted = s.num < currentStage || (currentStage === 5 && st === 'resolved');
        const isActive = s.num === currentStage && st !== 'resolved';

        const circleClass = isCompleted
          ? 'bg-[#10B981] text-white border-[#10B981]'
          : isActive
          ? 'bg-[#F59E0B] text-[#0C171C] border-[#F59E0B] ring-2 ring-[#F59E0B]/50 animate-pulse font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.6)]'
          : 'bg-[#1B2F38] text-[#64748B] border-[#334B56]';

        const textClass = isCompleted
          ? 'text-[#10B981] font-semibold'
          : isActive
          ? 'text-[#F59E0B] font-bold'
          : 'text-[#64748B]';

        return `
          <div class="flex flex-col items-center flex-1 relative z-10">
            <div class="w-5 h-5 rounded-full border text-[9px] flex items-center justify-center font-mono ${circleClass}">
              ${isCompleted ? 'OK' : s.num}
            </div>
            <span class="text-[8px] text-center mt-1 leading-tight tracking-tight ${textClass}">${s.label}</span>
          </div>
        `;
      })
      .join('');

    return `
      <div class="my-2 p-2 rounded-xl bg-[#0C171C] border border-[#334B56]">
        <div class="text-[9px] uppercase font-bold tracking-wider text-[#94A3B8] mb-1.5 flex items-center justify-between">
          <span>Verification Lifecycle</span>
          <span class="font-mono ${st === 'resolved' ? 'text-[#10B981]' : 'text-[#F59E0B]'}">Stage ${currentStage}/5</span>
        </div>
        <div class="relative flex items-start justify-between">
          <div class="absolute top-2.5 left-2 right-2 h-0.5 bg-[#1B2F38] z-0"></div>
          ${stageNodes}
        </div>
      </div>
    `;
  };

  // Render Status & Severity Coded Issue Markers & Inspection Popups (Managed by Issues Layer effect)
  const renderIssueMarkers = useCallback(
    (issues: CachedIssue[], filter: FacilityCategoryFilter = 'all') => {
      void issues;
      void filter;
      return;
      if (!issuesLayerRef.current) return;
      const group = issuesLayerRef.current;
      group.clearLayers();

      const safeList = Array.isArray(issues) ? issues.filter(Boolean) : [];

      const filtered = safeList.filter((iss) => {
        if (!iss) return false;
        const isResident = userRoleRef.current === 'user';
        const isOfficer = userRoleRef.current === 'officer';

        // Requirement 4A: Resident map ONLY renders pins that have reached 'under_inspection' or 'resolved'
        if (isResident) {
          const st = (iss.status || '').toLowerCase();
          if (st !== 'under_inspection' && st !== 'resolved') {
            return false;
          }
        }

        // Requirement 4C: Officer worklist/map hides Step 1 (pending_initial_approval)
        if (isOfficer) {
          const st = (iss.status || '').toLowerCase();
          if (st === 'pending_initial_approval') {
            return false;
          }
        }

        if (iss.approval_status === 'rejected') {
          return false;
        }

        if (filter === 'all' || filter === 'issues') return true;
        const cat = (iss.category || 'general').toLowerCase();
        const title = (iss.title || 'Civic Issue').toLowerCase();
        if (filter === 'water') {
          return (
            cat.includes('water') ||
            cat.includes('drain') ||
            cat.includes('runoff') ||
            title.includes('drain') ||
            title.includes('water')
          );
        }
        if (filter === 'health') {
          return (
            cat.includes('waste') ||
            cat.includes('heap') ||
            cat.includes('sanitation') ||
            title.includes('waste')
          );
        }
        return false;
      });

      filtered.forEach((iss) => {
        if (!iss || typeof iss.latitude !== 'number' || typeof iss.longitude !== 'number') return;
        const sev = (iss.severity || 'medium').toLowerCase();
        const st = (iss.status || 'pending_initial_approval').toLowerCase();

        // Marker Pin Colors:
        // Functional Facilities: Teal/Cyan (#38BDF8)
        // Active Inspections: Amber (#F59E0B)
        // Resolved Grievances: Emerald (#10B981)
        // Urgent Unassigned: Coral (#E05A47)
        let pinColor = '#F59E0B';
        if (st === 'resolved') {
          pinColor = '#10B981';
        } else if (
          st === 'under_inspection' ||
          st === 'assigned_for_inspection' ||
          st === 'pending_inspection_verification' ||
          st === 'pending_resolution_approval'
        ) {
          pinColor = '#F59E0B';
        } else if (st === 'pending_initial_approval' || st === 'reported' || sev === 'critical' || sev === 'high') {
          pinColor = '#E05A47';
        }

        let severityLabel = 'Medium Priority';
        let severityBadge = 'bg-[#F59E0B]/20 text-[#FDE68A] border border-[#F59E0B]/60 font-semibold text-xs px-2.5 py-0.5 rounded-full';

        if (sev === 'high' || sev === 'critical' || sev === 'urgent') {
          severityLabel = 'High Priority';
          severityBadge = 'bg-[#E05A47]/20 text-[#FCA5A5] border border-[#E05A47]/60 font-semibold text-xs px-2.5 py-0.5 rounded-full';
        } else if (sev === 'low') {
          severityLabel = 'Low Priority';
          severityBadge = 'bg-[#10B981]/20 text-[#6EE7B7] border border-[#10B981]/60 font-semibold text-xs px-2.5 py-0.5 rounded-full';
        }

        const glyphSvg = `<svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;

        const customIcon = L.divIcon({
          className: 'custom-issue-marker',
          html: `
            <div class="relative flex items-center justify-center group cursor-pointer">
              ${
                st === 'under_inspection' || sev === 'critical'
                  ? `<span class="absolute w-8 h-8 rounded-full animate-ping opacity-60" style="background-color: ${pinColor};"></span>`
                  : ''
              }
              <div class="relative w-8 h-8 rounded-full bg-[#132228] border-2 shadow-2xl flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-125" style="border-color: ${pinColor}; box-shadow: 0 0 16px ${pinColor}90;">
                <span class="flex items-center justify-center">${glyphSvg}</span>
                <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#132228]" style="background-color: ${pinColor}"></span>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([iss.latitude, iss.longitude], { icon: customIcon });

        marker.bindTooltip(
          `<div class="font-sans font-semibold text-xs text-[#F8FAFC]">${iss.title}</div>`,
          {
            direction: 'top',
            offset: [0, -18],
            className: 'gis-clean-tooltip',
            opacity: 0.95,
          }
        );

        const currentRole = userRoleRef.current;
        const isUserRole = currentRole === 'user';
        const isOfficerRole = currentRole === 'officer';
        const isAdminRole = currentRole === 'admin';

        // Role-based status interaction
        let statusControlHtml = '';
        if (isUserRole) {
          statusControlHtml = `
            <div class="mt-2.5 pt-2 border-t border-[#334B56]/50 flex items-center justify-between text-[11px]">
              <span class="text-[#94A3B8]">Verification Status:</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#1B2F38] border border-[#334B56]" style="color: ${pinColor}">
                ● ${(iss.status || 'pending_initial_approval').replace(/_/g, ' ')}
              </span>
            </div>
          `;
        } else if (isOfficerRole) {
          statusControlHtml = `
            <div class="mt-2.5 pt-2 border-t border-[#334B56]/50">
              <div class="text-[9px] uppercase font-bold text-[#FCA5A5] mb-1 flex items-center justify-between">
                <span>Field Officer Verification:</span>
                <span class="text-[#38BDF8] font-mono text-[9px]">Officer Desk</span>
              </div>
              <select
                class="issue-status-select w-full bg-[#0C171C] border border-[#334B56] rounded-lg text-xs text-[#F8FAFC] p-1.5 focus:outline-none focus:border-[#38BDF8] transition cursor-pointer"
                data-issue-id="${iss.issue_id}"
              >
                <option value="assigned_for_inspection" ${iss.status === 'assigned_for_inspection' ? 'selected' : ''}>Assigned For Inspection</option>
                <option value="pending_inspection_verification" ${iss.status === 'pending_inspection_verification' ? 'selected' : ''}>Inspection Req Sign-off</option>
                <option value="under_inspection" ${iss.status === 'under_inspection' ? 'selected' : ''}>Under Inspection</option>
                <option value="pending_resolution_approval" ${iss.status === 'pending_resolution_approval' ? 'selected' : ''}>Repair Proof Uploaded</option>
              </select>
            </div>
          `;
        } else if (isAdminRole) {
          statusControlHtml = `
            <div class="mt-2.5 pt-2 border-t border-[#334B56]/50">
              <div class="text-[9px] uppercase font-bold text-[#FCA5A5] mb-1 flex items-center justify-between">
                <span>Panchayat Admin Verification Override:</span>
                <span class="text-[#38BDF8] font-mono text-[9px]">Sarpanch Control</span>
              </div>
              <select
                class="issue-status-select w-full bg-[#0C171C] border border-[#334B56] rounded-lg text-xs text-[#F8FAFC] p-1.5 focus:outline-none focus:border-[#E05A47] transition cursor-pointer"
                data-issue-id="${iss.issue_id}"
              >
                <option value="pending_initial_approval" ${iss.status === 'pending_initial_approval' ? 'selected' : ''}>Step 1: Resident Submission</option>
                <option value="assigned_for_inspection" ${iss.status === 'assigned_for_inspection' ? 'selected' : ''}>Step 2: Assigned To Officer</option>
                <option value="pending_inspection_verification" ${iss.status === 'pending_inspection_verification' ? 'selected' : ''}>Step 3: Officer Requested Auth</option>
                <option value="under_inspection" ${iss.status === 'under_inspection' ? 'selected' : ''}>Step 4: Under Inspection</option>
                <option value="pending_resolution_approval" ${iss.status === 'pending_resolution_approval' ? 'selected' : ''}>Step 5: Repair Proof Awaiting Audit</option>
                <option value="resolved" ${iss.status === 'resolved' ? 'selected' : ''}>Step 6: Officially Resolved</option>
              </select>
            </div>
          `;
        }

        // Check KoboToolbox / Survey Photo evidence
        const rawPhoto = iss.photoBase64 || iss.photo_url || (iss as any).photo || '';
        let resolvedPhoto = '';
        if (rawPhoto) {
          if (
            rawPhoto.startsWith('data:') ||
            rawPhoto.startsWith('http://') ||
            rawPhoto.startsWith('https://') ||
            rawPhoto.startsWith('/')
          ) {
            resolvedPhoto = rawPhoto;
          } else {
            resolvedPhoto = `/media/${rawPhoto}`;
          }
        }

        const photoMarkup = resolvedPhoto
          ? `
            <div
              onclick="window.openPhotoLightbox && window.openPhotoLightbox('${resolvedPhoto}', '${(iss.title || '').replace(/'/g, "\\'")}', '${iss.category || 'Incident'}', [${iss.latitude}, ${iss.longitude}])"
              class="relative w-full h-32 mb-2 rounded-xl overflow-hidden border border-[#334B56] bg-[#0C171C] shadow-inner group cursor-pointer"
              title="Click to inspect high-resolution field survey evidence"
            >
              <img src="${resolvedPhoto}" alt="${iss.title}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <div class="absolute inset-0 bg-[#132228]/30 group-hover:bg-transparent transition-colors flex items-center justify-center">
                <span class="opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1 rounded-lg bg-[#132228]/95 text-[10px] font-bold text-[#F8FAFC] border border-[#334B56] shadow-md">
                  Inspect Ground-Truth
                </span>
              </div>
              <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#132228]/90 text-[#94A3B8] border border-[#334B56]">
                Field Evidence
              </span>
            </div>
          `
          : `
            <div class="mb-2 p-2 rounded-xl bg-[#1B2F38] border border-[#334B56] text-center flex items-center justify-center gap-1.5 text-[#94A3B8] text-xs">
              <span class="text-[10px] font-semibold text-[#94A3B8]">No Initial Photo Attached</span>
            </div>
          `;

        const isFloods =
          (iss.title || '').toLowerCase().includes('flood') ||
          (iss.title || '').toLowerCase().includes('drain') ||
          (iss.title || '').toLowerCase().includes('inundat') ||
          (iss.notes || '').toLowerCase().includes('waterlog') ||
          iss.severity === 'critical' ||
          iss.severity === 'high';

        const monsoonPill = isFloods
          ? `<span class="px-2.5 py-0.5 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] font-semibold text-[10px] flex items-center gap-1">Floods / Isolated</span>`
          : `<span class="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] font-semibold text-[10px] flex items-center gap-1">Year-round Accessible</span>`;

        const statusPill =
          iss.status === 'resolved'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] font-bold text-[10px]">● Resolved</span>`
            : iss.status === 'under_inspection'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/60 text-[#FDE68A] font-bold text-[10px]">● Under Inspection</span>`
            : iss.status === 'pending_resolution_approval'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#A855F7]/20 border border-[#A855F7]/60 text-[#D8B4FE] font-bold text-[10px]">● Awaiting Audit</span>`
            : iss.status === 'assigned_for_inspection' || iss.status === 'pending_inspection_verification'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#38BDF8]/20 border border-[#38BDF8]/60 text-[#38BDF8] font-bold text-[10px]">● Officer Assigned</span>`
            : `<span class="px-2 py-0.5 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] font-bold text-[10px]">● Pending Approval</span>`;

        // Resolution proof markup
        const resolutionProofMarkup = iss.resolution_photo_url
          ? `
            <div class="mb-2 p-2 rounded-xl bg-[#0C171C] border border-[#10B981]/50 shadow-inner">
              <div class="text-[9px] uppercase font-bold text-[#10B981] mb-1 flex items-center justify-between">
                <span>Officer Repair Proof:</span>
                <span class="text-[8px] font-mono text-[#94A3B8]">Audit Verified</span>
              </div>
              <img src="${iss.resolution_photo_url}" alt="Repair Proof" class="w-full h-24 object-cover rounded-lg border border-[#334B56]" />
              ${iss.officer_notes ? `<p class="text-[10px] text-[#94A3B8] italic mt-1 bg-[#132228] p-1.5 rounded border border-[#334B56]">${iss.officer_notes}</p>` : ''}
            </div>
          `
          : '';

        const popupHtml = `
          <div class="font-sans text-[#F8FAFC] p-2 min-w-[260px] max-w-[310px]">
            <!-- Inspection Thumbnail / Fallback -->
            ${photoMarkup}

            <!-- 1. Incident Title & ID -->
            <div class="flex items-start justify-between gap-2 mb-1.5">
              <h3 class="text-sm font-bold text-[#F8FAFC] tracking-tight leading-snug">
                ${iss?.title || 'Civic Issue'}
              </h3>
              <span class="text-[9px] font-mono text-[#38BDF8] font-bold bg-[#1B2F38] px-2 py-0.5 rounded border border-[#334B56] flex-shrink-0">
                ${iss.issue_id || 'ISS-GEN'}
              </span>
            </div>

            <!-- 2. Category Badge -->
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#1B2F38] border border-[#334B56] text-[#94A3B8] font-semibold text-[10px] capitalize mb-2">
              <span class="w-2 h-2 rounded-full bg-red-400"></span>
              <span>${(iss?.category || 'Incident').replace(/_/g, ' ')}</span>
            </div>

            <!-- 5-Stage Verification Step Tracker -->
            ${buildStepTrackerHtml(iss.status)}

            <!-- Resolution Proof if uploaded -->
            ${resolutionProofMarkup}

            <!-- Status Pill & Priority Badge -->
            <div class="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-[#1B2F38] border border-[#334B56] text-[10px] mb-2 shadow-sm">
              <div>
                <span class="text-[#94A3B8] block text-[9px] uppercase tracking-wider mb-0.5">Status</span>
                ${statusPill}
              </div>
              <div>
                <span class="text-[#94A3B8] block text-[9px] uppercase tracking-wider mb-0.5">Priority</span>
                <span class="inline-block ${severityBadge}">● ${severityLabel}</span>
              </div>
            </div>
            <div class="mb-2 p-1.5 rounded-lg bg-[#1B2F38] border border-[#334B56] text-[10px] flex items-center justify-between shadow-sm">
              <span class="text-[#94A3B8] text-[9px] uppercase tracking-wider">Monsoon Access:</span>
              ${monsoonPill}
            </div>

            ${statusControlHtml}

            <!-- Coordinate Telemetry & Copy -->
            <div class="pt-1.5 border-t border-[#334B56]/50 flex items-center justify-between gap-2 text-[10px] font-mono mt-2">
              <span class="text-[#94A3B8] truncate font-semibold">
                ${iss.latitude.toFixed(5)}°N, ${iss.longitude.toFixed(5)}°E
              </span>
              <button
                onclick="navigator.clipboard.writeText('${iss.latitude.toFixed(5)}, ${iss.longitude.toFixed(5)}'); this.innerText='Copied!'; setTimeout(() => this.innerText='Copy Coords', 1500);"
                class="px-2 py-0.5 rounded bg-[#1B2F38] hover:bg-[#233B46] text-[#38BDF8] border border-[#334B56] font-sans font-semibold transition active:scale-95 cursor-pointer text-[10px]"
              >
                Copy Coords
              </button>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml, {
          className: 'gis-dark-popup',
          closeButton: true,
          autoPanPadding: [15, 80],
        });

        group.addLayer(marker);
      });
    },
    []
  );

  // Filter facilities & issues by category and smoothly fit bounds to filtered group
  const handleFilterFacilities = (filter: FacilityCategoryFilter) => {
    setFacilityFilter(filter);
    renderFacilityMarkers(allFacilitiesRef.current, filter);
    renderIssueMarkers(allIssuesRef.current, filter);

    if (filter === 'issues') {
      const issueCoords = allIssuesRef.current
        .filter((i) => !isNaN(i.latitude) && !isNaN(i.longitude) && i.latitude !== 0 && i.longitude !== 0)
        .map((i) => [i.latitude, i.longitude] as [number, number]);

      if (issueCoords.length > 0 && mapInstanceRef.current) {
        const bounds = L.latLngBounds(issueCoords);
        if (bounds.isValid()) {
          try {
            mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
          } catch {
            // ignore
          }
        }
      }
      return;
    }

    const safeFacs = Array.isArray(allFacilitiesRef.current) ? allFacilitiesRef.current.filter(Boolean) : [];
    const filtered = safeFacs.filter((fac) => {
      if (!fac) return false;
      if (filter === 'all') return true;
      const cat = (fac.category || 'general').toLowerCase();
      const facNameLower = (fac.name || '').toLowerCase();
      if (filter === 'water') {
        return (
          cat.includes('water') ||
          cat.includes('borewell') ||
          cat.includes('standpost') ||
          cat.includes('pump') ||
          cat.includes('well') ||
          cat.includes('tank') ||
          facNameLower.includes('lake')
        );
      }
      if (filter === 'education') {
        return (
          cat.includes('education') ||
          cat.includes('school') ||
          cat.includes('anganwadi') ||
          cat.includes('childcare') ||
          cat.includes('college') ||
          cat.includes('balwadi') ||
          cat.includes('coaching') ||
          cat.includes('academy')
        );
      }
      if (filter === 'commerce') {
        return (
          cat.includes('shop') ||
          cat.includes('commerce') ||
          cat.includes('store') ||
          cat.includes('ration') ||
          cat.includes('dairy') ||
          cat.includes('hardware') ||
          cat.includes('market') ||
          cat.includes('vendor') ||
          cat.includes('saloon') ||
          cat.includes('laundry')
        );
      }
      if (filter === 'health') {
        return (
          cat.includes('health') ||
          cat.includes('clinic') ||
          cat.includes('hospital') ||
          cat.includes('sub-center')
        );
      }
      if (filter === 'civic') {
        return (
          cat.includes('civic') ||
          cat.includes('social') ||
          cat.includes('mandir') ||
          cat.includes('temple') ||
          cat.includes('graveyard') ||
          cat.includes('chwal') ||
          cat.includes('chawl') ||
          cat.includes('panchayat') ||
          cat.includes('admin')
        );
      }
      return false;
    });

    const coords = filtered
      .filter((f) => !isNaN(f.latitude) && !isNaN(f.longitude) && f.latitude !== 0 && f.longitude !== 0)
      .map((f) => [f.latitude, f.longitude] as [number, number]);

    if (coords.length > 0 && mapInstanceRef.current) {
      const bounds = L.latLngBounds(coords);
      if (bounds.isValid()) {
        try {
          mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
        } catch {
          // ignore transient container size errors
        }
      }
    }
  };

  // Switch dataset between field surveyed assets (22 fac + 3 iss) and unified village model assets (172 fac + 203 iss)
  // Handle saving newly registered facility
  const handleFacilitySaved = async (newFacility: CachedFacility) => {
    try {
      // 1. Save directly to IndexedDB SmartVillageOfflineDB (cached_facilities)
      await saveFacilityToOfflineDb(newFacility);

      // 2. Instantly append to React state and refs
      const updated = [newFacility, ...allFacilitiesRef.current];
      allFacilitiesRef.current = updated;
      setFacilitiesList(updated);
      setFacilityCount(
        updated.filter((f) => f.approval_status === 'approved' || !f.approval_status).length
      );

      // 3. Immediately render on Leaflet layer (pending items automatically hidden for user/officer)
      renderFacilityMarkers(updated, facilityFilter);

      // 4. Cleanup mode & temporary marker
      cleanupAddFacilityMode();

      // 5. Success Toast / Feedback
      if (newFacility.approval_status === 'pending_approval') {
        showToast('Facility proposal submitted for Panchayat Verification.');
      } else {
        showToast('Facility registered and published to live map!');
      }
    } catch (err) {
      console.error('Failed to save facility:', err);
      showToast('Error saving facility to local database.');
    }
  };

  // Update status for a village issue from popup
  const handleUpdateIssueStatus = useCallback(
    async (issueId: string, newStatus: string) => {
      try {
        await db.cached_issues.update(issueId, { status: newStatus });
        allIssuesRef.current = allIssuesRef.current.map((iss) =>
          iss.issue_id === issueId || String((iss as any).id) === issueId ? { ...iss, status: newStatus } : iss
        );
        setIssuesList([...allIssuesRef.current]);
        renderIssueMarkers(allIssuesRef.current, facilityFilter);
        if (refreshGrievanceMarkersRef.current) {
          refreshGrievanceMarkersRef.current();
        }
        if (propSetIssues) {
          propSetIssues((prev) =>
            prev.map((iss) => (iss.issue_id === issueId || String(iss.id) === issueId ? { ...iss, status: newStatus as any } : iss))
          );
        }
        const res = await updateIssueStatus(issueId, newStatus as IssueStatus);
        if (!res.success) {
          await upsertIssue({ issue_id: issueId, status: newStatus as any });
        }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.closePopup();
        }
        showToast(`Issue status updated to "${newStatus.replace(/_/g, ' ')}"!`);
      } catch (err) {
        console.error('Failed to update issue status in DB:', err);
      }
    },
    [facilityFilter, renderIssueMarkers, showToast, propSetIssues]
  );
  handleUpdateIssueStatusRef.current = handleUpdateIssueStatus;

  // Fly to high priority issue from ML Decision Support panel
  const handleFlyToIssue = useCallback((issue: CachedIssue) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([issue.latitude, issue.longitude], 18, {
      duration: 1.5,
    });
    if (issuesLayerRef.current) {
      issuesLayerRef.current.eachLayer((layer: any) => {
        if (layer.getLatLng) {
          const latlng = layer.getLatLng();
          if (
            Math.abs(latlng.lat - issue.latitude) < 0.0001 &&
            Math.abs(latlng.lng - issue.longitude) < 0.0001
          ) {
            setTimeout(() => {
              layer.openPopup();
            }, 800);
          }
        }
      });
    }
  }, []);

  // 1. Mount issuesLayerRef to the map once on map initialization
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!map.hasLayer(issuesLayerRef.current)) {
      issuesLayerRef.current.addTo(map);
    }
  }, [mapInstanceRef.current]);

  // 2. Populate and toggle the Issues layer reactively
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    issuesLayerRef.current.clearLayers();

    // Only render if the issues layer toggle is active
    if (!showIssuesLayer) return;

    const currentIssues = (issues && issues.length > 0) ? issues : PREDEFINED_SURVEY_ISSUES;

    currentIssues.forEach((issue) => {
      const lat = Number(issue?.latitude);
      const lng = Number(issue?.longitude);
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      const hasLabel = map.getZoom() >= 16;
      // Create an identifiable warning pin using getIssueDivIcon or a clean SVG badge
      const icon = createIssueDivIcon(issue.title, issue.severity, hasLabel);

      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: 800, // Render issues prominently above standard base features
      }).bindPopup(buildIssuePopupHTML(issue, userRole), {
        className: 'gis-dark-popup',
        autoPanPadding: [15, 80],
      });

      marker.on('click', () => {
        setInspectedPoint({
          lat,
          lng,
          distKm: parseFloat(
            (mapInstanceRef.current ? mapInstanceRef.current.distance([lat, lng], KHOPRIPADA_CORE) / 1000 : 0).toFixed(2)
          ),
        });
      });

      issuesLayerRef.current.addLayer(marker);
    });
  }, [showIssuesLayer, issues, userRole]);

  // 3. DBSCAN cluster circles removed completely from map canvas per architecture requirements
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    dbscanLayerRef.current.clearLayers();
    if (map.hasLayer(dbscanLayerRef.current)) {
      map.removeLayer(dbscanLayerRef.current);
    }
  }, []);

  // 4. Non-Crashing Native Heatmap Engine
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    try {
      // Ensure isolated high z-index pane exists
      if (!map.getPane('heatmapPane')) {
        const heatPane = map.createPane('heatmapPane');
        heatPane.style.zIndex = '450';
        heatPane.style.pointerEvents = 'none';
      }

      if (!map.hasLayer(heatmapGroupRef.current)) {
        heatmapGroupRef.current.addTo(map);
      }

      // 1. Clear previous layers ONCE at the start of the effect
      heatmapGroupRef.current.clearLayers();

      if (!heatmapActive) return;

      // 2. Validate all historical issues (do NOT filter out old or resolved issues from the heatmap)
      const validIssues = (issues || []).filter((issue: any) => {
        const lat = Number(issue?.latitude);
        const lng = Number(issue?.longitude);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      });

      console.log(`[Heatmap Engine] Plotting full density for ${validIssues.length} issues (historical + latest)`);

      // 3. Iterate through EVERY issue in the database
      validIssues.forEach((issue: any) => {
        const lat = Number(issue.latitude);
        const lng = Number(issue.longitude);
        const isCritical =
          issue.severity === 'high' ||
          issue.severity === 'critical' ||
          issue.severity === 'urgent' ||
          ((issue as any).priority_score && (issue as any).priority_score > 70);

        // Inner Core Hotspot
        const core = L.circle([lat, lng], {
          pane: 'heatmapPane',
          radius: isCritical ? 45 : 30,
          fillColor: '#EF4444',
          color: '#DC2626',
          weight: 1,
          fillOpacity: 0.65,
        });

        // Middle Aura
        const mid = L.circle([lat, lng], {
          pane: 'heatmapPane',
          radius: isCritical ? 90 : 60,
          fillColor: '#F59E0B',
          color: 'transparent',
          weight: 0,
          fillOpacity: 0.35,
        });

        // Outer Glow
        const outer = L.circle([lat, lng], {
          pane: 'heatmapPane',
          radius: isCritical ? 140 : 95,
          fillColor: '#38BDF8',
          color: 'transparent',
          weight: 0,
          fillOpacity: 0.15,
        });

        heatmapGroupRef.current.addLayer(outer);
        heatmapGroupRef.current.addLayer(mid);
        heatmapGroupRef.current.addLayer(core);
      });

      map.invalidateSize();
    } catch (err) {
      console.warn('Heatmap layer rendered safely with fallback:', err);
    }
  }, [heatmapActive, issues]);

  const toggleHeatmap = useCallback(
    (enable?: boolean) => {
      setHeatmapActive((prev) => (enable !== undefined ? enable : !prev));
    },
    [setHeatmapActive]
  );

  // Zoom visibility coordinator
  const syncLODLayers = useCallback((map: L.Map) => {
    if (!map || !tierGroupsRef.current) return;
    try {
      const zoom = map.getZoom();
      setCurrentZoom(zoom);
      map.getContainer().classList.toggle('zoom-micro', zoom >= 18);
      const { tier1, tier2, tier3, tier4 } = tierGroupsRef.current;

      // Zoom < 15: Macro View (Only Tier 1 anchor landmarks)
      if (zoom < 15) {
        if (!map.hasLayer(tier1)) map.addLayer(tier1);
        if (map.hasLayer(tier2)) map.removeLayer(tier2);
        if (map.hasLayer(tier3)) map.removeLayer(tier3);
        if (map.hasLayer(tier4)) map.removeLayer(tier4);
      }
      // Zoom 15 - 16: Meso View (Anchors + Civic Facilities)
      else if (zoom >= 15 && zoom < 17) {
        if (!map.hasLayer(tier1)) map.addLayer(tier1);
        if (!map.hasLayer(tier2)) map.addLayer(tier2);
        if (map.hasLayer(tier3)) map.removeLayer(tier3);
        if (map.hasLayer(tier4)) map.removeLayer(tier4);
      }
      // Zoom 17: Local View (Add local utilities, water taps, shops)
      else if (zoom === 17) {
        if (!map.hasLayer(tier1)) map.addLayer(tier1);
        if (!map.hasLayer(tier2)) map.addLayer(tier2);
        if (!map.hasLayer(tier3)) map.addLayer(tier3);
        if (map.hasLayer(tier4)) map.removeLayer(tier4);
      }
      // Zoom 18+: Granular Micro-Twin View (Reveal streetlights, meters, all details)
      else {
        if (!map.hasLayer(tier1)) map.addLayer(tier1);
        if (!map.hasLayer(tier2)) map.addLayer(tier2);
        if (!map.hasLayer(tier3)) map.addLayer(tier3);
        if (!map.hasLayer(tier4)) map.addLayer(tier4);
      }
    } catch (err) {
      console.warn('LOD layer transition caught safely:', err);
    }
  }, []);

  // Populate LOD Layers when Facilities or Issues update
  useEffect(() => {
    if (!tierGroupsRef.current) return;
    const { tier1, tier2, tier3, tier4 } = tierGroupsRef.current;

    tier1.clearLayers();
    tier2.clearLayers();
    tier3.clearLayers();
    tier4.clearLayers();

    const currentZoom = mapInstanceRef.current ? mapInstanceRef.current.getZoom() : 16;
    const showTextLabels = currentZoom >= 16; // Show inline name only when zoom >= 16

    // Populate Facilities
    if (showFacilities) {
      (safeFacilities || []).forEach((fac) => {
        const lat = Number(fac?.latitude);
        const lng = Number(fac?.longitude);
        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

        if (facilityFilter !== 'all') {
          const cat = (fac.category || '').toLowerCase();
          const name = (fac.name || '').toLowerCase();
          if (facilityFilter === 'water' && !cat.includes('water') && !name.includes('water') && !name.includes('pump') && !name.includes('tank')) return;
          if (facilityFilter === 'education' && !cat.includes('education') && !cat.includes('school') && !name.includes('school')) return;
          if (facilityFilter === 'commerce' && !cat.includes('commerce') && !cat.includes('shop') && !name.includes('shop') && !name.includes('store')) return;
          if (facilityFilter === 'health' && !cat.includes('health') && !cat.includes('hospital') && !cat.includes('clinic') && !cat.includes('anganwadi')) return;
          if (facilityFilter === 'civic' && !cat.includes('civic') && !cat.includes('mandir') && !cat.includes('temple') && !cat.includes('panchayat')) return;
          if (facilityFilter === 'issues') return;
        }

        const tier = classifyFacilityTier(fac.category, fac.name);
        // Labels shown for Tier 1 & 2 at zoom 16+; Tier 3 & 4 at zoom 17+
        const hasLabel = tier === 'tier1_anchor' || tier === 'tier2_civic' ? showTextLabels : currentZoom >= 17;

        const icon = createPOIDivIcon(fac.name, fac.category, tier, hasLabel);
        const marker = L.marker([lat, lng], { icon }).bindPopup(
          buildFacilityPopupHTML(fac as any),
          { className: 'gis-dark-popup', autoPanPadding: [15, 80] }
        );

        marker.on('click', () => {
          setInspectedPoint({
            lat,
            lng,
            distKm: parseFloat((mapInstanceRef.current ? mapInstanceRef.current.distance([lat, lng], KHOPRIPADA_CORE) / 1000 : 0).toFixed(2)),
          });
        });

        if (tier === 'tier1_anchor') tier1.addLayer(marker);
        else if (tier === 'tier2_civic') tier2.addLayer(marker);
        else if (tier === 'tier3_local') tier3.addLayer(marker);
        else tier4.addLayer(marker);
      });
    }

    if (mapInstanceRef.current) {
      syncLODLayers(mapInstanceRef.current);
    }
  }, [safeFacilities, facilityFilter, showFacilities, syncLODLayers, currentZoom]);

  // Export Handlers for Client-Side Audit & Reporting Engine
  const handleDownloadPanchayatPdf = useCallback(() => {
    generatePanchayatPDF(facilitiesList, issuesList, session || undefined);
    showToast('Official Panchayat Audit PDF generated & downloaded.');
  }, [facilitiesList, issuesList, session, showToast]);

  const handleExportMasterCsv = useCallback(() => {
    exportMasterDataCSV(facilitiesList, issuesList);
    showToast('Master Data CSV exported successfully.');
  }, [facilitiesList, issuesList, showToast]);

  const handleOfficerExportWorklist = useCallback(() => {
    generateOfficerWorklistPDF(issuesList, session || undefined);
    showToast('Field Inspection Worklist PDF generated & downloaded.');
  }, [issuesList, session, showToast]);

  // Export Audit Handler - role adaptive
  const handleExportAuditSummary = () => {
    if (userRole === 'officer') {
      handleOfficerExportWorklist();
    } else {
      setIsExportAuditModalOpen(true);
    }
  };

  // Refresh grievance pins from IndexedDB
  const refreshGrievanceMarkers = useCallback(async () => {
    if (!mapInstanceRef.current || !grievancesLayerRef.current) return;
    grievancesLayerRef.current.clearLayers();

    try {
      const allGrievances = await db.offline_grievances.toArray();
      const visibleGrievances = allGrievances.filter((g) => {
        const isResident = userRoleRef.current === 'user';
        const isOfficer = userRoleRef.current === 'officer';

        // Requirement 4A: Resident map ONLY renders pins that have reached 'under_inspection' or 'resolved'
        if (isResident) {
          const st = (g.status || '').toLowerCase();
          if (st !== 'under_inspection' && st !== 'resolved') {
            return false;
          }
        }

        // Requirement 4C: Officer worklist/map hides Step 1 (pending_initial_approval)
        if (isOfficer) {
          const st = (g.status || '').toLowerCase();
          if (st === 'pending_initial_approval') {
            return false;
          }
        }

        if (g.approval_status === 'rejected') {
          return false;
        }
        return true;
      });

      visibleGrievances.forEach((g) => {
        const st = (g.status || 'pending_initial_approval').toLowerCase();

        // Dynamic pin color based on verification lifecycle
        let pinColor = '#F59E0B';
        if (st === 'resolved') {
          pinColor = '#10B981'; // Emerald
        } else if (
          st === 'under_inspection' ||
          st === 'assigned_for_inspection' ||
          st === 'pending_inspection_verification' ||
          st === 'pending_resolution_approval'
        ) {
          pinColor = '#F59E0B'; // Amber
        } else if (st === 'pending_initial_approval' || st === 'reported' || g.severity === 'critical') {
          pinColor = '#E05A47'; // Coral
        }

        const customIcon = L.divIcon({
          className: 'grievance-marker',
          html: `
            <div class="relative flex items-center justify-center group cursor-pointer">
              ${
                st === 'under_inspection' || g.severity === 'critical'
                  ? `<span class="absolute w-7 h-7 rounded-full animate-ping opacity-75" style="background-color: ${pinColor}50"></span>`
                  : ''
              }
              <div class="relative w-6 h-6 rounded-full border-2 border-[#132228] shadow-xl flex items-center justify-center text-xs font-bold text-[#F8FAFC]" style="background-color: ${pinColor}">
                <span class="text-[10px] font-bold font-mono text-white">!</span>
              </div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const photoSrc = g.photoBase64 || DEFAULT_INSPECTION_PLACEHOLDER;
        const isFloods =
          (g.description || '').toLowerCase().includes('flood') ||
          (g.description || '').toLowerCase().includes('inundat') ||
          g.severity === 'critical';

        const monsoonPill = isFloods
          ? `<span class="px-2 py-0.5 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] font-bold text-[10px] flex items-center gap-1">Monsoon Flood Hazard</span>`
          : `<span class="px-2 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] font-bold text-[10px] flex items-center gap-1">Year-round Accessible</span>`;

        const statusPill =
          st === 'resolved'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] font-bold text-[10px]">● Resolved</span>`
            : st === 'under_inspection'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/60 text-[#FDE68A] font-bold text-[10px]">● Under Inspection</span>`
            : st === 'pending_resolution_approval'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#A855F7]/20 border border-[#A855F7]/60 text-[#D8B4FE] font-bold text-[10px]">● Awaiting Audit</span>`
            : st === 'assigned_for_inspection' || st === 'pending_inspection_verification'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#38BDF8]/20 border border-[#38BDF8]/60 text-[#38BDF8] font-bold text-[10px]">● Officer Assigned</span>`
            : `<span class="px-2 py-0.5 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] font-bold text-[10px]">● Pending Approval</span>`;

        // Resolution proof section
        const resolutionProofHtml = g.resolution_photo_url
          ? `
            <div class="mb-2 p-2 rounded-xl bg-[#0C171C] border border-[#10B981]/50 shadow-inner">
              <div class="text-[9px] uppercase font-bold text-[#10B981] mb-1 flex items-center justify-between">
                <span>Officer Resolution Proof:</span>
                <span class="text-[8px] font-mono text-[#94A3B8]">Audit Verified</span>
              </div>
              <img src="${g.resolution_photo_url}" alt="Repair Proof" class="w-full h-24 object-cover rounded-lg border border-[#334B56]" />
              ${g.officer_notes ? `<p class="text-[10px] text-[#94A3B8] italic mt-1 bg-[#132228] p-1.5 rounded border border-[#334B56]">${g.officer_notes}</p>` : ''}
            </div>
          `
          : '';

        const marker = L.marker([g.latitude, g.longitude], { icon: customIcon });
        marker.bindPopup(
          `
          <div class="font-sans text-[#F8FAFC] p-2 min-w-[260px] max-w-[310px]">
            <!-- Inspection Thumbnail -->
            <div class="relative w-full h-32 mb-2 rounded-xl overflow-hidden border border-[#334B56] bg-[#0C171C] shadow-inner">
              <img src="${photoSrc}" alt="${g.title}" class="w-full h-full object-cover" />
              <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#132228]/95 text-[#38BDF8] border border-[#38BDF8]/40">
                ${g.photoBase64 ? 'Photo Captured' : 'Offline Inspection'}
              </span>
            </div>

            <!-- 1. Incident Title -->
            <div class="flex items-start justify-between gap-2 mb-1.5">
              <h3 class="text-sm font-bold text-[#F8FAFC] tracking-tight leading-snug">
                ${g.title}
              </h3>
              <span class="text-[9px] font-mono text-[#94A3B8] font-bold bg-[#0C171C] px-1.5 py-0.5 rounded border border-[#334B56] flex-shrink-0">
                #${g.id ?? 'NEW'}
              </span>
            </div>

            <!-- 2. Category Badge -->
            <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1B2F38] border border-[#334B56] text-[#38BDF8] font-semibold text-[10px] capitalize mb-2">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${pinColor}"></span>
              <span>${g.category}</span>
            </div>

            <!-- 5-Stage Verification Step Tracker -->
            ${buildStepTrackerHtml(g.status || 'pending_initial_approval')}

            <!-- Officer Resolution Proof if present -->
            ${resolutionProofHtml}

            <!-- 3. Status Pill & 4. Monsoon Access Condition -->
            <div class="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-[#1B2F38] border border-[#334B56] text-[10px] mb-2">
              <div>
                <span class="text-[#94A3B8] block text-[9px] uppercase tracking-wider mb-0.5">Verification Status</span>
                ${statusPill}
              </div>
              <div>
                <span class="text-[#94A3B8] block text-[9px] uppercase tracking-wider mb-0.5">Monsoon Condition</span>
                ${monsoonPill}
              </div>
            </div>

            ${
              g.description
                ? `<div class="p-2 rounded-xl bg-[#0C171C] border border-[#334B56] text-[11px] text-[#94A3B8] italic mb-2">"${g.description}"</div>`
                : ''
            }

            <!-- Coordinate Telemetry & Copy -->
            <div class="pt-1.5 border-t border-[#334B56] flex items-center justify-between gap-2 text-[10px] font-mono">
              <span class="text-[#38BDF8] truncate font-semibold">
                ${g.latitude.toFixed(5)}°N, ${g.longitude.toFixed(5)}°E
              </span>
              <button
                onclick="navigator.clipboard.writeText('${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)}'); this.innerText='Copied!'; setTimeout(() => this.innerText='Copy Coords', 1500);"
                class="px-2 py-0.5 rounded bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] border border-[#334B56] font-sans font-semibold transition active:scale-95 cursor-pointer text-[10px]"
              >
                Copy Coords
              </button>
            </div>
          </div>
        `,
          { className: 'gis-dark-popup', autoPanPadding: [15, 80] }
        );

        grievancesLayerRef.current?.addLayer(marker);
      });
    } catch (e) {
      console.error('Failed to render grievance markers from IndexedDB:', e);
    }
  }, []);
  refreshGrievanceMarkersRef.current = refreshGrievanceMarkers;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // 1. Standard Clean Tile Layers: ESRI Satellite (Default) & OSM Street
    esriLayerRef.current = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
    );
    satelliteLayerRef.current = esriLayerRef.current;

    osmLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    });

    // 2. Initialize Map Instance centered at Khopripada Core with ESRI Satellite default
    const map = L.map(mapContainerRef.current, {
      center: KHOPRIPADA_CORE,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      layers: [esriLayerRef.current],
    });

    mapInstanceRef.current = map;

    // Create custom map pane with explicit stacking order
    if (!map.getPane('heatmapPane')) {
      const heatPane = map.createPane('heatmapPane');
      heatPane.style.zIndex = '450'; // Explicitly above satellite tile pane (200)
      heatPane.style.pointerEvents = 'none'; // Allow clicking through to underlying map features
    }

    // Ensure the heatmap and DBSCAN zones do not block map clicks
    if (!map.getPane('dbscanPane')) {
      const dbscanPane = map.createPane('dbscanPane');
      dbscanPane.style.zIndex = '420'; // Above tiles, below markers
      dbscanPane.style.pointerEvents = 'none'; // Critical: allows clicks to pass through to map
    }

    map.getContainer().classList.toggle('zoom-micro', map.getZoom() >= 18);

    // 2.1 Add Zoom Control positioned cleanly
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 3. Add Scale Control positioned at bottom right
    L.control
      .scale({
        imperial: false,
        metric: true,
        position: 'bottomright',
      })
      .addTo(map);

    // 4. Village Boundary AOI Overlay (Glowing Cyan Line)
    const boundary = L.polygon(VILLAGE_BOUNDARY_COORDS, {
      color: '#00E5FF',
      weight: 2,
      opacity: 0.9,
      dashArray: '4, 4',
      fillColor: '#00E5FF',
      fillOpacity: 0.05,
    }).addTo(map);

    boundary.bindTooltip(
      '<div class="px-2.5 py-1 font-sans text-xs font-semibold text-[#F1F5F9] bg-[#0D1C2A]/95 border border-[#1D3B52] rounded-lg shadow-lg">Khopripada & Bapane Study Corridor</div>',
      { sticky: true, className: 'gis-boundary-tooltip' }
    );
    boundaryLayerRef.current = boundary;

    // 4.1 Automatic Auto-Focus & Fit Bounds on mobile mount (settlement buildings & facilities)
    const khopripadaSettlementBounds = L.latLngBounds([
      [19.3512, 72.8805],
      [19.3588, 72.8885],
    ]);

    if (window.innerWidth < 768) {
      map.fitBounds(khopripadaSettlementBounds, { padding: [24, 24], maxZoom: 16, animate: false });
    }

    // 5. Layer Groups
    const landmarksGroup = L.layerGroup().addTo(map);
    landmarksLayerRef.current = landmarksGroup;

    const facilitiesGroup = L.layerGroup();
    facilitiesLayerRef.current = facilitiesGroup;

    if (!map.hasLayer(issuesLayerRef.current)) {
      issuesLayerRef.current.addTo(map);
    }

    const grievancesGroup = L.layerGroup();
    grievancesLayerRef.current = grievancesGroup;

    const gpsGroup = L.layerGroup().addTo(map);
    gpsLocationLayerRef.current = gpsGroup;

    // Add initial LOD layers safely
    if (tierGroupsRef.current) {
      map.addLayer(tierGroupsRef.current.tier1);
      map.addLayer(tierGroupsRef.current.tier2);
    }

    // Bind zoom listener
    const onZoom = () => syncLODLayers(map);
    map.on('zoomend', onZoom);

    // Heatmap Layer (DBSCAN circles removed completely)
    if (!map.hasLayer(heatmapGroupRef.current)) {
      heatmapGroupRef.current.addTo(map);
    }



    // Plot Landmarks
    LANDMARKS.forEach((poi) => {
      const isCore = poi.id === 'khopripada-core';
      const isStation = poi.id === 'juchandra-station';

      const customIcon = L.divIcon({
        className: 'custom-poi-marker',
        html: `
          <div class="relative flex items-center justify-center group cursor-pointer">
            <span class="absolute w-8 h-8 rounded-full ${isCore ? 'bg-[#38BDF8]/40 animate-ping' : isStation ? 'bg-[#94A3B8]/30 animate-ping' : 'bg-[#38BDF8]/20'}"></span>
            <div class="relative w-7 h-7 rounded-xl ${isCore ? 'bg-[#1B2F38] border-2 border-[#38BDF8] text-[#F8FAFC] scale-110 shadow-[0_0_15px_rgba(56,189,248,0.5)]' : isStation ? 'bg-[#1B2F38] border-2 border-[#94A3B8] text-[#F8FAFC] shadow-[0_0_12px_rgba(148,163,184,0.4)]' : 'bg-[#132228] border-2 border-[#334B56] text-[#F8FAFC]'} shadow-xl flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-125">
              ${isCore ? '<span class="w-2.5 h-2.5 rounded-full bg-[#38BDF8]"></span>' : isStation ? '<span class="w-2.5 h-2.5 rounded-full bg-slate-300"></span>' : '<span class="w-2 h-2 rounded-full bg-amber-400"></span>'}
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker(poi.coords, { icon: customIcon });

      // Clean lightweight Leaflet tooltip that disappears immediately on mouseout
      marker.bindTooltip(
        `<div class="font-sans font-semibold text-xs text-[#F8FAFC]">${poi.name}</div>`,
        { direction: 'top', offset: [0, -14], className: 'gis-clean-tooltip', opacity: 0.95 }
      );

      const popupContent = `
        <div class="font-sans text-[#F8FAFC] p-1.5 min-w-[210px]">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="text-xs uppercase tracking-wider font-semibold text-[#38BDF8] bg-[#1B2F38] border border-[#334B56] px-2 py-0.5 rounded-md">
              ${poi.category.toUpperCase()}
            </span>
          </div>
          <h3 class="text-sm font-bold text-[#F8FAFC] mt-1">${poi.name}</h3>
          <p class="text-xs text-[#94A3B8] mt-1 leading-relaxed">${poi.description}</p>
          <div class="mt-2 pt-2 border-t border-[#334B56] text-[11px] font-mono text-[#38BDF8] flex items-center justify-between">
            <span>${poi.coords[0].toFixed(5)}°N, ${poi.coords[1].toFixed(5)}°E</span>
            <span class="text-[#94A3B8]">Fixed Point</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: 'gis-dark-popup',
        closeButton: true,
        autoPanPadding: [15, 80],
      });

      landmarksGroup.addLayer(marker);
    });

    // Fetch and sync data via Supabase Cloud Data Service with local offline fallback
    Promise.all([fetchFacilities(), fetchIssues()])
      .then(([facilities, issues]) => {
        allFacilitiesRef.current = facilities as any;
        setFacilitiesList(facilities as any);
        setFacilityCount(facilities.length);
        renderFacilityMarkers(facilities as any, facilityFilter);

        allIssuesRef.current = issues as any;
        setIssuesList(issues as any);
        renderIssueMarkers(issues as any, facilityFilter);
        refreshGrievanceMarkers();
        if (propSetIssues) {
          propSetIssues(issues as any);
        }

        // Auto-focus and fit bounds
        if (window.innerWidth < 768) {
          const khopripadaSettlementBounds = L.latLngBounds([
            [19.3512, 72.8805],
            [19.3588, 72.8885],
          ]);
          map.fitBounds(khopripadaSettlementBounds, { padding: [24, 24], maxZoom: 16, animate: false });
        } else {
          // On desktop, fit all facilities across the study corridor
          const validCoords = facilities
            .filter((f) => !isNaN(f.latitude) && !isNaN(f.longitude) && f.latitude !== 0 && f.longitude !== 0)
            .map((f) => [f.latitude, f.longitude] as [number, number]);

          if (validCoords.length > 0) {
            const bounds = L.latLngBounds(validCoords);
            if (bounds.isValid()) {
              try {
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
              } catch {
                // ignore transient container size errors
              }
            }
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load initial cloud facilities/issues:', err);
      });

    // Attach real-time PostgreSQL Supabase & cross-device listener
    const unsubscribeSync = subscribeToPanchayatSync(
      (eventType, changedIssue) => {
        setIssuesList((prev) => {
          let updated: any[];
          const targetId = changedIssue.issue_id || (changedIssue as any).id;
          if (eventType === 'INSERT') {
            updated = [changedIssue, ...prev.filter((i) => (i.issue_id || (i as any).id) !== targetId)];
          } else if (eventType === 'UPDATE') {
            const exists = prev.some((i) => (i.issue_id || (i as any).id) === targetId);
            updated = exists
              ? prev.map((i) => ((i.issue_id || (i as any).id) === targetId ? { ...i, ...changedIssue } : i))
              : [changedIssue, ...prev];
          } else if (eventType === 'DELETE') {
            updated = prev.filter((i) => (i.issue_id || (i as any).id) !== targetId);
          } else {
            updated = prev;
          }
          allIssuesRef.current = updated;
          renderIssueMarkers(updated, facilityFilter);
          refreshGrievanceMarkers();
          if (propSetIssues) {
            propSetIssues(updated);
          }
          return updated;
        });
      },
      (eventType, changedFacility) => {
        setFacilitiesList((prev) => {
          let updated: any[];
          const targetId = changedFacility.facility_id || (changedFacility as any).id;
          if (eventType === 'INSERT') {
            updated = [changedFacility, ...prev.filter((f) => (f.facility_id || (f as any).id) !== targetId)];
          } else if (eventType === 'UPDATE') {
            const exists = prev.some((f) => (f.facility_id || (f as any).id) === targetId);
            updated = exists
              ? prev.map((f) => ((f.facility_id || (f as any).id) === targetId ? { ...f, ...changedFacility } : f))
              : [changedFacility, ...prev];
          } else if (eventType === 'DELETE') {
            updated = prev.filter((f) => (f.facility_id || (f as any).id) !== targetId);
          } else {
            updated = prev;
          }
          allFacilitiesRef.current = updated;
          setFacilityCount(updated.length);
          renderFacilityMarkers(updated, facilityFilter);
          return updated;
        });
      }
    );

    // Initial render of existing offline grievances
    refreshGrievanceMarkers();

    // Map Events
    const updateMeta = () => {
      const center = map.getCenter();
      setCenterCoords([parseFloat(center.lat.toFixed(5)), parseFloat(center.lng.toFixed(5))]);
      setCurrentZoom(map.getZoom());
    };

    let lastMoveTime = 0;
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      const now = performance.now();
      if (now - lastMoveTime > 60) {
        lastMoveTime = now;
        setCursorCoords([parseFloat(e.latlng.lat.toFixed(5)), parseFloat(e.latlng.lng.toFixed(5))]);
      }
    };

    const handleMouseOut = () => {
      setCursorCoords(null);
    };

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const lat = parseFloat(e.latlng.lat.toFixed(5));
      const lng = parseFloat(e.latlng.lng.toFixed(5));

      // Handle Add Facility Mode Click
      if (isAddFacilityModeRef.current) {
        // Validate coordinates fall within the Khopripada study envelope (Lat: 19.3000–19.4500 N, Lng: 72.7500–72.9000 E)
        const isInside = isCoordInStudyCorridor(lat, lng);
        if (!isInside) {
          showToast(
            `Clicked location (${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E) is outside the Khopripada study envelope (19.3000–19.4500°N, 72.7500–72.9000°E)!`
          );
          return;
        }

        // Drop temporary pulsing marker at clicked location
        if (tempFacilityMarkerRef.current) {
          tempFacilityMarkerRef.current.setLatLng([lat, lng]);
        } else {
          const tempIcon = L.divIcon({
            className: 'temp-facility-marker',
            html: `
              <div class="relative flex items-center justify-center pointer-events-none">
                <span class="absolute w-12 h-12 rounded-full bg-cyan-400/50 animate-ping"></span>
                <div class="relative w-7 h-7 rounded-full bg-[#0D9488] border-2 border-white shadow-[0_0_20px_#06b6d4] flex items-center justify-center text-white animate-pulse">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
                </div>
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });
          const marker = L.marker([lat, lng], { icon: tempIcon }).addTo(map);
          tempFacilityMarkerRef.current = marker;
        }

        // Open modal with captured coords
        setNewFacilityCoords([lat, lng]);
        setIsAddFacilityModalOpen(true);
        return;
      }

      // Normal map inspection behavior
      const distance = map.distance(e.latlng, L.latLng(KHOPRIPADA_CORE[0], KHOPRIPADA_CORE[1]));

      setInspectedPoint({
        lat,
        lng,
        distKm: parseFloat((distance / 1000).toFixed(2)),
      });

      if (inspectMarkerRef.current) {
        inspectMarkerRef.current.setLatLng([lat, lng]);
      } else {
        const inspectIcon = L.divIcon({
          className: 'inspect-marker',
          html: `
            <div class="relative flex items-center justify-center">
              <span class="absolute w-10 h-10 rounded-full bg-cyan-400/30 animate-ping"></span>
              <div class="relative w-7 h-7 rounded-full bg-[#1B2F38] border-2 border-[#38BDF8] shadow-2xl flex items-center justify-center text-[#38BDF8]">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const newMarker = L.marker([lat, lng], { icon: inspectIcon }).addTo(map);
        inspectMarkerRef.current = newMarker;
      }
    };

    const handlePopupOpen = (e: L.PopupEvent) => {
      const contentNode = e.popup.getElement();
      if (!contentNode) return;
      const selects = contentNode.querySelectorAll<HTMLSelectElement>('.issue-status-select, .issue-status-dropdown');
      selects.forEach((select) => {
        select.onchange = async () => {
          const issueId = select.getAttribute('data-issue-id');
          const newStatus = select.value;
          if (issueId && handleUpdateIssueStatusRef.current) {
            await handleUpdateIssueStatusRef.current(issueId, newStatus);
          }
        };
      });
    };

    map.on('moveend', updateMeta);
    map.on('zoomend', updateMeta);
    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseOut);
    map.on('click', handleMapClick);
    map.on('popupopen', handlePopupOpen);

    setTimeout(() => {
      map.invalidateSize();
      if (window.innerWidth < 768) {
        const khopripadaSettlementBounds = L.latLngBounds([
          [19.3512, 72.8805],
          [19.3588, 72.8885],
        ]);
        map.fitBounds(khopripadaSettlementBounds, { padding: [24, 24], maxZoom: 16, animate: false });
      }
    }, 150);

    return () => {
      unsubscribeSync();
      map.off('zoomend', onZoom);
      map.off('moveend', updateMeta);
      map.off('zoomend', updateMeta);
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseOut);
      map.off('click', handleMapClick);
      map.off('popupopen', handlePopupOpen);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [refreshGrievanceMarkers, renderFacilityMarkers, renderIssueMarkers, syncLODLayers]);

  // Synchronize layer visibility and marker popups whenever user role or filter changes
  useEffect(() => {
    userRoleRef.current = userRole;
    if (allFacilitiesRef.current.length > 0) {
      renderFacilityMarkers(allFacilitiesRef.current, facilityFilter);
    }
    if (allIssuesRef.current.length > 0) {
      renderIssueMarkers(allIssuesRef.current, facilityFilter);
    }
    refreshGrievanceMarkers();
  }, [
    userRole,
    renderIssueMarkers,
    renderFacilityMarkers,
    refreshGrievanceMarkers,
    facilityFilter,
  ]);

  // Wire DOM Change Listener for Real-Time Status Mutation
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handlePopupDomChange = async (e: Event) => {
      const target = e.target as HTMLSelectElement;
      if (
        target &&
        (target.classList.contains('issue-status-dropdown') ||
          target.classList.contains('issue-status-select'))
      ) {
        const issueId = target.getAttribute('data-issue-id');
        const newStatus = target.value as IssueStatus;

        if (!issueId) return;

        target.disabled = true;
        const originalBg = target.style.backgroundColor;
        target.style.backgroundColor = '#E2E8F0';

        const result = await updateIssueStatus(issueId, newStatus);

        if (result.success) {
          // Optimistically update local issues state
          if (propSetIssues) {
            propSetIssues((prev) =>
              prev.map((item) =>
                String(item.id) === issueId || item.issue_id === issueId
                  ? { ...item, status: newStatus, updated_at: new Date().toISOString() }
                  : item
              )
            );
          }
          setIssuesList((prev) =>
            prev.map((item) =>
              String((item as any).id) === issueId || item.issue_id === issueId
                ? { ...item, status: newStatus, updated_at: new Date().toISOString() }
                : item
            )
          );
          allIssuesRef.current = allIssuesRef.current.map((item) =>
            String((item as any).id) === issueId || item.issue_id === issueId
              ? { ...item, status: newStatus }
              : item
          );
          try {
            await db.cached_issues.update(issueId, { status: newStatus });
          } catch {
            // ignore
          }
          map.closePopup();
          showToast(`Status updated to "${newStatus.replace(/_/g, ' ')}"!`);
        } else {
          alert('Failed to update status: ' + result.error);
          target.disabled = false;
          target.style.backgroundColor = originalBg;
        }
      }
    };

    const container = map.getContainer();
    container.addEventListener('change', handlePopupDomChange);

    return () => {
      container.removeEventListener('change', handlePopupDomChange);
    };
  }, [propSetIssues]);

  // Render GPS Accuracy Circle & Pin
  const renderGpsFix = (coords: [number, number], accuracy: number, isSimulated = false) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    gpsLocationLayerRef.current?.clearLayers();

    const accuracyCircle = L.circle(coords, {
      radius: Math.max(accuracy, 15),
      color: isSimulated ? '#10b981' : '#3b82f6',
      fillColor: isSimulated ? '#34d399' : '#60a5fa',
      fillOpacity: 0.22,
      weight: 1.5,
    });

    const gpsPinIcon = L.divIcon({
      className: 'gps-pin',
      html: `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-8 h-8 rounded-full ${isSimulated ? 'bg-emerald-500/40' : 'bg-blue-500/40'} animate-ping"></span>
          <div class="relative w-5 h-5 rounded-full ${isSimulated ? 'bg-emerald-600' : 'bg-blue-600'} border-2 border-white shadow-2xl flex items-center justify-center text-[10px] text-white font-bold">
            ●
          </div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const gpsMarker = L.marker(coords, { icon: gpsPinIcon });
    gpsMarker.bindPopup(
      `
      <div class="font-sans text-[#F8FAFC] p-1.5 min-w-[190px]">
        <div class="text-[10px] uppercase font-bold text-[#38BDF8] mb-0.5">
          ${isSimulated ? 'Simulated Field Position' : 'Your Live GNSS Position'}
        </div>
        <div class="text-xs font-bold text-[#F8FAFC]">Khopripada Field Surveyor</div>
        <div class="mt-1 text-[11px] font-mono text-[#94A3B8]">
          ${coords[0].toFixed(5)}°N, ${coords[1].toFixed(5)}°E
        </div>
        <div class="text-[10px] text-[#10B981] mt-1 font-semibold">Accuracy: ±${accuracy.toFixed(1)}m (Corridor Verified)</div>
      </div>
    `,
      { className: 'gis-dark-popup', autoPanPadding: [15, 80] }
    );

    gpsLocationLayerRef.current?.addLayer(accuracyCircle);
    gpsLocationLayerRef.current?.addLayer(gpsMarker);

    map.flyTo(coords, 17, { duration: 1.8 });
    setTimeout(() => gpsMarker.openPopup(), 800);
  };

  // Geolocation Handler: High Accuracy Locate Me
  const handleLocateMe = async () => {
    setIsLocating(true);
    try {
      const pos: GeolocationResult = await getCurrentPosition();
      const { latitude, longitude, accuracy, isWithinBounds } = pos;

      if (isWithinBounds) {
        renderGpsFix([latitude, longitude], accuracy, false);
      } else {
        setGpsWarningModal({
          open: true,
          lat: latitude,
          lng: longitude,
        });
      }
    } catch (err: unknown) {
      const errorMsg = (err as { message?: string })?.message || 'Could not acquire GPS position.';
      showToast(errorMsg);
    } finally {
      setIsLocating(false);
    }
  };

  // Recenter explicitly on Khopripada Core settlement
  const recenterToKhopripadaCore = useCallback(() => {
    if (!mapInstanceRef.current) return;
    if (window.innerWidth < 768) {
      const settlementBounds = L.latLngBounds([
        [19.3512, 72.8805],
        [19.3588, 72.8885],
      ]);
      mapInstanceRef.current.fitBounds(settlementBounds, { padding: [24, 24], maxZoom: 16 });
    } else {
      mapInstanceRef.current.flyTo(KHOPRIPADA_CORE, DEFAULT_ZOOM, {
        duration: 1.4,
      });
    }
  }, []);

  // Recenter explicitly on Juchandra Station (19.36001, 72.87285)
  const flyToJuchandraStation = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(JUCHANDRA_STN, 17, {
      duration: 1.4,
    });
  }, []);

  // Switch Basemap between ESRI Satellite and OSM Street
  const changeBasemap = useCallback((type: BasemapType) => {
    setActiveBasemap(type);
    const map = mapInstanceRef.current;
    if (!map) return;

    const allLayers = [
      esriLayerRef.current,
      osmLayerRef.current,
      satelliteLayerRef.current,
    ];

    allLayers.forEach((l) => {
      if (l && map.hasLayer(l)) {
        map.removeLayer(l);
      }
    });

    if (type === 'esri' || type === 'satellite') {
      esriLayerRef.current?.addTo(map);
    } else if (type === 'osm') {
      osmLayerRef.current?.addTo(map);
    }

    setTimeout(() => map.invalidateSize(), 80);
  }, []);

  // Safe basemap switching effect
  useEffect(() => {
    changeBasemap(activeBasemap);
  }, [activeBasemap, changeBasemap]);

  // Leaflet Dynamic Size Invalidation on Resize/Mount
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Toggle Boundary
  const toggleBoundary = () => {
    if (!mapInstanceRef.current || !boundaryLayerRef.current) return;
    const map = mapInstanceRef.current;
    if (showBoundary) {
      map.removeLayer(boundaryLayerRef.current);
      setShowBoundary(false);
    } else {
      map.addLayer(boundaryLayerRef.current);
      setShowBoundary(true);
    }
  };

  // Toggle Landmarks
  const toggleLandmarks = () => {
    if (!mapInstanceRef.current || !landmarksLayerRef.current) return;
    const map = mapInstanceRef.current;
    if (showLandmarks) {
      map.removeLayer(landmarksLayerRef.current);
      setShowLandmarks(false);
    } else {
      map.addLayer(landmarksLayerRef.current);
      setShowLandmarks(true);
    }
  };

  // Toggle Facilities Layer
  const toggleFacilities = () => {
    setShowFacilities((prev) => !prev);
  };



  // Fly to Grievance from Drawer
  const flyToCoords = (coords: [number, number]) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.flyTo(coords, 18, { duration: 1.2 });

    // Ensure issues layer is visible
    setShowIssuesLayer(true);

    setTimeout(() => {
      issuesLayerRef.current.eachLayer((layer: any) => {
        if (layer.getLatLng) {
          const pos = layer.getLatLng();
          if (Math.abs(pos.lat - coords[0]) < 0.0006 && Math.abs(pos.lng - coords[1]) < 0.0006) {
            layer.openPopup();
          }
        }
      });
    }, 1300);
  };

  // Fly to coords with smooth Leaflet animation and temporary pulsing ping marker
  const flyToCoordsWithPing = useCallback((coords: [number, number]) => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.flyTo(coords, 18, { duration: 1.5 });

    const pingIcon = L.divIcon({
      className: 'temp-ping-marker',
      html: `
        <div class="relative flex items-center justify-center pointer-events-none">
          <span class="absolute w-12 h-12 rounded-full bg-[#E05A47]/60 animate-ping"></span>
          <div class="relative w-6 h-6 rounded-full bg-[#E05A47] border-2 border-white shadow-[0_0_15px_#E05A47] flex items-center justify-center text-white text-[10px] font-bold">
            ●
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    const pingMarker = L.marker(coords, { icon: pingIcon }).addTo(map);
    setTimeout(() => {
      if (map && map.hasLayer(pingMarker)) {
        map.removeLayer(pingMarker);
      }
    }, 4500);
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  // Copy coordinates
  const copyCoords = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Guard: Strictly prevent Resident from viewing Analytics sheet on mobile
  useEffect(() => {
    if (userRole === 'user' && mobileSheet === 'analytics') {
      setMobileSheet(null);
    }
  }, [userRole, mobileSheet]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F8FAFC] font-sans select-none text-slate-800 overscroll-none [touch-action:pan-x_pan-y]">
      {/* TOAST NOTIFICATION BANNER */}
      {toastWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[3000] px-5 py-3 rounded-2xl backdrop-blur-xl bg-white border border-slate-200 text-slate-800 text-sm font-medium shadow-xl flex items-center gap-3 max-w-lg animate-in fade-in slide-from-top-4">
          <span className="w-2.5 h-2.5 rounded-full bg-[#48999E] animate-pulse flex-shrink-0" />
          <span className="flex-1">{toastWarning}</span>
          <button
            onClick={() => setToastWarning(null)}
            className="text-slate-400 hover:text-slate-700 transition p-1 text-xs cursor-pointer ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. RESPONSIVE UNIFIED TOP NAVIGATION BAR */}
      <Navbar
        userRole={userRole}
        isLiveConnected={isLiveConnected}
        isSimulatedOffline={isSimulatedOffline}
        onToggleSimulatedOffline={() => {
          setIsSimulatedOffline(!isSimulatedOffline);
          showToast(
            isSimulatedOffline
              ? 'Live Network restored. Syncing with remote database.'
              : 'Simulated Offline mode active. Utilizing local IndexedDB.'
          );
        }}
        isLocating={isLocating}
        onLocateMe={handleLocateMe}
        showHeatmap={showHeatmap}
        onToggleHeatmap={toggleHeatmap}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        isAddFacilityMode={isAddFacilityMode}
        onToggleAddFacilityMode={() => {
          if (isAddFacilityMode) {
            cleanupAddFacilityMode();
          } else {
            setIsAddFacilityMode(true);
          }
        }}
        onOpenGrievanceModal={() => setIsGrievanceModalOpen(true)}
        onOpenGrievanceListDrawer={() => setIsGrievanceDrawerOpen(true)}
        onOpenExportAuditModal={handleExportAuditSummary}
        onOfficerExportWorklist={handleOfficerExportWorklist}
        onPortalSwitch={handlePortalSwitch}
        onMobileLogout={handleMobileLogout}
        onOpenMobileSheet={(sheet) => setMobileSheet(sheet)}
        mobileSheet={mobileSheet}
        facilityCount={facilitiesList.length}
        issueCount={issues.length}
      />

      {/* 2. MAIN DASHBOARD VIEWPORT (MAP + SIDEBAR SPLIT) */}
      <div className="flex flex-1 w-full min-h-0 overflow-hidden relative">

        {/* 2.1 RIGHT ANALYTICS & DECISION DRAWER (DESKTOP DOCKED, MOBILE SLIDE-OVER) */}
        {sidebarOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 z-[1400] bg-black/60 backdrop-blur-xs animate-in fade-in"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="order-2 fixed inset-y-0 right-0 z-[1500] w-80 sm:w-96 max-w-[85vw] md:static md:flex md:flex-col md:h-full md:flex-shrink-0 bg-[#081018]/95 backdrop-blur-lg border-l border-[#1D3B52] overflow-y-auto p-4 space-y-4 shadow-2xl text-xs text-[#F1F5F9] animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#1D3B52] flex-shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#00E5FF]" />
                <span className="font-bold text-sm text-[#F1F5F9]">
                  {isAdminOrOfficer ? 'Village Analytics & Layers' : 'Layers & Filters'}
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0D1C2A] hover:bg-[#142C3F] text-[#8CB0C9] hover:text-[#F1F5F9] border border-[#1D3B52] transition cursor-pointer text-xs font-semibold"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin pr-0.5">
              {/* SECTION 1: SELECT BASEMAP (2x2 Grid) */}
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider font-bold text-[#5A7C93] flex items-center justify-between">
                  <span>SELECT BASEMAP</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-1.5 py-0.5 rounded font-mono font-medium">
                    TILE CACHE ACTIVE
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'osm', label: 'OSM Street' },
                    { id: 'satellite', label: 'ESRI Satellite' },
                  ].map((bm) => (
                    <button
                      key={bm.id}
                      type="button"
                      onClick={() => changeBasemap(bm.id as BasemapType)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                        activeBasemap === bm.id || (bm.id === 'satellite' && activeBasemap === 'esri')
                          ? 'bg-[#00E5FF]/20 border border-[#00E5FF] text-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.25)]'
                          : 'bg-[#0D1C2A] border border-[#1D3B52] text-[#8CB0C9] hover:border-[#00E5FF]/50 hover:text-[#F1F5F9]'
                      }`}
                    >
                      {bm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION 2: CATEGORIES & ISSUES */}
              <div className="space-y-2.5">
                <div className="text-[11px] uppercase tracking-wider font-bold text-[#5A7C93] flex items-center justify-between">
                  <span>CATEGORIES & ISSUES</span>
                  <span className="text-[10px] text-[#8CB0C9] font-mono">{facilitiesList.length} Facilities</span>
                </div>

                {/* 2-column grid of 6 category buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'all', label: 'All POIs', icon: Layers, count: categoryCounts.all },
                    { id: 'water', label: 'Drinking Water', icon: Droplets, count: categoryCounts.water },
                    { id: 'education', label: 'Schools & Edu', icon: GraduationCap, count: categoryCounts.education },
                    { id: 'commerce', label: 'Commerce & Shops', icon: Store, count: categoryCounts.commerce },
                    { id: 'health', label: 'Health Centers', icon: Activity, count: categoryCounts.health },
                    { id: 'civic', label: 'Civic & Mandir', icon: Landmark, count: categoryCounts.civic },
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const isActive = facilityFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleFilterFacilities(cat.id as FacilityCategoryFilter)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer flex items-center justify-between gap-1 text-left ${
                          isActive
                            ? 'bg-[#142C3F] border-[#00E5FF] text-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.3)]'
                            : 'bg-[#0D1C2A] border-[#1D3B52] text-[#8CB0C9] hover:border-[#00E5FF]/40 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{cat.label}</span>
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 ${
                          isActive ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-[#081018] text-[#5A7C93]'
                        }`}>
                          {cat.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Facility Health & Issues Severity metric breakdown boxes */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {/* Facility Health Breakdown */}
                  <div className="p-2.5 rounded-xl bg-[#0D1C2A] border border-[#1D3B52]">
                    <span className="text-[9px] uppercase font-bold text-[#5A7C93] block mb-1.5">
                      Facility Health
                    </span>
                    <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px]">
                      <div className="text-emerald-400">
                        <span className="text-[8px] uppercase block font-sans text-emerald-500/80">Func</span>
                        <strong>{operationalCounts.functional}</strong>
                      </div>
                      <div className="text-amber-400 border-x border-[#1D3B52]/60">
                        <span className="text-[8px] uppercase block font-sans text-amber-500/80">Part</span>
                        <strong>{operationalCounts.partial}</strong>
                      </div>
                      <div className="text-rose-400">
                        <span className="text-[8px] uppercase block font-sans text-rose-500/80">Degr</span>
                        <strong>{operationalCounts.nonFunctional}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Issues Severity Breakdown */}
                  <div className="p-2.5 rounded-xl bg-[#0D1C2A] border border-[#1D3B52]">
                    <span className="text-[9px] uppercase font-bold text-[#5A7C93] block mb-1.5">
                      Issues Severity
                    </span>
                    <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px]">
                      <div className="text-rose-400">
                        <span className="text-[8px] uppercase block font-sans text-rose-500/80">High</span>
                        <strong>{issueCounts.high}</strong>
                      </div>
                      <div className="text-amber-400 border-x border-[#1D3B52]/60">
                        <span className="text-[8px] uppercase block font-sans text-amber-500/80">Med</span>
                        <strong>{issueCounts.medium}</strong>
                      </div>
                      <div className="text-emerald-400">
                        <span className="text-[8px] uppercase block font-sans text-emerald-500/80">Low</span>
                        <strong>{issueCounts.low}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: ACTIVE MAP LAYERS */}
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider font-bold text-[#5A7C93]">
                  ACTIVE MAP LAYERS
                </div>
                <div className="bg-[#0D1C2A] border border-[#1D3B52] rounded-xl p-2.5 space-y-1.5">
                  <label className="flex items-center justify-between p-2 rounded-lg bg-[#081018]/60 border border-[#1D3B52] hover:border-[#00E5FF]/40 cursor-pointer transition">
                    <span className="text-xs font-medium text-[#F1F5F9] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] shrink-0 shadow-[0_0_6px_#00E5FF]"></span>
                      Khopripada Boundary (AOI)
                    </span>
                    <input
                      type="checkbox"
                      checked={showBoundary}
                      onChange={toggleBoundary}
                      className="w-4 h-4 rounded text-[#00E5FF] focus:ring-0 accent-[#00E5FF] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-lg bg-[#081018]/60 border border-[#1D3B52] hover:border-[#00E5FF]/40 cursor-pointer transition">
                    <span className="text-xs font-medium text-[#F1F5F9] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
                      Village Facilities ({facilitiesList.length || facilityCount})
                    </span>
                    <input
                      type="checkbox"
                      checked={showFacilities}
                      onChange={toggleFacilities}
                      className="w-4 h-4 rounded text-[#00E5FF] focus:ring-0 accent-[#00E5FF] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between text-xs text-slate-300 hover:text-white cursor-pointer py-1 p-2 rounded-lg bg-[#081018]/60 border border-[#1D3B52] hover:border-[#00E5FF]/40 transition">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showIssuesLayer}
                        onChange={(e) => setShowIssuesLayer(e.target.checked)}
                        className="accent-red-500 rounded cursor-pointer w-4 h-4"
                      />
                      <span className="font-medium text-[#F1F5F9] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                        Reported Grievances & Issues
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsGrievanceDrawerOpen(true);
                        }}
                        className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-700/60 px-2 py-0.5 rounded cursor-pointer transition shadow-xs"
                        title="Open All Issues Registry"
                      >
                        View All ({issues.length})
                      </button>
                    </div>
                  </label>
                  <label className="flex items-center justify-between p-2 rounded-lg bg-[#081018]/60 border border-[#1D3B52] hover:border-[#00E5FF]/40 cursor-pointer transition">
                    <span className="text-xs font-medium text-[#F1F5F9] flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0"></span>
                      Key Landmark POIs
                    </span>
                    <input
                      type="checkbox"
                      checked={showLandmarks}
                      onChange={toggleLandmarks}
                      className="w-4 h-4 rounded text-[#00E5FF] focus:ring-0 accent-[#00E5FF] cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* SECTION 4: ML SPATIAL ANALYTICS (Panchayat View Only) */}
              {isAdminOrOfficer && (
                <div className="space-y-2 village-analytics-container">
                  <div className="text-[11px] uppercase tracking-wider font-bold text-[#5A7C93]">
                    ML SPATIAL ANALYTICS (Panchayat View Only)
                  </div>
                  <div className="bg-[#0D1C2A] text-[#F1F5F9] rounded-2xl p-4 border border-[#1D3B52] shadow-xl space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-[#1D3B52]">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#00E5FF] tracking-wider block">
                          PANCHAYAT ADMIN
                        </span>
                        <h4 className="text-xs font-bold text-white leading-tight">
                          Executive Decision Console
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#081018] text-[#00E5FF] border border-[#1D3B52]">
                        Live Active
                      </span>
                    </div>

                    {/* Layer Toggles for Heatmap */}
                    <div className="space-y-1.5">
                      <label className="flex items-center justify-between p-2 rounded-lg bg-[#081018]/80 border border-[#1D3B52] hover:border-[#F59E0B]/50 cursor-pointer transition">
                        <span className="text-xs font-medium text-[#F1F5F9] flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0"></span>
                          Failure Density Heatmap
                        </span>
                        <input
                          type="checkbox"
                          checked={showHeatmap}
                          onChange={(e) => toggleHeatmap(e.target.checked)}
                          className="w-4 h-4 rounded text-[#F59E0B] focus:ring-0 accent-[#F59E0B] cursor-pointer"
                        />
                      </label>
                    </div>

                    {/* Stat Badges */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="p-2 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300">
                        <span className="text-[9px] uppercase block text-red-400 font-sans font-bold">
                          Priority
                        </span>
                        <span className="text-xs font-bold font-mono">{issueCounts.total} ACTIVE ISSUES</span>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300">
                        <span className="text-[9px] uppercase block text-amber-400 font-sans font-bold">
                          Hotspots
                        </span>
                        <span className="text-xs font-bold font-mono">{computedClustersCount} DBSCAN CLUSTERS</span>
                      </div>
                    </div>

                    {/* Embedded Action Queue and ML Console */}
                    <ErrorBoundary>
                      <PanchayatAdminPanel
                        issues={issues as any}
                        facilities={safeFacilities}
                        onFlyToIssue={handleFlyToIssue}
                        isOpen={true}
                        hideHeader={true}
                        onClose={() => {}}
                        onExportAudit={() => setIsExportAuditModalOpen(true)}
                        onApproveSubmission={(item) => {
                          if (item.type === 'facility') {
                            const updated = allFacilitiesRef.current.map((f) =>
                              f.facility_id === item.id ? { ...f, approval_status: 'approved' as const } : f
                            );
                            allFacilitiesRef.current = updated;
                            setFacilitiesList(updated);
                            renderFacilityMarkers(updated, facilityFilter);
                          } else {
                            refreshGrievanceMarkers();
                          }
                          showToast(`"${item.title}" approved and published to live map!`);
                        }}
                        onRejectSubmission={(item) => {
                          if (item.type === 'facility') {
                            const updated = allFacilitiesRef.current.map((f) =>
                              f.facility_id === item.id ? { ...f, approval_status: 'rejected' as const } : f
                            );
                            allFacilitiesRef.current = updated;
                            setFacilitiesList(updated);
                            renderFacilityMarkers(updated, facilityFilter);
                          } else {
                            refreshGrievanceMarkers();
                          }
                          showToast(`Submission "${item.title}" rejected.`);
                        }}
                        onOpenPhotoLightbox={(data) => {
                          setLightboxData({
                            isOpen: true,
                            photoUrl: data.photoUrl,
                            title: data.title,
                            category: data.category,
                            coords: data.coords,
                          });
                        }}
                        onFlyToCoords={flyToCoords}
                      />
                    </ErrorBoundary>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </>
      )}

        {/* 2.2 MAP CANVAS CONTAINER */}
        <div className="order-1 flex-1 min-w-0 relative h-full flex flex-col">
          {/* 3. FLOATING QUICK-FILTER WIDGET (TOP-LEFT MAP OVERLAY) */}
          <div className="absolute top-4 left-4 z-[1000] bg-[#0D1C2A]/90 backdrop-blur-md border border-[#1D3B52] rounded-xl p-2 flex items-center gap-2 shadow-2xl pointer-events-auto">
            {/* Branding Block */}
            <div className="pr-2 border-r border-[#1D3B52] flex flex-col">
              <span className="text-white font-bold text-xs tracking-wide flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00E5FF] shadow-[0_0_6px_#00E5FF]"></span>
                Smart Village GIS
              </span>
              <span className="text-[#8CB0C9] text-[10px] font-mono">Khopripada Digital Twin</span>
            </div>

            {/* Quick-Filter Icon Buttons */}
            <div className="flex items-center gap-1">
              {[
                { id: 'all', label: 'All', icon: Layers, tooltip: 'All Facilities' },
                { id: 'water', label: 'Water', icon: Droplets, tooltip: 'Drinking Water' },
                { id: 'education', label: 'Edu', icon: GraduationCap, tooltip: 'Schools & Education' },
                { id: 'commerce', label: 'Shop', icon: Store, tooltip: 'Commerce & Kirana' },
                { id: 'health', label: 'Health', icon: Activity, tooltip: 'Health & Anganwadi' },
                { id: 'civic', label: 'Civic', icon: Landmark, tooltip: 'Civic & Mandir' },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = facilityFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleFilterFacilities(item.id as FacilityCategoryFilter)}
                    title={item.tooltip}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      isActive
                        ? 'bg-[#142C3F] border border-[#00E5FF] text-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.4)]'
                        : 'bg-[#081018]/60 hover:bg-[#142C3F] border border-[#1D3B52] text-[#8CB0C9] hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add Facility Mode Instruction Banner */}
          {isAddFacilityMode && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1500] pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="backdrop-blur-xl bg-[#0D1C2A]/95 border border-[#1D3B52] text-[#F1F5F9] rounded-2xl px-5 py-2.5 shadow-2xl flex items-center gap-3 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF] flex-shrink-0 animate-pulse"></span>
                <span className="font-semibold text-[#F1F5F9]">
                  {userRole === 'officer'
                    ? 'Click on the map to place Government Scheme Asset GPS point'
                    : userRole === 'user'
                    ? 'Click on the map to propose Community Facility GPS point'
                    : 'Click anywhere on the map to place the new facility'}{' '}
                  <span className="text-[#8CB0C9] font-mono text-[11px]">(Press Esc to cancel)</span>
                </span>
                <button
                  onClick={cleanupAddFacilityMode}
                  className="px-2.5 py-1 rounded-lg bg-[#081018] hover:bg-[#142C3F] text-[#8CB0C9] hover:text-white border border-[#1D3B52] transition cursor-pointer text-[11px] font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Selected / Inspected Point Floating Card */}
          {inspectedPoint && (
            <div className="absolute top-16 left-4 sm:left-6 z-[1000] pointer-events-auto backdrop-blur-xl bg-[#0D1C2A]/95 border border-[#1D3B52] text-[#F1F5F9] rounded-xl p-3 shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 max-w-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#142C3F] border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF]">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-[#F1F5F9] flex items-center gap-1">
                    Point Inspected
                    <span className="text-[10px] text-[#8CB0C9]">
                      ({inspectedPoint.distKm} km from Core)
                    </span>
                  </div>
                  <div className="font-mono text-[#00E5FF] text-[11px] mt-0.5">
                    {inspectedPoint.lat}°N, {inspectedPoint.lng}°E
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsGrievanceModalOpen(true)}
                  className="text-[11px] px-2 py-1 rounded bg-[#EF4444]/20 hover:bg-[#EF4444]/30 text-[#EF4444] border border-[#EF4444]/50 transition cursor-pointer flex items-center gap-1 font-semibold"
                  title="Log Grievance here"
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Report</span>
                </button>
                <button
                  onClick={() => copyCoords(`${inspectedPoint.lat}, ${inspectedPoint.lng}`)}
                  className="text-xs px-2 py-1 rounded bg-[#081018] hover:bg-[#142C3F] text-[#8CB0C9] hover:text-white border border-[#1D3B52] transition cursor-pointer font-semibold"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => setInspectedPoint(null)}
                  className="text-xs p-1 rounded hover:bg-[#142C3F] text-[#5A7C93] hover:text-[#F1F5F9] transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* 5. FLOATING BOTTOM STATUS BAR */}
          <div className="absolute bottom-20 md:bottom-3 left-3 z-[1000] bg-[#081018]/90 backdrop-blur-md border border-[#1D3B52] px-3 py-1.5 rounded-lg flex items-center gap-3 text-[11px] text-[#8CB0C9] font-mono shadow-xl pointer-events-auto">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse"></span>
              <span className="text-[#F1F5F9] font-semibold">Khopripada Core:</span>
              <span>19.3551°N, 72.8846°E</span>
            </div>
            <span className="text-[#1D3B52]">|</span>
            <div>
              <span className="text-[#5A7C93]">Boundary:</span> 19.3601°N, 72.8778°E
            </div>
            <span className="text-[#1D3B52]">|</span>
            <div>
              <span className="text-[#00E5FF] font-semibold">{facilitiesList.length}</span> mapped
            </div>
            <span className="text-[#1D3B52]">|</span>
            <div>
              <span className="text-[#5A7C93]">Cursor:</span>{' '}
              <span className="text-[#F1F5F9]">
                {cursorCoords ? `${cursorCoords[0].toFixed(4)}°N, ${cursorCoords[1].toFixed(4)}°E` : `${centerCoords[0].toFixed(4)}°N, ${centerCoords[1].toFixed(4)}°E`}
              </span>
            </div>
            <span className="text-[#1D3B52]">|</span>
            <div>
              <span className="text-[#5A7C93]">Zoom:</span> {currentZoom}
            </div>
          </div>

      {/* 5. FULL-SCREEN LEAFLET MAP CANVAS */}
      <div
        ref={mapContainerRef}
        id="village-map-canvas"
        className="w-full h-full z-0 flex-1 relative [touch-action:pan-x_pan-y]"
        style={{ touchAction: 'pan-x pan-y' }}
      />

      {/* 5.1 PERSISTENT BOTTOM FLOATING ACTION STRIP ON MOBILE (< 768px) */}
      <div className="md:hidden fixed bottom-3 left-3 right-3 z-[1100] bg-[#081018]/95 backdrop-blur-md border border-[#1D3B52] rounded-2xl shadow-2xl p-1.5 flex items-center justify-between gap-1 select-none">
        {/* [ 📍 Locate ] */}
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          className="flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl hover:bg-[#142C3F] active:scale-95 transition text-[#8CB0C9] hover:text-[#00E5FF] cursor-pointer"
          title="Locate Me"
        >
          <Locate className={`w-4 h-4 text-[#00E5FF] ${isLocating ? 'animate-spin' : ''}`} />
          <span className="text-[9px] font-semibold tracking-wider mt-0.5">Locate</span>
        </button>

        {/* [ 🔥 Heatmap ] */}
        <button
          onClick={() => toggleHeatmap(!heatmapActive)}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl active:scale-95 transition cursor-pointer ${
            heatmapActive ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40 font-bold' : 'hover:bg-[#142C3F] text-[#8CB0C9] hover:text-[#F1F5F9]'
          }`}
          title="Toggle Heatmap"
        >
          <Flame className="w-4 h-4 text-[#EF4444]" />
          <span className="text-[9px] font-semibold tracking-wider mt-0.5">Heatmap</span>
        </button>

        {/* [ + Add Facility ] */}
        <button
          onClick={() => {
            if (isAddFacilityMode) {
              cleanupAddFacilityMode();
            } else {
              setIsAddFacilityMode(true);
              showToast('Tap anywhere on the village map to plot a community facility pin.');
            }
          }}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl active:scale-95 transition cursor-pointer ${
            isAddFacilityMode ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 font-bold' : 'hover:bg-[#142C3F] text-[#8CB0C9] hover:text-[#F1F5F9]'
          }`}
          title="Add Facility"
        >
          <Plus className="w-4 h-4 text-[#00E5FF]" />
          <span className="text-[9px] font-semibold tracking-wider mt-0.5">Facility</span>
        </button>

        {/* [ ⚠️ Issues Registry ] */}
        <button
          onClick={() => setIsGrievanceDrawerOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl active:scale-95 transition cursor-pointer ${
            isGrievanceDrawerOpen
              ? 'bg-[#EF4444]/25 text-[#FCA5A5] border border-[#EF4444]/60 font-bold'
              : 'hover:bg-[#142C3F] text-[#8CB0C9] hover:text-[#F1F5F9]'
          }`}
          title="View All Issues"
        >
          <div className="relative">
            <AlertCircle className="w-4 h-4 text-[#EF4444]" />
            {issues.length > 0 && (
              <span className="absolute -top-1 -right-2 px-1 rounded-full bg-[#EF4444] text-white text-[8px] font-mono font-bold leading-none">
                {issues.length}
              </span>
            )}
          </div>
          <span className="text-[9px] font-semibold tracking-wider mt-0.5">Issues</span>
        </button>

        {/* [ ⚠️ Report ] */}
        <button
          onClick={() => setIsGrievanceModalOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl bg-red-950/40 border border-red-800/60 text-red-400 hover:text-red-300 active:scale-95 transition cursor-pointer"
          title="Report Civic Grievance"
        >
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-[9px] font-semibold tracking-wider mt-0.5">Report</span>
        </button>

        {/* [ ☰ Layers ] */}
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl active:scale-95 transition cursor-pointer ${
            sidebarOpen ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 font-bold' : 'hover:bg-[#142C3F] text-[#8CB0C9] hover:text-[#F1F5F9]'
          }`}
          title="Toggle Layers & Basemaps"
        >
          <Layers className="w-4 h-4 text-[#38BDF8]" />
          <span className="text-[9px] font-semibold tracking-wider mt-0.5">Layers</span>
        </button>
      </div>

      {/* 5.2 FULL-FEATURED MOBILE SLIDE-UP BOTTOM SHEET (< 768px) */}
      {mobileSheet && (
        <>
          {/* Backdrop Overlay */}
          <div
            className="md:hidden fixed inset-0 z-[2400] bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setMobileSheet(null)}
          />

          {/* Bottom Sheet Drawer */}
          <div className="md:hidden fixed inset-x-0 bottom-0 z-[2500] max-h-[85dvh] bg-[#0D1C2A] border-t border-[#1D3B52] text-[#F1F5F9] rounded-t-3xl shadow-2xl flex flex-col transition-all duration-300 ease-out overscroll-contain animate-in slide-in-from-bottom duration-300">
            {/* Touch-drag handle pill */}
            <div className="w-10 h-1 bg-[#1D3B52] rounded-full mx-auto my-2.5 flex-shrink-0" />

            {/* Header */}
            <div className="px-4 py-2 border-b border-[#1D3B52] bg-[#081018] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                {mobileSheet === 'analytics' && <BarChart3 className="w-4 h-4 text-[#00E5FF]" />}
                {mobileSheet === 'worklist' && <ClipboardCheck className="w-4 h-4 text-[#00E5FF]" />}
                {mobileSheet === 'layers' && <SlidersHorizontal className="w-4 h-4 text-[#00E5FF]" />}
                {mobileSheet === 'action' && <Plus className="w-4 h-4 text-[#00E5FF]" />}
                {mobileSheet === 'role' && <ShieldCheck className="w-4 h-4 text-[#00E5FF]" />}

                <div>
                  <h3 className="text-xs font-bold text-[#F1F5F9] tracking-wide uppercase">
                    {mobileSheet === 'analytics' && 'Executive Decision Support'}
                    {mobileSheet === 'worklist' &&
                      (userRole === 'officer'
                        ? 'Field Worklist'
                        : userRole === 'admin'
                        ? 'Pending Approvals'
                        : 'Surveyed Issues')}
                    {mobileSheet === 'layers' && 'Layers & Filters'}
                    {mobileSheet === 'action' && 'Propose Asset'}
                    {mobileSheet === 'role' && 'Select Portal'}
                  </h3>
                  <p className="text-[10px] text-[#8CB0C9]">
                    {mobileSheet === 'analytics' && 'ML Priority Hotspots & Facility Health'}
                    {mobileSheet === 'worklist' &&
                      (userRole === 'officer'
                        ? `${mobileGrievanceList.length} Tasks`
                        : userRole === 'admin'
                        ? `${pendingSubmissionsList.length} Approvals`
                        : 'Track your reported issues')}
                    {mobileSheet === 'layers' && 'Toggle layers and visual amenities'}
                    {mobileSheet === 'action' && 'Propose amenities or report incidents'}
                    {mobileSheet === 'role' && 'Role-segregated spatial access control'}
                  </p>
                </div>
              </div>

              {/* Explicit Close button in the header */}
              <button
                onClick={() => setMobileSheet(null)}
                className="min-h-[36px] px-2.5 py-1 flex items-center gap-1.5 rounded-lg text-[#8CB0C9] hover:text-[#F1F5F9] bg-[#0D1C2A] hover:bg-[#142C3F] border border-[#1D3B52] text-xs font-medium transition cursor-pointer active:scale-95"
                title="Close sheet"
                aria-label="Close bottom sheet"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>

            {/* Scrollable Content Body with native smooth vertical scrolling */}
            <div className="flex-1 overflow-y-auto max-h-[85dvh] p-4 space-y-4 pb-24 scrollbar-thin">
              {/* VIEW 1: COMPLETE MOBILE ANALYTICS ENGINE (ADMIN & OFFICER ONLY) */}
              {mobileSheet === 'analytics' && isAdminOrOfficer && (
                <div className="space-y-4">
                  {/* A. KPI Metric Ribbon: 3-column micro-grid */}
                  {(() => {
                    const totalFac = facilitiesList.length || 1;
                    const funcCount = operationalCounts.functional;
                    const funcPct = Math.round((funcCount / totalFac) * 100);
                    const highGrievances = issueCounts.high;
                    const medGrievances = issueCounts.medium;

                    return (
                      <div className="grid grid-cols-3 gap-2">
                        {/* TOTAL ASSETS */}
                        <div className="bg-[#F4F6F5] dark:bg-[#1B2F38] border border-[#D3DFD8] dark:border-[#334B56] p-2.5 rounded-xl shadow-sm text-center">
                          <div className="text-[9px] tracking-wider uppercase font-semibold text-[#566E67] dark:text-[#94A3B8]">
                            Total Assets
                          </div>
                          <div className="text-xl font-bold font-mono text-[#1C2927] dark:text-[#F8FAFC] mt-0.5">
                            {facilitiesList.length}
                          </div>
                          <div className="text-[10px] text-[#80A68A] dark:text-[#10B981] font-semibold mt-0.5 truncate">
                            {funcPct}% Functional
                          </div>
                        </div>

                        {/* ACTIVE PROBLEMS */}
                        <div className="bg-[#F4F6F5] dark:bg-[#1B2F38] border border-[#D3DFD8] dark:border-[#334B56] p-2.5 rounded-xl shadow-sm text-center">
                          <div className="text-[9px] tracking-wider uppercase font-semibold text-[#566E67] dark:text-[#94A3B8]">
                            Active Problems
                          </div>
                          <div className="text-xl font-bold font-mono text-[#CC6346] dark:text-[#E05A47] mt-0.5">
                            {issueCounts.total}
                          </div>
                          <div className="text-[10px] text-[#CC6346] dark:text-[#FCA5A5] font-semibold mt-0.5 truncate">
                            {highGrievances} High • {medGrievances} Med
                          </div>
                        </div>

                        {/* SOLVED PROBLEMS */}
                        <div className="bg-[#F4F6F5] dark:bg-[#1B2F38] border border-[#D3DFD8] dark:border-[#334B56] p-2.5 rounded-xl shadow-sm text-center">
                          <div className="text-[9px] tracking-wider uppercase font-semibold text-[#566E67] dark:text-[#94A3B8]">
                            Solved Problems
                          </div>
                          <div className="text-xl font-bold font-mono text-[#55949F] dark:text-[#38BDF8] mt-0.5">
                            {operationalCounts.functional}
                          </div>
                          <div className="text-[10px] text-[#55949F] dark:text-[#38BDF8] font-semibold mt-0.5 truncate">
                            Verified Resolved
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* B. Random Forest Decision Support (Top 5 Priority Ranking) */}
                  <div className="p-3.5 rounded-2xl bg-[#F4F6F5] dark:bg-[#1B2F38] border border-[#D3DFD8] dark:border-[#334B56] space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#1C2927] dark:text-[#F8FAFC] uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-[#55949F] dark:text-[#38BDF8]" />
                          ML Priority Hotspots
                        </h4>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#0C171C] border border-[#334B56] text-[#38BDF8]">
                          RF MODEL
                        </span>
                      </div>
                      <p className="text-[10px] text-[#94A3B8] mt-1 leading-snug">
                        Score algorithm weights amenity proximity & population impact
                      </p>
                    </div>

                    <div className="space-y-2">
                      {topMLIssues.slice(0, 5).map((issue, idx) => {
                        const rank = idx + 1;
                        const score = issue.ai_priority_score ?? (94 - idx * 3.2);
                        const coordsLat = issue.latitude ?? 19.3542;
                        const coordsLng = issue.longitude ?? 72.8845;

                        return (
                          <div
                            key={issue.issue_id || `ml-${idx}`}
                            className="p-3 rounded-xl bg-[#0C171C] border border-[#334B56] hover:border-[#38BDF8]/50 transition flex items-center justify-between gap-2.5 shadow-sm"
                          >
                            {/* Left: Priority badge */}
                            <div className="flex flex-col gap-1 shrink-0 min-w-[76px]">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-[#E05A47]/20 border border-[#E05A47] text-[#E05A47] text-center">
                                R{rank} URGENT
                              </span>
                              <span className="text-[9px] font-mono text-[#94A3B8] text-center">
                                SCORE: <strong className="text-[#F8FAFC]">{typeof score === 'number' ? score.toFixed(1) : score}</strong> / 100
                              </span>
                            </div>

                            {/* Center: Issue title, category tag, and coordinate tracker */}
                            <div className="flex-1 min-w-0">
                              <h5 className="text-xs font-bold text-[#F8FAFC] leading-snug line-clamp-1">
                                {issue.title}
                              </h5>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#1B2F38] border border-[#334B56] text-[#94A3B8] font-semibold">
                                  {issue.category}
                                </span>
                                <span className="text-[9px] font-mono text-[#38BDF8]">
                                  {coordsLat.toFixed(4)}° N, {coordsLng.toFixed(4)}° E
                                </span>
                              </div>
                            </div>

                            {/* Right: [ Focus on Map ] button */}
                            <button
                              onClick={() => {
                                setMobileSheet(null);
                                flyToCoordsWithPing([coordsLat, coordsLng]);
                              }}
                              className="shrink-0 px-2.5 py-2 min-h-[40px] rounded-lg bg-[#1B2F38] hover:bg-[#233B46] border border-[#38BDF8]/40 text-[#38BDF8] hover:text-[#F8FAFC] text-[10px] font-semibold flex items-center gap-1 active:scale-95 transition cursor-pointer"
                              title="Focus on Map"
                            >
                              <Locate className="w-3.5 h-3.5" />
                              <span>Focus on Map</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* C. Facility Condition Health Donut Chart */}
                  <div className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#334B56] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#F8FAFC] block uppercase tracking-wider">
                        Facility Condition Health
                      </span>
                      <span className="text-[10px] font-mono font-bold text-[#10B981] bg-[#10B981]/15 px-2 py-0.5 rounded-full border border-[#10B981]/40">
                        Live Audit Status
                      </span>
                    </div>

                    {/* Responsive SVG Donut Chart */}
                    <div className="flex items-center justify-center py-1">
                      <div className="relative w-40 h-40 flex items-center justify-center">
                        {(() => {
                          const total = facilitiesList.length || 1;
                          const func = operationalCounts.functional;
                          const part = operationalCounts.partial;

                          const funcPct = Math.round((func / total) * 100);
                          const partPct = Math.round((part / total) * 100);
                          const nonFuncPct = Math.max(0, 100 - funcPct - partPct);

                          const radius = 54;
                          const circumference = 2 * Math.PI * radius; // ~339.29

                          const funcLen = (funcPct / 100) * circumference;
                          const partLen = (partPct / 100) * circumference;
                          const nonFuncLen = (nonFuncPct / 100) * circumference;

                          const funcOffset = 0;
                          const partOffset = -funcLen;
                          const nonFuncOffset = -(funcLen + partLen);

                          return (
                            <>
                              <svg
                                viewBox="0 0 160 160"
                                className="w-full h-full transform -rotate-90 drop-shadow-md"
                              >
                                {/* Base Track Ring */}
                                <circle
                                  cx="80"
                                  cy="80"
                                  r={radius}
                                  fill="none"
                                  stroke="#0C171C"
                                  strokeWidth="16"
                                />

                                {/* Functional Segment (Emerald #10B981) */}
                                {funcLen > 0 && (
                                  <circle
                                    cx="80"
                                    cy="80"
                                    r={radius}
                                    fill="none"
                                    stroke="#10B981"
                                    strokeWidth="16"
                                    strokeDasharray={`${funcLen} ${circumference}`}
                                    strokeDashoffset={funcOffset}
                                    strokeLinecap="butt"
                                  />
                                )}

                                {/* Degraded / Partial Segment (Amber #F59E0B) */}
                                {partLen > 0 && (
                                  <circle
                                    cx="80"
                                    cy="80"
                                    r={radius}
                                    fill="none"
                                    stroke="#F59E0B"
                                    strokeWidth="16"
                                    strokeDasharray={`${partLen} ${circumference}`}
                                    strokeDashoffset={partOffset}
                                    strokeLinecap="butt"
                                  />
                                )}

                                {/* Broken Segment (Terracotta #E05A47) */}
                                {nonFuncLen > 0 && (
                                  <circle
                                    cx="80"
                                    cy="80"
                                    r={radius}
                                    fill="none"
                                    stroke="#E05A47"
                                    strokeWidth="16"
                                    strokeDasharray={`${nonFuncLen} ${circumference}`}
                                    strokeDashoffset={nonFuncOffset}
                                    strokeLinecap="butt"
                                  />
                                )}
                              </svg>

                              {/* Inner center label: 81% HEALTHY in bold #F8FAFC */}
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                                <span className="text-base font-bold font-mono text-[#F8FAFC] leading-none">
                                  {funcPct}% HEALTHY
                                </span>
                                <span className="text-[9px] font-semibold text-[#94A3B8] tracking-wider uppercase mt-1">
                                  ASSET CONDITION
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Clean legend pills below: Green dot, Amber dot, Red dot */}
                    {(() => {
                      const total = facilitiesList.length || 1;
                      const func = operationalCounts.functional;
                      const part = operationalCounts.partial;
                      const nonFunc = operationalCounts.nonFunctional;

                      const funcPct = Math.round((func / total) * 100);
                      const partPct = Math.round((part / total) * 100);
                      const nonFuncPct = Math.max(0, 100 - funcPct - partPct);

                      return (
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          {/* Green dot: Functional: 14 (81%) */}
                          <div className="p-2 rounded-xl bg-[#0C171C] border border-[#334B56] flex items-center justify-center gap-1.5 text-center min-h-[40px]">
                            <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981] flex-shrink-0" />
                            <span className="text-[11px] text-[#F8FAFC] font-medium truncate">
                              Functional: <strong className="text-[#10B981] font-mono">{func}</strong> ({funcPct}%)
                            </span>
                          </div>

                          {/* Amber dot: Degraded: 3 (14%) */}
                          <div className="p-2 rounded-xl bg-[#0C171C] border border-[#334B56] flex items-center justify-center gap-1.5 text-center min-h-[40px]">
                            <span className="w-2 h-2 rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B] flex-shrink-0" />
                            <span className="text-[11px] text-[#F8FAFC] font-medium truncate">
                              Degraded: <strong className="text-[#F59E0B] font-mono">{part}</strong> ({partPct}%)
                            </span>
                          </div>

                          {/* Red dot: Broken: 1 (5%) */}
                          <div className="p-2 rounded-xl bg-[#0C171C] border border-[#334B56] flex items-center justify-center gap-1.5 text-center min-h-[40px]">
                            <span className="w-2 h-2 rounded-full bg-[#E05A47] shadow-[0_0_6px_#E05A47] flex-shrink-0" />
                            <span className="text-[11px] text-[#F8FAFC] font-medium truncate">
                              Broken: <strong className="text-[#E05A47] font-mono">{nonFunc}</strong> ({nonFuncPct}%)
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* D. DBSCAN Failure Clusters & Spatial Density */}
                  <div className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#334B56] flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-[#E05A47]" />
                        DBSCAN Spatial Hotspots
                      </div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5 font-mono">
                        Active Density Radius: <strong className="text-[#38BDF8]">65m</strong>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleHeatmap(!showHeatmap)}
                      className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                        showHeatmap
                          ? 'bg-[#E05A47] text-white shadow-[0_0_12px_rgba(224,90,71,0.5)]'
                          : 'bg-[#0C171C] border border-[#334B56] text-[#94A3B8] hover:text-[#F8FAFC]'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>{showHeatmap ? 'Heatmap Active' : 'Toggle Failure Heatmap'}</span>
                    </button>
                  </div>

                  {/* E. Official Panchayat Audit Exporter */}
                  <div className="pt-1 space-y-2">
                    {userRole === 'admin' && (
                      <>
                        <button
                          onClick={() => {
                            handleDownloadPanchayatPdf();
                            setMobileSheet(null);
                          }}
                          className="w-full py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Generate Official PDF Audit Report</span>
                        </button>

                        <button
                          onClick={() => {
                            handleExportMasterCsv();
                            setMobileSheet(null);
                          }}
                          className="w-full py-3 min-h-[48px] rounded-xl bg-[#1B2F38] hover:bg-[#233B46] border border-[#38BDF8]/40 text-[#38BDF8] hover:text-[#F8FAFC] font-semibold text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          <span>Export Master GeoJSON/CSV</span>
                        </button>
                      </>
                    )}

                    {userRole === 'officer' && (
                      <button
                        onClick={() => {
                          handleOfficerExportWorklist();
                          setMobileSheet(null);
                        }}
                        className="w-full py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Export Field Inspection Checklist (PDF)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 2: MULTI-TIER ADMINISTRATIVE GOVERNANCE WORKLIST */}
              {mobileSheet === 'worklist' && (
                <div className="space-y-3">
                  {/* ADMIN VIEW: STRUCTURED 3-TIER PANCHAYAT VERIFICATION QUEUE */}
                  {userRole === 'admin' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">
                          Panchayat Verification Queue
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#E05A47]/20 text-[#FCA5A5] border border-[#E05A47]/60">
                          {pendingSubmissionsList.length +
                            mobileGrievanceList.filter((g) => g.status === 'pending_inspection_verification').length +
                            mobileGrievanceList.filter((g) => g.status === 'pending_resolution_approval').length}{' '}
                          Pending
                        </span>
                      </div>

                      {/* 3-Step Verification Tab Navigator */}
                      <div className="grid grid-cols-3 gap-1 p-1 bg-[#0C171C] rounded-xl border border-[#334B56]">
                        <button
                          type="button"
                          onClick={() => setMobileAdminQueueStep(1)}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                            mobileAdminQueueStep === 1
                              ? 'bg-[#1B2F38] text-[#F8FAFC] border border-[#334B56] shadow-sm'
                              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                          }`}
                        >
                          <span>Step 1: Submissions</span>
                          {pendingSubmissionsList.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[#E05A47] text-white">
                              {pendingSubmissionsList.length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileAdminQueueStep(2)}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                            mobileAdminQueueStep === 2
                              ? 'bg-[#1B2F38] text-[#F8FAFC] border border-[#334B56] shadow-sm'
                              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                          }`}
                        >
                          <span>Step 2: Inspect Req</span>
                          {mobileGrievanceList.filter((g) => g.status === 'pending_inspection_verification').length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[#F59E0B] text-[#0C171C] font-extrabold">
                              {mobileGrievanceList.filter((g) => g.status === 'pending_inspection_verification').length}
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileAdminQueueStep(3)}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                            mobileAdminQueueStep === 3
                              ? 'bg-[#1B2F38] text-[#F8FAFC] border border-[#334B56] shadow-sm'
                              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                          }`}
                        >
                          <span>Step 3: Audits</span>
                          {mobileGrievanceList.filter((g) => g.status === 'pending_resolution_approval').length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[#10B981] text-white">
                              {mobileGrievanceList.filter((g) => g.status === 'pending_resolution_approval').length}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* STEP 1: NEW RESIDENT SUBMISSIONS */}
                      {mobileAdminQueueStep === 1 && (
                        <div className="space-y-2.5">
                          {pendingSubmissionsList.length === 0 ? (
                            <div className="p-8 text-center rounded-2xl bg-[#1B2F38] border border-[#334B56] text-[#94A3B8] flex flex-col items-center gap-2">
                              <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
                              <h4 className="text-sm font-bold text-[#F8FAFC]">No New Resident Submissions</h4>
                              <p className="text-xs text-[#94A3B8]">
                                All resident submissions have been reviewed and assigned.
                              </p>
                            </div>
                          ) : (
                            pendingSubmissionsList.map((item) => (
                              <div
                                key={`${item.type}-${item.id}`}
                                className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#334B56] flex flex-col gap-2.5 shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                      item.type === 'facility'
                                        ? 'bg-[#10B981]/20 text-[#6EE7B7] border-[#10B981]/60'
                                        : 'bg-[#E05A47]/20 text-[#FCA5A5] border-[#E05A47]/60'
                                    }`}
                                  >
                                    {item.type === 'facility' ? 'Proposed Facility' : 'Step 1: Resident Grievance'}
                                  </span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0C171C] border border-[#334B56] text-[#94A3B8]">
                                    By: <strong className="text-[#F8FAFC]">{item.submitted_by}</strong>
                                  </span>
                                </div>

                                <h4 className="text-xs font-bold text-[#F8FAFC]">{item.title}</h4>

                                {item.description && (
                                  <p className="text-[11px] text-[#94A3B8] bg-[#0C171C] p-2 rounded-lg border border-[#334B56] line-clamp-2">
                                    {item.description}
                                  </p>
                                )}

                                <div className="flex items-center gap-2 pt-1 border-t border-[#334B56]">
                                  <button
                                    type="button"
                                    onClick={() => handleMobileAssignToOfficer(item)}
                                    className="flex-1 py-2 px-3 min-h-[44px] rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Approve & Assign to Officer</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMobileReject(item)}
                                    className="py-2 px-3 min-h-[44px] rounded-xl bg-[#E05A47]/20 hover:bg-[#E05A47]/30 text-[#FCA5A5] border border-[#E05A47]/60 font-semibold text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                                  >
                                    <X className="w-4 h-4" />
                                    <span>Reject</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      flyToCoords(item.coords);
                                      setMobileSheet(null);
                                    }}
                                    className="p-2 min-h-[44px] min-w-[44px] rounded-xl bg-[#0C171C] border border-[#334B56] text-[#38BDF8] flex items-center justify-center transition active:scale-95 cursor-pointer"
                                    title="Fly to location"
                                  >
                                    <Locate className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* STEP 2: FIELD INSPECTION REQUESTS */}
                      {mobileAdminQueueStep === 2 && (
                        <div className="space-y-2.5">
                          {mobileGrievanceList.filter((g) => g.status === 'pending_inspection_verification').length === 0 ? (
                            <div className="p-8 text-center rounded-2xl bg-[#1B2F38] border border-[#334B56] text-[#94A3B8] flex flex-col items-center gap-2">
                              <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
                              <h4 className="text-sm font-bold text-[#F8FAFC]">No Pending Inspection Requests</h4>
                              <p className="text-xs text-[#94A3B8]">
                                Officers have not flagged any new site inspections requiring Sarpanch authorization.
                              </p>
                            </div>
                          ) : (
                            mobileGrievanceList
                              .filter((g) => g.status === 'pending_inspection_verification')
                              .map((g) => (
                                <div
                                  key={g.id}
                                  className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#F59E0B]/50 flex flex-col gap-2.5 shadow-sm"
                                >
                                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F59E0B]/20 text-[#FDE68A] border border-[#F59E0B]/60 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-ping" />
                                      Step 2: Officer Inspection Request
                                    </span>
                                    <span className="text-[10px] font-mono text-[#38BDF8]">#{g.id}</span>
                                  </div>

                                  <h4 className="text-xs font-bold text-[#F8FAFC]">{g.title}</h4>

                                  {g.description && (
                                    <p className="text-[11px] text-[#94A3B8] bg-[#0C171C] p-2 rounded-lg border border-[#334B56] line-clamp-2">
                                      {g.description}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-2 pt-1 border-t border-[#334B56]">
                                    <button
                                      type="button"
                                      onClick={() => handleMobileAuthorizeInspection({ id: g.id!, title: g.title })}
                                      className="flex-1 py-2 px-3 min-h-[44px] rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-[#0C171C] font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span>Authorize Inspection Phase (Pin Amber)</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        flyToCoords([g.latitude, g.longitude]);
                                        setMobileSheet(null);
                                      }}
                                      className="p-2 min-h-[44px] min-w-[44px] rounded-xl bg-[#0C171C] border border-[#334B56] text-[#38BDF8] flex items-center justify-center transition active:scale-95 cursor-pointer"
                                    >
                                      <Locate className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      )}

                      {/* STEP 3: RESOLUTION & PHOTO AUDIT VERIFICATIONS */}
                      {mobileAdminQueueStep === 3 && (
                        <div className="space-y-2.5">
                          {mobileGrievanceList.filter((g) => g.status === 'pending_resolution_approval').length === 0 ? (
                            <div className="p-8 text-center rounded-2xl bg-[#1B2F38] border border-[#334B56] text-[#94A3B8] flex flex-col items-center gap-2">
                              <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
                              <h4 className="text-sm font-bold text-[#F8FAFC]">No Repair Proofs Awaiting Audit</h4>
                              <p className="text-xs text-[#94A3B8]">
                                There are currently zero repairs awaiting Sarpanch sign-off.
                              </p>
                            </div>
                          ) : (
                            mobileGrievanceList
                              .filter((g) => g.status === 'pending_resolution_approval')
                              .map((g) => (
                                <div
                                  key={g.id}
                                  className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#10B981]/50 flex flex-col gap-2.5 shadow-sm"
                                >
                                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#10B981]/20 text-[#6EE7B7] border border-[#10B981]/60">
                                      Step 3: Repair Proof Awaiting Audit
                                    </span>
                                    <span className="text-[10px] font-mono text-[#38BDF8]">#{g.id}</span>
                                  </div>

                                  <h4 className="text-xs font-bold text-[#F8FAFC]">{g.title}</h4>

                                  {/* Officer's Uploaded Repair Photo Proof */}
                                  {(g.resolution_photo_url || g.photoBase64) && (
                                    <div className="rounded-xl overflow-hidden border border-[#334B56] bg-[#0C171C]">
                                      <div className="text-[9px] uppercase font-bold text-[#10B981] p-1.5 bg-[#132228] border-b border-[#334B56] flex items-center justify-between">
                                        <span>Officer Ground-Truth Proof:</span>
                                        <span className="font-mono text-[#38BDF8]">Evidence Attached</span>
                                      </div>
                                      <img
                                        src={g.resolution_photo_url || g.photoBase64}
                                        alt="Repair proof"
                                        className="w-full h-32 object-cover"
                                      />
                                    </div>
                                  )}

                                  {g.officer_notes && (
                                    <p className="text-[11px] text-[#94A3B8] bg-[#0C171C] p-2 rounded-lg border border-[#334B56]">
                                      <strong className="text-[#38BDF8]">Officer Notes:</strong> {g.officer_notes}
                                    </p>
                                  )}

                                  <div className="flex items-center gap-2 pt-1 border-t border-[#334B56]">
                                    <button
                                      type="button"
                                      onClick={() => handleMobileVerifyResolution({ id: g.id!, title: g.title })}
                                      className="flex-1 py-2 px-3 min-h-[44px] rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span>Verify & Mark Officially Resolved (Pin Green)</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        flyToCoords([g.latitude, g.longitude]);
                                        setMobileSheet(null);
                                      }}
                                      className="p-2 min-h-[44px] min-w-[44px] rounded-xl bg-[#0C171C] border border-[#334B56] text-[#38BDF8] flex items-center justify-center transition active:scale-95 cursor-pointer"
                                    >
                                      <Locate className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* FIELD OFFICER VIEW: FIELD WORKLIST */}
                  {userRole === 'officer' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">
                          Field Operations Worklist
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#6EE7B7] border border-[#10B981]/40 font-bold">
                          {mobileGrievanceList.length} Tasks
                        </span>
                      </div>

                      {mobileGrievanceList.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl bg-[#1B2F38] border border-[#334B56] text-[#94A3B8] flex flex-col items-center gap-2">
                          <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
                          <h4 className="text-sm font-bold text-[#F8FAFC]">Worklist Clear</h4>
                          <p className="text-xs text-[#94A3B8]">
                            No pending assigned tasks in your field worklist.
                          </p>
                        </div>
                      ) : (
                        mobileGrievanceList.map((g) => {
                          const currentStatus = g.status || 'assigned_for_inspection';
                          const isAssigned = currentStatus === 'assigned_for_inspection';
                          const isPendingAuth = currentStatus === 'pending_inspection_verification';
                          const isUnderInspection = currentStatus === 'under_inspection';
                          const isPendingResolution = currentStatus === 'pending_resolution_approval';

                          return (
                            <div
                              key={g.id}
                              className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#334B56] flex flex-col gap-2.5 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                    isAssigned
                                      ? 'bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8]/40'
                                      : isPendingAuth
                                      ? 'bg-[#F59E0B]/20 text-[#FDE68A] border-[#F59E0B]/50'
                                      : isUnderInspection
                                      ? 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/60'
                                      : 'bg-[#A855F7]/20 text-[#D8B4FE] border-[#A855F7]/40'
                                  }`}
                                >
                                  {isAssigned
                                    ? 'Step 2: Assigned For Inspection'
                                    : isPendingAuth
                                    ? 'Step 3: Awaiting Admin Sign-off'
                                    : isUnderInspection
                                    ? 'Step 4: Authorized Under Inspection'
                                    : 'Step 5: Submitted for Audit'}
                                </span>
                                <span className="text-[10px] font-mono text-[#94A3B8]">#{g.id}</span>
                              </div>

                              <h4 className="text-xs font-bold text-[#F8FAFC]">{g.title}</h4>

                              {g.description && (
                                <p className="text-[11px] text-[#94A3B8] bg-[#0C171C] p-2 rounded-lg border border-[#334B56]">
                                  {g.description}
                                </p>
                              )}

                              {/* Officer Worklist Action Workflow */}
                              {isAssigned && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOfficerStartInspection({ id: g.id!, title: g.title })}
                                    className="w-full py-2.5 px-3 min-h-[44px] rounded-xl bg-gradient-to-r from-[#0284C7] to-[#38BDF8] text-[#0C171C] font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                                  >
                                    <ClipboardCheck className="w-4 h-4" />
                                    <span>Start Field Inspection</span>
                                  </button>
                                </div>
                              )}

                              {isPendingAuth && (
                                <div className="p-2 rounded-xl bg-[#0C171C] border border-[#F59E0B]/40 text-center text-xs text-[#FDE68A]">
                                  Inspection request sent to Admin for sign-off.
                                </div>
                              )}

                              {isUnderInspection && (
                                <div className="space-y-2 p-2.5 rounded-xl bg-[#0C171C] border border-[#334B56]">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#38BDF8] block">
                                    Capture / Upload Repair Proof
                                  </label>

                                  <div className="flex items-center gap-2">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      id={`photo-input-${g.id}`}
                                      className="hidden"
                                      onChange={(e) => handleOfficerPhotoSelect(g.id!, e)}
                                    />
                                    <label
                                      htmlFor={`photo-input-${g.id}`}
                                      className="flex-1 py-2 px-3 rounded-lg bg-[#1B2F38] border border-[#334B56] hover:bg-[#233B46] text-xs font-semibold text-[#F8FAFC] flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px]"
                                    >
                                      <ImageIcon className="w-3.5 h-3.5 text-[#38BDF8]" />
                                      <span>
                                        {officerPhotoMap[g.id!] ? 'Change Photo Proof' : 'Attach Repair Photo'}
                                      </span>
                                    </label>
                                  </div>

                                  {officerPhotoMap[g.id!] && (
                                    <div className="relative w-full h-24 rounded-lg overflow-hidden border border-[#10B981]/50">
                                      <img
                                        src={officerPhotoMap[g.id!]}
                                        alt="Proof preview"
                                        className="w-full h-full object-cover"
                                      />
                                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#10B981] text-white">
                                        Ready
                                      </span>
                                    </div>
                                  )}

                                  <input
                                    type="text"
                                    placeholder="Enter repair completion notes..."
                                    value={officerNotesMap[g.id!] || ''}
                                    onChange={(e) =>
                                      setOfficerNotesMap((prev) => ({ ...prev, [g.id!]: e.target.value }))
                                    }
                                    className="w-full p-2 text-xs rounded-lg bg-[#132228] border border-[#334B56] text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => handleOfficerSubmitResolution({ id: g.id!, title: g.title })}
                                    className="w-full py-2.5 px-3 min-h-[44px] rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] text-[#F8FAFC] font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Submit Resolution & Photo</span>
                                  </button>
                                </div>
                              )}

                              {isPendingResolution && (
                                <div className="p-2 rounded-xl bg-[#0C171C] border border-[#10B981]/40 text-center text-xs text-[#6EE7B7]">
                                  Repair proof submitted — Awaiting Sarpanch official verification.
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  flyToCoords([g.latitude, g.longitude]);
                                  setMobileSheet(null);
                                }}
                                className="w-full py-2 min-h-[40px] rounded-xl bg-[#0C171C] hover:bg-[#1B2F38] border border-[#334B56] text-[#38BDF8] text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                              >
                                <Locate className="w-4 h-4" />
                                <span>Fly to Location on Map</span>
                              </button>
                            </div>
                          );
                        })
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          handleOfficerExportWorklist();
                          setMobileSheet(null);
                        }}
                        className="w-full py-3 min-h-[48px] rounded-xl bg-[#1B2F38] hover:bg-[#233B46] border border-[#38BDF8]/40 text-[#38BDF8] hover:text-[#F8FAFC] font-semibold text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Worklist PDF</span>
                      </button>
                    </>
                  )}

                  {/* CITIZEN VIEW: MY REPORTS */}
                  {userRole === 'user' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">
                          My Field Reports & Grievances
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1B2F38] text-[#38BDF8] border border-[#334B56]">
                          {mobileGrievanceList.length} Logged
                        </span>
                      </div>

                      {mobileGrievanceList.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl bg-[#1B2F38] border border-[#334B56] text-[#94A3B8] flex flex-col items-center gap-2">
                          <AlertTriangle className="w-8 h-8 text-[#38BDF8]" />
                          <h4 className="text-sm font-bold text-[#F8FAFC]">No Grievances Logged Yet</h4>
                          <p className="text-xs text-[#94A3B8]">
                            Notice a broken handpump or flooded road? Tap "Report Grievance" below to capture a field issue.
                          </p>
                        </div>
                      ) : (
                        mobileGrievanceList.map((g) => {
                          const st = (g.status || 'pending_initial_approval').toLowerCase();
                          return (
                            <div
                              key={g.id}
                              className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#334B56] flex flex-col gap-2 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E05A47]/20 border border-[#E05A47]/50 text-[#FCA5A5]">
                                  {g.category}
                                </span>
                                <span
                                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                                    st === 'resolved'
                                      ? 'bg-[#10B981]/20 text-[#6EE7B7] border-[#10B981]/40'
                                      : st === 'under_inspection'
                                      ? 'bg-[#F59E0B]/20 text-[#FDE68A] border-[#F59E0B]/40'
                                      : 'bg-[#0C171C] text-[#94A3B8] border-[#334B56]'
                                  }`}
                                >
                                  {st === 'resolved'
                                    ? '● Officially Resolved'
                                    : st === 'under_inspection'
                                    ? '● Under Inspection'
                                    : st === 'pending_initial_approval'
                                    ? '● Awaiting Sarpanch Verification'
                                    : '● Assigned to Field Desk'}
                                </span>
                              </div>

                              <h4 className="text-xs font-bold text-[#F8FAFC]">{g.title}</h4>

                              {g.description && (
                                <p className="text-[11px] text-[#94A3B8] bg-[#0C171C] p-2 rounded-lg border border-[#334B56]">
                                  {g.description}
                                </p>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  flyToCoords([g.latitude, g.longitude]);
                                  setMobileSheet(null);
                                }}
                                className="w-full py-2 min-h-[44px] rounded-xl bg-[#0C171C] hover:bg-[#1B2F38] border border-[#334B56] text-[#38BDF8] text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                              >
                                <Locate className="w-4 h-4" />
                                <span>View on Map</span>
                              </button>
                            </div>
                          );
                        })
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsGrievanceModalOpen(true);
                          setMobileSheet(null);
                        }}
                        className="w-full py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-[#D9534F] to-[#E05A47] hover:brightness-110 text-[#F8FAFC] font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-2"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>Report Another Field Issue</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* VIEW 3: MAP OVERLAYS & BASEMAPS */}
              {mobileSheet === 'layers' && (
                <div className="space-y-4">
                  {/* Basemap Switcher */}
                  <div className="p-3.5 rounded-2xl bg-[#F1F5F9] dark:bg-[#172A33] border border-[#E2E8F0] dark:border-[#2C4654] space-y-2">
                    <span className="text-xs font-bold text-[#0F172A] dark:text-[#F1F5F9] block uppercase tracking-wider">
                      Select Basemap
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'osm', label: 'OSM Street' },
                        { id: 'satellite', label: 'ESRI Satellite' },
                      ].map((b) => (
                        <button
                          key={b.id}
                          onClick={() => changeBasemap(b.id as BasemapType)}
                          className={`py-2 px-1 min-h-[44px] rounded-xl font-bold text-xs text-center transition cursor-pointer active:scale-95 truncate ${
                            activeBasemap === b.id || (b.id === 'satellite' && activeBasemap === 'esri')
                              ? 'bg-[#00E5FF]/25 border border-[#00E5FF] text-[#00E5FF] font-semibold shadow-sm'
                              : 'bg-[#0D1C2A] text-[#8CB0C9] border border-[#1D3B52]'
                          }`}
                          title={b.label}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Layer Toggles */}
                  <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1B2F38] border border-[#CBD5E1] dark:border-[#334B56] space-y-2.5">
                    <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block uppercase tracking-wider">
                      Active Layers
                    </span>

                    <label className="flex items-center justify-between p-2.5 min-h-[48px] rounded-xl bg-white dark:bg-[#0C171C] border border-[#CBD5E1] dark:border-[#334B56] cursor-pointer">
                      <span className="text-xs text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 font-medium">
                        <Building2 className="w-4 h-4 text-[#38BDF8]" />
                        Khopripada Boundary
                      </span>
                      <input
                        type="checkbox"
                        checked={showBoundary}
                        onChange={toggleBoundary}
                        className="w-5 h-5 rounded text-[#38BDF8] accent-[#38BDF8] cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 min-h-[48px] rounded-xl bg-white dark:bg-[#0C171C] border border-[#CBD5E1] dark:border-[#334B56] cursor-pointer">
                      <span className="text-xs text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 font-medium">
                        <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
                        Village Facilities ({facilitiesList.length || facilityCount})
                      </span>
                      <input
                        type="checkbox"
                        checked={showFacilities}
                        onChange={toggleFacilities}
                        className="w-5 h-5 rounded text-[#10B981] accent-[#10B981] cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 min-h-[48px] rounded-xl bg-white dark:bg-[#0C171C] border border-[#CBD5E1] dark:border-[#334B56] cursor-pointer">
                      <span className="text-xs text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-4 h-4 text-[#E05A47]" />
                        Reported Grievances & Issues
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-red-400 bg-red-950/60 border border-red-800/60 px-1.5 py-0.5 rounded">
                          {issues.length} Active
                        </span>
                        <input
                          type="checkbox"
                          checked={showIssuesLayer}
                          onChange={(e) => setShowIssuesLayer(e.target.checked)}
                          className="w-5 h-5 rounded text-[#E05A47] accent-[#E05A47] cursor-pointer"
                        />
                      </div>
                    </label>

                    <label className="flex items-center justify-between p-2.5 min-h-[48px] rounded-xl bg-white dark:bg-[#0C171C] border border-[#CBD5E1] dark:border-[#334B56] cursor-pointer">
                      <span className="text-xs text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2 font-medium">
                        <Flame className="w-4 h-4 text-[#E05A47]" />
                        Failure Density Heatmap
                      </span>
                      <input
                        type="checkbox"
                        checked={showHeatmap}
                        onChange={() => toggleHeatmap(!showHeatmap)}
                        className="w-5 h-5 rounded text-[#E05A47] accent-[#E05A47] cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#1B2F38] border border-[#CBD5E1] dark:border-[#334B56] space-y-2">
                    <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block uppercase tracking-wider">
                      Filter Category
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'all', label: 'All POIs', color: '#38BDF8' },
                        { id: 'water', label: 'Drinking Water', color: '#38BDF8' },
                        { id: 'education', label: 'Education', color: '#94A3B8' },
                        { id: 'commerce', label: 'Commerce', color: '#FCD34D' },
                        { id: 'health', label: 'Health', color: '#E05A47' },
                        { id: 'civic', label: 'Civic', color: '#10B981' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleFilterFacilities(opt.id as FacilityCategoryFilter)}
                          className={`px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-2 ${
                            facilityFilter === opt.id
                              ? 'bg-[#10B981]/25 border-[#10B981] text-emerald-700 dark:text-[#6EE7B7] shadow-xs'
                              : 'bg-white dark:bg-[#0C171C] border-[#CBD5E1] dark:border-[#334B56] text-slate-600 dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: opt.color, boxShadow: `0 0 6px ${opt.color}` }}
                          />
                          <span className="truncate">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 4: QUICK FIELD OPERATIONS */}
              {mobileSheet === 'action' && (
                <div className="space-y-3">

                  {/* Option 1: Propose Community Facility */}
                  <button
                    onClick={() => {
                      if (isAddFacilityMode) {
                        cleanupAddFacilityMode();
                      } else {
                        setIsAddFacilityMode(true);
                      }
                      setMobileSheet(null);
                    }}
                    className="w-full p-4 min-h-[64px] rounded-2xl bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] flex items-center gap-3.5 transition active:scale-98 cursor-pointer shadow-md text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#0D9488]/20 border border-[#0D9488]/50 flex items-center justify-center text-[#10B981] flex-shrink-0 shadow-sm">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#F8FAFC]">
                        {isAddFacilityMode ? 'Cancel Placing Asset' : 'Propose Community Facility'}
                      </h4>
                      <p className="text-xs text-[#94A3B8] mt-0.5 leading-snug">
                        For local borewells, community taps, or kirana stores.
                      </p>
                    </div>
                  </button>

                  {/* Option 2: Report Civic Grievance */}
                  <button
                    onClick={() => {
                      setIsGrievanceModalOpen(true);
                      setMobileSheet(null);
                    }}
                    className="w-full p-4 min-h-[64px] rounded-2xl bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] flex items-center gap-3.5 transition active:scale-98 cursor-pointer shadow-md text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#E05A47]/20 border border-[#E05A47]/50 flex items-center justify-center text-[#E05A47] flex-shrink-0 shadow-sm">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#F8FAFC]">
                        Report Civic Grievance
                      </h4>
                      <p className="text-xs text-[#94A3B8] mt-0.5 leading-snug">
                        For road potholes, overflowing drains, or broken streetlights with camera capture.
                      </p>
                    </div>
                  </button>

                  {userRole === 'admin' && (
                    <button
                      onClick={() => {
                        setIsExportAuditModalOpen(true);
                        setMobileSheet(null);
                      }}
                      className="w-full p-4 min-h-[64px] rounded-2xl bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] flex items-center gap-3.5 transition active:scale-98 cursor-pointer shadow-md text-left"
                    >
                      <div className="w-11 h-11 rounded-xl bg-[#132228] border border-[#38BDF8]/50 flex items-center justify-center text-[#38BDF8] flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#F8FAFC]">
                          Executive Panchayat Audit
                        </h4>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          Download comprehensive Sarpanch PDF summary & master dataset CSV
                        </p>
                      </div>
                    </button>
                  )}

                  {userRole === 'officer' && (
                    <button
                      onClick={() => {
                        handleOfficerExportWorklist();
                        setMobileSheet(null);
                      }}
                      className="w-full p-4 min-h-[64px] rounded-2xl bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] flex items-center gap-3.5 transition active:scale-98 cursor-pointer shadow-md text-left"
                    >
                      <div className="w-11 h-11 rounded-xl bg-[#132228] border border-[#38BDF8]/50 flex items-center justify-center text-[#38BDF8] flex-shrink-0">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#F8FAFC]">
                          Export Officer Worklist PDF
                        </h4>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          Generate printable field inspection worklist for verified ground tasks
                        </p>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      recenterToKhopripadaCore();
                      setMobileSheet(null);
                    }}
                    className="w-full p-4 min-h-[64px] rounded-2xl bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] flex items-center gap-3.5 transition active:scale-98 cursor-pointer shadow-md text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#0C171C] border border-[#334B56] flex items-center justify-center text-[#10B981] flex-shrink-0">
                      <Locate className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#F8FAFC]">
                        Re-Center on Khopripada Core
                      </h4>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        Pan and zoom back to village centroid (19.3551°N, 72.8846°E)
                      </p>
                    </div>
                  </button>
                </div>
              )}

              {/* VIEW 5: ROLE / PORTAL SWITCHER */}
              {mobileSheet === 'role' && (
                <div className="space-y-3">
                  {/* Official Panchayat Identifier Card */}
                  <div className="p-3.5 rounded-2xl bg-[#0C171C] border border-[#334B56] space-y-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider block">
                        Official Panchayat Identifier
                      </span>
                      <div className="text-xs font-mono font-bold text-[#38BDF8] break-words mt-0.5">
                        {getPanchayatId(userRole)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#334B56]/50">
                      <div>
                        <strong className="text-sm text-[#F8FAFC] block">{session?.name || 'Authorized User'}</strong>
                        <span className="text-xs text-[#94A3B8]">{session?.designation}</span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] text-xs font-mono font-bold">
                        {userRole.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-[#F8FAFC] block uppercase tracking-wider pt-1">
                    Select Access Portal:
                  </span>

                  {AVAILABLE_ROLES.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => {
                        handlePortalSwitch(role.id, role.label);
                        setMobileSheet(null);
                      }}
                      className={`w-full p-3.5 min-h-[60px] rounded-2xl border transition flex items-center gap-3 text-left cursor-pointer active:scale-98 ${
                        userRole === role.id
                          ? 'bg-[#1B2F38] border-[#38BDF8] shadow-md'
                          : 'bg-[#0C171C] border-[#334B56] hover:bg-[#1B2F38]'
                      }`}
                    >
                      <div className="p-2.5 rounded-xl bg-[#132228] border border-[#334B56] flex-shrink-0 flex items-center justify-center">
                        {getRoleIcon(role.id)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-[#F8FAFC] flex items-center gap-2">
                          <span>{role.label}</span>
                          {userRole === role.id && (
                            <span className="text-[10px] text-[#38BDF8] font-mono">● Active</span>
                          )}
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-0.5 truncate">{role.desc}</p>
                      </div>
                    </button>
                  ))}

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        loginAsDemoRole('user');
                        setMobileSheet(null);
                      }}
                      className="w-full py-3 min-h-[44px] rounded-xl bg-[#0C171C] hover:bg-[#1B2F38] border border-[#334B56] text-[#94A3B8] hover:text-[#F8FAFC] font-semibold text-xs transition cursor-pointer"
                    >
                      Reset to Default Citizen View
                    </button>
                  </div>

                  {/* Clean Outlined Log Out Button */}
                  <div className="pt-2 border-t border-[#334B56]/60">
                    <button
                      onClick={handleMobileLogout}
                      className="w-full py-3 min-h-[44px] rounded-xl bg-transparent hover:bg-[#E05A47]/15 border border-[#E05A47]/60 text-[#FCA5A5] hover:text-[#F8FAFC] font-medium text-xs transition cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                    >
                      <LogOut className="w-4 h-4 text-[#E05A47]" />
                      <span>Sign Out Session</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 5.2 BOTTOM-LEFT: VILLAGE SUMMARY STATS & QUICK NAVIGATION PILL (UNIFIED DESKTOP & MOBILE CALIBRATION) */}
      <div className="absolute bottom-16 sm:bottom-6 left-3 sm:left-24 z-[1000] pointer-events-none flex items-center gap-2 max-w-[calc(100vw-24px)] overflow-x-auto scrollbar-none">
        <div className="pointer-events-auto backdrop-blur-md bg-white/95 dark:bg-[#132228]/95 border border-[#CBD5E1] dark:border-[#334B56] text-slate-600 dark:text-[#94A3B8] rounded-xl px-2.5 sm:px-3.5 py-1.5 sm:py-2 shadow-xl flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs whitespace-nowrap shrink-0">
          <button
            onClick={recenterToKhopripadaCore}
            className="flex items-center gap-1.5 hover:text-[#38BDF8] transition cursor-pointer min-h-[36px] sm:min-h-0"
            title="Click to Recenter on Khopripada Core"
          >
            <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
            <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Khopripada Core</span>
          </button>
          <span className="text-[#CBD5E1] dark:text-[#334B56]">|</span>
          <button
            onClick={flyToJuchandraStation}
            className="text-slate-600 dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition cursor-pointer min-h-[36px] sm:min-h-0 flex items-center"
            title="Click to Fly to Juchandra Station"
          >
            Juchandra Stn
          </button>
          <span className="text-[#CBD5E1] dark:text-[#334B56] hidden sm:inline">|</span>
          <span className="text-sky-700 dark:text-[#38BDF8] font-mono text-[10px] sm:text-[11px] hidden sm:inline">
            {cursorCoords ? `${cursorCoords[0]}°N, ${cursorCoords[1]}°E` : `${centerCoords[0]}°N, ${centerCoords[1]}°E`}
          </span>
          <span className="text-[#CBD5E1] dark:text-[#334B56]">|</span>
          <span className="text-slate-600 dark:text-[#94A3B8]">
            Zoom: <strong className="text-[#0F172A] dark:text-[#F8FAFC] font-mono">{currentZoom}</strong>
          </span>
          <span className="text-[#CBD5E1] dark:text-[#334B56]">|</span>
          <button
            onClick={toggleFullscreen}
            className="text-slate-600 dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition cursor-pointer p-1"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  </div>

      {/* 6. REPORT GRIEVANCE MODAL */}
      <GrievanceModal
        isOpen={isGrievanceModalOpen}
        onClose={() => setIsGrievanceModalOpen(false)}
        initialCoords={inspectedPoint ? [inspectedPoint.lat, inspectedPoint.lng] : KHOPRIPADA_CORE}
        onGrievanceSaved={(savedGrievance) => {
          refreshGrievanceMarkers();
          if (savedGrievance) {
            const canonical = normalizeIssue(savedGrievance);
            setIssuesList((prev) => {
              const key = String(canonical.issue_id || canonical.id);
              const filtered = prev.filter((i) => String(i.issue_id || (i as any).id) !== key);
              const updated = [canonical as any, ...filtered];
              allIssuesRef.current = updated;
              return updated;
            });
            if (propSetIssues) {
              propSetIssues((prev) => {
                const key = String(canonical.issue_id || canonical.id);
                const filtered = prev.filter((i) => String(i.issue_id || (i as any).id) !== key);
                return [canonical, ...filtered];
              });
            }
          }
        }}
        userRole={userRole}
      />

      {/* 6.1 REGISTER NEW VILLAGE FACILITY MODAL */}
      <AddFacilityModal
        isOpen={isAddFacilityModalOpen}
        onClose={cleanupAddFacilityMode}
        coords={newFacilityCoords}
        onFacilitySaved={handleFacilitySaved}
        userRole={userRole}
      />

      {/* 7. GRIEVANCES LIST DRAWER */}
      <GrievanceListDrawer
        isOpen={isGrievanceDrawerOpen}
        onClose={() => setIsGrievanceDrawerOpen(false)}
        onFlyToGrievance={flyToCoords}
        userRole={userRole}
        onGrievanceStatusUpdated={refreshGrievanceMarkers}
        issues={issues}
      />

      {/* 7.1 HIGH-RESOLUTION FIELD SURVEY PHOTO LIGHTBOX MODAL */}
      <PhotoLightboxModal
        isOpen={lightboxData.isOpen}
        photoUrl={lightboxData.photoUrl}
        title={lightboxData.title}
        category={lightboxData.category}
        coords={lightboxData.coords}
        onClose={() =>
          setLightboxData((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }
      />

      {/* 8. GPS OUT-OF-BOUNDS MODAL (WITH SIMULATE OPTION) */}
      {gpsWarningModal?.open && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#132228] border border-[#334B56] rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto text-[#F8FAFC]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E05A47]/20 border border-[#E05A47]/40 flex items-center justify-center text-[#FCA5A5] flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#F8FAFC]">
                  Location Outside Khopripada Study Corridor
                </h3>
                <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
                  Your live browser GPS coordinates: <span className="font-mono text-[#F8FAFC] font-semibold">{gpsWarningModal.lat.toFixed(4)}°N, {gpsWarningModal.lng.toFixed(4)}°E</span>.
                  The Smart Village GIS boundary is strictly enforced for Khopripada & Bapane (19.3000–19.4500°N, 72.7500–72.9000°E).
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#0C171C] border border-[#334B56] text-xs text-[#94A3B8] flex items-center gap-2">
              <span className="text-[#10B981] font-bold">Tip:</span>
              <span>For field verification outside the corridor, you can simulate a high-accuracy GNSS fix at Khopripada Core.</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#334B56]">
              <button
                onClick={() => setGpsWarningModal(null)}
                className="px-4 py-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] rounded-xl transition cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setGpsWarningModal(null);
                  renderGpsFix(KHOPRIPADA_CORE, 8.5, true);
                }}
                className="px-4 py-2 text-xs font-bold text-[#F8FAFC] bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 active:scale-95 rounded-xl shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Locate className="w-3.5 h-3.5" />
                <span>Simulate Field Position</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. EXECUTIVE PANCHAYAT AUDIT & DATA EXPORT MODAL */}
      <ExportAuditModal
        isOpen={isExportAuditModalOpen}
        onClose={() => setIsExportAuditModalOpen(false)}
        facilities={facilitiesList}
        issues={issuesList}
        currentUser={session || undefined}
        onDownloadPdf={handleDownloadPanchayatPdf}
        onExportCsv={handleExportMasterCsv}
      />
    </div>
  );
};

export default VillageMap;
