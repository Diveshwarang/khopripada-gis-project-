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
      className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-[#0C171C]/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !verificationNotice) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-[#132228] border border-[#334B56] rounded-2xl shadow-2xl overflow-hidden text-[#F8FAFC] flex flex-col max-h-[92dvh] overscroll-contain">
        {/* Verification Success Notice for Resident / Villager */}
        {verificationNotice ? (
          <div className="p-6 text-center flex flex-col items-center gap-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#10B981]/20 border border-[#10B981]/60 flex items-center justify-center text-[#6EE7B7] shadow-[0_0_25px_rgba(16,185,129,0.3)] animate-bounce">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <span className="px-2.5 py-1 rounded-full bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] text-[11px] font-mono font-bold uppercase tracking-wider">
                Pending Verification
              </span>
              <h3 className="text-lg font-bold text-[#F8FAFC] mt-2">
                Facility Submitted Successfully
              </h3>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto mt-2 leading-relaxed bg-[#0C171C] p-3 rounded-xl border border-[#334B56]">
                {verificationNotice}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-bold text-xs transition active:scale-95 cursor-pointer shadow-md"
            >
              Back to Map Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#334B56] bg-[#0C171C]/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md ${
                  userRole === 'officer'
                    ? 'bg-[#10B981]/20 border border-[#10B981]/60 text-[#6EE7B7]'
                    : userRole === 'user'
                    ? 'bg-[#1B2F38] border border-[#38BDF8]/40 text-[#38BDF8]'
                    : 'bg-[#1B2F38] border border-[#334B56] text-[#F8FAFC]'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#F8FAFC] tracking-tight flex items-center gap-2">
                    {userRole === 'officer'
                      ? '+ Add Govt Scheme Asset'
                      : userRole === 'user'
                      ? 'Propose Local Community Facility'
                      : 'Register Village Facility'}
                  </h2>
                  <p className="text-xs text-[#94A3B8]">
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
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#1B2F38] transition cursor-pointer"
                title="Close (Esc)"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs scrollbar-thin">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-[#E05A47]/20 border border-[#E05A47] text-[#FCA5A5] text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Auto-filled Read-Only Fields: ID & GPS Coords */}
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#0C171C] border border-[#334B56]">
                <div>
                  <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1">
                    Facility ID
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={facilityId}
                    className="w-full bg-[#132228] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#38BDF8] font-mono text-xs font-bold focus:outline-none cursor-default"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#38BDF8]" /> Latitude
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly
                    value={coords[0].toFixed(6)}
                    className="w-full bg-[#132228] border border-[#334B56] rounded-lg px-2.5 py-2 text-[#F8FAFC] font-mono text-xs focus:outline-none cursor-default min-h-[40px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#38BDF8]" /> Longitude
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    readOnly
                    value={coords[1].toFixed(6)}
                    className="w-full bg-[#132228] border border-[#334B56] rounded-lg px-2.5 py-2 text-[#F8FAFC] font-mono text-xs focus:outline-none cursor-default min-h-[40px]"
                  />
                </div>
              </div>

              {/* Facility Name */}
              <div>
                <label className="font-semibold text-[#94A3B8] block mb-1">
                  Asset Title <span className="text-[#E05A47]">*</span>
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
                  className="w-full bg-[#0C171C] border border-[#334B56] rounded-xl px-3.5 py-2.5 text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#38BDF8] text-xs transition"
                />
              </div>

              {/* Category Dropdown (Strictly Role-Restricted) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#94A3B8]">
                    Category Badge <span className="text-[#E05A47]">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-[#94A3B8]">
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
                    className="w-full bg-[#0C171C] border border-[#334B56] rounded-xl px-3.5 py-2.5 text-[#F8FAFC] focus:outline-none focus:border-[#38BDF8] text-xs transition cursor-pointer appearance-none font-medium"
                  >
                    {userRole === 'officer' ? (
                      <>
                        <option value="jal_jeevan_tap">🚰 Jal Jeevan Mission Public Tap Stand (jal_jeevan_tap)</option>
                        <option value="zp_school_infrastructure">🏫 Z.P. Primary School Amenity (zp_school_infrastructure)</option>
                        <option value="anganwadi_govt">🎒 Govt ICDS Anganwadi Nutrition Center (anganwadi_govt)</option>
                        <option value="govt_sub_center">🏥 National Health Mission Sub-Center (govt_sub_center)</option>
                        <option value="solar_highmast">💡 Panchayat Solar Streetlight Project (solar_highmast)</option>
                        <option value="pm_gram_sadak_drain">🌊 Government Stormwater Concrete Drain (pm_gram_sadak_drain)</option>
                      </>
                    ) : userRole === 'user' ? (
                      <>
                        <option value="vendor">🏪 Local Shop / Kirana / Flour Mill (vendor)</option>
                        <option value="water_borewell">💧 Community Borewell / Hand Pump (water_borewell)</option>
                        <option value="water_standpost">🚰 Private / Shared Drinking Water Point (water_standpost)</option>
                        <option value="social_civic">🏛️ Mandir / Temple / Community Civic Space (social_civic)</option>
                        <option value="anganwadi">🎒 Balwadi / Community Childcare (anganwadi)</option>
                      </>
                    ) : (
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
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#94A3B8] text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Operational Status Dropdown */}
              <div>
                <label className="font-semibold text-[#94A3B8] block mb-1">
                  Status (Colored Pill) <span className="text-[#E05A47]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={operationalStatus}
                    onChange={(e) => setOperationalStatus(e.target.value)}
                    className="w-full bg-[#0C171C] border border-[#334B56] rounded-xl px-3.5 py-2.5 text-[#F8FAFC] focus:outline-none focus:border-[#38BDF8] text-xs transition cursor-pointer appearance-none"
                  >
                    <option value="functional">🟢 Functional (Emerald Green)</option>
                    <option value="partially_functional">🟡 Partially Functional / Degraded (Warm Amber)</option>
                    <option value="non_functional">🔴 Broken / Inoperative (Terracotta)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#94A3B8] text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* Monsoon Accessibility Dropdown */}
              <div>
                <label className="font-semibold text-[#94A3B8] block mb-1">
                  Monsoon Access Condition <span className="text-[#E05A47]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={monsoonAccessible}
                    onChange={(e) => setMonsoonAccessible(e.target.value)}
                    className="w-full bg-[#0C171C] border border-[#334B56] rounded-xl px-3.5 py-2.5 text-[#F8FAFC] focus:outline-none focus:border-[#38BDF8] text-xs transition cursor-pointer appearance-none"
                  >
                    <option value="year_round">✅ Year-round (Fully Accessible)</option>
                    <option value="waterlogged">⚠️ Floods/Isolated (Waterlogged in Rains)</option>
                    <option value="cut_off">⛔ Floods/Isolated (Completely Cut Off)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#94A3B8] text-xs">
                    ▼
                  </div>
                </div>
              </div>

              {/* DYNAMIC CONTEXT-AWARE ATTRIBUTE FORM SECTIONS */}
              {isCommercialCategory(category) && (
                <div className="p-3 rounded-xl bg-[#1B2F38]/50 border border-[#334B56] space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#38BDF8] flex items-center gap-1.5">
                      <span>🏪</span> Commercial & Retail Details
                    </span>
                    <span className="text-[10px] text-[#94A3B8] font-mono">Payment & Services</span>
                  </div>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0C171C] border border-[#334B56] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={upiAvailable}
                      onChange={(e) => setUpiAvailable(e.target.checked)}
                      className="w-4 h-4 rounded text-[#10B981] bg-[#132228] border-[#334B56] focus:ring-0 cursor-pointer accent-[#10B981]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-[#F8FAFC] block">
                        Accepts GPay / PhonePe / UPI Payments
                      </span>
                      <span className="text-[10px] text-[#94A3B8] block">
                        QR code setup active on store counter
                      </span>
                    </div>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                        Operating Hours
                      </label>
                      <input
                        type="text"
                        value={businessHours}
                        onChange={(e) => setBusinessHours(e.target.value)}
                        placeholder="e.g. 7:00 AM – 9:30 PM"
                        className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                        Service / Goods Type
                      </label>
                      <input
                        type="text"
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        placeholder="e.g. Daily Groceries & Atta Chakki"
                        className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isHealthCategory(category) && (
                <div className="p-3 rounded-xl bg-[#1B2F38]/50 border border-[#334B56] space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#E05A47] flex items-center gap-1.5">
                      <span>🏥</span> Healthcare Facility & OPD Details
                    </span>
                    <span className="text-[10px] text-[#94A3B8] font-mono">Medical Specifics</span>
                  </div>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0C171C] border border-[#334B56] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={upiAvailable}
                      onChange={(e) => setUpiAvailable(e.target.checked)}
                      className="w-4 h-4 rounded text-[#E05A47] bg-[#132228] border-[#334B56] focus:ring-0 cursor-pointer accent-[#E05A47]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-[#F8FAFC] block">
                        Accepts GPay / PM-JAY Ayushman Card
                      </span>
                      <span className="text-[10px] text-[#94A3B8] block">
                        Digital payments & insurance card accepted (or Govt NHM Free Care)
                      </span>
                    </div>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                        Healthcare Services Focus
                      </label>
                      <input
                        type="text"
                        value={healthServices}
                        onChange={(e) => setHealthServices(e.target.value)}
                        placeholder="e.g. Primary First Aid & Maternal Health"
                        className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                        Doctor / Clinic Timings
                      </label>
                      <input
                        type="text"
                        value={operationalHours}
                        onChange={(e) => setOperationalHours(e.target.value)}
                        placeholder="e.g. 10:00 AM – 5:00 PM (Mon–Sat)"
                        className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isEducationCategory(category) && (
                <div className="p-3 rounded-xl bg-[#1B2F38]/50 border border-[#334B56] space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#38BDF8] flex items-center gap-1.5">
                      <span>🏫</span> Educational Institution Amenities
                    </span>
                    <span className="text-[10px] text-[#94A3B8] font-mono">No Payment Applied</span>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                      Grade Levels / Standard
                    </label>
                    <input
                      type="text"
                      value={gradeLevels}
                      onChange={(e) => setGradeLevels(e.target.value)}
                      placeholder="e.g. Std 1st to 7th (Marathi/Semi-English Medium)"
                      className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-[#0C171C] border border-[#334B56] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={middayMeal}
                        onChange={(e) => setMiddayMeal(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-[#10B981] bg-[#132228] border-[#334B56] focus:ring-0 cursor-pointer accent-[#10B981]"
                      />
                      <span className="text-[10px] text-[#F8FAFC] font-semibold">
                        🍱 PM-POSHAN Midday Meal Active
                      </span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-lg bg-[#0C171C] border border-[#334B56] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filteredWater}
                        onChange={(e) => setFilteredWater(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-[#10B981] bg-[#132228] border-[#334B56] focus:ring-0 cursor-pointer accent-[#10B981]"
                      />
                      <span className="text-[10px] text-[#F8FAFC] font-semibold">
                        🚰 Filtered Drinking Tap Available
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {isWaterCategory(category) && (
                <div className="p-3 rounded-xl bg-[#1B2F38]/50 border border-[#334B56] space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#10B981] flex items-center gap-1.5">
                      <span>🚰</span> Drinking Water Source Details
                    </span>
                    <span className="text-[10px] text-[#94A3B8] font-mono">No Payment Applied</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                        Water Availability / Supply Timings
                      </label>
                      <input
                        type="text"
                        value={supplyTimings}
                        onChange={(e) => setSupplyTimings(e.target.value)}
                        placeholder="e.g. Morning 6:30 AM – 9:00 AM (Gravity Tank)"
                        className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                        Source Potability Status
                      </label>
                      <select
                        value={potabilityStatus}
                        onChange={(e) => setPotabilityStatus(e.target.value)}
                        className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8] cursor-pointer"
                      >
                        <option value="✅ Potable Drinking Water">✅ Potable Drinking Water (Chlorinated)</option>
                        <option value="⚠️ Ground Testing Needed">⚠️ Ground Testing Needed (Unfiltered)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                      Maintenance Authority
                    </label>
                    <input
                      type="text"
                      value={maintenanceAuthority}
                      onChange={(e) => setMaintenanceAuthority(e.target.value)}
                      placeholder="e.g. Gram Panchayat Khopripada Water Dept"
                      className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8]"
                    />
                  </div>
                </div>
              )}

              {isCivicCategory(category) && (
                <div className="p-3 rounded-xl bg-[#1B2F38]/50 border border-[#334B56] space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#FCD34D] flex items-center gap-1.5">
                      <span>🏛️</span> Civic & Cultural Space Details
                    </span>
                    <span className="text-[10px] text-[#94A3B8] font-mono">Community Hall / Temple</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                        Community Utilization
                      </label>
                      <input
                        type="text"
                        value={communityUsage}
                        onChange={(e) => setCommunityUsage(e.target.value)}
                        placeholder="e.g. Public Gatherings & Gram Sabha Meetings"
                        className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                        Seating / Capacity
                      </label>
                      <input
                        type="text"
                        value={seatingCapacity}
                        onChange={(e) => setSeatingCapacity(e.target.value)}
                        placeholder="e.g. Capacity: ~150 Persons"
                        className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {isLightingCategory(category) && (
                <div className="p-3 rounded-xl bg-[#1B2F38]/50 border border-[#334B56] space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#38BDF8] flex items-center gap-1.5">
                      <span>💡</span> Public Lighting & Utility Specs
                    </span>
                    <span className="text-[10px] text-[#94A3B8] font-mono">No Payment Applied</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                        Fixture / Asset Specification
                      </label>
                      <input
                        type="text"
                        value={fixtureType}
                        onChange={(e) => setFixtureType(e.target.value)}
                        placeholder="e.g. LED 45W / Solar Photovoltaic"
                        className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#94A3B8] font-semibold block mb-1">
                        Power Grid Feeder
                      </label>
                      <input
                        type="text"
                        value={powerGrid}
                        onChange={(e) => setPowerGrid(e.target.value)}
                        placeholder="e.g. MSEDCL Feeder Line"
                        className="w-full bg-[#0C171C] border border-[#334B56] rounded-lg px-2.5 py-1.5 text-[#F8FAFC] text-xs focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Photo Upload & Camera Input Section */}
              <div className="p-3.5 rounded-xl bg-[#0C171C] border border-[#334B56]">
                <label className="text-[11px] font-semibold text-[#94A3B8] block mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#38BDF8]" />
                    Facility Inspection Photo
                  </span>
                  <span className="text-[10px] text-[#94A3B8] font-mono">
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
                      className="w-full py-3 px-4 rounded-xl border border-dashed border-[#334B56] hover:border-[#38BDF8] bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                    >
                      {isCompressing ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-[#38BDF8]/30 border-t-[#38BDF8] rounded-full animate-spin"></span>
                          <span>Compressing Photo...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4 text-[#38BDF8]" />
                          <span>📷 Upload Photo / Take Pic</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-[#94A3B8] text-center">
                      Live camera capture on mobile or file upload on desktop • Compressed automatically to save space
                    </p>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-[#334B56] bg-[#0C171C] group">
                    <img
                      src={photoBase64}
                      alt="Inspection Thumbnail"
                      className="w-full h-36 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#132228]/95 via-transparent to-transparent flex items-end justify-between p-2.5">
                      <span className="text-[10px] text-[#38BDF8] font-mono font-bold flex items-center gap-1 bg-[#132228]/90 px-2 py-0.5 rounded border border-[#38BDF8]/40">
                        <ImageIcon className="w-3 h-3" />
                        Photo Captured & Compressed
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2 py-1 rounded-lg bg-[#1B2F38] hover:bg-[#233B46] text-[#F8FAFC] text-[10px] font-semibold border border-[#334B56] transition cursor-pointer"
                          title="Retake / Change Photo"
                        >
                          Retake
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          className="p-1 rounded-lg bg-[#E05A47]/90 hover:bg-[#E05A47] text-[#F8FAFC] border border-[#E05A47] transition cursor-pointer"
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
              <div className="pt-3 border-t border-[#334B56] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#1B2F38] hover:bg-[#233B46] text-[#94A3B8] hover:text-[#F8FAFC] font-semibold transition cursor-pointer text-xs border border-[#334B56]"
                >
                  Cancel <span className="text-[#94A3B8] text-[10px]">(Esc)</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || isCompressing}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 text-xs"
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

export default AddFacilityModal;
