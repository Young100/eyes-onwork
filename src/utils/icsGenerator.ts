import { ClientAppointment, Project, Invoice } from '../types';

/**
 * Generates and downloads a standard RFC 5545 iCalendar (.ics) file
 * compatible with Google Calendar, Apple Calendar, Outlook, etc.
 */
export function generateIcsCalendar(
  appointments: ClientAppointment[] = [],
  projects: Project[] = [],
  invoices: Invoice[] = []
): void {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  const formatIcsDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };

  const formatIcsDateOnly = (dateStr: string): string => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  };

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//eyes-onwork//Studio Graphiste Freelance//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Planning eyes-onwork'
  ];

  // 1. Appointments
  appointments.forEach(apt => {
    const startIso = apt.date;
    const startDate = new Date(startIso);
    const endDate = new Date(startDate.getTime() + (apt.durationMinutes || 60) * 60 * 1000);

    ics.push(
      'BEGIN:VEVENT',
      `UID:apt-${apt.id}@eyesonwork.design`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
      `DTSTART:${formatIcsDate(startDate.toISOString())}`,
      `DTEND:${formatIcsDate(endDate.toISOString())}`,
      `SUMMARY:RDV: ${apt.title.replace(/[\n,;]/g, ' ')}`,
      `DESCRIPTION:${(apt.notes || 'Rendez-vous client studio').replace(/[\n,;]/g, ' ')}`,
      `LOCATION:${(apt.locationDetails || apt.locationType || 'En ligne').replace(/[\n,;]/g, ' ')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  });

  // 2. Project Deadlines
  projects.forEach(p => {
    if (p.deadline) {
      ics.push(
        'BEGIN:VEVENT',
        `UID:proj-${p.id}@eyesonwork.design`,
        `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
        `DTSTART;VALUE=DATE:${formatIcsDateOnly(p.deadline)}`,
        `SUMMARY:Livraison projet : ${p.title.replace(/[\n,;]/g, ' ')}`,
        `DESCRIPTION:Echeance finale pour ${p.title}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    }
  });

  // 3. Invoice Due Dates
  invoices.forEach(inv => {
    if (inv.dueDate && inv.balanceDue > 0) {
      ics.push(
        'BEGIN:VEVENT',
        `UID:inv-${inv.id}@eyesonwork.design`,
        `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
        `DTSTART;VALUE=DATE:${formatIcsDateOnly(inv.dueDate)}`,
        `SUMMARY:Echeance facture ${inv.invoiceNumber} (${inv.balanceDue} EUR)`,
        `DESCRIPTION:Paiement attendu pour la facture ${inv.invoiceNumber}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    }
  });

  ics.push('END:VCALENDAR');

  const icsBlob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(icsBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `planning_eyesonwork_${new Date().toISOString().slice(0, 10)}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}
