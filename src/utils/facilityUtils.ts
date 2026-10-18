import type { CachedFacility } from '../services/offlineDb';

/**
 * Robust category classification helpers
 */
export const isCommercialCategory = (category: string = ''): boolean => {
  const c = category.toLowerCase();
  return (
    c === 'vendor' ||
    c.includes('shop') ||
    c.includes('kirana') ||
    c.includes('flour_mill') ||
    c.includes('stall') ||
    c.includes('store') ||
    c.includes('commerce') ||
    c.includes('local_shop')
  );
};

export const isHealthCategory = (category: string = ''): boolean => {
  const c = category.toLowerCase();
  return (
    c === 'health' ||
    c.includes('clinic') ||
    c.includes('sub_center') ||
    c.includes('dispensary') ||
    c.includes('govt_sub_center') ||
    c.includes('hospital') ||
    c.includes('medical')
  );
};

export const isEducationCategory = (category: string = ''): boolean => {
  const c = category.toLowerCase();
  return (
    c === 'school' ||
    c === 'anganwadi' ||
    c.includes('zp_school') ||
    c.includes('childcare') ||
    c.includes('education') ||
    c.includes('balwadi') ||
    c.includes('coaching') ||
    c.includes('anganwadi_govt')
  );
};

export const isWaterCategory = (category: string = '', name: string = ''): boolean => {
  if (isLightingCategory(category, name)) return false;
  const c = category.toLowerCase();
  const n = name.toLowerCase();
  return (
    c === 'water_standpost' ||
    c === 'water_borewell' ||
    c === 'water_tank' ||
    c.includes('standpost') ||
    c.includes('borewell') ||
    c.includes('tank') ||
    c.includes('jal_jeevan') ||
    c.includes('water') ||
    c.includes('pump') ||
    c.includes('private_drinking') ||
    c.includes('community_borewell') ||
    n.includes('borewell') ||
    n.includes('water point') ||
    n.includes('water supplier') ||
    n.includes('hand pump')
  );
};

export const isCivicCategory = (category: string = '', name: string = ''): boolean => {
  const c = category.toLowerCase();
  const n = name.toLowerCase();
  return (
    c === 'social_civic' ||
    c.includes('mandir') ||
    c.includes('temple') ||
    c.includes('community') ||
    c.includes('hall') ||
    c.includes('panchayat') ||
    c.includes('civic') ||
    n.includes('mandir') ||
    n.includes('temple')
  );
};

export const isLightingCategory = (category: string = '', name: string = ''): boolean => {
  const c = category.toLowerCase();
  const n = name.toLowerCase();
  return (
    c === 'streetlight' ||
    c.includes('solar_highmast') ||
    c.includes('drain') ||
    c.includes('pm_gram_sadak') ||
    c.includes('transformer') ||
    c.includes('pole') ||
    c.includes('light') ||
    c.includes('electric') ||
    n.includes('street light') ||
    n.includes('streetlight') ||
    n.includes('highmast') ||
    n.includes('solar light')
  );
};

/**
 * Returns Category Theme & Badge Styling for Popups and Cards
 */
export const getCategoryTheme = (category: string = '', name: string = '') => {
  if (isCommercialCategory(category)) {
    return {
      glyph: '🏪',
      badgeClass: 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300',
      label: 'Commercial & Retail',
    };
  }
  if (isHealthCategory(category)) {
    return {
      glyph: '🏥',
      badgeClass: 'bg-rose-950/80 border-rose-500/40 text-rose-300',
      label: 'Healthcare Facility',
    };
  }
  if (isEducationCategory(category)) {
    return {
      glyph: '🏫',
      badgeClass: 'bg-purple-950/80 border-purple-500/40 text-purple-300',
      label: 'Educational Institution',
    };
  }
  if (isLightingCategory(category, name)) {
    return {
      glyph: '💡',
      badgeClass: 'bg-blue-950/80 border-blue-500/40 text-blue-300',
      label: 'Lighting & Infrastructure',
    };
  }
  if (isWaterCategory(category, name)) {
    return {
      glyph: '🚰',
      badgeClass: 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300',
      label: 'Drinking Water Source',
    };
  }
  if (isCivicCategory(category, name)) {
    return {
      glyph: '🏛️',
      badgeClass: 'bg-amber-950/80 border-amber-500/40 text-amber-300',
      label: 'Civic & Cultural Space',
    };
  }
  return {
    glyph: '📌',
    badgeClass: 'bg-slate-900 border-slate-700 text-slate-300',
    label: category.replace(/_/g, ' '),
  };
};

/**
 * Build sleek HTML for Context-Aware Facility Attributes inside Leaflet Popups
 * Only renders attributes that logically apply to the facility category.
 */
export const buildFacilityContextAttributesHtml = (fac: CachedFacility): string => {
  const cat = fac.category || '';
  const notes = fac.notes || '';
  const name = fac.name || '';
  const isFunctional = (fac.operational_status || '').toLowerCase().includes('functional') &&
    !(fac.operational_status || '').toLowerCase().includes('non');

  // A. COMMERCIAL & RETAIL
  if (isCommercialCategory(cat)) {
    const isUpi = fac.upi_available !== false;
    const paymentBadge = isUpi
      ? `<div class="flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-lg shadow-sm">
           <span>💳</span> <span>UPI / GPay Accepted (QR Active)</span>
         </div>`
      : `<div class="flex items-center gap-1.5 text-[10px] font-semibold text-slate-300 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-lg">
           <span>💵</span> <span>Cash Only</span>
         </div>`;

    let serviceType = fac.service_type;
    if (!serviceType) {
      if (name.toLowerCase().includes('flour') || notes.toLowerCase().includes('milling')) {
        serviceType = 'Grain Milling & Atta Chakki';
      } else if (name.toLowerCase().includes('repair')) {
        serviceType = 'Electronics & Appliance Repair';
      } else if (name.toLowerCase().includes('saloon')) {
        serviceType = 'Grooming & Personal Care';
      } else if (name.toLowerCase().includes('pan')) {
        serviceType = 'Daily Provisions & Pooja Essentials';
      } else {
        serviceType = notes || 'Daily Essentials & Groceries';
      }
    }

    const businessHours = fac.business_hours || 'Open: 7:00 AM – 9:30 PM';

    return `
      <div class="mb-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Payment Method</span>
          ${paymentBadge}
        </div>
        <div class="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800/80">
          <span class="text-slate-400 flex items-center gap-1">🕒 Business Hours:</span>
          <span class="font-semibold text-slate-200">${businessHours}</span>
        </div>
        <div class="flex items-center justify-between text-slate-300">
          <span class="text-slate-400 flex items-center gap-1">🛒 Service Type:</span>
          <span class="font-semibold text-emerald-300 truncate max-w-[150px] text-right">${serviceType}</span>
        </div>
      </div>
    `;
  }

  // B. HEALTHCARE FACILITIES
  if (isHealthCategory(cat)) {
    const isPrivateOrUpi = fac.upi_available === true;
    const schemeBadge = isPrivateOrUpi
      ? `<div class="flex items-center gap-1.5 text-[10px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded-lg">
           <span>💳</span> <span>UPI / PM-JAY Card Accepted</span>
         </div>`
      : `<div class="flex items-center gap-1.5 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-lg">
           <span>🏥</span> <span>Govt NHM Free Public Care</span>
         </div>`;

    const healthServices = fac.health_services || (notes.includes('BHMS') ? 'OPD Consultation, Primary First Aid & Medicine' : 'Primary First Aid & Maternal Health');
    const operationalHours = fac.operational_hours || (notes.includes('AM') || notes.includes('PM') ? notes : '10:00 AM – 5:00 PM (Doctor On-Duty: Mon–Sat)');

    return `
      <div class="mb-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Health Scheme</span>
          ${schemeBadge}
        </div>
        <div class="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800/80">
          <span class="text-slate-400 flex items-center gap-1">🩺 Care Focus:</span>
          <span class="font-semibold text-rose-300 truncate max-w-[150px] text-right">${healthServices}</span>
        </div>
        <div class="flex items-center justify-between text-slate-300">
          <span class="text-slate-400 flex items-center gap-1">🕒 Doctor Timings:</span>
          <span class="font-semibold text-slate-200 text-right">${operationalHours}</span>
        </div>
      </div>
    `;
  }

  // C. EDUCATIONAL INSTITUTIONS (Strictly NO payment/UPI)
  if (isEducationCategory(cat)) {
    const isAnganwadi = cat.includes('anganwadi') || name.toLowerCase().includes('anganwadi') || name.toLowerCase().includes('balwadi');
    const gradeLevels = fac.grade_levels || (isAnganwadi ? 'ICDS Pre-Primary (Age 0-6 Yrs)' : notes.includes('12th') ? notes : 'Std 1st to 7th (Marathi/Semi-English)');

    return `
      <div class="mb-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] space-y-1.5">
        <div class="flex items-center justify-between text-slate-300">
          <span class="text-slate-400 flex items-center gap-1">🎓 Curriculum/Grades:</span>
          <span class="font-semibold text-purple-300 truncate max-w-[150px] text-right">${gradeLevels}</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800/80">
          <div class="flex items-center gap-1 text-[9px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md">
            <span>🍱</span> <span>PM-POSHAN Meal</span>
          </div>
          <div class="flex items-center gap-1 text-[9px] font-semibold text-teal-300 bg-teal-950/60 border border-teal-500/30 px-2 py-0.5 rounded-md">
            <span>🚰</span> <span>Filtered Water</span>
          </div>
        </div>
      </div>
    `;
  }

  // D. LIGHTING & UTILITIES (Strictly NO payment/commercial info)
  if (isLightingCategory(cat, name)) {
    const isSolar = cat.includes('solar') || name.toLowerCase().includes('solar');
    const isDrain = cat.includes('drain') || name.toLowerCase().includes('drain');

    const fixture = fac.fixture_type || (
      isSolar
        ? 'LED 45W / Solar Photovoltaic Highmast'
        : isDrain
        ? 'Concrete Stormwater Concrete Channel'
        : 'LED 40W High Efficiency Luminaire'
    );

    const powerGrid = fac.power_grid || (
      isSolar
        ? 'Standalone Solar Lithium-Ion Battery Storage'
        : 'MSEDCL Feeder Line (Panchayat Auto-Timer)'
    );

    return `
      <div class="mb-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] space-y-1.5">
        <div class="flex items-center justify-between text-slate-300">
          <span class="text-slate-400 flex items-center gap-1">💡 Specification:</span>
          <span class="font-semibold text-blue-300 truncate max-w-[140px] text-right">${fixture}</span>
        </div>
        <div class="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800/80">
          <span class="text-slate-400 flex items-center gap-1">⚡ Power Line:</span>
          <span class="font-semibold text-slate-200 truncate max-w-[140px] text-right">${powerGrid}</span>
        </div>
      </div>
    `;
  }

  // E. DRINKING WATER SOURCES (Strictly NO payment/UPI)
  if (isWaterCategory(cat, name)) {
    const isTank = cat.includes('tank') || name.toLowerCase().includes('tank') || name.toLowerCase().includes('supplier');
    const isBorewell = cat.includes('borewell') || name.toLowerCase().includes('borewell') || name.toLowerCase().includes('pump');

    const supplyTimings = fac.supply_timings || (
      isTank
        ? 'Gravity Bulk Tanker Refill (Demand Based)'
        : isBorewell
        ? '24x7 Deep Borewell & Manual Hand Pump'
        : 'Morning 6:30 AM – 9:00 AM (Gravity Tank)'
    );

    const potabilityStatus = fac.potability_status || (
      isFunctional
        ? '✅ Potable Drinking Water (Chlorinated)'
        : '⚠️ Ground Testing Needed'
    );

    const authority = fac.maintenance_authority || 'Gram Panchayat Khopripada Water Dept';

    return `
      <div class="mb-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] space-y-1.5">
        <div class="flex items-center justify-between text-slate-300">
          <span class="text-slate-400 flex items-center gap-1">💧 Supply Timings:</span>
          <span class="font-semibold text-cyan-300 truncate max-w-[150px] text-right">${supplyTimings}</span>
        </div>
        <div class="flex items-center justify-between pt-1 border-t border-slate-800/80">
          <span class="text-slate-400">Potability:</span>
          <span class="font-bold text-[9px] ${isFunctional ? 'text-emerald-300' : 'text-amber-300'}">${potabilityStatus}</span>
        </div>
        <div class="flex items-center justify-between text-slate-400 text-[9px]">
          <span>🏛️ Maintenance:</span>
          <span class="text-slate-300 font-semibold truncate max-w-[140px]">${authority}</span>
        </div>
      </div>
    `;
  }

  // F. CIVIC & CULTURAL SPACES (Strictly NO payment/UPI)
  if (isCivicCategory(cat, name)) {
    const usage = fac.community_usage || (notes ? notes : 'Public Gatherings & Gram Sabha Meetings');
    const capacity = fac.seating_capacity || 'Capacity: ~150 Persons';

    return `
      <div class="mb-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] space-y-1.5">
        <div class="flex items-center justify-between text-slate-300">
          <span class="text-slate-400 flex items-center gap-1">🏛️ Utilization:</span>
          <span class="font-semibold text-amber-300 truncate max-w-[150px] text-right">${usage}</span>
        </div>
        <div class="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800/80">
          <span class="text-slate-400 flex items-center gap-1">👥 Seating:</span>
          <span class="font-semibold text-slate-200">${capacity}</span>
        </div>
      </div>
    `;
  }

  // Generic Fallback (Notes only if present)
  if (notes) {
    return `
      <div class="mb-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] text-slate-300">
        <span class="text-slate-400 font-bold block mb-0.5">Asset Notes:</span>
        <span>${notes}</span>
      </div>
    `;
  }

  return '';
};
