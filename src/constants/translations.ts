export type Language = 'en' | 'mr';

export const translations = {
  en: {
    // Brand & Header
    village_title: 'Khopripada Digital Twin',
    panchayat_name: 'Bapane Gram Panchayat',
    report_issue: 'Report Problem',
    propose_facility: 'Suggest Facility',
    heatmap: 'Problem Heatmap',
    analytics: 'Village Analytics',
    smart_village_gis: 'Smart Village GIS',
    add_facility: '+ Add Facility',
    add_scheme_asset: '+ Add Govt Scheme Asset',
    cancel_placing: 'Cancel Placing',
    layers_and_drawer: 'Layers & Drawer',
    locate_me: 'Locate Me',
    locating: 'Locating...',
    density_heatmap: 'Density Heatmap',
    heatmap_active: 'Heatmap Active',
    toggle_heatmap: 'Toggle Failure Heatmap',
    export_audit: 'Export Audit',
    export_worklist: 'Export Worklist',
    generate_pdf_report: 'Generate Official PDF Audit Report',
    export_csv: 'Export Master GeoJSON/CSV',
    export_officer_checklist: 'Export Field Inspection Checklist (PDF)',

    // Connectivity & Ambient Sync
    online_sync: 'ONLINE • LIVE SYNC',
    offline_cache: 'OFFLINE MODE • LOCAL CACHE ACTIVE',
    online_short: 'ONLINE • LIVE',
    offline_short: 'OFFLINE',
    unsynced: 'unsynced',

    // Role Definitions
    role_resident: 'Residential Desk',
    role_officer: 'Field Operations',
    role_admin: 'Panchayat Executive',
    role_resident_desc: 'Public Asset Registry & Grievances',
    role_officer_desc: 'Task Execution & Ground Inspection',
    role_admin_desc: 'Budget Decision Support & Approvals',
    role_ward_01: 'Resident Portal • Khopripada Ward 1',
    role_officer_id: 'Officer ID: GS-MH-4012 • Gram Sevak Field Desk',
    role_admin_id: 'Panchayat ID: GP-KHOP-001 • Sarpanch Admin',
    switch_portal: 'Switch Portal',
    active_portal: 'Active',
    select_access_portal: 'Select Access Portal',

    // 5-Stage Verification Steps
    step_1: 'Report Registered',
    step_2: 'Assigned to Officer',
    step_3: 'Field Inspection Underway',
    step_4: 'Work Done & Photo Uploaded',
    step_5: 'Verified & Closed',
    step_reported: 'Report Registered',
    step_assigned: 'Assigned to Officer',
    step_inspection: 'Field Inspection Underway',
    step_repaired: 'Work Done & Photo Uploaded',
    step_closed: 'Verified & Closed',
    step_1_title: 'Step 1: Report Registered',
    step_2_title: 'Step 2: Assigned to Officer',
    step_3_title: 'Step 3: Field Inspection Underway',
    step_4_title: 'Step 4: Work Done & Photo Uploaded',
    step_5_title: 'Step 5: Verified & Closed',
    step_closed_title: 'Step 5: Verified & Closed',

    // Categories
    water: 'Drinking Water',
    road: 'Road & Pathway',
    drainage: 'Gutters & Drainage',
    lighting: 'Street Light',
    health: 'Health & Anganwadi',
    commerce: 'Commerce & Kirana',
    education: 'Schools & Education',
    civic: 'Civic & Mandir',
    other: 'Other Infrastructure',
    all_poi: 'All POIs',

    // Analytics Drawer (AnalyticsDrawer.tsx)
    total_assets: 'Total Public Facilities',
    active_problems: 'Active Problems',
    solved_problems: 'Solved Problems',
    ml_priority_header: 'Top 5 Priority Work (ML Ranked)',
    ward_summary: 'Ward-wise Summary',

    // Login Page (LoginPage.tsx)
    welcome_title: 'Welcome to Khopripada GIS',
    welcome_sub: 'Spatial digital twin & public grievance tracking',
    select_role_label: 'Choose Your Role',
    enter_btn: 'Open Map Dashboard',
    villager_role: 'Villager',
    officer_role: 'Field Officer',
    admin_role: 'Panchayat Admin',
    quick_demo: 'Quick Demo Testing',
    visiting_guest: 'Visiting Khopripada? Continue as Guest',

    // Heatmap Legend
    heatmap_moderate: 'मध्यम समस्या (Moderate)',
    heatmap_critical: 'तातडीचे केंद्र (Critical Cluster)',

    // Map Overlays & Layers
    select_basemap: 'Select Basemap',
    tile_cache_active: 'Tile Cache Active',
    basemap_satellite: 'Satellite',
    basemap_osm: 'OSM Street',
    basemap_dark: 'Dark Matter',
    basemap_light: 'Light Positron',
    active_layers: 'Active Layers',
    layer_boundary: 'Khopripada Boundary (AOI)',
    layer_facilities: 'Village Facilities',
    layer_issues: 'Surveyed Issues',
    layer_grievances: 'Reported Grievances (IndexedDB)',
    layer_landmarks: 'Key Landmark POIs',
    layer_dbscan: 'DBSCAN Failure Zones (3 Hotspots)',
    layer_heatmap: 'Failure Density Heatmap',
    filter_category: 'Filter Amenities By Category',

    // Mobile Dock & Controls
    tab_map: 'Map',
    tab_layers: 'Layers',
    tab_action: 'Action',
    tab_analytics: 'Analytics',
    tab_worklist: 'Worklist',
    close: 'Close',
    dismiss: 'Dismiss',
    cancel: 'Cancel',
    save: 'Save',
    sign_out: 'Sign Out',
    focus_on_map: 'Focus on Map',
    fly_to_location: 'Fly to Location on Map',
    recenter_core: 'Re-Center on Khopripada Core',
    recenter_desc: 'Pan and zoom back to village centroid (19.3551°N, 72.8846°E)',

    // Theme Switcher
    switch_to_light: 'Switch to Light Mode',
    switch_to_dark: 'Switch to Dark Mode',
    theme_light: 'Light',
    theme_dark: 'Dark',

    // Statistics & Dashboard
    facility_health: 'Facility Condition Health',
    healthy: 'HEALTHY',
    asset_condition: 'ASSET CONDITION',
    functional: 'Functional',
    partial: 'Needs Attention',
    non_functional: 'Critical Failure',
    pending_verification: 'Pending',
    start_field_inspection: 'Start Field Inspection',
    attach_repair_photo: 'Attach Repair Photo',
    change_repair_photo: 'Change Photo Proof',
    enter_repair_notes: 'Enter repair completion notes...',
    submit_resolution: 'Submit Resolution & Photo',
  },
  mr: {
    // Brand & Header
    village_title: 'खोपरीपाडा डिजिटल नकाशा',
    panchayat_name: 'बापणे ग्रामपंचायत',
    report_issue: 'समस्या सांगा',
    propose_facility: 'नवीन सोय सुचवा',
    heatmap: 'समस्यांचा नकाशा',
    analytics: 'गावाची आकडेवारी',
    smart_village_gis: 'स्मार्ट ग्राम जीआयएस',
    add_facility: '+ सोय जोडा',
    add_scheme_asset: '+ शासकीय योजना सोय',
    cancel_placing: 'रद्द करा',
    layers_and_drawer: 'नकाशा स्तर व माहिती',
    locate_me: 'माझे स्थान',
    locating: 'शोधत आहे...',
    density_heatmap: 'घनता नकाशा',
    heatmap_active: 'हीटमॅप सुरू आहे',
    toggle_heatmap: 'समस्या नकाशा सुरू/बंद करा',
    export_audit: 'ऑडिट अहवाल',
    export_worklist: 'कार्यसूची अहवाल',
    generate_pdf_report: 'अधिकृत ग्रामपंचायत ऑडिट अहवाल (PDF)',
    export_csv: 'मास्टर डेटा GeoJSON/CSV डाऊनलोड करा',
    export_officer_checklist: 'क्षेत्रीय तपासणी कार्यसूची (PDF)',

    // Connectivity & Ambient Sync
    online_sync: 'ऑनलाइन • थेट समन्वय',
    offline_cache: 'ऑफलाइन मोड • स्थानिक कॅश सुरू',
    online_short: 'ऑनलाइन • थेट',
    offline_short: 'ऑफलाइन',
    unsynced: 'असिंक',

    // Role Definitions
    role_resident: 'नागरिक कक्ष',
    role_officer: 'क्षेत्रीय अधिकारी',
    role_admin: 'ग्रामपंचायत प्रशासन',
    role_resident_desc: 'सार्वजनिक सोयी नोंदणी व तक्रारी',
    role_officer_desc: 'क्षेत्रीय तपासणी व दुरुस्ती अंमलबजावणी',
    role_admin_desc: 'प्रशासकीय मान्यता व अर्थसंकल्प निर्णय',
    role_ward_01: 'नागरिक कक्ष • खोपरीपाडा प्रभाग १',
    role_officer_id: 'अधिकारी ओळख: GS-MH-4012 • ग्रामसेवक क्षेत्रीय कक्ष',
    role_admin_id: 'पंचायत ओळख: GP-KHOP-001 • सरपंच व ग्रामपंचायत प्रशासन',
    switch_portal: 'पोर्टल बदला',
    active_portal: 'सक्रिय',
    select_access_portal: 'प्रवेश पर्याय निवडा',

    // 5-Stage Verification Steps
    step_1: 'तक्रार दाखल झाली',
    step_2: 'अधिकाऱ्याकडे सोपवले',
    step_3: 'जागेवर पाहणी सुरू',
    step_4: 'दुरुस्ती पूर्ण (फोटो जोडला)',
    step_5: 'तपासून पूर्ण बंद केले',
    step_reported: 'तक्रार दाखल झाली',
    step_assigned: 'अधिकाऱ्याकडे सोपवले',
    step_inspection: 'जागेवर पाहणी सुरू',
    step_repaired: 'दुरुस्ती पूर्ण (फोटो जोडला)',
    step_closed: 'तपासून पूर्ण बंद केले',
    step_1_title: 'टप्पा १: तक्रार दाखल झाली',
    step_2_title: 'टप्पा २: अधिकाऱ्याकडे सोपवले',
    step_3_title: 'टप्पा ३: जागेवर पाहणी सुरू',
    step_4_title: 'टप्पा ४: दुरुस्ती पूर्ण (फोटो जोडला)',
    step_5_title: 'टप्पा ५: तपासून पूर्ण बंद केले',
    step_closed_title: 'टप्पा ५: तपासून पूर्ण बंद केले',

    // Categories
    water: 'पिण्याचे पाणी',
    road: 'रस्ते आणि गल्ली',
    drainage: 'गटारे आणि सांडपाणी',
    lighting: 'पथदिवे',
    health: 'दवाखाना व अंगणवाडी',
    commerce: 'व्यापार व किराणा',
    education: 'शाळा व शिक्षण',
    civic: 'सार्वजनिक व मंदिरे',
    other: 'इतर पायाभूत सुविधा',
    all_poi: 'सर्व सोयी',

    // Analytics Drawer (AnalyticsDrawer.tsx)
    total_assets: 'एकूण सरकारी सोयी',
    active_problems: 'सध्याच्या समस्या',
    solved_problems: 'सुटलेल्या समस्या',
    ml_priority_header: 'सर्वात आधी करायची ५ कामे',
    ward_summary: 'वॉर्डनुसार माहिती',

    // Login Page (LoginPage.tsx)
    welcome_title: 'खोपरीपाडा डिजिटल प्रणाली',
    welcome_sub: 'गावातील सोयी व तक्रार निवारण व्यवस्था',
    select_role_label: 'प्रवेश पर्याय निवडा',
    enter_btn: 'नकाशा सुरू करा',
    villager_role: 'नागरिक',
    officer_role: 'क्षेत्रीय अधिकारी',
    admin_role: 'ग्रामपंचायत प्रशासन',
    quick_demo: 'झटपट चाचणी',
    visiting_guest: 'गावात नवीन आहात? थेट नकाशावर जा',

    // Heatmap Legend
    heatmap_moderate: 'मध्यम समस्या (Moderate)',
    heatmap_critical: 'तातडीचे केंद्र (Critical Cluster)',

    // Map Overlays & Layers
    select_basemap: 'नकाशा प्रकार निवडा',
    tile_cache_active: 'टाईल कॅश सक्रिय',
    basemap_satellite: 'सॅटेलाइट',
    basemap_osm: 'रस्ते (OSM)',
    basemap_dark: 'डार्क मॅटर',
    basemap_light: 'लाईट पॉझिट्रॉन',
    active_layers: 'सक्रिय स्तर',
    layer_boundary: 'खोपरीपाडा सीमा (AOI)',
    layer_facilities: 'ग्राम सोयी',
    layer_issues: 'नोंदवलेल्या समस्या',
    layer_grievances: 'तक्रार नोंदी (IndexedDB)',
    layer_landmarks: 'महत्त्वाची ठिकाणे (POIs)',
    layer_dbscan: 'DBSCAN समस्या झोन (३ हॉटस्पॉट)',
    layer_heatmap: 'समस्यांचा नकाशा',
    filter_category: 'वर्गवारीनुसार सोयी फिल्टर करा',

    // Mobile Dock & Controls
    tab_map: 'नकाशा',
    tab_layers: 'स्तर',
    tab_action: 'क्रिया',
    tab_analytics: 'विश्लेषण',
    tab_worklist: 'कार्यसूची',
    close: 'बंद करा',
    dismiss: 'रद्द',
    cancel: 'रद्द करा',
    save: 'जतन करा',
    sign_out: 'बाहेर पडा',
    focus_on_map: 'नकाशावर पहा',
    fly_to_location: 'नकाशावरील स्थानावर जा',
    recenter_core: 'खोपरीपाडा केंद्रावर पुनर्स्थित करा',
    recenter_desc: 'गावाच्या मध्यवर्ती बिंदूकडे परत जा (१९.३५५१°उ, ७२.८८४६°पू)',

    // Theme Switcher
    switch_to_light: 'लाईट मोड सुरू करा',
    switch_to_dark: 'डार्क मोड सुरू करा',
    theme_light: 'लाईट',
    theme_dark: 'डार्क',

    // Statistics & Dashboard
    facility_health: 'सुविधा स्थिती आरोग्य',
    healthy: 'कार्यरत',
    asset_condition: 'सुविधा स्थिती',
    functional: 'पूर्ण कार्यरत',
    partial: 'दुरुस्ती आवश्यक',
    non_functional: 'गंभीर बिघाड',
    pending_verification: 'प्रलंबित',
    start_field_inspection: 'क्षेत्रीय तपासणी सुरू करा',
    attach_repair_photo: 'दुरुस्ती छायाचित्र जोडा',
    change_repair_photo: 'छायाचित्र पुरावा बदला',
    enter_repair_notes: 'दुरुस्ती अहवाल नोंदी प्रविष्ट करा...',
    submit_resolution: 'दुरुस्ती अहवाल व फोटो सादर करा',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function getTranslation(lang: Language, key: string, fallback?: string): string {
  const dict = translations[lang] || translations.en;
  if (key in dict) {
    return (dict as Record<string, string>)[key];
  }
  // Try English fallback
  if (key in translations.en) {
    return (translations.en as Record<string, string>)[key];
  }
  return fallback ?? key;
}
