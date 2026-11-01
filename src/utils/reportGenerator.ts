import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CachedFacility, CachedIssue, OfflineGrievance } from '../services/offlineDb';

export interface UserSessionInfo {
  name?: string;
  role?: string;
  designation?: string;
  email?: string;
}

/**
 * Robust CSV Exporter using native Blob and URL.createObjectURL
 * Properly escapes commas, quotes, and newlines with UTF-8 BOM support for Excel
 */
export function exportToCSV(
  rows: (string | number | boolean | null | undefined)[][],
  filename: string
): void {
  const csvContent = rows
    .map((row) =>
      row
        .map((val) => {
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    )
    .join('\r\n');

  // Prepend UTF-8 BOM so Microsoft Excel and LibreOffice parse UTF-8 characters accurately
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export complete Master Dataset (Approved Facilities + Civic Issues + Grievances)
 */
export function exportMasterDataCSV(
  facilities: CachedFacility[],
  issues: CachedIssue[],
  grievances: OfflineGrievance[] = []
): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `khopripada_civic_data_${timestamp}.csv`;

  const headers = [
    'Record_Type',
    'Record_ID',
    'Name_Or_Title',
    'Category',
    'Severity_Or_Condition',
    'Operational_Status',
    'Monsoon_Access',
    'Approval_Status',
    'Submitted_By',
    'Latitude',
    'Longitude',
    'AI_Priority_Score',
    'Estimated_Budget_INR',
    'Notes',
    'Timestamp',
  ];

  const rows: (string | number | boolean | null | undefined)[][] = [headers];

  // 1. Add Facilities
  facilities.forEach((f) => {
    rows.push([
      'FACILITY',
      f.facility_id,
      f.name,
      f.category,
      f.operational_status,
      f.operational_status,
      f.monsoon_accessible || 'Accessible',
      f.approval_status || 'approved',
      f.submitted_by || 'Baseline Survey',
      f.latitude,
      f.longitude,
      'N/A',
      'N/A',
      f.notes || '',
      new Date().toISOString(),
    ]);
  });

  // 2. Add Baseline Issues
  issues.forEach((iss) => {
    rows.push([
      'BASELINE_ISSUE',
      iss.issue_id,
      iss.title,
      iss.category,
      iss.severity,
      iss.status,
      'N/A',
      iss.approval_status || 'approved',
      iss.submitted_by || iss.reported_by || 'Field Survey',
      iss.latitude,
      iss.longitude,
      iss.ai_priority_score ?? 'N/A',
      iss.estimated_budget_inr ?? 0,
      iss.notes || iss.ai_recommendation || '',
      new Date().toISOString(),
    ]);
  });

  // 3. Add Offline Grievances
  grievances.forEach((g) => {
    rows.push([
      'CITIZEN_GRIEVANCE',
      `GRIEV-${g.id || 'NEW'}`,
      g.title,
      g.category,
      g.severity,
      g.status || 'reported',
      'N/A',
      g.approval_status || 'pending_approval',
      g.submitted_by || g.reporterName || 'Resident',
      g.latitude,
      g.longitude,
      g.severity === 'critical' ? 95 : g.severity === 'high' ? 85 : 50,
      0,
      g.description || '',
      new Date(g.timestamp || Date.now()).toISOString(),
    ]);
  });

  exportToCSV(rows, filename);
}

/**
 * Generate Official Panchayat Infrastructure Audit Report PDF
 * Contains executive header, priority civic issues table, facility registry table, and formal signature blocks.
 */
export function generatePanchayatPDF(
  facilities: CachedFacility[],
  issues: CachedIssue[],
  currentUser?: UserSessionInfo
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = margin;

  // Filter approved items
  const approvedFacilities = facilities.filter(
    (f) => (f.approval_status || 'approved') === 'approved'
  );
  const approvedIssues = issues.filter(
    (i) => (i.approval_status || 'approved') === 'approved'
  );
  const activeGrievances = approvedIssues.filter(
    (i) => i.status !== 'resolved'
  );

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // ----------------------------------------------------
  // 1. EXECUTIVE HEADER
  // ----------------------------------------------------
  // Decorative deep navy top accent header bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, currentY, pageWidth - margin * 2, 24, 'F');

  // Emerald brand line accent
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(margin, currentY + 24, pageWidth - margin * 2, 1.5, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('GRAM PANCHAYAT KHOPRIPADA - INFRASTRUCTURE AUDIT REPORT', margin + 4, currentY + 9);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    'Vasai-Virar Corridor, Palghar District, Maharashtra | Generated by Smart Village GIS',
    margin + 4,
    currentY + 16
  );

  // Reference Code
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(52, 211, 153); // emerald-400
  doc.text(`DOC REF: GPK-AUDIT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`, pageWidth - margin - 4, currentY + 9, { align: 'right' });

  currentY += 31;

  // ----------------------------------------------------
  // 2. METADATA SUMMARY CARDS
  // ----------------------------------------------------
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cardHeight = 16;

  const metadataCards = [
    {
      label: 'GENERATION TIME',
      value: `${formattedDate} ${formattedTime}`,
      sub: 'Official Record Timestamp',
    },
    {
      label: 'GENERATED BY',
      value: currentUser?.name || 'Sarpanch Rajesh Patil',
      sub: currentUser?.designation || 'Sarpanch / Admin Lead',
    },
    {
      label: 'TOTAL APPROVED ASSETS',
      value: `${approvedFacilities.length} Facilities`,
      sub: `${facilities.filter((f) => f.approval_status === 'pending_approval').length} Pending Review`,
    },
    {
      label: 'ACTIVE GRIEVANCES',
      value: `${activeGrievances.length} Active / ${approvedIssues.length} Total`,
      sub: `${approvedIssues.filter((i) => i.severity === 'critical' || i.severity === 'high').length} High Priority`,
    },
  ];

  metadataCards.forEach((card, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    // Background
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    // Accent line top
    doc.setFillColor(15, 23, 42);
    doc.rect(cardX, currentY, cardWidth, 1, 'F');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(card.label, cardX + 2.5, currentY + 4.5);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(card.value, cardX + 2.5, currentY + 9.5);

    // Subtext
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(card.sub, cardX + 2.5, currentY + 13.5);
  });

  currentY += cardHeight + 7;

  // ----------------------------------------------------
  // 3. SECTION 1: TOP PRIORITY CIVIC GRIEVANCES
  // ----------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Top Priority Civic Grievances (Decision Support Queue)', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Vulnerabilities prioritized by spatial hazard analysis, citizen submissions, and monsoon disruption risk.',
    margin,
    currentY + 4.5
  );

  currentY += 7;

  // Sort issues: Critical/High first, then by priority score
  const sortedIssues = [...approvedIssues].sort((a, b) => {
    const sevWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const wA = sevWeight[a.severity.toLowerCase()] || 0;
    const wB = sevWeight[b.severity.toLowerCase()] || 0;
    if (wB !== wA) return wB - wA;
    return (b.ai_priority_score || 0) - (a.ai_priority_score || 0);
  });

  const issuesTableRows = sortedIssues.map((iss, index) => {
    const id = iss.issue_id || `ISS-${index + 1}`;
    const title = iss.title || 'Untitled Issue';
    const category = (iss.category || 'General').toUpperCase();
    const severity = (iss.severity || 'medium').toUpperCase();
    const status = (iss.status || 'reported').replace('_', ' ').toUpperCase();
    const coords = `${iss.latitude.toFixed(4)}N, ${iss.longitude.toFixed(4)}E`;
    const score = iss.ai_priority_score ? `${iss.ai_priority_score}/100` : severity === 'CRITICAL' ? '95/100' : severity === 'HIGH' ? '85/100' : '60/100';

    return [id, title, category, severity, status, coords, score];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['ID', 'Issue Title', 'Category', 'Severity', 'Status', 'Coordinates', 'Priority Score']],
    body: issuesTableRows.length > 0 ? issuesTableRows : [['-', 'No approved civic grievances currently active', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2,
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 24 },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 24 },
      5: { cellWidth: 28, fontStyle: 'italic', fontSize: 6.5 },
      6: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Color-code severity column
      if (data.section === 'body' && data.column.index === 3) {
        const text = String(data.cell.raw).toUpperCase();
        if (text.includes('CRITICAL') || text.includes('HIGH')) {
          data.cell.styles.textColor = [220, 38, 38]; // Red
          data.cell.styles.fontStyle = 'bold';
        } else if (text.includes('MEDIUM')) {
          data.cell.styles.textColor = [217, 119, 6]; // Amber
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [16, 185, 129]; // Emerald
        }
      }
    },
  });

  // Calculate position after Section 1
  const lastTableDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  currentY = (lastTableDoc.lastAutoTable ? lastTableDoc.lastAutoTable.finalY : currentY) + 9;

  // Check if we need to add a page for Section 2
  if (currentY + 50 > pageHeight) {
    doc.addPage();
    currentY = margin + 5;
  }

  // ----------------------------------------------------
  // 4. SECTION 2: PUBLIC FACILITIES & ASSET HEALTH REGISTRY
  // ----------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Public Facilities & Asset Health Registry', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Inventory of verified community amenities, public drinking water points, school infrastructure, and healthcare centers.',
    margin,
    currentY + 4.5
  );

  currentY += 7;

  const facilitiesTableRows = approvedFacilities.map((fac, idx) => {
    const id = fac.facility_id || `FAC-${idx + 1}`;
    const name = fac.name || 'Unnamed Facility';
    const category = (fac.category || 'General').toUpperCase();
    const operational = (fac.operational_status || 'functional').replace('_', ' ').toUpperCase();
    const monsoon = (fac.monsoon_accessible || 'Accessible').toUpperCase();

    return [id, name, category, operational, monsoon];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['ID', 'Asset Name', 'Category', 'Operational Status', 'Monsoon Access']],
    body: facilitiesTableRows.length > 0 ? facilitiesTableRows : [['-', 'No approved facilities on record', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2,
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 32 },
      3: { cellWidth: 35, halign: 'center' },
      4: { cellWidth: 32, halign: 'center' },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Color-code operational status column
      if (data.section === 'body' && data.column.index === 3) {
        const text = String(data.cell.raw).toUpperCase();
        if (text.includes('NON') || text.includes('BROKEN')) {
          data.cell.styles.textColor = [220, 38, 38]; // Red
          data.cell.styles.fontStyle = 'bold';
        } else if (text.includes('PARTIAL') || text.includes('DEGRADED')) {
          data.cell.styles.textColor = [217, 119, 6]; // Amber
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [16, 185, 129]; // Emerald
        }
      }
    },
  });

  const finalTableDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  currentY = (finalTableDoc.lastAutoTable ? finalTableDoc.lastAutoTable.finalY : currentY) + 12;

  // ----------------------------------------------------
  // 5. FORMAL SIGN-OFF SIGNATURE BLOCKS (On Last Page)
  // ----------------------------------------------------
  // Ensure enough room for signature block (need ~32mm)
  if (currentY + 34 > pageHeight - 15) {
    doc.addPage();
    currentY = margin + 15;
  }

  const signBlockY = currentY;
  const colWidth = (pageWidth - margin * 2 - 20) / 2;

  // Left Block: Prepared By
  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, signBlockY + 16, margin + colWidth, signBlockY + 16);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Prepared By: Gram Sevak / Field Officer', margin, signBlockY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Official Signature: _______________________`, margin, signBlockY + 25);
  doc.text(`Verification Date: ${formattedDate}`, margin, signBlockY + 29);

  // Right Block: Approved By
  const rightX = margin + colWidth + 20;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(rightX, signBlockY + 16, rightX + colWidth, signBlockY + 16);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Approved By: Sarpanch / Panchayat Lead', rightX, signBlockY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Gram Panchayat Khopripada (Official Seal)', rightX, signBlockY + 25);
  doc.text(`Approval Certified on: ${formattedDate}`, rightX, signBlockY + 29);

  // ----------------------------------------------------
  // 6. RUNNING HEADER & FOOTER WITH PAGE NUMBERS
  // ----------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    // Footer divider line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      'Khopripada Smart Village GIS Platform • Government of Maharashtra Spatial Audit Standards',
      margin,
      pageHeight - 7
    );

    // Page Numbers: "Page X of Y"
    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 7, {
      align: 'right',
    });
  }

  // Save the PDF file
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`Khopripada_Panchayat_Audit_Report_${dateStr}.pdf`);
}

/**
 * Generate Field Inspection Worklist PDF for Government Field Officers
 * Focused on assigned active tasks, verified coordinates, inspection status, and technical field notes.
 */
export function generateOfficerWorklistPDF(
  issues: CachedIssue[],
  currentUser?: UserSessionInfo
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = margin;

  // Filter approved, non-resolved issues
  const officerTasks = issues.filter(
    (i) => (i.approval_status || 'approved') === 'approved' && i.status !== 'resolved'
  );

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Header Banner: Deep Blue / Navy
  doc.setFillColor(30, 58, 138); // blue-900
  doc.rect(margin, currentY, pageWidth - margin * 2, 24, 'F');

  // Cyan Accent Line
  doc.setFillColor(6, 182, 212); // cyan-500
  doc.rect(margin, currentY + 24, pageWidth - margin * 2, 1.5, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('GRAM PANCHAYAT KHOPRIPADA - FIELD INSPECTION WORKLIST', margin + 4, currentY + 9);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(224, 242, 254); // sky-100
  doc.text(
    'Technical Field Worklist & Task Orders • Vasai-Virar Sub-Division Field Unit',
    margin + 4,
    currentY + 16
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(165, 243, 252); // cyan-200
  doc.text(`TASK BATCH: OFFICER-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`, pageWidth - margin - 4, currentY + 9, { align: 'right' });

  currentY += 31;

  // Metadata Box
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cardHeight = 16;

  const metadataCards = [
    {
      label: 'ASSIGNED OFFICER',
      value: currentUser?.name || 'Officer Ramesh Shinde',
      sub: currentUser?.designation || 'Technical Field Inspector',
    },
    {
      label: 'WORKLIST DATE',
      value: formattedDate,
      sub: 'Issued for Field Inspection',
    },
    {
      label: 'ASSIGNED TASKS',
      value: `${officerTasks.length} Pending Tasks`,
      sub: 'Admin Verified Submissions',
    },
    {
      label: 'PRIORITY SUMMARY',
      value: `${officerTasks.filter((t) => t.severity === 'critical' || t.severity === 'high').length} Urgent Items`,
      sub: 'Requires Immediate Visit',
    },
  ];

  metadataCards.forEach((card, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFillColor(30, 58, 138);
    doc.rect(cardX, currentY, cardWidth, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, cardX + 2.5, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(card.value, cardX + 2.5, currentY + 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(card.sub, cardX + 2.5, currentY + 13.5);
  });

  currentY += cardHeight + 8;

  // Worklist Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Mandatory Field Verification Tasks', margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Inspect on-site, record physical degradation, capture geotagged proof photographs, and update status in IndexedDB.',
    margin,
    currentY + 4.5
  );

  currentY += 7;

  const tableRows = officerTasks.map((task, idx) => {
    const id = task.issue_id || `TSK-${idx + 1}`;
    const title = task.title || 'Untitled Task';
    const category = (task.category || 'General').toUpperCase();
    const severity = (task.severity || 'Medium').toUpperCase();
    const status = (task.status || 'Reported').replace('_', ' ').toUpperCase();
    const coords = `${task.latitude.toFixed(4)}N, ${task.longitude.toFixed(4)}E`;
    const notes = task.notes || task.ai_recommendation || 'Verify physical damage and quantify repair capex.';

    return [id, title, category, severity, status, coords, notes];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['ID', 'Task Title', 'Category', 'Severity', 'Status', 'GPS Coordinates', 'Inspection Instructions']],
    body: tableRows.length > 0 ? tableRows : [['-', 'No pending field inspection tasks assigned', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2,
    },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold' },
      1: { cellWidth: 38 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 22 },
      5: { cellWidth: 26, fontStyle: 'italic', fontSize: 6.5 },
      6: { cellWidth: 'auto', fontSize: 6.5 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const text = String(data.cell.raw).toUpperCase();
        if (text.includes('CRITICAL') || text.includes('HIGH')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (text.includes('MEDIUM')) {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [16, 185, 129];
        }
      }
    },
  });

  const finalDoc = doc as jsPDF & { lastAutoTable?: { finalY: number } };
  currentY = (finalDoc.lastAutoTable ? finalDoc.lastAutoTable.finalY : currentY) + 12;

  // Signatures on Last Page
  if (currentY + 34 > pageHeight - 15) {
    doc.addPage();
    currentY = margin + 15;
  }

  const signBlockY = currentY;
  const colWidth = (pageWidth - margin * 2 - 20) / 2;

  // Left Block: Field Inspector
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin, signBlockY + 16, margin + colWidth, signBlockY + 16);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Inspected By: Field Officer / Engineer', margin, signBlockY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Officer Signature: _______________________`, margin, signBlockY + 25);
  doc.text(`Field Visit Date: ${formattedDate}`, margin, signBlockY + 29);

  // Right Block: Countersigned By
  const rightX = margin + colWidth + 20;
  doc.setLineDashPattern([1, 1], 0);
  doc.line(rightX, signBlockY + 16, rightX + colWidth, signBlockY + 16);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Countersigned By: Gram Sevak / JE', rightX, signBlockY + 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Gram Panchayat Vasai-Virar Sub-Division', rightX, signBlockY + 25);
  doc.text(`Closed & Verified Date: _______________`, rightX, signBlockY + 29);

  // Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Khopripada Smart Village GIS Platform • Official Technical Field Orders',
      margin,
      pageHeight - 7
    );

    doc.setFont('helvetica', 'bold');
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 7, {
      align: 'right',
    });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`Khopripada_Field_Worklist_${dateStr}.pdf`);
}

/**
 * Convert any image URL or Base64 string into a sanitized Data URL suitable for jsPDF addImage.
 */
async function resolveImageDataUrl(src?: string | null): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith('data:image/')) return src;
  try {
    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
            return;
          }
        } catch {
          // Cross-origin canvas security restriction fallback
        }
        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  } catch {
    return null;
  }
}

function renderPhotoPlaceholder(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  instruction: string
): void {
  doc.setFillColor(248, 250, 252);
  doc.rect(x, y, w, h, 'F');

  doc.setLineDashPattern([2, 1.5], 0);
  doc.setDrawColor(148, 163, 184);
  doc.rect(x + 1.5, y + 1.5, w - 3, h - 3, 'D');
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(title, x + w / 2, y + h / 2 - 2, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text(instruction, x + w / 2, y + h / 2 + 3, { align: 'center' });
  doc.text('[ 4" x 6" Physical Evidence Attachment Frame ]', x + w / 2, y + h / 2 + 7, { align: 'center' });
}

/**
 * Generate an official single-issue audit record PDF for physical archiving and Sarpanch signature.
 * Strictly formatted under statutory Maharashtra Village Panchayats Public Works standards.
 */
export async function generateSingleIssueAuditPDF(
  issue: any,
  currentUser?: UserSessionInfo
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm
  let currentY = margin;

  // Resolve photos asynchronously
  const reportedPhoto = await resolveImageDataUrl(issue.photoBase64 || issue.photo_url || (issue as any).proof_image_url);
  const rawResolution = await resolveImageDataUrl(issue.resolution_photo_url);
  // STRICT SEPARATION: Ensure resolution photo is distinct from the initial reported defect photo
  const resolutionPhoto = (rawResolution && rawResolution !== reportedPhoto && rawResolution !== issue.photo_url && rawResolution !== issue.photoBase64)
    ? rawResolution
    : null;

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const issueId = String(issue.issue_id || issue.id || 'KHOP-ISS-001');
  const rawStatus = (issue.status || 'reported').toLowerCase();
  const isResolved = rawStatus === 'resolved' || rawStatus === 'verified_closed';
  const statusLabel = isResolved
    ? 'VERIFIED & OFFICIALLY RESOLVED'
    : rawStatus === 'pending_resolution_approval'
    ? 'AUDIT PENDING SARPANCH SIGN-OFF'
    : rawStatus === 'under_inspection'
    ? 'UNDER FIELD INSPECTION'
    : 'REGISTERED & ACTIVE';

  // 1. Double Outer Certificate Border (Government Archive Standard)
  doc.setDrawColor(30, 41, 59); // slate-800
  doc.setLineWidth(0.8);
  doc.rect(margin - 2, margin - 2, contentWidth + 4, pageHeight - (margin - 2) * 2);
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);

  // 2. Executive Government Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, currentY, contentWidth, 23, 'F');

  // Emerald Accent line
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(margin, currentY + 23, contentWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('GOVERNMENT OF MAHARASHTRA • PALGHAR DISTRICT ADMINISTRATION', pageWidth / 2, currentY + 6, { align: 'center' });

  doc.setFontSize(11.5);
  doc.setTextColor(56, 189, 248); // sky-400
  doc.text('BAPANE GRAM PANCHAYAT — VILLAGE KHOPRIPADA', pageWidth / 2, currentY + 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240); // slate-200
  doc.text('OFFICIAL CIVIC GRIEVANCE & INFRASTRUCTURE RESOLUTION AUDIT RECORD', pageWidth / 2, currentY + 17, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('[ Statutory Form 12-B • Section 4B Maharashtra Village Panchayats Act • Gram Sabha Works Register ]', pageWidth / 2, currentY + 21, { align: 'center' });

  currentY += 27;

  // 3. Document Identification & Audit Barcode Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, contentWidth, 13, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`AUDIT FILE NO: GPB/KHOP/AUDIT/2026/${issueId.toUpperCase()}`, margin + 3.5, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  const createdDateStr = issue.created_at ? new Date(issue.created_at).toLocaleDateString('en-IN') : formattedDate;
  doc.text(`Recorded Date: ${createdDateStr} | Audit Timestamp: ${formattedDate} ${formattedTime} | Auditor: ${currentUser?.name || 'Sarpanch Rajesh Patil'}`, margin + 3.5, currentY + 10);

  // Status Badge on Right
  const badgeColor = isResolved ? [16, 185, 129] : [245, 158, 11];
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  doc.roundedRect(pageWidth - margin - 65, currentY + 2.5, 62, 8, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text(statusLabel, pageWidth - margin - 34, currentY + 7.5, { align: 'center' });

  currentY += 15.5;

  // 4. Issue Profile & Geodetic Telemetry Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 1.8,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [15, 23, 42],
      cellPadding: 1.8,
      lineColor: [226, 232, 240],
    },
    head: [['PARAMETER', 'SURVEY SPECIFICATION', 'PARAMETER', 'SURVEY SPECIFICATION']],
    body: [
      [
        'Incident / Defect Title',
        issue.title || 'Civic Infrastructure Fault',
        'Category / Sector',
        (issue.category || 'General').toUpperCase(),
      ],
      [
        'GPS Latitude & Longitude',
        `${Number(issue.latitude || 19.3542).toFixed(5)}° N, ${Number(issue.longitude || 72.8845).toFixed(5)}° E`,
        'Priority Severity Level',
        (issue.severity || 'Medium').toUpperCase(),
      ],
      [
        'Reported By / Source',
        issue.reported_by || issue.reporter_name || 'Resident Field Survey',
        'Assigned Field Officer',
        issue.assigned_officer || issue.assigned_to || 'Panchayat Engineering Division',
      ],
      [
        'Verification Lifecycle',
        `Stage: ${statusLabel}`,
        'Statutory Filing Class',
        'Gram Panchayat Public Works Permanent Record',
      ],
    ],
  });

  currentY = (doc as any).lastAutoTable.finalY + 3;

  // 5. Section: Citizen Grievance & Defect Statement
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, currentY, contentWidth, 4.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('1. CITIZEN GRIEVANCE & GROUND DEFECT STATEMENT', margin + 3, currentY + 3.4);
  currentY += 4.5;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  const descText = issue.description || 'No additional narrative description submitted during baseline intake.';
  const splitDesc = doc.splitTextToSize(descText, contentWidth - 6);
  const descHeight = Math.max(10, splitDesc.length * 3.8 + 3);
  doc.rect(margin, currentY, contentWidth, descHeight, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(splitDesc, margin + 3, currentY + 4);
  currentY += descHeight + 3;

  // 6. Section: Technical Rectification & On-Site Repair Log
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, currentY, contentWidth, 4.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('2. TECHNICAL RECTIFICATION & FIELD COMPLETION LOG', margin + 3, currentY + 3.4);
  currentY += 4.5;

  const notesText = issue.resolution_notes || issue.officer_notes || 'Field repair inspected and completed as per standard public works specifications. Verified operational and restored for village residents.';
  const splitNotes = doc.splitTextToSize(notesText, contentWidth - 6);
  const notesHeight = Math.max(10, splitNotes.length * 3.8 + 3);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, currentY, contentWidth, notesHeight, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(splitNotes, margin + 3, currentY + 4);
  currentY += notesHeight + 3;

  // 7. Section: Dual Photographic Evidence Record
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, currentY, contentWidth, 4.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('3. PHOTOGRAPHIC AUDIT EVIDENCE (REQUIRED BEFORE PHYSICAL SARPANCH SIGNATURE)', margin + 3, currentY + 3.4);
  currentY += 5.5;

  const photoFrameW = (contentWidth - 6) / 2; // ~90mm
  const photoFrameH = 38; // 38mm

  // Box 1: Initial Reported Damage Photo
  const photo1X = margin;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  if (reportedPhoto) {
    try {
      doc.addImage(reportedPhoto, 'JPEG', photo1X, currentY, photoFrameW, photoFrameH);
      doc.rect(photo1X, currentY, photoFrameW, photoFrameH);
    } catch {
      renderPhotoPlaceholder(doc, photo1X, currentY, photoFrameW, photoFrameH, 'PHOTO 1: INITIAL REPORTED DEFECT', 'Attach physical photo of initial damage');
    }
  } else {
    renderPhotoPlaceholder(doc, photo1X, currentY, photoFrameW, photoFrameH, 'PHOTO 1: INITIAL REPORTED DEFECT', 'Attach physical photo of initial damage');
  }

  // Box 2: Post-Repair Resolution Photo
  const photo2X = margin + photoFrameW + 6;
  if (resolutionPhoto) {
    try {
      doc.addImage(resolutionPhoto, 'JPEG', photo2X, currentY, photoFrameW, photoFrameH);
      doc.rect(photo2X, currentY, photoFrameW, photoFrameH);
    } catch {
      renderPhotoPlaceholder(doc, photo2X, currentY, photoFrameW, photoFrameH, 'PHOTO 2: POST-REPAIR RESOLUTION PROOF', 'Attach verified completion photo proof');
    }
  } else {
    renderPhotoPlaceholder(doc, photo2X, currentY, photoFrameW, photoFrameH, 'PHOTO 2: POST-REPAIR RESOLUTION PROOF', 'Attach verified completion photo proof');
  }

  currentY += photoFrameH + 3.5;

  // 8. Section: Tripartite Physical Certification & Sarpanch Seal
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, currentY, contentWidth, 4.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('4. STATUTORY PHYSICAL CERTIFICATION & FORMAL SARPANCH SIGN-OFF', margin + 3, currentY + 3.4);
  currentY += 6.5;

  const colW = (contentWidth - 8) / 3; // ~59mm each

  // Col 1: Field Inspecting Officer
  const col1X = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('FIELD INSPECTING OFFICER', col1X, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Technical Assessment & Work Completion', col1X, currentY + 3);

  doc.setLineDashPattern([1, 1], 0);
  doc.line(col1X, currentY + 14, col1X + colW - 4, currentY + 14);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Officer: ${issue.assigned_officer || 'Panchayat Inspector'}`, col1X, currentY + 17.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Signature & Date of Inspection', col1X, currentY + 21);

  // Col 2: Gram Sevak / Development Officer
  const col2X = margin + colW + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('GRAM SEVAK / SECRETARY', col2X, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Panchayat Public Works Registry Validation', col2X, currentY + 3);

  doc.setLineDashPattern([1, 1], 0);
  doc.line(col2X, currentY + 14, col2X + colW - 4, currentY + 14);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Gram Sevak, Bapane GP', col2X, currentY + 17.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Register No: GPB/REG/2026/____', col2X, currentY + 21);

  // Col 3: Sarpanch Formal Seal & Signature
  const col3X = margin + (colW + 4) * 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('SARPANCH (HEAD OF PANCHAYAT)', col3X, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('Statutory Closure & Physical Seal', col3X, currentY + 3);

  // Official Seal Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(254, 252, 232); // amber-50
  doc.roundedRect(col3X + colW - 24, currentY + 5, 22, 22, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.setTextColor(180, 83, 9);
  doc.text('OFFICIAL GP', col3X + colW - 13, currentY + 12.5, { align: 'center' });
  doc.text('SEAL & STAMP', col3X + colW - 13, currentY + 15.5, { align: 'center' });
  doc.text('HERE', col3X + colW - 13, currentY + 18.5, { align: 'center' });

  doc.setLineDashPattern([1, 1], 0);
  doc.line(col3X, currentY + 17, col3X + colW - 27, currentY + 17);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Sarpanch Signature', col3X, currentY + 20.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Date of Sign-off: ________', col3X, currentY + 24);

  // 9. Mandatory Archival Notice in Footer
  currentY += 27.5;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'MANDATORY PHYSICAL RECORD KEEPING NOTICE: Under Section 4B of the Maharashtra Village Panchayats Act, this signed & sealed document',
    margin,
    currentY + 3.5
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'must be permanently archived in the Gram Panchayat Office Public Works File along with photographic prints for statutory District and AG Audit.',
    margin,
    currentY + 6.5
  );

  const cleanId = issueId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`Audit_Record_GP_Khopripada_${cleanId}_${dateStr}.pdf`);
}
