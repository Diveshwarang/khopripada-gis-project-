import L from 'leaflet';
import type { FacilityAsset, FacilityMetadata } from '../types';

export function resolveFacilityAttributes(fac: FacilityAsset | any): FacilityMetadata {
  const cat = (fac?.category || '').toLowerCase();
  const name = (fac?.name || '').toLowerCase();
  const existing = fac?.metadata || {};

  // 1. Schools & Educational Institutions
  if (cat.includes('edu') || cat.includes('school') || name.includes('school')) {
    return {
      payment_modes: existing.payment_modes || ['Direct Bank Transfer (DBT)', 'Zero Fee (Govt ZP)'],
      water_facility: existing.water_facility || 'Available (RO / Filtered Standpost)',
      sanitation_facility: existing.sanitation_facility || 'Separate Boys/Girls Toilets (Functional)',
      power_backup: existing.power_backup || 'Solar Powered Rooftop Backup',
      operating_hours: existing.operating_hours || '07:30 AM - 01:30 PM (Mon - Sat)',
      contact_person: existing.contact_person || 'School Headmaster / ZP Coordinator',
      ...existing,
    };
  }

  // 2. Health Centers, Sub-Centers & Anganwadis
  if (cat.includes('health') || cat.includes('anganwadi') || cat.includes('clinic') || name.includes('hospital')) {
    return {
      payment_modes: existing.payment_modes || ['Ayushman Bharat / Free Govt Care', 'Cash'],
      water_facility: existing.water_facility || 'Continuous Filtered Water Supply (24/7)',
      sanitation_facility: existing.sanitation_facility || 'Sanitized Medical Waste / Attached Washroom',
      power_backup: existing.power_backup || 'Dedicated Inverter Backup (Vaccine Cold Chain Active)',
      operating_hours: existing.operating_hours || '09:00 AM - 05:00 PM (Emergency on-call)',
      contact_person: existing.contact_person || 'ASHA Worker / Primary Medical Officer',
      emergency_number: existing.emergency_number || '108 (Ambulance Helpline)',
      ...existing,
    };
  }

  // 3. Shops, Kirana Stores & Rural Commerce
  if (cat.includes('shop') || cat.includes('commerce') || cat.includes('kirana') || cat.includes('market')) {
    return {
      payment_modes: existing.payment_modes || ['UPI (PhonePe / GPay)', 'Cash Accepted'],
      water_facility: existing.water_facility || 'Nearby Public Handpump (~30m)',
      operating_hours: existing.operating_hours || '07:00 AM - 09:30 PM (Daily)',
      contact_person: existing.contact_person || 'Store Owner',
      ...existing,
    };
  }

  // 4. Drinking Water Infrastructure (Tanks, Taps, Borewells)
  if (cat.includes('water') || cat.includes('tap') || cat.includes('well')) {
    return {
      payment_modes: ['Free Public Service (Jal Jeevan Mission)'],
      water_facility: 'Potable Drinking Water (Chlorinated Supply)',
      operating_hours: 'Supply Hours: 06:00 AM - 09:00 AM & 05:00 PM - 07:00 PM',
      contact_person: 'Panchayat Jal Surakshak',
      ...existing,
    };
  }

  // 5. Civic, Religious & Community Spaces (Panchayat Office, Mandirs)
  if (cat.includes('civic') || cat.includes('panchayat') || cat.includes('mandir') || cat.includes('temple')) {
    return {
      payment_modes: existing.payment_modes || ['UPI Donations / Seva Box', 'Cash'],
      water_facility: existing.water_facility || 'Community Drinking Water Tap Active',
      sanitation_facility: existing.sanitation_facility || 'Public Urinal Adjacent',
      operating_hours: existing.operating_hours || '06:00 AM - 08:30 PM',
      contact_person: existing.contact_person || 'Gram Sevak / Trustee',
      ...existing,
    };
  }

  // Default fallback
  return {
    payment_modes: ['Cash / Standard'],
    water_facility: 'Nearby Community Source',
    operating_hours: 'Regular Daytime Access',
    ...existing,
  };
}

export type FacilityTier = 'tier1_anchor' | 'tier2_civic' | 'tier3_local' | 'tier4_micro';

export function classifyFacilityTier(category?: string, name?: string): FacilityTier {
  const cat = (category || '').toLowerCase();
  const n = (name || '').toLowerCase();

  // Tier 1: Core anchors (visible at macro zoom < 15)
  if (
    cat.includes('panchayat') ||
    cat.includes('hospital') ||
    cat.includes('primary health') ||
    n.includes('gram panchayat') ||
    n.includes('hospital') ||
    n.includes('zilla parishad school')
  ) {
    return 'tier1_anchor';
  }

  // Tier 2: Community infrastructure (visible at zoom 15-16)
  if (
    cat.includes('school') ||
    cat.includes('anganwadi') ||
    cat.includes('mandir') ||
    cat.includes('temple') ||
    cat.includes('water tank') ||
    cat.includes('sub center')
  ) {
    return 'tier2_civic';
  }

  // Tier 3: Local utilities & commerce (visible at zoom 17)
  if (
    cat.includes('water') ||
    cat.includes('tap') ||
    cat.includes('well') ||
    cat.includes('shop') ||
    cat.includes('kirana') ||
    cat.includes('dairy')
  ) {
    return 'tier3_local';
  }

  // Tier 4: Granular micro-fixtures (visible at zoom 18+)
  return 'tier4_micro'; // Solar streetlights, handpumps, waste bins, individual meters
}

export function createPOIDivIcon(
  name: string,
  category: string,
  _tier: FacilityTier,
  showLabel: boolean
): L.DivIcon {
  const cat = (category || '').toLowerCase();

  let bg = '#0284C7';
  let svgPath = '';

  if (cat.includes('water') || cat.includes('tap') || cat.includes('well') || cat.includes('tank') || cat.includes('pump')) {
    bg = '#0284C7'; // Cyan Water
    svgPath = `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />`;
  } else if (cat.includes('health') || cat.includes('anganwadi') || cat.includes('clinic') || cat.includes('hospital')) {
    bg = '#059669'; // Emerald Health
    svgPath = `<path d="M19 10.5h-5.5V5h-3v5.5H5v3h5.5V19h3v-5.5H19z" />`;
  } else if (cat.includes('edu') || cat.includes('school') || cat.includes('college')) {
    bg = '#4F46E5'; // Indigo School
    svgPath = `<path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17z" />`;
  } else if (cat.includes('mandir') || cat.includes('temple') || cat.includes('civic') || cat.includes('panchayat')) {
    bg = '#8B5CF6'; // Purple Civic
    svgPath = `<path d="M12 2l7 4v3H5V6zm-5 9h2v8H7zm4 0h2v8h-2zm4 0h2v8h-2zM3 21h18v2H3z" />`;
  } else if (cat.includes('light') || cat.includes('solar') || cat.includes('pole') || cat.includes('lamp')) {
    bg = '#D97706'; // Amber Light
    svgPath = `<path d="M9 21h6v-2H9zm3-19a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17h8v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7z" />`;
  } else {
    bg = '#0D9488'; // Teal
    svgPath = `<circle cx="12" cy="12" r="6" />`;
  }

  // Google Maps style typography pill
  const cleanName = (name || 'Asset').replace(/_/g, ' ');
  const displayName = cleanName.length > 20 ? cleanName.substring(0, 18) + '...' : cleanName;

  const html = `
    <div style="display: inline-flex; align-items: center; gap: 6px; pointer-events: auto; cursor: pointer;">
      <div style="
        background-color: ${bg};
        width: 22px;
        height: 22px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 4px rgba(0,0,0,0.45);
        border: 1.5px solid #FFFFFF;
        flex-shrink: 0;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFFFFF">
          ${svgPath}
        </svg>
      </div>
      ${
        showLabel
          ? `<span style="
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              font-size: 11px;
              font-weight: 600;
              color: #FFFFFF;
              text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 5px rgba(0,0,0,0.85);
              white-space: nowrap;
              letter-spacing: 0.2px;
              background: rgba(13, 28, 42, 0.7);
              padding: 1px 5px;
              border-radius: 4px;
              border: 0.5px solid rgba(255,255,255,0.25);
            ">${displayName}</span>`
          : ''
      }
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-poi-marker',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

export function createIssueDivIcon(title: string, severity: string, showLabel: boolean): L.DivIcon {
  const sev = (severity || 'low').toLowerCase();
  const isHigh = sev === 'high' || sev === 'critical' || sev === 'urgent';
  const isMedium = sev === 'medium';
  const bg = isHigh ? '#EF4444' : isMedium ? '#F59E0B' : '#0284C7';

  const cleanTitle = (title || 'Issue').replace(/_/g, ' ');
  const displayTitle = cleanTitle.length > 20 ? cleanTitle.substring(0, 18) + '...' : cleanTitle;

  const html = `
    <div style="display: inline-flex; align-items: center; gap: 6px; pointer-events: auto; cursor: pointer;">
      <div style="
        background-color: ${bg};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 8px ${bg}99, 0 2px 5px rgba(0,0,0,0.5);
        border: 2px solid #FFFFFF;
        animation: ${isHigh ? 'pulse 1.8s infinite' : 'none'};
        flex-shrink: 0;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFFFFF">
          <path d="M12 2L1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
        </svg>
      </div>
      ${
        showLabel
          ? `<span style="
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 11px;
              font-weight: 700;
              color: #FCA5A5;
              text-shadow: 0 1px 3px rgba(0,0,0,0.9);
              white-space: nowrap;
              background: rgba(45, 10, 10, 0.85);
              padding: 1px 6px;
              border-radius: 4px;
              border: 0.5px solid rgba(239,68,68,0.5);
            ">${displayTitle}</span>`
          : ''
      }
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-issue-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

// Backward-compatibility exports
export const getFacilityDivIcon = (category?: string, name?: string) =>
  createPOIDivIcon(name || 'Facility', category || '', classifyFacilityTier(category, name), false);

export const getIssueDivIcon = (severity?: string) =>
  createIssueDivIcon('Issue', severity || 'low', false);
