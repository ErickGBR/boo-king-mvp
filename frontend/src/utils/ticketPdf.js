/**
 * Generates a ticket PDF for an appointment with QR code.
 * Uses dynamic imports to avoid inflating the initial bundle.
 */

export function ticketNumberFromId(id) {
  return 'BK-' + String(id).padStart(6, '0');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status) {
  const map = {
    confirmed: 'Confirmada',
    cancelled: 'Cancelada',
    completed: 'Completada',
    present: 'Presente',
    pending: 'Pendiente',
    no_show: 'No llegó',
  };
  return map[status] || status;
}

function sanitizeFilename(str) {
  return str.replace(/[/\\?%*:|"<>]/g, '-');
}

export async function generateTicketPdf(appointment) {
  const [{ default: QRCode }, { default: jsPDF }] = await Promise.all([
    import('qrcode'),
    import('jspdf'),
  ]);

  const ticketNumber = appointment.ticketNumber || ticketNumberFromId(appointment.id);
  const ticketUrl =
    (typeof window !== 'undefined' ? window.location.origin : '') +
    '/t/' +
    appointment.id;

  // QR code
  const qrDataUrl = await QRCode.toDataURL(ticketUrl, {
    width: 220,
    margin: 1,
    color: { dark: '#1a1a1a', light: '#ffffff' },
  });

  // Compact ticket: 80mm wide x 140mm tall
  const doc = new jsPDF({ unit: 'mm', format: [80, 140] });
  const pageW = 80;
  const margin = 6;
  const contentW = pageW - margin * 2;

  // --- Header: teal bar ---
  doc.setFillColor(20, 184, 166); // teal-500
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('Boo-king', margin, 8);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const bizName = appointment.business?.name || '';
  if (bizName) {
    doc.text(bizName, pageW - margin, 8, { align: 'right' });
  }

  // --- Ticket number ---
  let y = 26;
  doc.setTextColor(20, 184, 166);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(ticketNumber, pageW / 2, y, { align: 'center' });

  // Divider
  y += 6;
  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  // --- Appointment data ---
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  const addRow = (label, value) => {
    if (!value) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(label, margin, y);
    y += 3.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(String(value), contentW);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  };

  addRow('FECHA', formatDate(appointment.startsAt));
  addRow('HORA', formatTime(appointment.startsAt) + ' - ' + formatTime(appointment.endsAt));
  addRow('ESTADO', statusLabel(appointment.status));

  if (appointment.business?.locationType === 'presencial' && appointment.business?.address) {
    addRow('UBICACIÓN', appointment.business.address);
  } else if (appointment.business?.locationType === 'online') {
    addRow('UBICACIÓN', 'Reunión en línea');
  }

  if (appointment.guestName) {
    addRow('CLIENTE', appointment.guestName);
  }

  // --- QR code ---
  y += 2;
  const qrSize = 32;
  const qrX = (pageW - qrSize) / 2;
  doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);
  y += qrSize + 4;

  // Scan hint
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 140);
  doc.text('Escanea el código QR para validar tu cita', pageW / 2, y, {
    align: 'center',
  });
  y += 6;

  // --- Footer ---
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(160, 160, 160);
  doc.text(ticketUrl, pageW / 2, y, { align: 'center' });

  // Save
  doc.save('ticket-' + sanitizeFilename(ticketNumber) + '.pdf');
}
