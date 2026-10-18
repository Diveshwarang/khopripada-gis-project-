import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MapPin,
  Save,
  Building2,
  ShieldAlert,
  Camera,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { type CachedFacility } from '../services/offlineDb';
import { compressImageToBase64 } from '../utils/imageUtils';
import type { UserRole } from '../types';
import {
  isCommercialCategory,
  isHealthCategory,
  isEducationCategory,
  isWaterCategory,
  isCivicCategory,
  isLightingCategory,
} from '../utils/facilityUtils';

interface AddFacilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  coords: [number, number] | null;
  onFacilitySaved: (newFacility: CachedFacility) => void;
  userRole?: UserRole;
}

export const AddFacilityModal: React.FC<AddFacilityModalProps> = ({
  isOpen,
  onClose,
  coords,
  onFacilitySaved,
  userRole = 'user',
}) => {
  const [facilityId, setFacilityId] = useState('');
  const [name, setName] = useState('');
  const defaultCategory = userRole === 'officer' ? 'jal_jeevan_tap' : userRole === 'user' ? 'vendor' : 'water_standpost';
  const [category, setCategory] = useState<string>(defaultCategory);
  const [operationalStatus, setOperationalStatus] = useState<string>('functional');
  const [monsoonAccessible, setMonsoonAccessible] = useState<string>('year_round');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);

  // Context-Aware Form States
  const [upiAvailable, setUpiAvailable] = useState<boolean>(true);
  const [businessHours, setBusinessHours] = useState<string>('7:00 AM – 9:30 PM');
  const [serviceType, setServiceType] = useState<string>('Daily Groceries & Essentials');
  const [healthServices, setHealthServices] = useState<string>('Primary First Aid & Maternal Health');
  const [operationalHours, setOperationalHours] = useState<string>('10:00 AM – 5:00 PM (Mon–Sat)');
  const [gradeLevels, setGradeLevels] = useState<string>('Std 1st to 7th (Marathi/Semi-English)');
  const [middayMeal, setMiddayMeal] = useState<boolean>(true);
  const [filteredWater, setFilteredWater] = useState<boolean>(true);
  const [supplyTimings, setSupplyTimings] = useState<string>('Morning 6:30 AM – 9:00 AM (Gravity Tank)');
  const [potabilityStatus, setPotabilityStatus] = useState<string>('✅ Potable Drinking Water');
  const [maintenanceAuthority, setMaintenanceAuthority] = useState<string>('Gram Panchayat Khopripada Water Dept');
  const [communityUsage, setCommunityUsage] = useState<string>('Public Gatherings & Gram Sabha Meetings');
  const [seatingCapacity, setSeatingCapacity] = useState<string>('Capacity: ~150 Persons');
  const [fixtureType, setFixtureType] = useState<string>('LED 45W / Solar Photovoltaic');
  const [powerGrid, setPowerGrid] = useState<string>('MSEDCL Feeder Line (Panchayat Auto-Timer)');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Generate unique ID and reset fields whenever modal opens with new coords
  useEffect(() => {
    if (isOpen) {
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      setFacilityId(`FAC_${randomDigits}`);
      setName('');
      setCategory(userRole === 'officer' ? 'jal_jeevan_tap' : userRole === 'user' ? 'vendor' : 'water_standpost');
      setOperationalStatus('functional');
      setMonsoonAccessible('year_round');
      setPhotoBase64(null);
      setErrorMsg(null);
      setVerificationNotice(null);
      setIsSubmitting(false);
      setIsCompressing(false);
    }
  }, [isOpen, userRole]);

  // Handle ESC key press inside modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !coords) return null;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setErrorMsg(null);
    try {
      const compressed = await compressImageToBase64(file, 800, 800, 0.75);
      setPhotoBase64(compressed);
    } catch (err) {
      console.error('Failed to compress image:', err);
      setErrorMsg('Failed to process image file. Please try another image.');
    } finally {
      setIsCompressing(false);
      // Reset input value so same photo can be re-selected if desired
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    setPhotoBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter a descriptive facility name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Map monsoon choice to 4 essential features: Year-round vs Floods/Isolated
      let monsoonLabel = 'Year-round';
      if (monsoonAccessible === 'waterlogged' || monsoonAccessible === 'floods') {
        monsoonLabel = 'Floods / Waterlogged';
      } else if (monsoonAccessible === 'cut_off' || monsoonAccessible === 'isolated') {
        monsoonLabel = 'Floods / Isolated';
      }

      const isResident = userRole === 'user';
      const isOfficer = userRole === 'officer';
      const isAdmin = userRole === 'admin';

      const isComm = isCommercialCategory(category);
      const isHlth = isHealthCategory(category);
      const isEdu = isEducationCategory(category);
      const isWtr = isWaterCategory(category);
      const isCiv = isCivicCategory(category);
      const isUtil = isLightingCategory(category);

      const newFacility: CachedFacility = {
        facility_id: facilityId,
        name: name.trim(),
        category,
        operational_status: operationalStatus,
        monsoon_accessible: monsoonLabel,
        latitude: parseFloat(coords[0].toFixed(6)),
        longitude: parseFloat(coords[1].toFixed(6)),
        photoBase64: photoBase64 || undefined,
        approval_status: isAdmin ? 'approved' : 'pending_approval',
        submitted_by: isResident ? 'Resident' : isOfficer ? 'Officer' : 'Admin',
        scheme_name: isOfficer ? category : undefined,

        // Context-Aware Attributes
        upi_available: isComm ? upiAvailable : isHlth ? upiAvailable : undefined,
        business_hours: isComm ? businessHours.trim() : undefined,
        service_type: isComm ? serviceType.trim() : undefined,
        health_services: isHlth ? healthServices.trim() : undefined,
        operational_hours: isHlth ? operationalHours.trim() : undefined,
        grade_levels: isEdu ? gradeLevels.trim() : undefined,
        midday_meal: isEdu ? middayMeal : undefined,
        filtered_water: isEdu ? filteredWater : undefined,
        supply_timings: isWtr ? supplyTimings.trim() : undefined,
        potability_status: isWtr ? potabilityStatus.trim() : undefined,
        maintenance_authority: isWtr ? maintenanceAuthority.trim() : undefined,
        community_usage: isCiv ? communityUsage.trim() : undefined,
        seating_capacity: isCiv ? seatingCapacity.trim() : undefined,
        fixture_type: isUtil ? fixtureType.trim() : undefined,
        power_grid: isUtil ? powerGrid.trim() : undefined,
      };

      if (isResident) {
        onFacilitySaved(newFacility);
        setVerificationNotice(
          'Submitted for Panchayat Verification. Your submission will appear on the map once reviewed and approved by the Sarpanch/Admin.'
        );
      } else {
        onFacilitySaved(newFacility);
        onClose();
      }
    } catch (err) {
      console.error('Failed to submit facility:', err);
      setErrorMsg('Error creating facility record.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !verificationNotice) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-slate-900/95 border border-cyan-500/40 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.25)] overflow-hidden text-slate-100 flex flex-col max-h-[92vh]">
        {/* Verification Success Notice for Resident / Villager */}
        {verificationNotice ? (
          <div className="p-6 text-center flex flex-col items-center gap-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)] animate-bounce">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-bold uppercase tracking-wider">
                Pending Verification
              </span>
              <h3 className="text-lg font-bold text-white mt-2">
                Facility Submitted Successfully
              </h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto mt-2 leading-relaxed bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                {verificationNotice}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs transition active:scale-95 cursor-pointer shadow-lg shadow-emerald-950/50"
            >
              Back to Map Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg ${
                  userRole === 'officer'
                    ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shadow-emerald-500/20'
                    : userRole === 'user'
                    ? 'bg-amber-500/20 border border-amber-400/40 text-amber-300 shadow-amber-500/20'
                    : 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shadow-cyan-500/20'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    {userRole === 'officer'
                      ? '+ Add Govt Scheme Asset'
                      : userRole === 'user'
                      ? 'Propose Local Community Facility'
                      : 'Register Village Facility'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {userRole === 'officer'
                      ? 'Government-Sanctioned Schemes Only (Z.P. / Jal Jeevan / NHM)'
                      : userRole === 'user'
                      ? 'Resident Community Submission (Subject to Panchayat Review)'
                      : 'Panchayat Executive Ingestion (Direct Publish to Live Map)'}
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs scrollbar-thin">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Auto-filled Read-Only Fields: ID & GPS Coords */}
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                    Facility ID
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={facilityId}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-cyan-300 font-mono text-xs font-bold focus:outline-none cursor-default"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-400" /> Latitude
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={coords[0].toFixed(6)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none cursor-default"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-400" /> Longitude
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={coords[1].toFixed(6)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none cursor-default"
                  />
                </div>
              </div>

              {/* Facility Name */}
              <div>
                <label className="font-semibold text-slate-200 block mb-1">
                  Asset Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    userRole === 'officer'
                      ? 'e.g. Jal Jeevan Mission Solar Tap Stand 04'
                      : userRole === 'user'
                      ? 'e.g. Om Sai General Kirana & Flour Mill'
                      : 'e.g. Wakipada Public Borewell'
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-xs transition"
                />
              </div>

              {/* Category Dropdown (Strictly Role-Restricted) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-200">
                    Category Badge <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {userRole === 'officer'
                      ? 'Govt-Sanctioned Schemes Only'
                      : userRole === 'user'
                      ? 'Local Community Categories'
                      : 'All Village Facilities'}
                  </span>
                </div>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-xs transition cursor-pointer appearance-none font-medium"
                  >
                    {userRole === 'officer' ? (
                      /* Officer Role: Strictly Government-Sanctioned Schemes (No commercial shops) */
                      <>
                        <option value="jal_jeevan_tap">🚰 Jal Jeevan Mission Public Tap Stand (jal_jeevan_tap)</option>
                        <option value="zp_school_infrastructure">🏫 Z.P. Primary School Amenity (zp_school_infrastructure)</option>
                        <option value="anganwadi_govt">🎒 Govt ICDS Anganwadi Nutrition Center (anganwadi_govt)</option>
                        <option value="govt_sub_center">🏥 National Health Mission Sub-Center (govt_sub_center)</option>
                        <option value="solar_highmast">💡 Panchayat Solar Streetlight Project (solar_highmast)</option>
                        <option value="pm_gram_sadak_drain">🌊 Government Stormwater Concrete Drain (pm_gram_sadak_drain)</option>
                      </>
                    ) : userRole === 'user' ? (
                      /* Resident / Villager Role: Community Facilities */
                      <>
                        <option value="vendor">🏪 Local Shop / Kirana / Flour Mill (vendor)</option>
                        <option value="water_borewell">💧 Community Borewell / Hand Pump (water_borewell)</option>
                        <option value="water_standpost">🚰 Private / Shared Drinking Water Point (water_standpost)</option>
                        <option value="social_civic">🏛️ Mandir / Temple / Community Civic Space (social_civic)</option>
                        <option value="anganwadi">🎒 Balwadi / Community Childcare (anganwadi)</option>
                      </>
                    ) : (
                      /* Admin Role: All Facilities (Govt + Community) */
                      <>
                        <optgroup label="Government Schemes">
                          <option value="jal_jeevan_tap">🚰 Jal Jeevan Mission Public Tap Stand</option>
                          <option value="zp_school_infrastructure">🏫 Z.P. Primary School Infrastructure</option>
                          <option value="anganwadi_govt">🎒 Govt ICDS Anganwadi Center</option>
                          <option value="govt_sub_center">🏥 National Health Mission Sub-Center</option>
                          <option value="solar_highmast">💡 Panchayat Solar Highmast Light</option>
                          <option value="pm_gram_sadak_drain">🌊 Government Stormwater Concrete Drain</option>
                        </optgroup>
                        <optgroup label="Village & Community Assets">
                          <option value="water_standpost">💧 Public Tap (water_standpost)</option>
                          <option value="water_borewell">💧 Borewell / Hand Pump (water_borewell)</option>
                          <option value="water_tank">💧 Storage Tank (water_tank)</option>
                          <option value="school">🏫 Z.P. School / Primary (school)</option>
                          <option value="anganwadi">🎒 Childcare / Nutrition Center (anganwadi)</option>
                          <option value="health">🏥 Sub-center / Clinic (health)</option>
                          <option value="vendor">🏪 Kirana / Flour Mill / Local Stall (vendor)</option>
                          <option value="social_civic">🏛️ Community Hall / Mandir / Panchayat (social_civic)</option>
                        </optgroup>
                      </>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

          {/* Operational Status Dropdown */}
          <div>
            <label className="font-semibold text-slate-200 block mb-1">
              Status (Colored Pill) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <select
                value={operationalStatus}
                onChange={(e) => setOperationalStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-xs transition cursor-pointer appearance-none"
              >
                <option value="functional">🟢 Functional (Green Pill)</option>
                <option value="partially_functional">🟡 Partially Functional / Degraded (Yellow Pill)</option>
                <option value="non_functional">🔴 Broken / Inoperative (Red Pill)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* Monsoon Accessibility Dropdown */}
          <div>
            <label className="font-semibold text-slate-200 block mb-1">
              Monsoon Access Condition <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <select
                value={monsoonAccessible}
                onChange={(e) => setMonsoonAccessible(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-xs transition cursor-pointer appearance-none"
              >
                <option value="year_round">✅ Year-round (Fully Accessible)</option>
                <option value="waterlogged">⚠️ Floods/Isolated (Waterlogged in Rains)</option>
                <option value="cut_off">⛔ Floods/Isolated (Completely Cut Off)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          {/* DYNAMIC CONTEXT-AWARE ATTRIBUTE FORM SECTIONS */}
          {isCommercialCategory(category) && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                  <span>🏪</span> Commercial & Retail Details
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Payment & Services</span>
              </div>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={upiAvailable}
                  onChange={(e) => setUpiAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-400 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-emerald-300 block">
                    Accepts GPay / PhonePe / UPI Payments
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    QR code setup active on store counter
                  </span>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Operating Hours
                  </label>
                  <input
                    type="text"
                    value={businessHours}
                    onChange={(e) => setBusinessHours(e.target.value)}
                    placeholder="e.g. 7:00 AM – 9:30 PM"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Service / Goods Type
                  </label>
                  <input
                    type="text"
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    placeholder="e.g. Daily Groceries & Atta Chakki"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>
          )}

          {isHealthCategory(category) && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-rose-500/30 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                  <span>🏥</span> Healthcare Facility & OPD Details
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Medical Specifics</span>
              </div>

              <label className="flex items-center gap-2.5 p-2 rounded-lg bg-rose-950/30 border border-rose-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={upiAvailable}
                  onChange={(e) => setUpiAvailable(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-500 bg-slate-900 border-slate-700 focus:ring-rose-400 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-semibold text-rose-300 block">
                    Accepts GPay / PM-JAY Ayushman Card
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    Digital payments & insurance card accepted (or Govt NHM Free Care)
                  </span>
                </div>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Healthcare Services Focus
                  </label>
                  <input
                    type="text"
                    value={healthServices}
                    onChange={(e) => setHealthServices(e.target.value)}
                    placeholder="e.g. Primary First Aid & Maternal Health"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Doctor / Clinic Timings
                  </label>
                  <input
                    type="text"
                    value={operationalHours}
                    onChange={(e) => setOperationalHours(e.target.value)}
                    placeholder="e.g. 10:00 AM – 5:00 PM (Mon–Sat)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>
            </div>
          )}

          {isEducationCategory(category) && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-purple-500/30 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                  <span>🏫</span> Educational Institution Amenities
                </span>
                <span className="text-[10px] text-slate-400 font-mono">No Payment Applied</span>
              </div>

              <div>
                <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                  Grade Levels / Standard
                </label>
                <input
                  type="text"
                  value={gradeLevels}
                  onChange={(e) => setGradeLevels(e.target.value)}
                  placeholder="e.g. Std 1st to 7th (Marathi/Semi-English Medium)"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={middayMeal}
                    onChange={(e) => setMiddayMeal(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-purple-500 bg-slate-950 border-slate-700 focus:ring-purple-400 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-300 font-semibold">
                    🍱 PM-POSHAN Midday Meal Active
                  </span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filteredWater}
                    onChange={(e) => setFilteredWater(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-purple-500 bg-slate-950 border-slate-700 focus:ring-purple-400 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-300 font-semibold">
                    🚰 Filtered Drinking Tap Available
                  </span>
                </label>
              </div>
            </div>
          )}

          {isWaterCategory(category) && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-cyan-500/30 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                  <span>🚰</span> Drinking Water Source Details
                </span>
                <span className="text-[10px] text-slate-400 font-mono">No Payment Applied</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Water Availability / Supply Timings
                  </label>
                  <input
                    type="text"
                    value={supplyTimings}
                    onChange={(e) => setSupplyTimings(e.target.value)}
                    placeholder="e.g. Morning 6:30 AM – 9:00 AM (Gravity Tank)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Source Potability Status
                  </label>
                  <select
                    value={potabilityStatus}
                    onChange={(e) => setPotabilityStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="✅ Potable Drinking Water">✅ Potable Drinking Water (Chlorinated)</option>
                    <option value="⚠️ Ground Testing Needed">⚠️ Ground Testing Needed (Unfiltered)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                  Maintenance Authority
                </label>
                <input
                  type="text"
                  value={maintenanceAuthority}
                  onChange={(e) => setMaintenanceAuthority(e.target.value)}
                  placeholder="e.g. Gram Panchayat Khopripada Water Dept"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          {isCivicCategory(category) && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-amber-500/30 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                  <span>🏛️</span> Civic & Cultural Space Details
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Community Hall / Temple</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Community Utilization
                  </label>
                  <input
                    type="text"
                    value={communityUsage}
                    onChange={(e) => setCommunityUsage(e.target.value)}
                    placeholder="e.g. Public Gatherings & Gram Sabha Meetings"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Seating / Capacity
                  </label>
                  <input
                    type="text"
                    value={seatingCapacity}
                    onChange={(e) => setSeatingCapacity(e.target.value)}
                    placeholder="e.g. Capacity: ~150 Persons"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          )}

          {isLightingCategory(category) && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-blue-500/30 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-300 flex items-center gap-1.5">
                  <span>💡</span> Public Lighting & Utility Specs
                </span>
                <span className="text-[10px] text-slate-400 font-mono">No Payment Applied</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Fixture / Asset Specification
                  </label>
                  <input
                    type="text"
                    value={fixtureType}
                    onChange={(e) => setFixtureType(e.target.value)}
                    placeholder="e.g. LED 45W / Solar Photovoltaic"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-300 font-semibold block mb-1">
                    Power Grid Feeder
                  </label>
                  <input
                    type="text"
                    value={powerGrid}
                    onChange={(e) => setPowerGrid(e.target.value)}
                    placeholder="e.g. MSEDCL Feeder Line"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Photo Upload & Camera Input Section */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <label className="text-[11px] font-semibold text-slate-200 block mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                Facility Inspection Photo
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                IndexedDB Photo Storage
              </span>
            </label>

            {/* Hidden Input with capture="environment" for camera / file picker */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              id="photo-upload"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {!photoBase64 ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCompressing}
                  className="w-full py-3 px-4 rounded-xl border border-dashed border-cyan-500/50 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                >
                  {isCompressing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></span>
                      <span>Compressing Photo...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <span>📷 Upload Photo / Take Pic</span>
                    </>
                  )}
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Live camera capture on mobile or file upload on desktop • Compressed automatically to save space
                </p>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 group">
                <img
                  src={photoBase64}
                  alt="Inspection Thumbnail"
                  className="w-full h-36 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent flex items-end justify-between p-2.5">
                  <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded border border-emerald-500/40">
                    <ImageIcon className="w-3 h-3" />
                    Photo Captured & Compressed
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold border border-slate-600 transition cursor-pointer"
                      title="Retake / Change Photo"
                    >
                      Retake
                    </button>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="p-1 rounded-lg bg-rose-950/90 hover:bg-rose-900 text-rose-300 border border-rose-600/50 transition cursor-pointer"
                      title="Remove Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold transition cursor-pointer text-xs"
            >
              Cancel <span className="text-slate-400 text-[10px]">(Esc)</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 text-xs"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Register Facility</span>
                </>
              )}
            </button>
          </div>
        </form>
        </>
        )}
      </div>
    </div>
  );
};
