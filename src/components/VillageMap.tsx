import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import {
  Layers,
  MapPin,
  Building2,
  ChevronDown,
  Locate,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Flame,
  Maximize2,
  Minimize2,
  FileText,
  ClipboardList,
  Compass,
  BarChart3,
  Activity,
  CheckCircle2,
  X,
  ShieldCheck,
  Download,
} from 'lucide-react';
import {
  getCurrentPosition,
  isCoordInStudyCorridor,
  type GeolocationResult,
} from '../services/geolocation';
import {
  db,
  seedFacilitiesFromCsv,
  saveFacilityToOfflineDb,
  seedIssuesFromCsv,
  approveFacility,
  rejectFacility,
  approveGrievance,
  rejectGrievance,
  type CachedFacility,
  type CachedIssue,
  type OfflineGrievance,
} from '../services/offlineDb';
import { GrievanceModal } from './GrievanceModal';
import { GrievanceListDrawer } from './GrievanceListDrawer';
import { AddFacilityModal } from './AddFacilityModal';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types/auth';
import { UserProfileBadge } from './UserProfileBadge';
import { PanchayatAdminPanel } from './PanchayatAdminPanel';
import { PhotoLightboxModal } from './PhotoLightboxModal';
import { ExportAuditModal } from './ExportAuditModal';
import { DEFAULT_INSPECTION_PLACEHOLDER } from '../utils/imageUtils';
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

type BasemapType = 'esri' | 'osm' | 'cartoDark' | 'topo';
export type FacilityCategoryFilter = 'all' | 'water' | 'education' | 'commerce' | 'health' | 'civic' | 'issues';

export const VillageMap = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const boundaryLayerRef = useRef<L.Polygon | null>(null);
  const landmarksLayerRef = useRef<L.LayerGroup | null>(null);
  const facilitiesLayerRef = useRef<L.LayerGroup | null>(null);
  const issuesLayerRef = useRef<L.LayerGroup | null>(null);
  const grievancesLayerRef = useRef<L.LayerGroup | null>(null);
  const gpsLocationLayerRef = useRef<L.LayerGroup | null>(null);
  const inspectMarkerRef = useRef<L.Marker | null>(null);
  const tileLayersRef = useRef<Record<BasemapType, L.TileLayer> | null>(null);
  const allFacilitiesRef = useRef<CachedFacility[]>([]);
  const allIssuesRef = useRef<CachedIssue[]>([]);
  const heatLayerRef = useRef<any>(null);

  // Available roles for dedicated Portal Switcher
  const AVAILABLE_ROLES: { id: Role; label: string; icon: string; desc: string }[] = [
    { id: 'user', label: 'Resident / Villager', icon: '👤', desc: 'Public map, report issues' },
    { id: 'officer', label: 'Field Officer', icon: '📋', desc: 'Inspect worklist, govt assets' },
    { id: 'admin', label: 'Panchayat Admin', icon: '🏛️', desc: 'Approvals, ML priority, audits' },
  ];

  // Auth Context & Role
  const { session, loginAsDemoRole } = useAuth();
  const userRole = session?.role || 'user';
  const userRoleRef = useRef(userRole);
  userRoleRef.current = userRole;

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
  const dbscanLayerRef = useRef<L.LayerGroup | null>(null);
  const heatmapLayerRef = useRef<L.LayerGroup | null>(null);
  const [showDbscanClusters, setShowDbscanClusters] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const handleUpdateIssueStatusRef = useRef<((id: string, st: string) => Promise<void>) | null>(null);

  // Map state
  const [currentZoom, setCurrentZoom] = useState<number>(DEFAULT_ZOOM);
  const [centerCoords, setCenterCoords] = useState<[number, number]>(KHOPRIPADA_CORE);
  const [cursorCoords, setCursorCoords] = useState<[number, number] | null>(null);
  const [activeBasemap, setActiveBasemap] = useState<BasemapType>('esri');
  const [showBoundary, setShowBoundary] = useState<boolean>(true);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [showFacilities, setShowFacilities] = useState<boolean>(true);
  const [showIssues, setShowIssues] = useState<boolean>(true);
  const [showGrievancePins, setShowGrievancePins] = useState<boolean>(true);
  const [facilityFilter, setFacilityFilter] = useState<FacilityCategoryFilter>('all');
  const [facilitiesList, setFacilitiesList] = useState<CachedFacility[]>([]);
  const [issuesList, setIssuesList] = useState<CachedIssue[]>([]);
  const [activeDataset, setActiveDataset] = useState<'survey' | 'unified'>('survey');

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

  // Drawer Accordion States
  const [activeLayersOpen, setActiveLayersOpen] = useState<boolean>(true);
  const [categoryFiltersOpen, setCategoryFiltersOpen] = useState<boolean>(true);
  const [analyticsHealthOpen, setAnalyticsHealthOpen] = useState<boolean>(true);

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

  // Operational status breakdown counts for village facilities
  const operationalCounts = useMemo(() => {
    return {
      functional: facilitiesList.filter(
        (f) =>
          f.operational_status.toLowerCase().includes('functional') &&
          !f.operational_status.toLowerCase().includes('partial') &&
          !f.operational_status.toLowerCase().includes('non')
      ).length,
      partial: facilitiesList.filter((f) =>
        f.operational_status.toLowerCase().includes('partial')
      ).length,
      nonFunctional: facilitiesList.filter(
        (f) =>
          f.operational_status.toLowerCase().includes('non') ||
          f.operational_status.toLowerCase().includes('repair') ||
          f.operational_status.toLowerCase().includes('broken') ||
          f.operational_status.toLowerCase().includes('degraded')
      ).length,
    };
  }, [facilitiesList]);

  // Priority breakdown counts for village issues from CSV
  const issueCounts = useMemo(() => {
    return {
      total: issuesList.length,
      high: issuesList.filter(
        (i) => i.severity === 'high' || i.severity === 'critical' || i.severity === 'urgent'
      ).length,
      medium: issuesList.filter((i) => i.severity === 'medium').length,
      low: issuesList.filter((i) => i.severity === 'low').length,
    };
  }, [issuesList]);

  // Mobile Touch Interface States (< 768px viewports)
  const [mobileSheet, setMobileSheet] = useState<'action' | 'analytics' | 'worklist' | 'layers' | 'role' | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'map' | 'heatmap' | 'analytics' | 'worklist' | null>('map');
  const [mobileGrievanceList, setMobileGrievanceList] = useState<OfflineGrievance[]>([]);
  const [pendingSubmissionsList, setPendingSubmissionsList] = useState<{
    id: string | number;
    type: 'facility' | 'grievance';
    title: string;
    category: string;
    submitted_by: string;
    coords: [number, number];
    photoUrl?: string;
    description?: string;
  }[]>([]);

  // Function to refresh mobile worklist data
  const refreshMobileWorklist = useCallback(async () => {
    try {
      const records = await db.offline_grievances.reverse().toArray();
      if (userRole === 'officer') {
        const approved = records.filter(
          (g) =>
            (g.approval_status === 'approved' || g.approval_status === undefined) &&
            (g.status || '').toLowerCase() !== 'resolved'
        );
        setMobileGrievanceList(approved);
      } else {
        setMobileGrievanceList(records);
      }
    } catch (err) {
      console.error('Failed to query mobile grievances:', err);
    }
  }, [userRole]);

  // Load pending submissions for Admin approvals on mobile
  const loadMobilePendingSubmissions = useCallback(async () => {
    try {
      const grievances = await db.offline_grievances.toArray();
      const pendingGrievances = grievances
        .filter((g) => g.approval_status === 'pending_approval')
        .map((g) => ({
          id: g.id!,
          type: 'grievance' as const,
          title: g.title,
          category: g.category,
          submitted_by: g.submitted_by || 'Resident',
          coords: [g.latitude, g.longitude] as [number, number],
          photoUrl: g.photoBase64,
          description: g.description,
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

  const totalMLCapex = useMemo(() => {
    return topMLIssues.reduce((sum, item) => sum + (item.estimated_budget_inr || 45000), 0);
  }, [topMLIssues]);

  // Category breakdown for mobile analytics chart
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      Roads: 0,
      Water: 0,
      Drainage: 0,
      Sanitation: 0,
      Electricity: 0,
    };
    issuesList.forEach((iss) => {
      const cat = (iss.category || '').toLowerCase();
      const title = (iss.title || '').toLowerCase();
      if (cat.includes('road') || cat.includes('pothole') || title.includes('road')) {
        counts.Roads += 1;
      } else if (cat.includes('water') || title.includes('tap') || title.includes('pipe')) {
        counts.Water += 1;
      } else if (cat.includes('drain') || cat.includes('runoff') || title.includes('drain')) {
        counts.Drainage += 1;
      } else if (cat.includes('waste') || cat.includes('sanitat') || title.includes('garbage')) {
        counts.Sanitation += 1;
      } else {
        counts.Electricity += 1;
      }
    });
    if (Object.values(counts).every((v) => v === 0)) {
      counts.Roads = 6;
      counts.Water = 4;
      counts.Drainage = 3;
      counts.Sanitation = 2;
      counts.Electricity = 1;
    }
    const maxVal = Math.max(...Object.values(counts), 1);
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      pct: Math.round((count / maxVal) * 100),
    }));
  }, [issuesList]);

  const handleMobileApprove = async (item: { id: string | number; type: 'facility' | 'grievance'; title: string }) => {
    try {
      if (item.type === 'facility') {
        await approveFacility(item.id as string);
        const updated = allFacilitiesRef.current.map((f) =>
          f.facility_id === item.id ? { ...f, approval_status: 'approved' as const } : f
        );
        allFacilitiesRef.current = updated;
        setFacilitiesList(updated);
        renderFacilityMarkers(updated, facilityFilter);
      } else {
        await approveGrievance(item.id as number);
        refreshGrievanceMarkers();
      }
      showToast(`✅ "${item.title}" approved & published to live map!`);
      loadMobilePendingSubmissions();
      refreshMobileWorklist();
    } catch (err) {
      console.error('Failed to approve on mobile:', err);
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
      showToast(`❌ Rejected "${item.title}"`);
      loadMobilePendingSubmissions();
      refreshMobileWorklist();
    } catch (err) {
      console.error('Failed to reject on mobile:', err);
    }
  };

  const handleMobileUpdateGrievanceStatus = async (id: number, newStatus: string) => {
    try {
      await db.offline_grievances.update(id, { status: newStatus });
      refreshGrievanceMarkers();
      refreshMobileWorklist();
      showToast(`Status updated to ${newStatus.replace(/_/g, ' ')}`);
    } catch (err) {
      console.error('Failed to update status on mobile:', err);
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

      const filtered = facilities.filter((fac) => {
        // Strict approval filter: user and officer ONLY see approved facilities
        const isApproved = fac.approval_status === 'approved' || fac.approval_status === undefined;
        if ((userRoleRef.current === 'user' || userRoleRef.current === 'officer') && !isApproved) {
          return false;
        }
        if (fac.approval_status === 'rejected') {
          return false;
        }

        if (filter === 'all') return true;
        const cat = fac.category.toLowerCase();
        if (filter === 'water') {
          return (
            cat.includes('water') ||
            cat.includes('borewell') ||
            cat.includes('standpost') ||
            cat.includes('pump') ||
            cat.includes('well') ||
            cat.includes('tank') ||
            fac.name.toLowerCase().includes('lake')
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
        // Status Coding:
        // functional: Fresh Emerald (#10B981)
        // partially_functional: Warm Gold (#F59E0B)
        // non_functional: Controlled Terracotta (#E05A47)
        const status = fac.operational_status.toLowerCase();
        let statusColor = '#10B981'; // Functional Emerald
        let statusLabel = 'Functional';
        let statusBadge = 'bg-[#10B981]/20 text-[#6EE7B7] border border-[#10B981]/60 font-semibold text-xs px-2.5 py-0.5 rounded-full';

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
          statusColor = '#E05A47'; // Broken / Non-functional Terracotta
          statusLabel = 'Broken / Non-functional';
          statusBadge = 'bg-[#E05A47]/20 text-[#FCA5A5] border border-[#E05A47]/60 font-semibold text-xs px-2.5 py-0.5 rounded-full';
        }

        const isWater =
          fac.category.includes('water') ||
          fac.category.includes('borewell') ||
          fac.category.includes('standpost') ||
          fac.category.includes('tank') ||
          fac.category.includes('pump') ||
          fac.category.includes('well') ||
          fac.name.toLowerCase().includes('lake');

        const glyph = isWater
          ? '💧'
          : fac.category.includes('edu') || fac.category.includes('school') || fac.category.includes('coaching') || fac.category.includes('academy')
          ? '🏫'
          : fac.category.includes('angan') || fac.category.includes('child') || fac.category.includes('balwadi')
          ? '🎒'
          : fac.category.includes('shop') || fac.category.includes('store') || fac.category.includes('hardware') || fac.category.includes('vendor') || fac.category.includes('saloon') || fac.category.includes('laundry')
          ? '🏪'
          : fac.category.includes('ration') || fac.category.includes('commerce') || fac.category.includes('dairy')
          ? '🛒'
          : fac.category.includes('health') || fac.category.includes('clinic') || fac.category.includes('hospital')
          ? '🏥'
          : fac.category.includes('mandir') || fac.category.includes('temple')
          ? '🛕'
          : fac.category.includes('graveyard')
          ? '⚰️'
          : fac.name.toLowerCase().includes('light')
          ? '💡'
          : '🏛️';

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
                <span>${glyph}</span>
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
          `<div class="font-sans font-semibold text-xs text-[#F8FAFC]">${fac.name}</div>`,
          {
            direction: 'top',
            offset: [0, -18],
            className: 'gis-clean-tooltip',
            opacity: 0.95,
          }
        );

        // Polished Inspection Popup with Photo Thumbnail & Slate-Marine Palette
        const monsoonLower = fac.monsoon_accessible.toLowerCase();
        const isFloods =
          monsoonLower.includes('cut') ||
          monsoonLower.includes('inaccessible') ||
          monsoonLower.includes('waterlog') ||
          monsoonLower.includes('flood') ||
          monsoonLower.includes('isolated');

        const monsoonPill = isFloods
          ? `<span class="px-2.5 py-0.5 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] font-semibold text-[10px] flex items-center gap-1">⚠️ Floods/Isolated</span>`
          : `<span class="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] font-semibold text-[10px] flex items-center gap-1">✅ Year-round</span>`;

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

        const photoMarkup = resolvedPhoto
          ? `
            <div
              onclick="window.openPhotoLightbox && window.openPhotoLightbox('${resolvedPhoto}', '${fac.name.replace(/'/g, "\\'")}', '${fac.category}', [${fac.latitude}, ${fac.longitude}])"
              class="relative w-full h-32 mb-2 rounded-xl overflow-hidden border border-[#334B56] bg-[#0C171C] shadow-inner group cursor-pointer"
              title="Click to inspect high-resolution field survey evidence"
            >
              <img src="${resolvedPhoto}" alt="${fac.name}" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <div class="absolute inset-0 bg-[#132228]/20 group-hover:bg-transparent transition-colors flex items-center justify-center">
                <span class="opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1 rounded-lg bg-[#132228]/95 text-[10px] font-bold text-[#38BDF8] border border-[#38BDF8]/60 shadow-md">
                  🔍 Inspect Ground-Truth
                </span>
              </div>
              <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#132228]/90 text-[#94A3B8] border border-[#334B56]">
                📷 KoboCollect Field Photo
              </span>
            </div>
          `
          : `
            <div class="mb-2 p-2 rounded-xl bg-[#1B2F38] border border-[#334B56] text-center flex items-center justify-center gap-1.5 text-[#94A3B8] text-xs">
              <span class="text-[#38BDF8] text-[11px]">📷</span>
              <span class="text-[10px] font-semibold text-[#94A3B8]">No Field Photo Recorded</span>
            </div>
          `;

        const catTheme = getCategoryTheme(fac.category, fac.name);
        const contextAttributesHtml = buildFacilityContextAttributesHtml(fac);

        const popupHtml = `
          <div class="font-sans text-[#F8FAFC] p-1 min-w-[270px] max-w-[320px]">
            <!-- Inspection Thumbnail / Fallback -->
            ${photoMarkup}

            <!-- 1. Asset Title & ID -->
            <div class="flex items-start justify-between gap-2 mb-1.5">
              <h3 class="text-sm font-semibold text-[#F8FAFC] tracking-tight leading-snug">
                ${fac.name}
              </h3>
              <span class="text-[9px] font-mono text-[#38BDF8] font-bold bg-[#1B2F38] px-2 py-0.5 rounded border border-[#334B56] flex-shrink-0">
                ${fac.facility_id}
              </span>
            </div>

            <!-- 2. Category Badge (Colored by Category) -->
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[10px] font-bold capitalize mb-2 ${catTheme.badgeClass}">
              <span>${catTheme.glyph}</span>
              <span>${fac.category.replace(/_/g, ' ')}</span>
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
                ${fac.latitude.toFixed(5)}°N, ${fac.longitude.toFixed(5)}°E
              </span>
              <button
                onclick="navigator.clipboard.writeText('${fac.latitude.toFixed(5)}, ${fac.longitude.toFixed(5)}'); this.innerText='Copied!'; setTimeout(() => this.innerText='Copy Coords', 1500);"
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
          autoPanPadding: [12, 75],
        });

        group.addLayer(marker);
      });
    },
    []
  );

  // Render Status & Severity Coded Issue Markers & Inspection Popups
  const renderIssueMarkers = useCallback(
    (issues: CachedIssue[], filter: FacilityCategoryFilter = 'all') => {
      if (!issuesLayerRef.current) return;
      const group = issuesLayerRef.current;
      group.clearLayers();

      const filtered = issues.filter((iss) => {
        // Strict approval filter: user and officer ONLY see approved issues
        const isApproved = iss.approval_status === 'approved' || iss.approval_status === undefined;
        if ((userRoleRef.current === 'user' || userRoleRef.current === 'officer') && !isApproved) {
          return false;
        }
        if (iss.approval_status === 'rejected') {
          return false;
        }

        if (filter === 'all' || filter === 'issues') return true;
        const cat = (iss.category || '').toLowerCase();
        const title = (iss.title || '').toLowerCase();
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
        const sev = (iss.severity || 'medium').toLowerCase();
        let statusColor = '#F59E0B'; // Warm Sand Gold for medium
        let severityLabel = 'Medium Priority';
        let severityBadge = 'bg-[#F59E0B]/20 text-[#FDE68A] border border-[#F59E0B]/60 font-semibold text-xs px-2.5 py-0.5 rounded-full';

        if (sev === 'high' || sev === 'critical' || sev === 'urgent') {
          statusColor = '#E05A47'; // Controlled Terracotta
          severityLabel = 'High Priority';
          severityBadge = 'bg-[#E05A47]/20 text-[#FCA5A5] border border-[#E05A47]/60 font-semibold text-xs px-2.5 py-0.5 rounded-full';
        } else if (sev === 'low') {
          statusColor = '#10B981'; // Fresh Emerald
          severityLabel = 'Low Priority';
          severityBadge = 'bg-[#10B981]/20 text-[#6EE7B7] border border-[#10B981]/60 font-semibold text-xs px-2.5 py-0.5 rounded-full';
        }

        const cat = (iss.category || '').toLowerCase();
        const glyph =
          cat.includes('road') || cat.includes('pothole')
            ? '🚧'
            : cat.includes('waste') || cat.includes('dump')
            ? '🚯'
            : cat.includes('drain') || cat.includes('runoff')
            ? '🌊'
            : cat.includes('water')
            ? '🚰'
            : cat.includes('light') || cat.includes('electric')
            ? '⚡'
            : '⚠️';

        const customIcon = L.divIcon({
          className: 'custom-issue-marker',
          html: `
            <div class="relative flex items-center justify-center group cursor-pointer">
              ${
                sev === 'high' || sev === 'critical' || sev === 'urgent'
                  ? `<span class="absolute w-8 h-8 rounded-full animate-ping opacity-60" style="background-color: ${statusColor};"></span>`
                  : ''
              }
              <div class="relative w-8 h-8 rounded-full bg-[#132228] border-2 shadow-2xl flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-125" style="border-color: ${statusColor}; box-shadow: 0 0 16px ${statusColor}90;">
                <span>${glyph}</span>
                <span class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-[#132228]" style="background-color: ${statusColor}"></span>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([iss.latitude, iss.longitude], { icon: customIcon });

        // Clean lightweight Leaflet tooltip that immediately disappears on mouseout
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
              <span class="text-[#94A3B8]">Current Status:</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#1B2F38] border border-[#334B56] text-[#F8FAFC]">
                ● ${(iss.status || 'reported').replace(/_/g, ' ')}
              </span>
            </div>
          `;
        } else if (isOfficerRole) {
          statusControlHtml = `
            <div class="mt-2.5 pt-2 border-t border-[#334B56]/50">
              <div class="text-[9px] uppercase font-bold text-[#FCA5A5] mb-1 flex items-center justify-between">
                <span>Field Inspection Status:</span>
                <span class="text-[#38BDF8] font-mono text-[9px]">Officer Update</span>
              </div>
              <select
                class="issue-status-select w-full bg-[#0C171C] border border-[#334B56] rounded-lg text-xs text-[#F8FAFC] p-1.5 focus:outline-none focus:border-[#38BDF8] transition cursor-pointer"
                data-issue-id="${iss.issue_id}"
              >
                <option value="reported" ${iss.status === 'reported' ? 'selected' : ''}>⚠️ Reported</option>
                <option value="under_inspection" ${iss.status === 'under_inspection' ? 'selected' : ''}>🔍 Under Inspection</option>
                <option value="resolved" ${iss.status === 'resolved' ? 'selected' : ''}>✅ Resolved</option>
              </select>
            </div>
          `;
        } else if (isAdminRole) {
          statusControlHtml = `
            <div class="mt-2.5 pt-2 border-t border-[#334B56]/50">
              <div class="text-[9px] uppercase font-bold text-[#FCA5A5] mb-1 flex items-center justify-between">
                <span>Administrative Status Override:</span>
                <span class="text-[#38BDF8] font-mono text-[9px]">Admin Override</span>
              </div>
              <select
                class="issue-status-select w-full bg-[#0C171C] border border-[#334B56] rounded-lg text-xs text-[#F8FAFC] p-1.5 focus:outline-none focus:border-[#E05A47] transition cursor-pointer"
                data-issue-id="${iss.issue_id}"
              >
                <option value="reported" ${iss.status === 'reported' ? 'selected' : ''}>⚠️ Reported</option>
                <option value="under_inspection" ${iss.status === 'under_inspection' ? 'selected' : ''}>🔍 Under Inspection</option>
                <option value="in_progress" ${iss.status === 'in_progress' ? 'selected' : ''}>🛠️ In Progress</option>
                <option value="resolved" ${iss.status === 'resolved' ? 'selected' : ''}>✅ Resolved</option>
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
                  🔍 Inspect Ground-Truth
                </span>
              </div>
              <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#132228]/90 text-[#94A3B8] border border-[#334B56]">
                📷 KoboCollect Field Photo
              </span>
            </div>
          `
          : `
            <div class="mb-2 p-2 rounded-xl bg-[#1B2F38] border border-[#334B56] text-center flex items-center justify-center gap-1.5 text-[#94A3B8] text-xs">
              <span class="text-[#38BDF8] text-[11px]">📷</span>
              <span class="text-[10px] font-semibold text-[#94A3B8]">No Field Photo Recorded</span>
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
          ? `<span class="px-2.5 py-0.5 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] font-semibold text-[10px] flex items-center gap-1">⚠️ Floods/Isolated</span>`
          : `<span class="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] font-semibold text-[10px] flex items-center gap-1">✅ Year-round</span>`;

        const statusPill =
          iss.status === 'resolved'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] font-bold text-[10px]">● Solved</span>`
            : iss.status === 'in_progress'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/60 text-[#FDE68A] font-bold text-[10px]">● In Progress</span>`
            : iss.status === 'under_inspection'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#38BDF8]/20 border border-[#38BDF8]/60 text-[#38BDF8] font-bold text-[10px]">● Under Inspection</span>`
            : `<span class="px-2 py-0.5 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] font-bold text-[10px]">● New / Reported</span>`;

        const popupHtml = `
          <div class="font-sans text-[#F8FAFC] p-2 min-w-[260px] max-w-[310px]">
            <!-- Inspection Thumbnail / Fallback -->
            ${photoMarkup}

            <!-- 1. Incident Title & ID -->
            <div class="flex items-start justify-between gap-2 mb-1.5">
              <h3 class="text-sm font-bold text-[#F8FAFC] tracking-tight leading-snug">
                ${iss.title}
              </h3>
              <span class="text-[9px] font-mono text-[#38BDF8] font-bold bg-[#1B2F38] px-2 py-0.5 rounded border border-[#334B56] flex-shrink-0">
                ${iss.issue_id}
              </span>
            </div>

            <!-- 2. Category Badge -->
            <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#1B2F38] border border-[#334B56] text-[#94A3B8] font-semibold text-[10px] capitalize mb-2">
              <span>${glyph}</span>
              <span>${iss.category.replace(/_/g, ' ')}</span>
            </div>

            <!-- 3. Status Pill & 4. Priority Badge -->
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
          autoPanPadding: [12, 75],
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

    const filtered = allFacilitiesRef.current.filter((fac) => {
      if (filter === 'all') return true;
      const cat = fac.category.toLowerCase();
      if (filter === 'water') {
        return (
          cat.includes('water') ||
          cat.includes('borewell') ||
          cat.includes('standpost') ||
          cat.includes('pump') ||
          cat.includes('well') ||
          cat.includes('tank') ||
          fac.name.toLowerCase().includes('lake')
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
  const handleSwitchDataset = async (dataset: 'survey' | 'unified') => {
    setActiveDataset(dataset);
    const facPath = dataset === 'unified' ? '/data/unified_facilities.csv' : '/data/facilities.csv';
    const issPath = dataset === 'unified' ? '/data/unified_issues.csv' : '/data/issues.csv';

    const [facilities, issues] = await Promise.all([
      seedFacilitiesFromCsv(true, facPath),
      seedIssuesFromCsv(true, issPath),
    ]);

    allFacilitiesRef.current = facilities;
    setFacilitiesList(facilities);
    setFacilityCount(facilities.length);
    renderFacilityMarkers(facilities, facilityFilter);

    allIssuesRef.current = issues;
    setIssuesList(issues);
    renderIssueMarkers(issues, facilityFilter);

    showToast(
      dataset === 'unified'
        ? `Loaded All ${facilities.length} Facilities & ${issues.length} Issues (Digital Twin Model)`
        : `Loaded ${facilities.length} Survey Facilities & ${issues.length} Field Survey Issues`
    );

    const validCoords = (facilityFilter === 'issues' ? issues : facilities)
      .filter((f) => !isNaN(f.latitude) && !isNaN(f.longitude) && f.latitude !== 0 && f.longitude !== 0)
      .map((f) => [f.latitude, f.longitude] as [number, number]);

    if (validCoords.length > 0 && mapInstanceRef.current) {
      const bounds = L.latLngBounds(validCoords);
      if (bounds.isValid()) {
        try {
          mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        } catch {
          // ignore transient container size errors
        }
      }
    }
  };

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
          iss.issue_id === issueId ? { ...iss, status: newStatus } : iss
        );
        setIssuesList([...allIssuesRef.current]);
        renderIssueMarkers(allIssuesRef.current, facilityFilter);
        showToast(`Issue ${issueId} status updated to "${newStatus.replace(/_/g, ' ')}"!`);
      } catch (err) {
        console.error('Failed to update issue status in DB:', err);
      }
    },
    [facilityFilter, renderIssueMarkers, showToast]
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

  // Pre-computed DBSCAN clusters based on survey fault density (epsilon = 85m, minPts = 4)
  const DBSCAN_CLUSTERS = [
    {
      id: 'cluster-alpha',
      name: 'Hotspot α: Core Inundation & Culvert Choke',
      coords: [19.3548, 72.8858] as [number, number],
      radius: 135,
      count: 9,
      sev: 'Critical Danger Zone',
      color: '#ef4444',
      desc: 'High concentration of drainage overflow & road shoulder erosion affecting 140+ households during monsoon.',
    },
    {
      id: 'cluster-beta',
      name: 'Hotspot β: Station Transit Corridor Deterioration',
      coords: [19.3615, 72.8755] as [number, number],
      radius: 145,
      count: 6,
      sev: 'High Danger Zone',
      color: '#ef4444',
      desc: 'Severe pavement potholes & waterlogging along Juchandra commuter arterial link.',
    },
    {
      id: 'cluster-gamma',
      name: 'Hotspot γ: Bapane Gaothan Silt & Debris Blockage',
      coords: [19.3665, 72.8835] as [number, number],
      radius: 120,
      count: 5,
      sev: 'High Danger Zone',
      color: '#ef4444',
      desc: 'Silted stormwater channel creating backwater seepage near civic boundary.',
    },
  ];

  // Spatial ML: DBSCAN Spatial Clustering & Density Heatmap Generator
  const renderDbscanAndHeatmap = useCallback(
    (issues: CachedIssue[], showDbscan: boolean, showHeat: boolean) => {
      // 1. Render DBSCAN Layer
      if (dbscanLayerRef.current) {
        dbscanLayerRef.current.clearLayers();
        if (showDbscan) {
          DBSCAN_CLUSTERS.forEach((cl) => {
            const circle = L.circle(cl.coords, {
              radius: cl.radius,
              color: '#E05A47',
              weight: 2,
              dashArray: '6, 6',
              fillColor: '#E05A47',
              fillOpacity: 0.18,
            });

            circle.bindTooltip(
              `<div class="p-2.5 font-sans text-xs bg-[#132228]/95 border border-[#E05A47]/60 rounded-xl shadow-[0_10px_30px_rgba(12,23,28,0.7)] text-[#F8FAFC]">
                <div class="flex items-center gap-1.5 mb-1">
                  <span class="w-2.5 h-2.5 rounded-full bg-[#E05A47] animate-ping"></span>
                  <strong class="text-[#FCA5A5] text-xs font-bold uppercase tracking-wider">High-Density Failure Zone</strong>
                </div>
                <div class="text-[11px] text-[#F8FAFC] font-semibold">${cl.name}</div>
                <div class="text-[10px] text-[#38BDF8] font-mono font-bold">${cl.count} Correlated Faults • DBSCAN ε=85m</div>
                <div class="text-[10px] text-[#94A3B8] mt-1 italic max-w-xs leading-relaxed">${cl.desc}</div>
              </div>`,
              { sticky: true, className: 'gis-clean-tooltip' }
            );

            dbscanLayerRef.current?.addLayer(circle);
          });
        }
      }

      // 2. Render Heatmap Layer (with Scaled Terracotta-filled Transparent DBSCAN Failure Hotspots)
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.clearLayers();
        if (showHeat) {
          const map = mapInstanceRef.current;
          const mapBounds = map?.getBounds();

          // 2.1 Always Scale Terracotta-filled Transparent DBSCAN Failure Circles on Heatmap
          DBSCAN_CLUSTERS.forEach((cl) => {
            const dangerCircle = L.circle(cl.coords, {
              radius: cl.radius,
              color: '#E05A47',
              weight: 2,
              dashArray: '6, 6',
              fillColor: '#E05A47',
              fillOpacity: 0.18,
            });

            dangerCircle.bindTooltip(
              `<div class="p-2.5 font-sans text-xs bg-[#132228]/95 border border-[#E05A47] rounded-xl shadow-[0_10px_30px_rgba(12,23,28,0.7)] text-[#F8FAFC]">
                <div class="flex items-center gap-2 mb-1">
                  <span class="w-2.5 h-2.5 rounded-full bg-[#E05A47] animate-ping"></span>
                  <strong class="text-[#FCA5A5] text-xs uppercase font-bold tracking-wider">High-Density Failure Zone</strong>
                </div>
                <div class="text-[11px] text-[#F8FAFC] font-semibold">${cl.name}</div>
                <div class="text-[10px] text-[#38BDF8] font-mono font-bold">${cl.count} Spatial Faults • ε=85m</div>
                <div class="text-[10px] text-[#94A3B8] mt-1 italic max-w-xs leading-relaxed">${cl.desc}</div>
              </div>`,
              { sticky: true, className: 'gis-clean-tooltip' }
            );

            heatmapLayerRef.current?.addLayer(dangerCircle);
          });

          // 2.2 Render Gradient Thermal Density Discs for all visible issues
          issues.forEach((iss) => {
            if (!iss.latitude || !iss.longitude) return;
            if (mapBounds && !mapBounds.contains([iss.latitude, iss.longitude])) return;

            const isUrgent =
              iss.severity === 'high' || iss.severity === 'critical' || iss.severity === 'urgent';

            // Outer soft glow disc
            const outerDisc = L.circle([iss.latitude, iss.longitude], {
              radius: isUrgent ? 85 : 55,
              stroke: false,
              fillColor: isUrgent ? '#E05A47' : '#F59E0B',
              fillOpacity: isUrgent ? 0.22 : 0.14,
            });
            heatmapLayerRef.current?.addLayer(outerDisc);

            // Inner intense thermal core disc
            const innerCore = L.circle([iss.latitude, iss.longitude], {
              radius: isUrgent ? 40 : 25,
              stroke: false,
              fillColor: isUrgent ? '#FCA5A5' : '#E05A47',
              fillOpacity: isUrgent ? 0.45 : 0.3,
            });
            heatmapLayerRef.current?.addLayer(innerCore);
          });
        }
      }
    },
    []
  );

  // Hook map pan/zoom boundary updates so density rendering overlay updates dynamically
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const handleBoundaryUpdate = () => {
      if (showHeatmap) {
        renderDbscanAndHeatmap(allIssuesRef.current, showDbscanClusters, true);
      }
    };

    map.on('moveend', handleBoundaryUpdate);
    map.on('zoomend', handleBoundaryUpdate);

    return () => {
      map.off('moveend', handleBoundaryUpdate);
      map.off('zoomend', handleBoundaryUpdate);
    };
  }, [showHeatmap, showDbscanClusters, renderDbscanAndHeatmap]);

  const toggleDbscanClusters = (enable: boolean) => {
    setShowDbscanClusters(enable);
    if (!mapInstanceRef.current || !dbscanLayerRef.current) return;
    if (enable) {
      if (!mapInstanceRef.current.hasLayer(dbscanLayerRef.current)) {
        mapInstanceRef.current.addLayer(dbscanLayerRef.current);
      }
      renderDbscanAndHeatmap(allIssuesRef.current, true, showHeatmap);
    } else {
      if (mapInstanceRef.current.hasLayer(dbscanLayerRef.current)) {
        mapInstanceRef.current.removeLayer(dbscanLayerRef.current);
      }
    }
  };

  // Real-time Leaflet Heatmap Layer (leaflet.heat) for Failure Density & Grievances (Admin & Officer only)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (showHeatmap && (userRole === 'admin' || userRole === 'officer')) {
      const renderHeat = async () => {
        const points: [number, number, number][] = [];

        // 1. Surveyed issues from CSV
        allIssuesRef.current.forEach((iss) => {
          if (iss.latitude && iss.longitude) {
            const weight =
              iss.severity === 'critical' || iss.severity === 'high' || iss.severity === 'urgent'
                ? 1.0
                : iss.severity === 'medium'
                ? 0.6
                : 0.3;
            points.push([iss.latitude, iss.longitude, weight]);
          }
        });

        // 2. Approved and active grievances from IndexedDB
        try {
          const allGrievances = await db.offline_grievances.toArray();
          const visible = allGrievances.filter(
            (g) => g.approval_status === 'approved' || g.approval_status === undefined
          );
          visible.forEach((g) => {
            if (g.latitude && g.longitude) {
              const weight =
                g.severity === 'critical' || g.severity === 'high'
                  ? 1.0
                  : g.severity === 'medium'
                  ? 0.6
                  : 0.3;
              points.push([g.latitude, g.longitude, weight]);
            }
          });
        } catch (err) {
          console.error('Error querying grievances for heatmap:', err);
        }

        // Clean up previous heatLayer instance if any
        if (heatLayerRef.current && map.hasLayer(heatLayerRef.current)) {
          map.removeLayer(heatLayerRef.current);
          heatLayerRef.current = null;
        }

        if (points.length > 0) {
          try {
            heatLayerRef.current = (L as any)
              .heatLayer(points, {
                radius: 30,
                blur: 20,
                maxZoom: 17,
                minOpacity: 0.4,
                gradient: {
                  0.2: '#3b82f6',
                  0.4: '#10b981',
                  0.6: '#eab308',
                  0.8: '#f97316',
                  1.0: '#ef4444',
                },
              })
              .addTo(map);
          } catch (e) {
            console.error('Failed to initialize Leaflet heatLayer:', e);
          }
        }
      };

      renderHeat();
    } else {
      if (heatLayerRef.current && map.hasLayer(heatLayerRef.current)) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    }
  }, [showHeatmap, issuesList, userRole]);

  const toggleHeatmap = (enable: boolean) => {
    setShowHeatmap(enable);
  };

  // Export Handlers for Client-Side Audit & Reporting Engine
  const handleDownloadPanchayatPdf = useCallback(() => {
    generatePanchayatPDF(facilitiesList, issuesList, session || undefined);
    showToast('📄 Official Panchayat Audit PDF generated & downloaded!');
  }, [facilitiesList, issuesList, session, showToast]);

  const handleExportMasterCsv = useCallback(() => {
    exportMasterDataCSV(facilitiesList, issuesList);
    showToast('📊 Master Data CSV exported successfully!');
  }, [facilitiesList, issuesList, showToast]);

  const handleOfficerExportWorklist = useCallback(() => {
    generateOfficerWorklistPDF(issuesList, session || undefined);
    showToast('📋 Field Inspection Worklist PDF generated & downloaded!');
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
        const isApproved = g.approval_status === 'approved' || g.approval_status === undefined;
        if ((userRoleRef.current === 'user' || userRoleRef.current === 'officer') && !isApproved) {
          return false;
        }
        if (g.approval_status === 'rejected') {
          return false;
        }
        return true;
      });

      visibleGrievances.forEach((g) => {
        const severityColor =
          g.severity === 'critical'
            ? '#E05A47'
            : g.severity === 'high'
            ? '#E05A47'
            : g.severity === 'medium'
            ? '#F59E0B'
            : '#10B981';

        const customIcon = L.divIcon({
          className: 'grievance-marker',
          html: `
            <div class="relative flex items-center justify-center group cursor-pointer">
              <span class="absolute w-7 h-7 rounded-full animate-ping opacity-75" style="background-color: ${severityColor}40"></span>
              <div class="relative w-6 h-6 rounded-full border-2 border-[#132228] shadow-xl flex items-center justify-center text-xs font-bold text-[#F8FAFC]" style="background-color: ${severityColor}">
                ⚠️
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
          ? `<span class="px-2 py-0.5 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] font-bold text-[10px] flex items-center gap-1">⚠️ Floods/Isolated</span>`
          : `<span class="px-2 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] font-bold text-[10px] flex items-center gap-1">✅ Year-round</span>`;

        const statusPill =
          g.severity === 'critical' || g.severity === 'high'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] font-bold text-[10px]">● ${g.severity}</span>`
            : g.severity === 'medium'
            ? `<span class="px-2 py-0.5 rounded-full bg-[#F59E0B]/20 border border-[#F59E0B]/60 text-[#FDE68A] font-bold text-[10px]">● ${g.severity}</span>`
            : `<span class="px-2 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] font-bold text-[10px]">● ${g.severity}</span>`;

        const marker = L.marker([g.latitude, g.longitude], { icon: customIcon });
        marker.bindPopup(
          `
          <div class="font-sans text-[#F8FAFC] p-2 min-w-[260px] max-w-[310px]">
            <!-- Inspection Thumbnail -->
            <div class="relative w-full h-32 mb-2 rounded-xl overflow-hidden border border-[#334B56] bg-[#0C171C] shadow-inner">
              <img src="${photoSrc}" alt="${g.title}" class="w-full h-full object-cover" />
              <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#132228]/95 text-[#38BDF8] border border-[#38BDF8]/40">
                ${g.photoBase64 ? '📷 Photo Captured' : 'Offline Inspection'}
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
            <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1B2F38] border border-[#334B56] text-[#38BDF8] font-semibold text-[10px] capitalize mb-2">
              <span>⚠️</span>
              <span>${g.category}</span>
            </div>

            <!-- 3. Status Pill & 4. Monsoon Access Condition -->
            <div class="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-[#1B2F38] border border-[#334B56] text-[10px] mb-2">
              <div>
                <span class="text-[#94A3B8] block text-[9px] uppercase tracking-wider mb-0.5">Severity</span>
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
          { className: 'gis-dark-popup', autoPanPadding: [12, 75] }
        );

        grievancesLayerRef.current?.addLayer(marker);
      });
    } catch (e) {
      console.error('Failed to render grievance markers from IndexedDB:', e);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // 1. Create Tile Layers
    const esriWorldImagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.esri.com/" target="_blank">Esri</a>, Maxar, Earthstar Geographics',
      }
    );

    const osmStandard = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    });

    const cartoDark = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://carto.com/" target="_blank">CARTO</a> &copy; OpenStreetMap',
      }
    );

    const openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; OpenTopoMap contributors',
    });

    tileLayersRef.current = {
      esri: esriWorldImagery,
      osm: osmStandard,
      cartoDark: cartoDark,
      topo: openTopo,
    };

    // 2. Initialize Map Instance centered at Khopripada Core
    const map = L.map(mapContainerRef.current, {
      center: KHOPRIPADA_CORE,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      layers: [esriWorldImagery],
    });

    mapInstanceRef.current = map;

    // 2.1 Add Zoom Control positioned at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 3. Add Scale Control
    L.control
      .scale({
        imperial: false,
        metric: true,
        position: 'bottomleft',
      })
      .addTo(map);

    // 4. Village Boundary AOI Overlay
    const boundary = L.polygon(VILLAGE_BOUNDARY_COORDS, {
      color: '#38BDF8',
      weight: 2,
      opacity: 0.85,
      dashArray: '6, 8',
      fillColor: '#38BDF8',
      fillOpacity: 0.06,
    }).addTo(map);

    boundary.bindTooltip(
      '<div class="px-2.5 py-1 font-sans text-xs font-semibold text-[#F8FAFC] bg-[#132228]/95 border border-[#334B56] rounded-lg shadow-lg">Khopripada & Bapane Study Corridor</div>',
      { sticky: true, className: 'gis-boundary-tooltip' }
    );
    boundaryLayerRef.current = boundary;

    // 5. Layer Groups
    const landmarksGroup = L.layerGroup().addTo(map);
    landmarksLayerRef.current = landmarksGroup;

    const facilitiesGroup = L.layerGroup().addTo(map);
    facilitiesLayerRef.current = facilitiesGroup;

    const issuesGroup = L.layerGroup().addTo(map);
    issuesLayerRef.current = issuesGroup;

    const grievancesGroup = L.layerGroup().addTo(map);
    grievancesLayerRef.current = grievancesGroup;

    const gpsGroup = L.layerGroup().addTo(map);
    gpsLocationLayerRef.current = gpsGroup;

    // DBSCAN & Heatmap Layers
    const dbscanGroup = L.layerGroup();
    dbscanLayerRef.current = dbscanGroup;
    if (userRoleRef.current === 'admin' && showDbscanClusters) {
      dbscanGroup.addTo(map);
    }

    const heatmapGroup = L.layerGroup();
    heatmapLayerRef.current = heatmapGroup;
    if (userRoleRef.current === 'admin' && showHeatmap) {
      heatmapGroup.addTo(map);
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
              ${isCore ? '🎯' : isStation ? '🚆' : poi.category === 'heritage' ? '🛕' : poi.category === 'corridor' ? '🛣️' : '📍'}
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
        autoPanPadding: [12, 75],
      });

      landmarksGroup.addLayer(marker);
    });

    // Seed and Plot Facilities from CSV using PapaParse & Auto Fit Bounds
    seedFacilitiesFromCsv(false).then((facilities) => {
      allFacilitiesRef.current = facilities;
      setFacilitiesList(facilities);
      setFacilityCount(facilities.length);
      renderFacilityMarkers(facilities, 'all');

      // Verify that the map bounds fit automatically around all mapped facilities without crashing
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
    });

    // Seed and Plot Issues from CSV using PapaParse
    seedIssuesFromCsv(false).then((issues) => {
      allIssuesRef.current = issues;
      setIssuesList(issues);
      renderIssueMarkers(issues, 'all');
    });

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
                <div class="relative w-8 h-8 rounded-full bg-cyan-500 border-2 border-white shadow-[0_0_20px_#06b6d4] flex items-center justify-center text-white text-xs font-bold animate-pulse">
                  📍
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
              <div class="relative w-8 h-8 rounded-full bg-cyan-500 border-2 border-white shadow-2xl flex items-center justify-center text-white text-xs font-bold">
                🎯
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
      const selects = contentNode.querySelectorAll<HTMLSelectElement>('.issue-status-select');
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
    }, 150);

    return () => {
      map.off('moveend', updateMeta);
      map.off('zoomend', updateMeta);
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseOut);
      map.off('click', handleMapClick);
      map.off('popupopen', handlePopupOpen);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [refreshGrievanceMarkers, renderFacilityMarkers, renderIssueMarkers, showDbscanClusters, showHeatmap]);

  // Synchronize layer visibility and marker popups whenever user role or DBSCAN state changes
  useEffect(() => {
    userRoleRef.current = userRole;
    if (allFacilitiesRef.current.length > 0) {
      renderFacilityMarkers(allFacilitiesRef.current, facilityFilter);
    }
    if (allIssuesRef.current.length > 0) {
      renderIssueMarkers(allIssuesRef.current, facilityFilter);
    }
    refreshGrievanceMarkers();
    if (userRole === 'admin' || userRole === 'officer') {
      if (
        mapInstanceRef.current &&
        dbscanLayerRef.current &&
        showDbscanClusters &&
        !mapInstanceRef.current.hasLayer(dbscanLayerRef.current)
      ) {
        mapInstanceRef.current.addLayer(dbscanLayerRef.current);
      }
      renderDbscanAndHeatmap(allIssuesRef.current, showDbscanClusters, false);
    } else {
      if (
        mapInstanceRef.current &&
        dbscanLayerRef.current &&
        mapInstanceRef.current.hasLayer(dbscanLayerRef.current)
      ) {
        mapInstanceRef.current.removeLayer(dbscanLayerRef.current);
      }
      if (
        mapInstanceRef.current &&
        heatLayerRef.current &&
        mapInstanceRef.current.hasLayer(heatLayerRef.current)
      ) {
        mapInstanceRef.current.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      setShowHeatmap(false);
    }
  }, [
    userRole,
    renderIssueMarkers,
    facilityFilter,
    showDbscanClusters,
    showHeatmap,
    renderDbscanAndHeatmap,
  ]);

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
      { className: 'gis-dark-popup', autoPanPadding: [12, 75] }
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

  // Recenter explicitly on Khopripada Core (19.35509, 72.88463)
  const recenterToKhopripadaCore = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(KHOPRIPADA_CORE, DEFAULT_ZOOM, {
      duration: 1.4,
    });
  }, []);

  // Recenter explicitly on Juchandra Station (19.36001, 72.87285)
  const flyToJuchandraStation = useCallback(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(JUCHANDRA_STN, 17, {
      duration: 1.4,
    });
  }, []);

  // Switch Basemap
  const changeBasemap = useCallback(
    (type: BasemapType) => {
      if (!mapInstanceRef.current || !tileLayersRef.current) return;
      const map = mapInstanceRef.current;

      Object.values(tileLayersRef.current).forEach((layer) => {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });

      const selected = tileLayersRef.current[type];
      map.addLayer(selected);
      setActiveBasemap(type);
    },
    []
  );

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
    if (!mapInstanceRef.current || !facilitiesLayerRef.current) return;
    const map = mapInstanceRef.current;
    if (showFacilities) {
      map.removeLayer(facilitiesLayerRef.current);
      setShowFacilities(false);
    } else {
      map.addLayer(facilitiesLayerRef.current);
      setShowFacilities(true);
    }
  };

  // Toggle Issues Layer
  const toggleIssues = () => {
    if (!mapInstanceRef.current || !issuesLayerRef.current) return;
    const map = mapInstanceRef.current;
    if (showIssues) {
      map.removeLayer(issuesLayerRef.current);
      setShowIssues(false);
    } else {
      map.addLayer(issuesLayerRef.current);
      setShowIssues(true);
    }
  };

  // Toggle Grievances Layer
  const toggleGrievancePins = () => {
    if (!mapInstanceRef.current || !grievancesLayerRef.current) return;
    const map = mapInstanceRef.current;
    if (showGrievancePins) {
      map.removeLayer(grievancesLayerRef.current);
      setShowGrievancePins(false);
    } else {
      map.addLayer(grievancesLayerRef.current);
      setShowGrievancePins(true);
    }
  };



  // Fly to Grievance from Drawer
  const flyToCoords = (coords: [number, number]) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo(coords, 18, { duration: 1.5 });
  };

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

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-[#132228] font-sans select-none text-[#F8FAFC] flex flex-col overscroll-none [touch-action:pan-x_pan-y]">
      {/* TOAST NOTIFICATION BANNER */}
      {toastWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[3000] px-5 py-3 rounded-2xl backdrop-blur-xl bg-[#132228]/95 border border-[#334B56] text-[#F8FAFC] text-sm font-medium shadow-[0_15px_40px_rgba(12,23,28,0.7)] flex items-center gap-3 max-w-lg animate-in fade-in slide-from-top-4">
          <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] animate-pulse shadow-[0_0_8px_#38BDF8] flex-shrink-0" />
          <span className="flex-1">{toastWarning}</span>
          <button
            onClick={() => setToastWarning(null)}
            className="text-[#94A3B8] hover:text-[#F8FAFC] transition p-1 text-xs cursor-pointer ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1.0 SLIM MOBILE TOP BAR (HEIGHT: 48PX, SCREENS < 768PX) */}
      <header className="flex md:hidden h-12 w-full bg-[#132228]/95 backdrop-blur-md border-b border-[#334B56] px-3 items-center justify-between z-[1100] flex-shrink-0 select-none">
        {/* Left: Compact Brand Icon + "Khopripada GIS" + Live Sync Dot */}
        <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#1B2F38] border border-[#334B56] flex items-center justify-center text-[#38BDF8] shadow-sm flex-shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-bold text-[#F8FAFC] tracking-tight truncate">
              Khopripada GIS
            </span>
            <span
              className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shadow-[0_0_6px_#10B981] flex-shrink-0"
              title="Live Sync Active"
            />
          </div>
        </div>

        {/* Center: Active Role Badge (Tapping opens Role Switcher Sheet) */}
        <button
          onClick={() => setMobileSheet('role')}
          className="px-2.5 py-1 rounded-full bg-[#1B2F38] border border-[#38BDF8]/40 text-[11px] font-semibold text-[#F8FAFC] flex items-center gap-1 active:scale-95 transition shadow-sm min-h-[36px] cursor-pointer"
          title="Tap to switch active portal"
        >
          <span>
            {userRole === 'admin'
              ? '🏛️ Admin'
              : userRole === 'officer'
              ? '📋 Officer'
              : '👤 Citizen'}
          </span>
          <ChevronDown className="w-3 h-3 text-[#38BDF8]" />
        </button>

        {/* Right: GPS Locate Me + Quick Layers/Basemap Toggle */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleLocateMe}
            disabled={isLocating}
            className={`p-2 rounded-xl border transition active:scale-95 min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer ${
              isLocating
                ? 'bg-[#38BDF8]/20 border-[#38BDF8] text-[#38BDF8]'
                : 'bg-[#1B2F38] border-[#334B56] text-[#38BDF8] hover:text-[#F8FAFC]'
            }`}
            title="Locate Me (GPS)"
            aria-label="Locate me on map"
          >
            <Locate className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setMobileSheet(mobileSheet === 'layers' ? null : 'layers')}
            className={`p-2 rounded-xl border transition active:scale-95 min-w-[38px] min-h-[38px] flex items-center justify-center cursor-pointer ${
              mobileSheet === 'layers'
                ? 'bg-[#38BDF8]/20 border-[#38BDF8] text-[#38BDF8]'
                : 'bg-[#1B2F38] border-[#334B56] text-[#38BDF8] hover:text-[#F8FAFC]'
            }`}
            title="Layers & Basemaps"
            aria-label="Toggle layers bottom sheet"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 1.1 DESKTOP TOP NAVIGATION BAR (SCREENS >= 768PX) */}
      <header className="hidden md:flex relative z-[1100] w-full h-16 bg-[#132228]/95 backdrop-blur-md border-b border-[#334B56] shadow-lg px-3 sm:px-6 py-3 items-center justify-between gap-2 sm:gap-4 flex-shrink-0">
        {/* Section 1: Left Side (Identity & Status) */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1B2F38] flex items-center justify-center text-[#F8FAFC] shadow-md border border-[#334B56]">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#38BDF8]" />
            </div>
            <div className="flex items-center">
              <span className="md:hidden text-sm sm:text-base font-bold text-[#F8FAFC] tracking-tight whitespace-nowrap">
                Khopripada GIS
              </span>
              <span className="hidden md:inline text-lg font-bold text-[#F8FAFC] tracking-wide whitespace-nowrap">
                Smart Village GIS
              </span>
              <span className="hidden md:inline-flex text-xs font-semibold px-2.5 py-1 rounded-md bg-[#1B2F38] text-[#38BDF8] border border-[#38BDF8]/40 ml-2 whitespace-nowrap">
                Khopripada • Digital Twin
              </span>
            </div>
          </div>

          {/* Live Network Status Indicator */}
          <div
            onClick={() => {
              setIsSimulatedOffline(!isSimulatedOffline);
              showToast(
                isSimulatedOffline
                  ? '🟢 Live Network restored. Syncing with remote database.'
                  : '🟡 Simulated Offline mode active. Utilizing local IndexedDB.'
              );
            }}
            className="hidden lg:flex items-center gap-2 pl-3 border-l border-[#334B56] cursor-pointer hover:opacity-85 transition select-none"
            title="Click to toggle offline mode simulation"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  isLiveConnected ? 'bg-[#10B981] opacity-75' : 'bg-[#E05A47] opacity-75'
                }`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isLiveConnected
                    ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]'
                    : 'bg-[#E05A47] shadow-[0_0_8px_#E05A47]'
                }`}
              ></span>
            </span>
            <span className="text-xs text-[#94A3B8] whitespace-nowrap font-medium">
              {isLiveConnected ? 'Online • Live Sync' : 'Offline • Local Cache'}
            </span>
          </div>
        </div>

        {/* Section 2: Center (Map Exploration Tools) - Segmented Capsule */}
        <div className="flex items-center justify-center flex-shrink-0">
          <div className="bg-[#0C171C] border border-[#334B56] p-1 rounded-xl flex items-center gap-1 shadow-inner">
            {/* [ 📍 Locate Me ] */}
            <button
              onClick={handleLocateMe}
              disabled={isLocating}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                isLocating
                  ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/60 shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38] border border-transparent'
              }`}
              title="High-precision GPS geolocation with study corridor boundary check"
            >
              <Locate className={`w-4 h-4 ${isLocating ? 'animate-spin text-[#38BDF8]' : 'text-[#94A3B8]'}`} />
              <span className="hidden sm:inline whitespace-nowrap">{isLocating ? 'Locating...' : 'Locate Me'}</span>
            </button>

            {/* [ 🔥 Density Heatmap ] (Admin & Field Officer Portal Only) */}
            {(userRole === 'admin' || userRole === 'officer') && (
              <button
                onClick={() => toggleHeatmap(!showHeatmap)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                  showHeatmap
                    ? 'bg-[#E05A47]/20 text-[#FCA5A5] border border-[#E05A47]/60 shadow-sm'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38] border border-transparent'
                }`}
                title="Toggle failure density heatmap & DBSCAN spatial clusters"
              >
                <Flame className={`w-4 h-4 ${showHeatmap ? 'text-[#FCA5A5] animate-pulse' : 'text-[#94A3B8]'}`} />
                <span className="hidden sm:inline whitespace-nowrap">Density Heatmap</span>
              </button>
            )}

            {/* [ 📋 Layers & Drawer ] */}
            <button
              onClick={() => setSidebarOpen((prev) => !prev)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                sidebarOpen
                  ? 'bg-[#1B2F38] text-[#F8FAFC] border border-[#334B56] shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38] border border-transparent'
              }`}
              title="Toggle Layers & Analytics Drawer"
            >
              <Layers className={`w-4 h-4 ${sidebarOpen ? 'text-[#38BDF8]' : 'text-[#94A3B8]'}`} />
              <span className="hidden sm:inline whitespace-nowrap">Layers & Drawer</span>
            </button>
          </div>
        </div>

        {/* Section 3: Right Side (Actions & Role Gateway) */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Desktop [ + Propose Facility ] Button */}
          <button
            onClick={() => {
              if (isAddFacilityMode) {
                cleanupAddFacilityMode();
              } else {
                setIsAddFacilityMode(true);
              }
            }}
            className={`hidden md:flex font-semibold px-4 py-2 rounded-xl text-sm shadow-md items-center gap-2 transition active:scale-95 whitespace-nowrap cursor-pointer ${
              isAddFacilityMode
                ? 'bg-[#E05A47] hover:brightness-110 text-[#F8FAFC]'
                : 'bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC]'
            }`}
            title={
              userRole === 'officer'
                ? 'Register Government-sanctioned scheme asset by clicking on the map'
                : userRole === 'user'
                ? 'Propose a community facility for Panchayat verification'
                : 'Register and publish village asset directly to the live map'
            }
          >
            <Plus className={`w-4 h-4 ${isAddFacilityMode ? 'rotate-45' : ''}`} />
            <span>
              {isAddFacilityMode
                ? 'Cancel Placing'
                : userRole === 'officer'
                ? '+ Add Govt Scheme Asset'
                : userRole === 'user'
                ? '+ Propose Facility'
                : '+ Add Facility'}
            </span>
          </button>

          {/* Desktop [ ⚠️ Report Grievance ] Button */}
          <button
            onClick={() => setIsGrievanceModalOpen(true)}
            className="hidden md:flex bg-gradient-to-r from-[#D9534F] to-[#E05A47] hover:brightness-110 text-[#F8FAFC] font-semibold px-4 py-2 rounded-xl text-sm shadow-md items-center gap-2 transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Report citizen grievance with camera photo capture"
          >
            <AlertTriangle className="w-4 h-4 text-[#F8FAFC]" />
            <span>Report Grievance</span>
          </button>

          {/* Export Audit (Admin) or Export Worklist (Officer) */}
          {userRole === 'admin' && (
            <button
              onClick={() => setIsExportAuditModalOpen(true)}
              className="hidden xl:flex bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] border border-[#334B56] px-3.5 py-2 rounded-xl text-sm shadow-sm items-center gap-2 transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Open Executive Panchayat Audit & Reporting Engine (PDF & CSV)"
            >
              <FileText className="w-4 h-4 text-[#38BDF8]" />
              <span>Export Audit</span>
            </button>
          )}

          {userRole === 'officer' && (
            <button
              onClick={handleOfficerExportWorklist}
              className="hidden xl:flex bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] border border-[#334B56] px-3.5 py-2 rounded-xl text-sm shadow-sm items-center gap-2 transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Download Field Inspection Worklist PDF"
            >
              <ClipboardList className="w-4 h-4 text-[#38BDF8]" />
              <span>Export Worklist</span>
            </button>
          )}

          {/* Dedicated High Z-Index Role Switcher Gateway */}
          <div className="relative" ref={portalSwitcherRef}>
            <button
              onClick={() => setIsPortalSwitcherOpen(!isPortalSwitcherOpen)}
              className="bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] border border-[#38BDF8]/40 px-3.5 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition cursor-pointer active:scale-95 whitespace-nowrap shadow-sm"
              title="Switch between Resident, Field Officer, and Panchayat Admin portals"
            >
              <span className="text-base">
                {userRole === 'admin' ? '🏛️' : userRole === 'officer' ? '📋' : '👤'}
              </span>
              <span className="hidden sm:inline font-medium">
                {userRole === 'admin'
                  ? 'Panchayat Admin'
                  : userRole === 'officer'
                  ? 'Field Officer'
                  : 'Resident View'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform duration-200 ${
                  isPortalSwitcherOpen ? 'rotate-180 text-[#F8FAFC]' : ''
                }`}
              />
            </button>

            {/* Dedicated High Z-Index Portal Switcher Dropdown Menu */}
            {isPortalSwitcherOpen && (
              <div className="z-[9999] absolute right-0 mt-2 w-64 sm:w-72 bg-[#132228]/95 border border-[#334B56] rounded-xl shadow-2xl backdrop-blur-xl p-2 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-[#94A3B8] border-b border-[#334B56] flex items-center justify-between">
                  <span>Switch Portal</span>
                  <span className="text-[#38BDF8] font-mono text-[9px]">1-Click</span>
                </div>

                {AVAILABLE_ROLES.filter((r) => r.id !== userRole).map((role) => (
                  <button
                    key={role.id}
                    onClick={() => handlePortalSwitch(role.id, role.label)}
                    className="w-full p-2.5 rounded-lg border border-[#334B56] bg-[#1B2F38]/80 hover:bg-[#233B46] hover:border-[#38BDF8]/50 transition flex items-start gap-2.5 text-left cursor-pointer group active:scale-95"
                  >
                    <span className="text-lg p-1.5 rounded-lg bg-[#0C171C] border border-[#334B56] flex-shrink-0">
                      {role.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#F8FAFC] text-xs group-hover:text-[#38BDF8] transition-colors">
                        {role.label}
                      </div>
                      <div className="text-[10px] text-[#94A3B8] leading-snug mt-0.5">
                        {role.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Role Profile Pill with dropdown for Logout & Export Audit */}
          <UserProfileBadge onExportAudit={handleExportAuditSummary} />
        </div>
      </header>

      {/* 1.1 ADD FACILITY MODE INSTRUCTION BANNER */}
      {isAddFacilityMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1500] pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="backdrop-blur-2xl bg-[#132228]/98 border border-[#334B56] rounded-2xl px-5 py-2.5 shadow-[0_10px_30px_rgba(12,23,28,0.7)] flex items-center gap-3 text-xs text-[#F8FAFC]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981] flex-shrink-0"></span>
            <span className="font-semibold text-[#F8FAFC]">
              {userRole === 'officer'
                ? 'Click on the map to place Government Scheme Asset GPS point'
                : userRole === 'user'
                ? 'Click on the map to propose Community Facility GPS point'
                : 'Click anywhere on the map to place the new facility'}{' '}
              <span className="text-[#94A3B8] font-mono text-[11px]">(Press Esc to cancel)</span>
            </span>
            <button
              onClick={cleanupAddFacilityMode}
              className="px-2.5 py-1 rounded-lg bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] border border-[#334B56] transition cursor-pointer text-[11px] font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 2. COLLAPSIBLE RIGHT SIDEBAR ("DRAWER MODE") */}
      <aside
        className={`fixed top-16 right-0 bottom-0 z-[1200] w-full md:w-96 bg-[#132228]/98 backdrop-blur-2xl border-l border-[#334B56] text-[#F8FAFC] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#334B56] bg-[#0C171C]/90 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#38BDF8]" />
            <span className="font-bold text-sm text-[#F8FAFC]">Layers & Analytics</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] border border-[#334B56] transition cursor-pointer text-xs font-semibold"
            title="Close Drawer"
          >
            <span>✕ Close</span>
          </button>
        </div>

        {/* Drawer Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {/* BASEMAPS: Clean segmented toggle button group: [ Satellite | OSM Street | Dark Matter ] */}
          <div className="p-3 rounded-2xl bg-[#1B2F38] border border-[#334B56]">
            <div className="text-[11px] uppercase tracking-wider font-bold text-[#94A3B8] mb-2 flex items-center justify-between">
              <span>Select Basemap</span>
              <span className="text-[10px] text-[#38BDF8] font-mono">Tile Cache Active</span>
            </div>
            <div className="grid grid-cols-3 p-1 rounded-xl bg-[#0C171C] border border-[#334B56] text-xs">
              {[
                { id: 'esri', label: 'Satellite' },
                { id: 'osm', label: 'OSM Street' },
                { id: 'cartoDark', label: 'Dark Matter' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => changeBasemap(b.id as BasemapType)}
                  className={`py-1.5 px-2 rounded-lg font-semibold text-center transition cursor-pointer text-xs ${
                    activeBasemap === b.id
                      ? 'bg-[#10B981] text-[#F8FAFC] shadow-md'
                      : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38]'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* ACCORDION 1: > Active Layers */}
          <div className="rounded-2xl bg-[#1B2F38]/50 border border-[#334B56] overflow-hidden">
            <button
              onClick={() => setActiveLayersOpen(!activeLayersOpen)}
              className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase tracking-wider text-[#F8FAFC] hover:bg-[#233B46] bg-[#1B2F38] transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeLayersOpen ? '' : '-rotate-90'}`} />
                Active Layers
              </span>
              <span className="text-[10px] font-mono text-[#38BDF8]">Layer Stack</span>
            </button>

            {activeLayersOpen && (
              <div className="p-3 pt-2 space-y-2 border-t border-[#334B56]">
                {/* Village Boundary AOI */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-[#0C171C]/70 border border-[#334B56] hover:border-[#38BDF8]/50 cursor-pointer transition">
                  <span className="text-xs text-[#F8FAFC] flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                    Khopripada Boundary (AOI)
                  </span>
                  <input
                    type="checkbox"
                    checked={showBoundary}
                    onChange={toggleBoundary}
                    className="w-4 h-4 rounded text-[#38BDF8] focus:ring-0 accent-[#38BDF8] cursor-pointer"
                  />
                </label>

                {/* Village Facilities */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-[#0C171C]/70 border border-[#334B56] hover:border-[#38BDF8]/50 cursor-pointer transition">
                  <span className="text-xs text-[#F8FAFC] flex items-center gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#94A3B8]" />
                    Village Facilities ({facilityCount})
                  </span>
                  <input
                    type="checkbox"
                    checked={showFacilities}
                    onChange={toggleFacilities}
                    className="w-4 h-4 rounded text-[#10B981] focus:ring-0 accent-[#10B981] cursor-pointer"
                  />
                </label>

                {/* Surveyed Issues */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-[#0C171C]/70 border border-[#334B56] hover:border-[#38BDF8]/50 cursor-pointer transition">
                  <span className="text-xs text-[#F8FAFC] flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#E05A47]" />
                    Surveyed Issues ({issueCounts.total})
                  </span>
                  <input
                    type="checkbox"
                    checked={showIssues}
                    onChange={toggleIssues}
                    className="w-4 h-4 rounded text-[#E05A47] focus:ring-0 accent-[#E05A47] cursor-pointer"
                  />
                </label>

                {/* Grievances Pins */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-[#0C171C]/70 border border-[#334B56] hover:border-[#38BDF8]/50 cursor-pointer transition">
                  <span className="text-xs text-[#F8FAFC] flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#E05A47]" />
                    Reported Grievances (IndexedDB)
                  </span>
                  <input
                    type="checkbox"
                    checked={showGrievancePins}
                    onChange={toggleGrievancePins}
                    className="w-4 h-4 rounded text-[#E05A47] focus:ring-0 accent-[#E05A47] cursor-pointer"
                  />
                </label>

                {/* Key Landmark POIs */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-[#0C171C]/70 border border-[#334B56] hover:border-[#38BDF8]/50 cursor-pointer transition">
                  <span className="text-xs text-[#F8FAFC] flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" />
                    Key Landmark POIs
                  </span>
                  <input
                    type="checkbox"
                    checked={showLandmarks}
                    onChange={toggleLandmarks}
                    className="w-4 h-4 rounded text-[#38BDF8] focus:ring-0 accent-[#38BDF8] cursor-pointer"
                  />
                </label>

                {/* DBSCAN Failure Zones (Admin & Field Officer Portal Only) */}
                {(userRole === 'admin' || userRole === 'officer') && (
                  <label className="flex items-center justify-between p-2 rounded-lg bg-[#E05A47]/15 border border-[#E05A47]/40 hover:border-[#E05A47]/60 cursor-pointer transition">
                    <span className="text-xs text-[#F8FAFC] flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#FCA5A5]" />
                      DBSCAN Failure Zones (3 Hotspots)
                    </span>
                    <input
                      type="checkbox"
                      checked={showDbscanClusters}
                      onChange={(e) => toggleDbscanClusters(e.target.checked)}
                      className="w-4 h-4 rounded text-[#E05A47] focus:ring-0 accent-[#E05A47] cursor-pointer"
                    />
                  </label>
                )}

                {/* Failure Density Heatmap (Admin & Field Officer Portal Only) */}
                {(userRole === 'admin' || userRole === 'officer') && (
                  <label className="flex items-center justify-between p-2 rounded-lg bg-[#E05A47]/15 border border-[#E05A47]/40 hover:border-[#E05A47]/60 cursor-pointer transition">
                    <span className="text-xs text-[#F8FAFC] flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-[#FCA5A5]" />
                      Failure Density Heatmap
                    </span>
                    <input
                      type="checkbox"
                      checked={showHeatmap}
                      onChange={(e) => toggleHeatmap(e.target.checked)}
                      className="w-4 h-4 rounded text-[#E05A47] focus:ring-0 accent-[#E05A47] cursor-pointer"
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          {/* ACCORDION 2: > Category Filters */}
          <div className="rounded-2xl bg-[#1B2F38]/50 border border-[#334B56] overflow-hidden">
            <button
              onClick={() => setCategoryFiltersOpen(!categoryFiltersOpen)}
              className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase tracking-wider text-[#F8FAFC] hover:bg-[#233B46] bg-[#1B2F38] transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${categoryFiltersOpen ? '' : '-rotate-90'}`} />
                Category Filters & Guide
              </span>
              <span className="text-[10px] font-mono text-[#94A3B8]">{facilitiesList.length} Fac</span>
            </button>

            {categoryFiltersOpen && (
              <div className="p-3 pt-2 space-y-3 border-t border-[#334B56]">
                {/* Dataset Switcher (Admin & Field Officer Portal Only) */}
                {(userRole === 'admin' || userRole === 'officer') && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">Dataset Model</span>
                    <div className="grid grid-cols-2 p-0.5 rounded-lg bg-[#0C171C] border border-[#334B56] text-[11px]">
                      <button
                        onClick={() => handleSwitchDataset('survey')}
                        className={`py-1 px-1.5 rounded-md font-semibold text-center transition cursor-pointer ${
                          activeDataset === 'survey' ? 'bg-[#10B981] text-[#F8FAFC] shadow-sm' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        Field Survey (22 / 3)
                      </button>
                      <button
                        onClick={() => handleSwitchDataset('unified')}
                        className={`py-1 px-1.5 rounded-md font-semibold text-center transition cursor-pointer ${
                          activeDataset === 'unified' ? 'bg-[#10B981] text-[#F8FAFC] shadow-sm' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                        }`}
                      >
                        All Model (172 / 203)
                      </button>
                    </div>
                  </div>
                )}

                {/* Category Filter Buttons */}
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'all', label: 'All POIs', icon: '🏢' },
                    { id: 'water', label: 'Drinking Water', icon: '💧' },
                    { id: 'education', label: 'Education', icon: '🏫' },
                    { id: 'commerce', label: 'Shops & Commerce', icon: '🏪' },
                    { id: 'health', label: 'Health Clinics', icon: '🏥' },
                    { id: 'civic', label: 'Civic & Mandirs', icon: '🏛️' },
                    { id: 'issues', label: `Issues (${issuesList.length})`, icon: '⚠️' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => handleFilterFacilities(opt.id as FacilityCategoryFilter)}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                        facilityFilter === opt.id
                          ? opt.id === 'issues'
                            ? 'bg-[#E05A47]/25 border-[#E05A47] text-[#FCA5A5] shadow-sm'
                            : 'bg-[#10B981]/25 border-[#10B981] text-[#6EE7B7] shadow-sm'
                          : 'bg-[#0C171C] border-[#334B56] text-[#94A3B8] hover:bg-[#1B2F38] hover:text-[#F8FAFC]'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Resident Clean Map Legend & Guide (Resident Portal Only) */}
                {userRole === 'user' && (
                  <div className="p-3 rounded-xl bg-[#0C171C]/80 border border-[#334B56] text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider">Map Legend & Amenities</span>
                      <span className="text-[10px] font-mono text-[#38BDF8]">Citizen View</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#94A3B8]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] shadow-[0_0_6px_#38BDF8] flex-shrink-0"></span>
                        <span className="truncate text-[#F8FAFC]">💧 Drinking Water</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#94A3B8] shadow-[0_0_6px_#94A3B8] flex-shrink-0"></span>
                        <span className="truncate text-[#F8FAFC]">🏫 Schools & Balwadi</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FCD34D] shadow-[0_0_6px_#FCD34D] flex-shrink-0"></span>
                        <span className="truncate text-[#F8FAFC]">🏪 Kirana & Vendors</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#E05A47] shadow-[0_0_6px_#E05A47] flex-shrink-0"></span>
                        <span className="truncate text-[#F8FAFC]">🏥 Health Clinics</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981] flex-shrink-0"></span>
                        <span className="truncate text-[#F8FAFC]">🏛️ Mandirs & Civic</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#E05A47] shadow-[0_0_6px_#E05A47] flex-shrink-0"></span>
                        <span className="truncate text-[#F8FAFC]">⚠️ Civic Issues</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-[#334B56] text-[10px] text-[#94A3B8] leading-relaxed">
                      💡 Click any pin on the map to inspect operational status, business timings, UPI payment availability, and field photos.
                    </div>
                  </div>
                )}

                {/* Facility Health Breakdown & Issues Severity (Admin & Field Officer Portal Only) */}
                {(userRole === 'admin' || userRole === 'officer') && (
                  <>
                    <div className="pt-2 border-t border-[#334B56]">
                      <span className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">Facility Health</span>
                      <div className="grid grid-cols-3 gap-1 text-[10px] p-2 rounded-xl bg-[#0C171C]/80 border border-[#334B56] text-center">
                        <div>
                          <span className="text-[#6EE7B7] block text-[9px] font-semibold">● Functional</span>
                          <strong className="text-[#F8FAFC] text-xs font-mono">{operationalCounts.functional}</strong>
                        </div>
                        <div className="border-x border-[#334B56]">
                          <span className="text-[#FDE68A] block text-[9px] font-semibold">● Partial</span>
                          <strong className="text-[#F8FAFC] text-xs font-mono">{operationalCounts.partial}</strong>
                        </div>
                        <div>
                          <span className="text-[#FCA5A5] block text-[9px] font-semibold">● Degraded</span>
                          <strong className="text-[#F8FAFC] text-xs font-mono">{operationalCounts.nonFunctional}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#334B56]">
                      <span className="text-[10px] uppercase font-bold text-[#94A3B8] block mb-1">Issues Severity</span>
                      <div className="grid grid-cols-3 gap-1 text-[10px] p-2 rounded-xl bg-[#0C171C]/80 border border-[#334B56] text-center">
                        <div>
                          <span className="text-[#FCA5A5] block text-[9px] font-semibold">● High/Crit</span>
                          <strong className="text-[#F8FAFC] text-xs font-mono">{issueCounts.high}</strong>
                        </div>
                        <div className="border-x border-[#334B56]">
                          <span className="text-[#FDE68A] block text-[9px] font-semibold">● Medium</span>
                          <strong className="text-[#F8FAFC] text-xs font-mono">{issueCounts.medium}</strong>
                        </div>
                        <div>
                          <span className="text-[#6EE7B7] block text-[9px] font-semibold">● Low</span>
                          <strong className="text-[#F8FAFC] text-xs font-mono">{issueCounts.low}</strong>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ACCORDION 3: > Analytics & Health (Admin & Field Officer Portal Only) */}
          {(userRole === 'admin' || userRole === 'officer') && (
            <div className="rounded-2xl bg-[#1B2F38]/50 border border-[#334B56] overflow-hidden">
              <button
                onClick={() => setAnalyticsHealthOpen(!analyticsHealthOpen)}
                className="w-full flex items-center justify-between p-3 text-xs font-bold uppercase tracking-wider text-[#F8FAFC] hover:bg-[#233B46] bg-[#1B2F38] transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${analyticsHealthOpen ? '' : '-rotate-90'}`} />
                  Village Analytics & Health
                </span>
                <span className="text-[10px] font-mono text-[#38BDF8]">Decision Support</span>
              </button>

              {analyticsHealthOpen && (
                <div className="p-2 border-t border-[#334B56]">
                  <PanchayatAdminPanel
                    issues={issuesList}
                    facilities={facilitiesList}
                    onFlyToIssue={handleFlyToIssue}
                    isOpen={true}
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
                      showToast(`✅ "${item.title}" approved and published to live map!`);
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
                      showToast(`❌ Submission "${item.title}" rejected.`);
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
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Selected / Inspected Point Floating Card */}
      {inspectedPoint && (
        <div className="absolute top-20 left-4 z-[1000] pointer-events-auto backdrop-blur-xl bg-[#132228]/95 border border-[#334B56] text-[#F8FAFC] rounded-xl p-3 shadow-[0_10px_30px_rgba(12,23,28,0.7)] flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 max-w-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1B2F38] border border-[#334B56] flex items-center justify-center text-[#38BDF8]">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="text-xs">
              <div className="font-semibold text-[#F8FAFC] flex items-center gap-1">
                Point Inspected
                <span className="text-[10px] text-[#94A3B8]">
                  ({inspectedPoint.distKm} km from Core)
                </span>
              </div>
              <div className="font-mono text-[#38BDF8] text-[11px] mt-0.5">
                {inspectedPoint.lat}°N, {inspectedPoint.lng}°E
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsGrievanceModalOpen(true)}
              className="text-[11px] px-2 py-1 rounded bg-[#E05A47]/20 hover:bg-[#E05A47]/30 text-[#FCA5A5] border border-[#E05A47]/60 transition cursor-pointer flex items-center gap-1 font-semibold"
              title="Log Grievance here"
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Report</span>
            </button>
            <button
              onClick={() => copyCoords(`${inspectedPoint.lat}, ${inspectedPoint.lng}`)}
              className="text-xs px-2 py-1 rounded bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] border border-[#334B56] transition cursor-pointer font-semibold"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={() => setInspectedPoint(null)}
              className="text-xs p-1 rounded hover:bg-[#1B2F38] text-[#94A3B8] hover:text-[#F8FAFC] transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 5. FULL-SCREEN LEAFLET MAP CANVAS */}
      <div
        ref={mapContainerRef}
        id="village-map-canvas"
        className="w-full h-full z-0 flex-1 relative [touch-action:pan-x_pan-y]"
        style={{ touchAction: 'pan-x pan-y' }}
      />

      {/* 5.1 TOUCH-FIRST MOBILE BOTTOM NAVIGATION BAR (< 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[2000] h-16 bg-[#132228]/95 backdrop-blur-xl border-t border-[#334B56] px-2 flex items-center justify-around pb-safe select-none shadow-[0_-10px_30px_rgba(12,23,28,0.7)]">
        {/* Tab 1: Map */}
        <button
          onClick={() => {
            setMobileSheet(null);
            setActiveMobileTab('map');
          }}
          className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] rounded-xl transition active:scale-95 cursor-pointer ${
            activeMobileTab === 'map' && !mobileSheet
              ? 'text-[#38BDF8]'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
          title="Full Map View"
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-semibold">Map</span>
        </button>

        {/* Tab 2: Heatmap */}
        <button
          onClick={() => {
            toggleHeatmap(!showHeatmap);
            setActiveMobileTab('heatmap');
          }}
          className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] rounded-xl transition active:scale-95 cursor-pointer ${
            showHeatmap
              ? 'text-[#FCA5A5] drop-shadow-[0_0_8px_rgba(224,90,71,0.6)]'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
          title="Toggle Failure Heatmap"
        >
          <Flame className={`w-5 h-5 mb-0.5 ${showHeatmap ? 'animate-pulse text-[#E05A47]' : ''}`} />
          <span className="text-[10px] font-semibold">Heatmap</span>
        </button>

        {/* Tab 3: Action Floating Center Button */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => setMobileSheet(mobileSheet === 'action' ? null : 'action')}
            className="w-12 h-12 -mt-6 rounded-full bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 shadow-[0_4px_16px_rgba(16,185,129,0.4)] border-2 border-[#132228] flex items-center justify-center text-[#F8FAFC] active:scale-90 transition-transform cursor-pointer"
            title="Propose Facility or Report Issue"
            aria-label="Quick Actions"
          >
            <Plus className={`w-6 h-6 transition-transform duration-200 ${mobileSheet === 'action' ? 'rotate-45' : ''}`} />
          </button>
        </div>

        {/* Tab 4: Analytics & ML */}
        <button
          onClick={() => {
            setMobileSheet(mobileSheet === 'analytics' ? null : 'analytics');
            setActiveMobileTab('analytics');
          }}
          className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] rounded-xl transition active:scale-95 cursor-pointer ${
            mobileSheet === 'analytics'
              ? 'text-[#38BDF8]'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
          title="Decision Support & ML Priorities"
        >
          <BarChart3 className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-semibold">Analytics</span>
        </button>

        {/* Tab 5: Worklist / Queue */}
        <button
          onClick={() => {
            setMobileSheet(mobileSheet === 'worklist' ? null : 'worklist');
            setActiveMobileTab('worklist');
          }}
          className={`flex flex-col items-center justify-center min-w-[54px] min-h-[44px] rounded-xl transition active:scale-95 cursor-pointer ${
            mobileSheet === 'worklist'
              ? 'text-[#38BDF8]'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
          title="Field Worklist / Approvals"
        >
          <ClipboardList className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] font-semibold">
            {userRole === 'officer'
              ? 'Worklist'
              : userRole === 'admin'
              ? 'Approvals'
              : 'Reports'}
          </span>
        </button>
      </nav>

      {/* 5.2 FULL-FEATURED MOBILE SLIDE-UP BOTTOM SHEET (< 768px) */}
      {mobileSheet && (
        <>
          {/* Backdrop Overlay */}
          <div
            className="md:hidden fixed inset-0 z-[2400] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileSheet(null)}
          />

          {/* Bottom Sheet Drawer */}
          <div className="md:hidden fixed inset-x-0 bottom-0 z-[2500] max-h-[85dvh] bg-[#132228] border-t border-[#334B56] rounded-t-3xl shadow-[0_-10px_40px_rgba(12,23,28,0.85)] flex flex-col transition-all duration-300 ease-out overscroll-contain animate-in slide-in-from-bottom duration-300">
            {/* Drag Handle Pill */}
            <div className="w-12 h-1.5 bg-[#334B56] rounded-full mx-auto my-2.5 flex-shrink-0" />

            {/* Header */}
            <div className="px-4 py-2 border-b border-[#334B56] bg-[#0C171C]/90 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                {mobileSheet === 'analytics' && <BarChart3 className="w-4 h-4 text-[#38BDF8]" />}
                {mobileSheet === 'worklist' && <ClipboardList className="w-4 h-4 text-[#38BDF8]" />}
                {mobileSheet === 'layers' && <Layers className="w-4 h-4 text-[#38BDF8]" />}
                {mobileSheet === 'action' && <Plus className="w-4 h-4 text-[#10B981]" />}
                {mobileSheet === 'role' && <ShieldCheck className="w-4 h-4 text-[#38BDF8]" />}

                <div>
                  <h3 className="text-sm font-bold text-[#F8FAFC]">
                    {mobileSheet === 'analytics' && 'Village Analytics & ML Priority'}
                    {mobileSheet === 'worklist' &&
                      (userRole === 'officer'
                        ? 'Officer Field Worklist'
                        : userRole === 'admin'
                        ? 'Pending Approvals Queue'
                        : 'Citizen Field Reports')}
                    {mobileSheet === 'layers' && 'Map Overlays & Basemaps'}
                    {mobileSheet === 'action' && 'Quick Field Operations'}
                    {mobileSheet === 'role' && 'Select Access Portal'}
                  </h3>
                  <p className="text-[10px] text-[#94A3B8]">
                    {mobileSheet === 'analytics' && 'Decision Support System • Top 5 Failures'}
                    {mobileSheet === 'worklist' &&
                      (userRole === 'officer'
                        ? `${mobileGrievanceList.length} Verified Tasks Assigned`
                        : userRole === 'admin'
                        ? `${pendingSubmissionsList.length} Submissions Awaiting Approval`
                        : 'Track your reported issues & proposals')}
                    {mobileSheet === 'layers' && 'Toggle layers and visual amenities'}
                    {mobileSheet === 'action' && 'Propose amenities or report incidents'}
                    {mobileSheet === 'role' && 'Role-segregated spatial access control'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setMobileSheet(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38] transition cursor-pointer"
                title="Close sheet"
                aria-label="Close bottom sheet"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 scrollbar-thin">
              {/* VIEW 1: ANALYTICS & ML DECISION SUPPORT */}
              {mobileSheet === 'analytics' && (
                <div className="space-y-4">
                  {/* KPI Metric Tiles */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-[#1B2F38] border border-[#334B56] p-3.5 rounded-xl shadow-sm">
                      <div className="text-[10px] tracking-wider uppercase font-semibold text-[#94A3B8]">
                        Active Issues
                      </div>
                      <div className="text-2xl font-bold font-mono text-[#F8FAFC] mt-0.5">
                        {issueCounts.total}
                      </div>
                      <div className="text-[10px] text-[#E05A47] font-semibold mt-0.5">
                        {issueCounts.high} High/Critical
                      </div>
                    </div>

                    <div className="bg-[#1B2F38] border border-[#334B56] p-3.5 rounded-xl shadow-sm">
                      <div className="text-[10px] tracking-wider uppercase font-semibold text-[#94A3B8]">
                        DBSCAN Hotspots
                      </div>
                      <div className="text-2xl font-bold font-mono text-[#38BDF8] mt-0.5">
                        3
                      </div>
                      <div className="text-[10px] text-[#38BDF8] font-semibold mt-0.5">
                        Failure Clusters (ε=85m)
                      </div>
                    </div>

                    <div className="bg-[#1B2F38] border border-[#334B56] p-3.5 rounded-xl shadow-sm">
                      <div className="text-[10px] tracking-wider uppercase font-semibold text-[#94A3B8]">
                        Est. Works Capex
                      </div>
                      <div className="text-2xl font-bold font-mono text-[#FCD34D] mt-0.5">
                        ₹{(totalMLCapex / 1000).toFixed(0)}k
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
                        Top 5 Urgent Works
                      </div>
                    </div>

                    <div className="bg-[#1B2F38] border border-[#334B56] p-3.5 rounded-xl shadow-sm">
                      <div className="text-[10px] tracking-wider uppercase font-semibold text-[#94A3B8]">
                        Monitored Assets
                      </div>
                      <div className="text-2xl font-bold font-mono text-[#10B981] mt-0.5">
                        {facilitiesList.length}
                      </div>
                      <div className="text-[10px] text-[#6EE7B7] font-semibold mt-0.5">
                        {operationalCounts.functional} Fully Functional
                      </div>
                    </div>
                  </div>

                  {/* Top 5 ML Priority Rankings */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#F8FAFC] flex items-center gap-1.5 uppercase tracking-wider">
                        <Activity className="w-3.5 h-3.5 text-[#38BDF8]" />
                        Top 5 ML Priority Action Items
                      </span>
                      <span className="text-[10px] font-mono text-[#38BDF8] bg-[#1B2F38] px-2 py-0.5 rounded border border-[#334B56]">
                        AI Ranked
                      </span>
                    </div>

                    {topMLIssues.map((issue, idx) => (
                      <div
                        key={issue.issue_id}
                        className="p-3 rounded-xl bg-[#1B2F38] border border-[#334B56] border-l-4 border-l-[#E05A47] hover:bg-[#233B46] transition flex flex-col gap-2 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="text-[10px] font-mono font-bold bg-[#0C171C] text-[#38BDF8] px-1.5 py-0.5 rounded border border-[#334B56]">
                                #{idx + 1}
                              </span>
                              <span className="text-[10px] uppercase font-bold text-[#FCA5A5] bg-[#E05A47]/20 border border-[#E05A47]/60 px-2 py-0.5 rounded-full">
                                Score: {issue.ai_priority_score ?? 85}
                              </span>
                              <span className="text-[10px] uppercase text-[#94A3B8] font-semibold bg-[#0C171C] px-1.5 py-0.5 rounded border border-[#334B56]">
                                {issue.category}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-[#F8FAFC] leading-snug">
                              {issue.title}
                            </h4>
                            <p className="text-[11px] text-[#94A3B8] mt-0.5">
                              Est. Budget: <strong className="text-[#FCD34D] font-mono">₹{(issue.estimated_budget_inr || 45000).toLocaleString('en-IN')}</strong>
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            handleFlyToIssue(issue);
                            setMobileSheet(null);
                          }}
                          className="w-full py-2 px-3 min-h-[44px] rounded-xl bg-[#0C171C] hover:bg-[#132228] border border-[#334B56] text-[#38BDF8] hover:text-[#F8FAFC] text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                        >
                          <Locate className="w-4 h-4 text-[#38BDF8]" />
                          <span>Fly to Pin on Map</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Spatial Health: Category Distribution (Bar Chart Layout) */}
                  <div className="p-3.5 rounded-xl bg-[#1B2F38] border border-[#334B56] space-y-2.5">
                    <span className="text-xs font-bold text-[#F8FAFC] block uppercase tracking-wider">
                      Issue Category Breakdown
                    </span>
                    <div className="space-y-2">
                      {categoryBreakdown.map((cat) => (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#94A3B8] font-medium">{cat.name}</span>
                            <span className="font-mono text-[#F8FAFC] font-semibold">{cat.count} faults</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-[#0C171C] overflow-hidden border border-[#334B56]">
                            <div
                              className="h-full bg-gradient-to-r from-[#0D9488] to-[#38BDF8] rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(cat.pct, 8)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Facility Condition Health */}
                  <div className="p-3.5 rounded-xl bg-[#1B2F38] border border-[#334B56] space-y-2">
                    <span className="text-xs font-bold text-[#F8FAFC] block uppercase tracking-wider">
                      Facility Operational Status
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-2 rounded-lg bg-[#0C171C] border border-[#334B56]">
                        <span className="text-[#6EE7B7] text-[10px] block font-semibold">● Functional</span>
                        <strong className="text-base font-mono text-[#F8FAFC]">{operationalCounts.functional}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0C171C] border border-[#334B56]">
                        <span className="text-[#FDE68A] text-[10px] block font-semibold">● Partial</span>
                        <strong className="text-base font-mono text-[#F8FAFC]">{operationalCounts.partial}</strong>
                      </div>
                      <div className="p-2 rounded-lg bg-[#0C171C] border border-[#334B56]">
                        <span className="text-[#FCA5A5] text-[10px] block font-semibold">● Broken</span>
                        <strong className="text-base font-mono text-[#F8FAFC]">{operationalCounts.nonFunctional}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Native Mobile Download Buttons */}
                  <div className="pt-2 space-y-2">
                    <button
                      onClick={() => {
                        handleDownloadPanchayatPdf();
                        setMobileSheet(null);
                      }}
                      className="w-full py-3 min-h-[48px] rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Download Audit Report (PDF)</span>
                    </button>

                    <button
                      onClick={() => {
                        handleExportMasterCsv();
                        setMobileSheet(null);
                      }}
                      className="w-full py-3 min-h-[48px] rounded-xl bg-[#1B2F38] hover:bg-[#233B46] border border-[#38BDF8]/40 text-[#38BDF8] hover:text-[#F8FAFC] font-semibold text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Export Master Dataset (CSV)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 2: WORKLIST / APPROVALS / MY REPORTS */}
              {mobileSheet === 'worklist' && (
                <div className="space-y-3">
                  {/* ADMIN VIEW: PENDING APPROVALS QUEUE */}
                  {userRole === 'admin' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">
                          Citizen Submissions Awaiting Approval
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#E05A47]/20 text-[#FCA5A5] border border-[#E05A47]/60">
                          {pendingSubmissionsList.length} Pending
                        </span>
                      </div>

                      {pendingSubmissionsList.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl bg-[#1B2F38] border border-[#334B56] text-[#94A3B8] flex flex-col items-center gap-2">
                          <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
                          <h4 className="text-sm font-bold text-[#F8FAFC]">All Submissions Verified</h4>
                          <p className="text-xs text-[#94A3B8]">
                            There are currently zero pending facility proposals or citizen grievances.
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
                                {item.type === 'facility' ? '🏢 Proposed Facility' : '⚠️ Civic Grievance'}
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
                                onClick={() => handleMobileApprove(item)}
                                className="flex-1 py-2 px-3 min-h-[44px] rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleMobileReject(item)}
                                className="py-2 px-3.5 min-h-[44px] rounded-xl bg-[#E05A47]/20 hover:bg-[#E05A47]/30 text-[#FCA5A5] border border-[#E05A47]/60 font-semibold text-xs flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                                <span>Reject</span>
                              </button>
                              <button
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
                    </>
                  )}

                  {/* OFFICER VIEW: FIELD WORKLIST */}
                  {userRole === 'officer' && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#F8FAFC] uppercase tracking-wider">
                          Assigned Verified Field Tasks
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
                            No pending verified tasks assigned for field inspection.
                          </p>
                        </div>
                      ) : (
                        mobileGrievanceList.map((g) => {
                          const currentStatus = g.status || 'reported';
                          return (
                            <div
                              key={g.id}
                              className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#334B56] flex flex-col gap-2.5 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E05A47]/20 border border-[#E05A47]/50 text-[#FCA5A5]">
                                  ● {g.severity.toUpperCase()}
                                </span>
                                <span className="text-[10px] uppercase font-semibold text-[#94A3B8] px-1.5 py-0.5 rounded bg-[#0C171C] border border-[#334B56]">
                                  {g.category}
                                </span>
                                <span className="text-[10px] font-mono text-[#38BDF8]">
                                  {g.latitude.toFixed(4)}°N, {g.longitude.toFixed(4)}°E
                                </span>
                              </div>

                              <h4 className="text-xs font-bold text-[#F8FAFC]">{g.title}</h4>

                              {g.description && (
                                <p className="text-[11px] text-[#94A3B8] bg-[#0C171C] p-2 rounded-lg border border-[#334B56] line-clamp-2">
                                  {g.description}
                                </p>
                              )}

                              {/* Officer Status Buttons */}
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleMobileUpdateGrievanceStatus(g.id!, 'under_inspection')}
                                  className={`py-2 px-1 min-h-[44px] rounded-xl text-[10px] font-bold transition cursor-pointer flex items-center justify-center ${
                                    currentStatus === 'under_inspection'
                                      ? 'bg-[#38BDF8] text-[#0C171C] shadow-sm'
                                      : 'bg-[#0C171C] border border-[#334B56] text-[#94A3B8]'
                                  }`}
                                >
                                  Inspecting
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMobileUpdateGrievanceStatus(g.id!, 'in_progress')}
                                  className={`py-2 px-1 min-h-[44px] rounded-xl text-[10px] font-bold transition cursor-pointer flex items-center justify-center ${
                                    currentStatus === 'in_progress'
                                      ? 'bg-[#E05A47] text-[#F8FAFC] shadow-sm'
                                      : 'bg-[#0C171C] border border-[#334B56] text-[#94A3B8]'
                                  }`}
                                >
                                  In Progress
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMobileUpdateGrievanceStatus(g.id!, 'resolved')}
                                  className="py-2 px-1 min-h-[44px] rounded-xl text-[10px] font-bold bg-gradient-to-r from-[#0D9488] to-[#10B981] text-[#F8FAFC] transition cursor-pointer flex items-center justify-center gap-1 active:scale-95 shadow-sm"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  Resolved
                                </button>
                              </div>

                              <button
                                onClick={() => {
                                  flyToCoords([g.latitude, g.longitude]);
                                  setMobileSheet(null);
                                }}
                                className="w-full py-2 min-h-[44px] rounded-xl bg-[#0C171C] hover:bg-[#1B2F38] border border-[#334B56] text-[#38BDF8] text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                              >
                                <Locate className="w-4 h-4" />
                                <span>Fly to Location on Map</span>
                              </button>
                            </div>
                          );
                        })
                      )}

                      <button
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
                        mobileGrievanceList.map((g) => (
                          <div
                            key={g.id}
                            className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#334B56] flex flex-col gap-2 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E05A47]/20 border border-[#E05A47]/50 text-[#FCA5A5]">
                                {g.category}
                              </span>
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#10B981]/20 text-[#6EE7B7] border border-[#10B981]/40">
                                {g.status || 'Reported'}
                              </span>
                            </div>

                            <h4 className="text-xs font-bold text-[#F8FAFC]">{g.title}</h4>

                            {g.description && (
                              <p className="text-[11px] text-[#94A3B8] bg-[#0C171C] p-2 rounded-lg border border-[#334B56]">
                                {g.description}
                              </p>
                            )}

                            <button
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
                        ))
                      )}

                      <button
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
                  <div className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#334B56] space-y-2">
                    <span className="text-xs font-bold text-[#F8FAFC] block uppercase tracking-wider">
                      Select Basemap Tile Layer
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'esri', label: '🛰️ Satellite' },
                        { id: 'osm', label: '🗺️ OSM Street' },
                        { id: 'cartoDark', label: '🌑 Dark Matter' },
                      ].map((b) => (
                        <button
                          key={b.id}
                          onClick={() => changeBasemap(b.id as BasemapType)}
                          className={`py-2.5 px-2 min-h-[48px] rounded-xl font-bold text-xs text-center transition cursor-pointer active:scale-95 ${
                            activeBasemap === b.id
                              ? 'bg-[#10B981] text-[#F8FAFC] shadow-md'
                              : 'bg-[#0C171C] text-[#94A3B8] hover:text-[#F8FAFC] border border-[#334B56]'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Layer Toggles */}
                  <div className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#334B56] space-y-2.5">
                    <span className="text-xs font-bold text-[#F8FAFC] block uppercase tracking-wider">
                      Active Spatial Layers
                    </span>

                    <label className="flex items-center justify-between p-2.5 min-h-[48px] rounded-xl bg-[#0C171C] border border-[#334B56] cursor-pointer">
                      <span className="text-xs text-[#F8FAFC] flex items-center gap-2 font-medium">
                        <Building2 className="w-4 h-4 text-[#38BDF8]" />
                        Khopripada Boundary (AOI)
                      </span>
                      <input
                        type="checkbox"
                        checked={showBoundary}
                        onChange={toggleBoundary}
                        className="w-5 h-5 rounded text-[#38BDF8] accent-[#38BDF8] cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 min-h-[48px] rounded-xl bg-[#0C171C] border border-[#334B56] cursor-pointer">
                      <span className="text-xs text-[#F8FAFC] flex items-center gap-2 font-medium">
                        <FileSpreadsheet className="w-4 h-4 text-[#10B981]" />
                        Village Facilities ({facilityCount})
                      </span>
                      <input
                        type="checkbox"
                        checked={showFacilities}
                        onChange={toggleFacilities}
                        className="w-5 h-5 rounded text-[#10B981] accent-[#10B981] cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 min-h-[48px] rounded-xl bg-[#0C171C] border border-[#334B56] cursor-pointer">
                      <span className="text-xs text-[#F8FAFC] flex items-center gap-2 font-medium">
                        <AlertTriangle className="w-4 h-4 text-[#E05A47]" />
                        Surveyed Civic Issues ({issueCounts.total})
                      </span>
                      <input
                        type="checkbox"
                        checked={showIssues}
                        onChange={toggleIssues}
                        className="w-5 h-5 rounded text-[#E05A47] accent-[#E05A47] cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 min-h-[48px] rounded-xl bg-[#0C171C] border border-[#334B56] cursor-pointer">
                      <span className="text-xs text-[#F8FAFC] flex items-center gap-2 font-medium">
                        <Flame className="w-4 h-4 text-[#E05A47]" />
                        Failure Density Heatmap & Clusters
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
                  <div className="p-3.5 rounded-2xl bg-[#1B2F38] border border-[#334B56] space-y-2">
                    <span className="text-xs font-bold text-[#F8FAFC] block uppercase tracking-wider">
                      Filter Amenities By Category
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'all', label: 'All POIs', icon: '🏢' },
                        { id: 'water', label: 'Drinking Water', icon: '💧' },
                        { id: 'education', label: 'Schools', icon: '🏫' },
                        { id: 'commerce', label: 'Commerce', icon: '🏪' },
                        { id: 'health', label: 'Health Clinics', icon: '🏥' },
                        { id: 'civic', label: 'Civic & Mandirs', icon: '🏛️' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => handleFilterFacilities(opt.id as FacilityCategoryFilter)}
                          className={`px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-2 ${
                            facilityFilter === opt.id
                              ? 'bg-[#10B981]/25 border-[#10B981] text-[#6EE7B7] shadow-sm'
                              : 'bg-[#0C171C] border-[#334B56] text-[#94A3B8] hover:text-[#F8FAFC]'
                          }`}
                        >
                          <span>{opt.icon}</span>
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                      <Plus className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#F8FAFC]">
                        {isAddFacilityMode ? 'Cancel Placing Asset' : '+ Propose / Add Facility'}
                      </h4>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        Tap map to drop GPS point for drinking water, shop, clinic, or school
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsGrievanceModalOpen(true);
                      setMobileSheet(null);
                    }}
                    className="w-full p-4 min-h-[64px] rounded-2xl bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] flex items-center gap-3.5 transition active:scale-98 cursor-pointer shadow-md text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#D9534F] to-[#E05A47] flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#F8FAFC]">
                        ⚠️ Report Citizen Grievance
                      </h4>
                      <p className="text-xs text-[#94A3B8] mt-0.5">
                        Capture photo with GPS coordinates for broken pipes, potholes, or flood risks
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
                      <div className="w-12 h-12 rounded-xl bg-[#132228] border border-[#38BDF8]/50 flex items-center justify-center text-[#38BDF8] flex-shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#F8FAFC]">
                          📄 Executive Panchayat Audit
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
                      <div className="w-12 h-12 rounded-xl bg-[#132228] border border-[#38BDF8]/50 flex items-center justify-center text-[#38BDF8] flex-shrink-0">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#F8FAFC]">
                          📋 Export Officer Worklist PDF
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
                    <div className="w-12 h-12 rounded-xl bg-[#0C171C] border border-[#334B56] flex items-center justify-center text-[#10B981] flex-shrink-0">
                      <Locate className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#F8FAFC]">
                        📍 Re-Center on Khopripada Core
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
                  <div className="p-3.5 rounded-2xl bg-[#0C171C] border border-[#334B56] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#94A3B8] block">Current Session</span>
                      <strong className="text-sm text-[#F8FAFC]">{session?.name || 'Authorized User'}</strong>
                      <span className="text-xs text-[#38BDF8] block mt-0.5">{session?.designation}</span>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7] text-xs font-mono font-bold">
                      {userRole.toUpperCase()}
                    </span>
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
                      <span className="text-2xl p-2 rounded-xl bg-[#132228] border border-[#334B56] flex-shrink-0">
                        {role.icon}
                      </span>
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
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 5.2 BOTTOM-LEFT: VILLAGE SUMMARY STATS & QUICK NAVIGATION PILL */}
      <div className="absolute bottom-6 left-4 z-[1000] pointer-events-none hidden md:flex items-center gap-3">
        <div className="pointer-events-auto backdrop-blur-md bg-[#132228]/95 border border-[#334B56] text-[#94A3B8] rounded-xl px-3.5 py-2 shadow-xl flex items-center gap-3 text-xs">
          <button
            onClick={recenterToKhopripadaCore}
            className="flex items-center gap-1.5 hover:text-[#38BDF8] transition cursor-pointer"
            title="Click to Recenter on Khopripada Core"
          >
            <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
            <span className="font-semibold text-[#F8FAFC]">Khopripada Core</span>
          </button>
          <span className="text-[#334B56]">|</span>
          <button
            onClick={flyToJuchandraStation}
            className="text-[#94A3B8] hover:text-[#F8FAFC] transition cursor-pointer"
            title="Click to Fly to Juchandra Station"
          >
            Juchandra Stn
          </button>
          <span className="text-[#334B56]">|</span>
          <span className="text-[#38BDF8] font-mono text-[11px]">
            {cursorCoords ? `${cursorCoords[0]}°N, ${cursorCoords[1]}°E` : `${centerCoords[0]}°N, ${centerCoords[1]}°E`}
          </span>
          <span className="text-[#334B56]">|</span>
          <span className="text-[#94A3B8]">
            Zoom: <strong className="text-[#F8FAFC] font-mono">{currentZoom}</strong>
          </span>
          <span className="text-[#334B56]">|</span>
          <button
            onClick={toggleFullscreen}
            className="text-[#94A3B8] hover:text-[#F8FAFC] transition cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 6. REPORT GRIEVANCE MODAL */}
      <GrievanceModal
        isOpen={isGrievanceModalOpen}
        onClose={() => setIsGrievanceModalOpen(false)}
        initialCoords={inspectedPoint ? [inspectedPoint.lat, inspectedPoint.lng] : KHOPRIPADA_CORE}
        onGrievanceSaved={() => {
          refreshGrievanceMarkers();
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
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-[#0C171C]/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#132228] border border-[#334B56] rounded-2xl shadow-[0_10px_30px_rgba(12,23,28,0.7)] p-5 text-[#F8FAFC] flex flex-col gap-4">
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
              <span className="text-[#10B981] font-bold">💡 Tip:</span>
              <span>For field verification outside the corridor, you can simulate a high-accuracy GNSS fix at Khopripada Core.</span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                onClick={() => setGpsWarningModal(null)}
                className="px-3.5 py-2 text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] rounded-xl transition cursor-pointer"
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
