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
import { upsertFacility } from '../services/dataService';
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
  const [potabilityStatus, setPotabilityStatus] = useState<string>('Potable Drinking Water');
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
        latitude: coords[0],
        longitude: coords[1],
        monsoon_accessible: monsoonLabel,
        photoBase64: photoBase64 || undefined,
        approval_status: isAdmin ? 'approved' : isResident ? 'pending_approval' : 'approved',
        submitted_by: isResident ? 'Resident' : isOfficer ? 'Officer' : 'Admin',
        upi_available: isComm ? upiAvailable : isHlth ? upiAvailable : undefined,
        business_hours: isComm ? businessHours : undefined,
        service_type: isComm ? serviceType : undefined,
        health_services: isHlth ? healthServices : undefined,
        operational_hours: isHlth ? operationalHours : undefined,
        grade_levels: isEdu ? gradeLevels : undefined,
        midday_meal_available: isEdu ? middayMeal : undefined,
        drinking_water_available: isEdu ? filteredWater : undefined,
        water_supply_timings: isWtr ? supplyTimings : undefined,
        water_potability: isWtr ? potabilityStatus : undefined,
        maintenance_authority: isWtr ? maintenanceAuthority : undefined,
        community_usage: isCiv ? communityUsage : undefined,
        seating_capacity: isCiv ? seatingCapacity : undefined,
        lighting_fixture_type: isUtil ? fixtureType : undefined,
        power_grid_feeder: isUtil ? powerGrid : undefined,
      };

      // Realtime cross-device sync via Supabase dataService
      await upsertFacility(newFacility);

      if (isResident) {
        onFacilitySaved(newFacility);
        setVerificationNotice(
          'Submitted for Panchayat Verification. Your proposal has been sent to the Gram Panchayat review queue and will appear live once confirmed.'
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
      className="fixed inset-0 z-[4000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !verificationNotice) onClose();
      }}
    >
      <div className="relative w-full max-w-lg mx-auto max-h-[85dvh] sm:max-h-[90dvh] bg-[#0D1C2A] border-t sm:border border-[#1D3B52] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col text-[#F1F5F9] overflow-hidden">
        {/* Mobile touch-drag handle pill */}
        <div className="w-10 h-1 bg-[#1D3B52] rounded-full mx-auto my-2 sm:hidden flex-shrink-0" />

        {/* Verification Success Notice for Resident / Villager */}
        {verificationNotice ? (
          <div className="p-6 text-center flex flex-col items-center gap-4 my-auto overflow-y-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-800 flex items-center justify-center text-emerald-400 shadow-xs animate-bounce">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <span className="px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-800 text-amber-300 text-[11px] font-mono font-bold uppercase tracking-wider">
                Pending Verification
              </span>
              <h3 className="text-lg font-bold text-white mt-2">
                Facility Submitted Successfully
              </h3>
              <p className="text-xs text-[#8CB0C9] max-w-sm mx-auto mt-2 leading-relaxed bg-[#081018] p-3 rounded-xl border border-[#1D3B52]">
                {verificationNotice}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 min-h-[44px] px-6 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#38BDF8] text-[#081018] font-bold text-xs transition active:scale-95 cursor-pointer shadow-xs"
            >
              Back to Map Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-[#1D3B52] bg-[#081018] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-xs bg-[#142C3F] border border-[#00E5FF]/40 text-[#00E5FF]">
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
                  <p className="text-xs text-[#8CB0C9]">
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
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#8CB0C9] hover:text-[#F1F5F9] hover:bg-[#142C3F] transition cursor-pointer"
                title="Close (Esc)"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs scrollbar-thin">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Auto-filled Read-Only Fields: ID & GPS Coords */}
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#081018]/60 border border-[#1D3B52]">
                <div>
                  <label className="text-[10px] font-mono text-[#5A7C93] uppercase tracking-wider block mb-1">
                    Facility ID
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={facilityId}
                    className="w-full bg-[#081018] border border-[#1D3B52] rounded-lg px-2.5 py-1.5 text-[#00E5FF] font-mono text-xs font-bold focus:outline-none cursor-default"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-[#5A7C93] uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#00E5FF]" /> Latitude
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly
                    value={coords[0].toFixed(6)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 font-mono text-[16px] sm:text-xs focus:outline-none cursor-default min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#48999E]" /> Longitude
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly
                    value={coords[1].toFixed(6)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800 font-mono text-[16px] sm:text-xs focus:outline-none cursor-default min-h-[44px]"
                  />
                </div>
              </div>

              {/* Facility Name */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Asset Title <span className="text-[#E56A54]">*</span>
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#48999E] text-[16px] sm:text-xs transition min-h-[44px]"
                />
              </div>

              {/* Category Dropdown (Strictly Role-Restricted) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">
                    Category Badge <span className="text-[#E56A54]">*</span>
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-[#48999E] text-[16px] sm:text-xs transition cursor-pointer appearance-none font-medium min-h-[44px]"
                  >
                    {userRole === 'officer' ? (
                      <>
                        <option value="jal_jeevan_tap">Jal Jeevan Mission Public Tap Stand (jal_jeevan_tap)</option>
                        <option value="zp_school_infrastructure">Z.P. Primary School Amenity (zp_school_infrastructure)</option>
                        <option value="anganwadi_govt">Govt ICDS Anganwadi Nutrition Center (anganwadi_govt)</option>
                        <option value="govt_sub_center">National Health Mission Sub-Center (govt_sub_center)</option>
                        <option value="solar_highmast">Panchayat Solar Streetlight Project (solar_highmast)</option>
                        <option value="pm_gram_sadak_drain">Government Stormwater Concrete Drain (pm_gram_sadak_drain)</option>
                      </>
                    ) : userRole === 'user' ? (
                      <>
                        <option value="vendor">Local Shop / Kirana / Flour Mill (vendor)</option>
                        <option value="water_borewell">Community Borewell / Hand Pump (water_borewell)</option>
                        <option value="water_standpost">Private / Shared Drinking Water Point (water_standpost)</option>
                        <option value="social_civic">Mandir / Temple / Community Civic Space (social_civic)</option>
                        <option value="anganwadi">Balwadi / Community Childcare (anganwadi)</option>
                      </>
                    ) : (
                      <>
                        <optgroup label="Government Schemes">
                          <option value="jal_jeevan_tap">Jal Jeevan Mission Public Tap Stand</option>
                          <option value="zp_school_infrastructure">Z.P. Primary School Infrastructure</option>
                          <option value="anganwadi_govt">Govt ICDS Anganwadi Center</option>
                          <option value="govt_sub_center">National Health Mission Sub-Center</option>
                          <option value="solar_highmast">Panchayat Solar Highmast Light</option>
                          <option value="pm_gram_sadak_drain">Government Stormwater Concrete Drain</option>
                        </optgroup>
                        <optgroup label="Village & Community Assets">
                          <option value="water_standpost">Public Tap (water_standpost)</option>
                          <option value="water_borewell">Borewell / Hand Pump (water_borewell)</option>
                          <option value="water_tank">Storage Tank (water_tank)</option>
                          <option value="school">Z.P. School / Primary (school)</option>
                          <option value="anganwadi">Childcare / Nutrition Center (anganwadi)</option>
                          <option value="health">Sub-center / Clinic (health)</option>
                          <option value="vendor">Kirana / Flour Mill / Local Stall (vendor)</option>
                          <option value="social_civic">Community Hall / Mandir / Panchayat (social_civic)</option>
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
                <label className="font-semibold text-slate-700 block mb-1">
                  Status (Colored Pill) <span className="text-[#E56A54]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={operationalStatus}
                    onChange={(e) => setOperationalStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-[#48999E] text-xs transition cursor-pointer appearance-none"
                  >
                    <option value="functional">Functional (Emerald)</option>
                    <option value="partially_functional">Partially Functional / Degraded (Amber)</option>
                    <option value="non_functional">Broken / Inoperative (Terracotta)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Monsoon Accessibility Dropdown */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Monsoon Access Condition <span className="text-[#E56A54]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={monsoonAccessible}
                    onChange={(e) => setMonsoonAccessible(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:border-[#48999E] text-xs transition cursor-pointer appearance-none"
                  >
                    <option value="year_round">Year-round (Fully Accessible)</option>
                    <option value="waterlogged">Seasonal (Waterlogged in Rains)</option>
                    <option value="cut_off">Floods / Cut Off (Isolated in Monsoon)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* DYNAMIC CONTEXT-AWARE ATTRIBUTE FORM SECTIONS */}
              {isCommercialCategory(category) && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#48999E] flex items-center gap-1.5">
                      Commercial & Retail Details
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Payment & Services</span>
                  </div>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={upiAvailable}
                      onChange={(e) => setUpiAvailable(e.target.checked)}
                      className="w-4 h-4 rounded text-[#10B981] bg-white border-slate-300 focus:ring-0 cursor-pointer accent-[#10B981]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Accepts GPay / PhonePe / UPI Payments
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        QR code setup active on store counter
                      </span>
                    </div>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                        Operating Hours
                      </label>
                      <input
                        type="text"
                        value={businessHours}
                        onChange={(e) => setBusinessHours(e.target.value)}
                        placeholder="e.g. 7:00 AM – 9:30 PM"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                        Service / Goods Type
                      </label>
                      <input
                        type="text"
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        placeholder="e.g. Daily Groceries & Atta Chakki"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isHealthCategory(category) && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#E56A54] flex items-center gap-1.5">
                      Healthcare Facility & OPD Details
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Medical Specifics</span>
                  </div>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={upiAvailable}
                      onChange={(e) => setUpiAvailable(e.target.checked)}
                      className="w-4 h-4 rounded text-[#E56A54] bg-white border-slate-300 focus:ring-0 cursor-pointer accent-[#E56A54]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Accepts GPay / PM-JAY Ayushman Card
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        Digital payments & insurance card accepted (or Govt NHM Free Care)
                      </span>
                    </div>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                        Healthcare Services Focus
                      </label>
                      <input
                        type="text"
                        value={healthServices}
                        onChange={(e) => setHealthServices(e.target.value)}
                        placeholder="e.g. Primary First Aid & Maternal Health"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                        Doctor / Clinic Timings
                      </label>
                      <input
                        type="text"
                        value={operationalHours}
                        onChange={(e) => setOperationalHours(e.target.value)}
                        placeholder="e.g. 10:00 AM – 5:00 PM (Mon–Sat)"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isEducationCategory(category) && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#48999E] flex items-center gap-1.5">
                      Educational Institution Amenities
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">No Payment Applied</span>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                      Grade Levels / Standard
                    </label>
                    <input
                      type="text"
                      value={gradeLevels}
                      onChange={(e) => setGradeLevels(e.target.value)}
                      placeholder="e.g. Std 1st to 7th (Marathi/Semi-English Medium)"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={middayMeal}
                        onChange={(e) => setMiddayMeal(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-[#10B981] bg-white border-slate-300 focus:ring-0 cursor-pointer accent-[#10B981]"
                      />
                      <span className="text-[10px] text-slate-800 font-semibold">
                        PM-POSHAN Midday Meal Active
                      </span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filteredWater}
                        onChange={(e) => setFilteredWater(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-[#10B981] bg-white border-slate-300 focus:ring-0 cursor-pointer accent-[#10B981]"
                      />
                      <span className="text-[10px] text-slate-800 font-semibold">
                        Filtered Drinking Tap Available
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {isWaterCategory(category) && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#10B981] flex items-center gap-1.5">
                      Drinking Water Source Details
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">No Payment Applied</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                        Water Availability / Supply Timings
                      </label>
                      <input
                        type="text"
                        value={supplyTimings}
                        onChange={(e) => setSupplyTimings(e.target.value)}
                        placeholder="e.g. Morning 6:30 AM – 9:00 AM (Gravity Tank)"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                        Source Potability Status
                      </label>
                      <select
                        value={potabilityStatus}
                        onChange={(e) => setPotabilityStatus(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E] cursor-pointer"
                      >
                        <option value="Potable Drinking Water">Potable Drinking Water (Chlorinated)</option>
                        <option value="Ground Testing Needed">Ground Testing Needed (Unfiltered)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                      Maintenance Authority
                    </label>
                    <input
                      type="text"
                      value={maintenanceAuthority}
                      onChange={(e) => setMaintenanceAuthority(e.target.value)}
                      placeholder="e.g. Gram Panchayat Khopripada Water Dept"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E]"
                    />
                  </div>
                </div>
              )}

              {isCivicCategory(category) && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5">
                      Civic & Cultural Space Details
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Community Hall / Temple</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                        Community Utilization
                      </label>
                      <input
                        type="text"
                        value={communityUsage}
                        onChange={(e) => setCommunityUsage(e.target.value)}
                        placeholder="e.g. Public Gatherings & Gram Sabha Meetings"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                        Seating / Capacity
                      </label>
                      <input
                        type="text"
                        value={seatingCapacity}
                        onChange={(e) => setSeatingCapacity(e.target.value)}
                        placeholder="e.g. Capacity: ~150 Persons"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isLightingCategory(category) && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#48999E] flex items-center gap-1.5">
                      Public Lighting & Utility Specs
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">No Payment Applied</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                        Fixture / Asset Specification
                      </label>
                      <input
                        type="text"
                        value={fixtureType}
                        onChange={(e) => setFixtureType(e.target.value)}
                        placeholder="e.g. LED 45W / Solar Photovoltaic"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 font-semibold block mb-1">
                        Power Grid Feeder
                      </label>
                      <input
                        type="text"
                        value={powerGrid}
                        onChange={(e) => setPowerGrid(e.target.value)}
                        placeholder="e.g. MSEDCL Feeder Line"
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 text-xs focus:outline-none focus:border-[#48999E]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Photo Upload & Camera Input Section */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <label className="text-[11px] font-semibold text-slate-700 block mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#48999E]" />
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
                      className="w-full py-3 px-4 rounded-xl border border-dashed border-slate-300 hover:border-[#48999E] bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                    >
                      {isCompressing ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-[#48999E]/30 border-t-[#48999E] rounded-full animate-spin"></span>
                          <span>Compressing Photo...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4 text-[#48999E]" />
                          <span>Upload Inspection Photo</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center">
                      Live camera capture on mobile or file upload on desktop • Compressed automatically to save space
                    </p>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group">
                    <img
                      src={photoBase64}
                      alt="Inspection Thumbnail"
                      className="w-full h-36 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-2.5">
                      <span className="text-[10px] text-white font-mono font-bold flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded border border-white/20">
                        <ImageIcon className="w-3 h-3 text-[#48999E]" />
                        Photo Captured & Compressed
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2 py-1 rounded-lg bg-white/90 hover:bg-white text-slate-800 text-[10px] font-semibold border border-slate-300 transition cursor-pointer"
                          title="Retake / Change Photo"
                        >
                          Retake
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="p-1 rounded-lg bg-[#E56A54] hover:bg-[#D45943] text-white border border-[#E56A54] transition cursor-pointer"
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
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1D3B52]">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#081018] hover:bg-[#142C3F] text-[#8CB0C9] hover:text-[#F1F5F9] font-semibold transition cursor-pointer text-xs border border-[#1D3B52]"
                >
                  Cancel <span className="text-[#5A7C93] text-[10px]">(Esc)</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || isCompressing}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#38BDF8] text-[#081018] font-bold transition-all shadow-lg flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 text-xs"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-[#081018]/30 border-t-[#081018] rounded-full animate-spin"></span>
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

export default AddFacilityModal;
