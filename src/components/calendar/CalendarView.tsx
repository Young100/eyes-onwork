import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Download, 
  Clock, 
  Video, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  X, 
  ExternalLink,
  Users
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ClientAppointment } from '../../types';
import { CustomSelect } from '../common/CustomSelect';
import { generateIcsCalendar } from '../../utils/icsGenerator';

export const CalendarView: React.FC = () => {
  const { 
    projects = [], 
    invoices = [], 
    clients = [], 
    appointments = [],
    addAppointment
  } = useApp();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [isNewAptModalOpen, setIsNewAptModalOpen] = useState(false);

  // New appointment form
  const [newTitle, setNewTitle] = useState('');
  const [newClientId, setNewClientId] = useState(clients[0]?.id || '');
  const [newDate, setNewDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [newDuration, setNewDuration] = useState(45);
  const [newLocType, setNewLocType] = useState<'visio' | 'in_person' | 'phone'>('visio');
  const [newLocDetails, setNewLocDetails] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const handleAddAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addAppointment({
      clientId: newClientId || (clients[0]?.id ?? ''),
      title: newTitle.trim(),
      date: new Date(newDate).toISOString(),
      time: newDate.slice(11, 16) || '14:00',
      durationMinutes: Number(newDuration),
      locationType: newLocType,
      locationDetails: newLocDetails.trim() || 'Visioconférence Google Meet',
      reminderMinutes: 30,
      status: 'scheduled',
      notes: newNotes.trim() || undefined
    });
    setIsNewAptModalOpen(false);
    setNewTitle('');
  };

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Generate calendar days for month view
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];

  // Padding days from previous month
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ day: d, dateStr, isCurrentMonth: false });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ day: d, dateStr, isCurrentMonth: true });
  }

  // Export .ics trigger
  const handleExportIcs = () => {
    generateIcsCalendar(appointments, projects, invoices);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-16 lg:pb-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#f7c548]/20 text-[#f7c548]">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">
              Calendrier & Planning
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#8E97AB] mt-1">
            Échéances de création, livraisons clients, dates de paiement et rendez-vous.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportIcs}
            className="glass-btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            title="Exporter le calendrier au format standard .ics"
          >
            <Download className="w-3.5 h-3.5 text-[#f7c548]" />
            <span>Exporter .ics</span>
          </button>

          <button
            onClick={() => setIsNewAptModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-[#f7c548]/20"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nouveau rendez-vous</span>
          </button>
        </div>
      </div>

      {/* Week workload preview banner */}
      <div className="glass-panel p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-white/[0.04] to-white/[0.01]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#f7c548]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white font-display">
              Charge de travail & Échéances de la semaine
            </h3>
          </div>
          <p className="text-xs text-[#8E97AB]">
            3 projets actifs prioritaires cette semaine · 2 livrables à valider · 1 échéance de facture.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="text-center">
            <span className="block text-lg font-bold text-[#5FB59A] font-display">{projects.filter(p => p.currentStep !== 'livre').length}</span>
            <span className="text-[10px] text-[#8E97AB]">Projets en cours</span>
          </div>
          <div className="text-center">
            <span className="block text-lg font-bold text-[#f7c548] font-display">{appointments.length}</span>
            <span className="text-[10px] text-[#8E97AB]">Rendez-vous</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="glass-panel p-4 sm:p-6 space-y-4">
        {/* Month Navigation & Switch */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-[#8E97AB] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm sm:text-base font-bold text-white capitalize font-display min-w-36 text-center">
              {monthName}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-[#8E97AB] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-[11px] text-[#f7c548]">
              <span className="w-2 h-2 rounded-full bg-[#f7c548]" />
              RDV Client
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-[#5FB59A]">
              <span className="w-2 h-2 rounded-full bg-[#5FB59A]" />
              Livraison
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-[#D9695F]">
              <span className="w-2 h-2 rounded-full bg-[#D9695F]" />
              Facture
            </span>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[11px] font-bold text-[#8E97AB] py-1 uppercase tracking-wider">
          <span>Lun</span>
          <span>Mar</span>
          <span>Mer</span>
          <span>Jeu</span>
          <span>Ven</span>
          <span>Sam</span>
          <span>Dim</span>
        </div>

        {/* Month Cells Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {days.map((item, idx) => {
            // Find events for this day
            const dayProjects = projects.filter(p => p.deadline === item.dateStr);
            const dayInvoices = invoices.filter(inv => inv.dueDate === item.dateStr && inv.balanceDue > 0);
            const dayApts = appointments.filter((a: ClientAppointment) => a.date.startsWith(item.dateStr));

            return (
              <div
                key={idx}
                className={`
                  min-h-24 sm:min-h-28 p-1.5 sm:p-2 rounded-xl border flex flex-col justify-between transition-colors
                  ${item.isCurrentMonth ? 'bg-white/[0.02] border-white/10 text-white' : 'bg-transparent border-white/5 text-white/30'}
                `}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-semibold font-display ${item.isCurrentMonth ? 'text-white' : 'text-white/30'}`}>
                    {item.day}
                  </span>
                </div>

                {/* Event tags in cell */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {dayApts.map((apt: ClientAppointment) => (
                    <div
                      key={apt.id}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-[#f7c548]/20 text-[#f7c548] truncate font-medium border border-[#f7c548]/30"
                      title={apt.title}
                    >
                      {apt.title}
                    </div>
                  ))}

                  {dayProjects.map(proj => (
                    <div
                      key={proj.id}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-[#5FB59A]/20 text-[#5FB59A] truncate font-medium border border-[#5FB59A]/30"
                      title={`Livraison : ${proj.title}`}
                    >
                      Livraison : {proj.title}
                    </div>
                  ))}

                  {dayInvoices.map(inv => (
                    <div
                      key={inv.id}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-[#D9695F]/20 text-[#D9695F] truncate font-medium border border-[#D9695F]/30"
                      title={`Échéance facture ${inv.invoiceNumber}`}
                    >
                      Échéance {inv.invoiceNumber}
                    </div>
                  ))}
                </div>

                <div className="text-[9px] text-right text-[#8E97AB]/60">
                  {dayApts.length + dayProjects.length + dayInvoices.length > 0 && (
                    <span>{dayApts.length + dayProjects.length + dayInvoices.length} rappel(s)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Appointment Modal */}
      {isNewAptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white font-display">
                Planifier un rendez-vous client
              </h3>
              <button
                onClick={() => setIsNewAptModalOpen(false)}
                className="p-1 text-[#8E97AB] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleAddAppointment}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-[#8E97AB] font-semibold mb-1">Titre de la réunion *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Ex: Présentation des premières maquettes V1"
                  className="w-full px-3 py-2 glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-[#8E97AB] font-semibold mb-1">Client concerné</label>
                <CustomSelect
                  value={newClientId}
                  onChange={setNewClientId}
                  options={clients.map(c => ({
                    value: c.id,
                    label: `${c.company} (${c.name})`
                  }))}
                  placeholder="Sélectionner un client..."
                  sheetTitle="Client concerné"
                  searchable={clients.length > 3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8E97AB] font-semibold mb-1">Date & Heure *</label>
                  <input
                    type="datetime-local"
                    required
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 glass-input text-xs min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-[#8E97AB] font-semibold mb-1">Durée</label>
                  <CustomSelect
                    value={String(newDuration)}
                    onChange={(val) => setNewDuration(Number(val))}
                    options={[
                      { value: '30', label: '30 min' },
                      { value: '45', label: '45 min' },
                      { value: '60', label: '1 heure' },
                      { value: '90', label: '1h30' },
                    ]}
                    sheetTitle="Durée du rendez-vous"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#8E97AB] font-semibold mb-1">Format de rendez-vous</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'visio', label: 'Visioconférence', icon: Video },
                    { id: 'phone', label: 'Téléphone', icon: Phone },
                    { id: 'in_person', label: 'En présentiel', icon: MapPin }
                  ].map(loc => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setNewLocType(loc.id as any)}
                      className={`p-2 rounded-xl text-center border transition-all cursor-pointer ${
                        newLocType === loc.id
                          ? 'bg-[#f7c548]/20 text-[#f7c548] border-[#f7c548]'
                          : 'bg-white/[0.02] text-[#8E97AB] border-white/10'
                      }`}
                    >
                      <loc.icon className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-[10px] block font-medium">{loc.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#8E97AB] font-semibold mb-1">Lien de visio ou adresse</label>
                <input
                  type="text"
                  value={newLocDetails}
                  onChange={e => setNewLocDetails(e.target.value)}
                  placeholder="https://meet.google.com/... ou adresse du studio"
                  className="w-full px-3 py-2 glass-input text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewAptModalOpen(false)}
                  className="px-4 py-2 text-xs text-[#8E97AB] hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer font-display"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
