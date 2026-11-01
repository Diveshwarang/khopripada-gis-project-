import L from 'leaflet';

export function getFacilityDivIcon(category?: string, name?: string): L.DivIcon {
  const combined = ((category || '') + ' ' + (name || '')).toLowerCase();

  let bg = '#0284C7'; // Default Blue
  let svgPath = '';

  if (
    combined.includes('water') ||
    combined.includes('tap') ||
    combined.includes('well') ||
    combined.includes('handpump') ||
    combined.includes('tank')
  ) {
    bg = '#0284C7'; // Cyan/Water Blue
    svgPath = `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />`;
  } else if (
    combined.includes('health') ||
    combined.includes('anganwadi') ||
    combined.includes('clinic') ||
    combined.includes('hospital') ||
    combined.includes('phc')
  ) {
    bg = '#059669'; // Emerald Green
    svgPath = `<path d="M19 10.5h-5.5V5h-3v5.5H5v3h5.5V19h3v-5.5H19z" />`;
  } else if (
    combined.includes('edu') ||
    combined.includes('school') ||
    combined.includes('college')
  ) {
    bg = '#4F46E5'; // Indigo/Navy
    svgPath = `<path d="M12 3L1 9l11 6 9-4.91V17h2V9M5 13.18v4L12 21l7-3.82v-4L12 17z" />`;
  } else if (
    combined.includes('mandir') ||
    combined.includes('temple') ||
    combined.includes('civic') ||
    combined.includes('panchayat')
  ) {
    bg = '#8B5CF6'; // Purple
    svgPath = `<path d="M12 2l7 4v3H5V6zm-5 9h2v8H7zm4 0h2v8h-2zm4 0h2v8h-2zM3 21h18v2H3z" />`;
  } else if (
    combined.includes('light') ||
    combined.includes('solar') ||
    combined.includes('lamp') ||
    combined.includes('pole')
  ) {
    bg = '#D97706'; // Amber Gold
    svgPath = `<path d="M9 21h6v-2H9zm3-19a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17h8v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7z" />`;
  } else {
    bg = '#0D9488'; // Teal default
    svgPath = `<circle cx="12" cy="12" r="7" />`;
  }

  const html = `
    <div style="
      background-color: ${bg};
      width: 28px;
      height: 28px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      border: 2px solid #FFFFFF;
      transition: transform 0.15s ease;
    ">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF">
        ${svgPath}
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-facility-pin',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

export function getIssueDivIcon(severity?: string): L.DivIcon {
  const sev = (severity || 'low').toLowerCase();
  const isHigh = sev === 'high' || sev === 'critical' || sev === 'urgent';
  const isMedium = sev === 'medium';
  const bg = isHigh ? '#DC2626' : isMedium ? '#F59E0B' : '#0284C7';

  const html = `
    <div style="
      background-color: ${bg};
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 0 8px ${bg}90, 0 2px 6px rgba(0,0,0,0.5);
      border: 2px solid #FFFFFF;
      animation: ${isHigh ? 'pulse 1.8s infinite' : 'none'};
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFFFFF">
        <path d="M12 2L1 21h22L12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-issue-pin',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}
