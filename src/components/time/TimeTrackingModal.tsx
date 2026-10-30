import React, { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  Clock, 
  Plus, 
  Trash2, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle,
  Receipt,
  CheckCircle2
} from 'lucide-react';
import { Project, TimeEntry, ProjectExpense } from '../../types';
import { formatMontant } from '../../utils/formatUtils';
import { INITIAL_TIME_ENTRIES, INITIAL_EXPENSES } from '../../data/initialData';

interface TimeTrackingModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
}

export const TimeTrackingModal: React.FC<TimeTrackingModalProps> = ({ project, isOpen, onClose }) => {
  const [entries, setEntries] = useState<TimeEntry[]>(() =>
    INITIAL_TIME_ENTRIES.filter(t => t.projectId === project.id)
  );
  const [expenses, setExpenses] = useState<ProjectExpense[]>(() =>
    INITIAL_EXPENSES.filter(e => e.projectId === project.id)
  );

  // Live Timer State
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerDesc, setTimerDesc] = useState('');

  // Manual Entry Form
  const [manualDesc, setManualDesc] = useState('');
  const [manualHours, setManualHours] = useState('1.5');
  const [manualRate, setManualRate] = useState(85);

  // Expense Form
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState(120);
  const [expCategory, setExpCategory] = useState<'impression' | 'sous_traitance' | 'licence' | 'autre'>('licence');

  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTimerDisplay = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStopAndSaveTimer = () => {
    if (elapsedSeconds < 30) {
      setIsRunning(false);
      setElapsedSeconds(0);
      return;
    }

    const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const newEntry: TimeEntry = {
      id: `time_${Date.now()}`,
      projectId: project.id,
      description: timerDesc.trim() || 'Session de création chronométrée',
      durationMinutes: minutes,
      date: new Date().toISOString().slice(0, 10),
      hourlyRate: manualRate
    };

    setEntries([newEntry, ...entries]);
    setIsRunning(false);
    setElapsedSeconds(0);
    setTimerDesc('');
  };

  const handleAddManualTime = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = Math.round(parseFloat(manualHours) * 60);
    if (isNaN(mins) || mins <= 0) return;

    const newEntry: TimeEntry = {
      id: `time_${Date.now()}`,
      projectId: project.id,
      description: manualDesc.trim() || 'Travail de recherche et conception',
      durationMinutes: mins,
      date: new Date().toISOString().slice(0, 10),
      hourlyRate: manualRate
    };

    setEntries([newEntry, ...entries]);
    setManualDesc('');
    setManualHours('1.5');
  };

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim() || expAmount <= 0) return;

    const newExp: ProjectExpense = {
      id: `exp_${Date.now()}`,
      projectId: project.id,
      title: expTitle.trim(),
      amount: Number(expAmount),
      category: expCategory,
      date: new Date().toISOString().slice(0, 10)
    };

    setExpenses([newExp, ...expenses]);
    setExpTitle('');
    setExpAmount(50);
  };

  // Calculations
  const totalMinutes = entries.reduce((acc, t) => acc + t.durationMinutes, 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const estimatedHours = 25; // standard estimate for project type
  const isExceeded = totalHours > estimatedHours;

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const netRevenue = project.budget - totalExpenses;
  const effectiveHourlyRate = totalHours > 0 ? Math.round(netRevenue / totalHours) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl glass-panel p-6 sm:p-8 space-y-6 my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#f7c548]" />
              <h2 className="text-lg font-bold text-white font-display">
                Temps passé & Rentabilité — {project.title}
              </h2>
            </div>
            <p className="text-xs text-[#8E97AB] mt-1">
              Chronomètre en direct, dépenses engagées et calcul du taux horaire effectif.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#8E97AB] hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-[11px] text-[#8E97AB] block">Temps passé</span>
            <span className="text-xl font-bold text-white font-display tabular-nums">
              {totalHours} h
            </span>
            <span className="text-[10px] text-[#8E97AB] block mt-0.5">
              Estimé : {estimatedHours} h
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#5FB59A]/10 border border-[#5FB59A]/20">
            <span className="text-[11px] text-[#5FB59A] block font-semibold">Taux horaire effectif</span>
            <span className="text-xl font-bold text-[#5FB59A] font-display tabular-nums">
              {effectiveHourlyRate} € / h
            </span>
            <span className="text-[10px] text-[#5FB59A]/80 block mt-0.5">
              Marge nette : {formatMontant(netRevenue, 'EUR')}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
            <span className="text-[11px] text-[#8E97AB] block">Dépenses engagées</span>
            <span className="text-xl font-bold text-[#f7c548] font-display tabular-nums">
              {formatMontant(totalExpenses, 'EUR')}
            </span>
            <span className="text-[10px] text-[#8E97AB] block mt-0.5">
              {expenses.length} dépense(s)
            </span>
          </div>
        </div>

        {/* Exceed Warning Banner if any */}
        {isExceeded && (
          <div className="p-3.5 rounded-xl bg-[#D9695F]/15 border border-[#D9695F]/30 flex items-center gap-2.5 text-xs text-[#F1F3F8]">
            <AlertTriangle className="w-4 h-4 text-[#D9695F] shrink-0" />
            <span>
              <strong>Alerte temps :</strong> Le temps passé ({totalHours}h) dépasse l'estimation initiale ({estimatedHours}h). Pensez à ajuster vos forfaits ou facturer des révisions supplémentaires.
            </span>
          </div>
        )}

        {/* Stopwatch Section */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0B0F1A]/80 border border-white/15 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-widest tabular-nums">
                {formatTimerDisplay(elapsedSeconds)}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                isRunning ? 'bg-[#5FB59A]/20 text-[#5FB59A] animate-pulse' : 'bg-white/10 text-[#8E97AB]'
              }`}>
                {isRunning ? 'Chrono actif' : 'En pause'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isRunning 
                    ? 'bg-[#D9695F] text-white hover:bg-[#c4534a]' 
                    : 'bg-[#5FB59A] text-[#0B0F1A] hover:bg-[#52a58b]'
                }`}
              >
                {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isRunning ? 'Mettre en pause' : 'Démarrer chrono'}</span>
              </button>

              {elapsedSeconds > 0 && (
                <button
                  onClick={handleStopAndSaveTimer}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
                >
                  Enregistrer la session
                </button>
              )}
            </div>
          </div>

          {isRunning && (
            <input
              type="text"
              value={timerDesc}
              onChange={e => setTimerDesc(e.target.value)}
              placeholder="Que faites-vous actuellement ? (ex: Déclinaisons de logos flacons...)"
              className="w-full px-3 py-1.5 text-xs glass-input"
            />
          )}
        </div>

        {/* Manual Time Entry Form */}
        <form onSubmit={handleAddManualTime} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
          <span className="text-xs font-bold text-white/90 block">Ajouter manuellement une session :</span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              required
              value={manualDesc}
              onChange={e => setManualDesc(e.target.value)}
              placeholder="Description du travail"
              className="sm:col-span-2 px-3 py-1.5 glass-input text-xs"
            />
            <input
              type="number"
              step="0.25"
              required
              value={manualHours}
              onChange={e => setManualHours(e.target.value)}
              placeholder="Heures (ex: 2.5)"
              className="px-3 py-1.5 glass-input text-xs font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0B0F1A] bg-[#f7c548] hover:bg-[#e5b336] transition-colors cursor-pointer"
            >
              Ajouter
            </button>
          </div>
        </form>

        {/* Expenses Form */}
        <form onSubmit={handleAddExpense} className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
          <span className="text-xs font-bold text-white/90 block">Ajouter une dépense projet (imprimeur, licence...) :</span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              required
              value={expTitle}
              onChange={e => setExpTitle(e.target.value)}
              placeholder="Titre de la dépense"
              className="px-3 py-1.5 glass-input text-xs sm:col-span-2"
            />
            <input
              type="number"
              required
              value={expAmount}
              onChange={e => setExpAmount(Number(e.target.value))}
              placeholder="Montant HT"
              className="px-3 py-1.5 glass-input text-xs font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/15 transition-colors cursor-pointer"
            >
              Ajouter dépense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
