
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    CURRENT_YEAR,
    MONTH_NAMES,
    BIMESTERS
} from './constants';
import { Student, ClassAttendance, AttendanceStatus, ClassGroup, EnrollmentStatus, BimesterConfig, PendingChange, LessonSubjectMap, LessonTopicMap, Holiday, ApiData } from './types';
import AttendanceGrid from './components/AttendanceGrid';
import StudentDetailModal from './components/StudentDetailModal';
import GlobalDashboard from './components/GlobalDashboard';
import ReportsDashboard from './components/ReportsDashboard';
import LessonDiary from './components/LessonDiary';
import StudentManager from './components/StudentManager';
import SettingsModal from './components/SettingsModal';
import SchoolConfigModal from './components/SchoolConfigModal';
import { useSchool } from './context/SchoolContext';
import { api, getApiUrl, transformAttendanceFromApi, transformConfigFromApi } from './services/api';
import { ChevronLeft, ChevronRight, Plus, GraduationCap, School, X, Settings, Filter, CalendarRange, LayoutDashboard, Users, Pencil, Trash2, Check, Loader2, Database, Save, AlertCircle, BookOpen, FileBarChart, Menu, Wifi, WifiOff, RefreshCw, BookMarked } from 'lucide-react';

type ViewMode = 'CLASS' | 'DASHBOARD' | 'STUDENTS' | 'REPORTS' | 'DIARY';

const App: React.FC = () => {
    const {
        classes, allStudents, attendance, bimesters, holidays, dailyLessonConfig,
        lessonSubjects, lessonTopics, isOnline, isSaving, isLoading, pendingChanges, registeredSubjects,
        year, month, selectedClassId, statusFilter, selectedStudent, classStudents, dateList,
        setYear, setMonth, setSelectedClassId, setStatusFilter, setSelectedStudent,
        refreshData, updateStudentStatus, toggleAttendance, bulkAttendanceUpdate, saveChanges,
        addStudent, updateStudent, deleteStudent, batchAddStudents, createClass, updateClass, deleteClass,
        updateBimesterConfig, saveBimesters, updateLessonConfig, saveSchoolSubjects, saveHolidays
    } = useSchool();

    // --- LOCAL UI STATE ---
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSchoolConfigOpen, setIsSchoolConfigOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [viewMode, setViewMode] = useState<ViewMode>('CLASS');

    const [isAddingClass, setIsAddingClass] = useState(false);
    const [isConfigBimesters, setIsConfigBimesters] = useState(false);
    const [classToDelete, setClassToDelete] = useState<ClassGroup | null>(null);
    const [editingClassId, setEditingClassId] = useState<string | null>(null);
    const [editClassName, setEditClassName] = useState('');
    const [newEntryName, setNewEntryName] = useState('');

    // Close sidebar when changing view on mobile
    useEffect(() => {
        setIsSidebarOpen(false);
    }, [viewMode, selectedClassId]);

    // --- DERIVED DATA ---
    const currentClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

    // --- HANDLERS ---
    const handleStartEditClass = (c: ClassGroup) => {
        setEditingClassId(c.id);
        setEditClassName(c.name);
    };

    const handleSaveEditClass = async () => {
        if (!editClassName.trim() || !editingClassId) return;
        await updateClass(editingClassId, editClassName);
        setEditingClassId(null);
    };

    const handleCreateClass = async () => {
        if (!newEntryName.trim()) return;
        const newId = await createClass(newEntryName);
        setSelectedClassId(newId as string);
        setViewMode('CLASS');
        setNewEntryName('');
        setIsAddingClass(false);
    };

    const promptDeleteClass = (c: ClassGroup) => {
        setClassToDelete(c);
    };

    const executeDeleteClass = async () => {
        if (!classToDelete) return;
        const id = classToDelete.id;
        if (String(selectedClassId) === String(id)) {
            setSelectedClassId('');
            setViewMode('DASHBOARD');
        }
        await deleteClass(id);
        setClassToDelete(null);
    };


    if (isLoading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
                <p className="text-slate-500 font-medium">Carregando dados...</p>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden relative">
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSave={() => refreshData()}
            />

            <SchoolConfigModal
                isOpen={isSchoolConfigOpen}
                onClose={() => setIsSchoolConfigOpen(false)}
            />

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-200"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Class Management */}
            <aside className={`
          fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-slate-400 flex flex-col shrink-0 
          transform transition-all duration-300 ease-in-out shadow-2xl
          md:relative md:translate-x-0 md:shadow-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="p-6 border-b border-slate-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <School className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="font-bold text-white tracking-tight text-lg leading-tight">MZS</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Frequência</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setIsSettingsOpen(true)} className="text-slate-600 hover:text-white p-2 hover:bg-slate-900 rounded-lg transition-colors" title="Configurar Banco de Dados">
                            <Database size={18} />
                        </button>
                        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-600 hover:text-white p-2">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Network Status Indicator */}
                <div className={`mx-4 mt-4 text-[10px] px-3 py-1.5 rounded-full font-bold flex items-center gap-2 transition-all ${isOnline ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                    {isOnline ? 'SISTEMA ONLINE' : 'MODO OFFLINE'}
                </div>


                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1 custom-scrollbar">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-[0.2em] px-3 mb-3">Principal</div>

                    <button
                        onClick={() => setViewMode('DASHBOARD')}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group ${viewMode === 'DASHBOARD'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-semibold'
                            : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <LayoutDashboard size={20} className={viewMode === 'DASHBOARD' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'} />
                        <span className="text-sm">Dashboard</span>
                    </button>

                    <button
                        onClick={() => setViewMode('REPORTS')}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group ${viewMode === 'REPORTS'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-semibold'
                            : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <FileBarChart size={20} className={viewMode === 'REPORTS' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'} />
                        <span className="text-sm">Relatórios</span>
                    </button>

                    <button
                        onClick={() => setViewMode('DIARY')}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group ${viewMode === 'DIARY'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-semibold'
                            : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <BookMarked size={20} className={viewMode === 'DIARY' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'} />
                        <span className="text-sm">Conteúdos</span>
                    </button>

                    <button
                        onClick={() => setViewMode('STUDENTS')}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group ${viewMode === 'STUDENTS'
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-semibold'
                            : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <Users size={20} className={viewMode === 'STUDENTS' ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'} />
                        <span className="text-sm">Protagonistas</span>
                    </button>

                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-[0.2em] px-3 mb-3 mt-8">Turmas</div>

                    {classes.map(c => (
                        <div key={c.id} className={`group flex items-center gap-1 w-full rounded-xl transition-all pr-2 ${selectedClassId === c.id && viewMode === 'CLASS'
                            ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20'
                            : 'hover:bg-slate-900 text-slate-400 hover:text-slate-200'
                            }`}>
                            {editingClassId === c.id ? (
                                <div className="flex items-center gap-1 flex-1 p-1">
                                    <input
                                        className="w-full bg-slate-800 text-white text-xs p-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
                                        value={editClassName}
                                        onChange={e => setEditClassName(e.target.value)}
                                        autoFocus
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleSaveEditClass();
                                            if (e.key === 'Escape') setEditingClassId(null);
                                        }}
                                    />
                                    <button onClick={handleSaveEditClass} className="text-emerald-400 hover:text-emerald-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"><Check size={14} /></button>
                                    <button onClick={() => setEditingClassId(null)} className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"><X size={14} /></button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => { setSelectedClassId(c.id); setViewMode('CLASS'); }}
                                        className="flex-1 text-left px-3 py-2.5 flex items-center gap-3 overflow-hidden"
                                    >
                                        <GraduationCap size={18} className={`shrink-0 ${selectedClassId === c.id ? 'text-indigo-400' : 'text-slate-500'}`} />
                                        <span className={`truncate text-sm ${selectedClassId === c.id ? 'font-bold' : 'font-medium'}`}>{c.name}</span>
                                    </button>
                                    <div className={`flex items-center gap-1 ${selectedClassId === c.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity z-10`}>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleStartEditClass(c);
                                            }}
                                            className="text-slate-500 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                                            title="Editar Nome"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                promptDeleteClass(c);
                                            }}
                                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                                            title="Excluir Turma"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                    {isAddingClass ? (
                        <div className="p-2 bg-slate-800 rounded mt-2">
                            <input
                                autoFocus
                                className="w-full bg-slate-700 text-white text-sm p-1.5 rounded border border-slate-600 mb-2 focus:outline-none focus:border-indigo-500"
                                placeholder="Nome da Turma"
                                value={newEntryName}
                                onChange={e => setNewEntryName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateClass()}
                            />
                            <div className="flex gap-2">
                                <button onClick={handleCreateClass} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-2 py-1 rounded flex-1">Salvar</button>
                                <button onClick={() => setIsAddingClass(false)} className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded flex-1">Cancelar</button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsAddingClass(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors border border-dashed border-slate-700 mt-2"
                        >
                            <Plus size={16} /> Nova Turma
                        </button>
                    )}

                    <div className="mt-8 px-6 pb-4 space-y-3">
                        <button
                            onClick={() => setIsConfigBimesters(true)}
                            className="w-full flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-900 rounded-xl border border-slate-800/50 transition-all text-slate-300 group"
                        >
                            <div className="grid text-left">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Configuração</span>
                                <span className="font-semibold text-sm group-hover:text-white transition-colors">Bimestres</span>
                            </div>
                            <CalendarRange size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                        </button>

                        <button
                            onClick={() => setIsSchoolConfigOpen(true)}
                            className="w-full flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-900 rounded-xl border border-slate-800/50 transition-all text-slate-300 group"
                        >
                            <div className="grid text-left">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Configuração</span>
                                <span className="font-semibold text-sm group-hover:text-white transition-colors">Disciplinas & Feriados</span>
                            </div>
                            <BookOpen size={18} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
                        </button>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-800 text-xs text-center text-slate-500">
                    © 2026 Frequência Escolar
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Top Navigation Bar */}
                <header className="glass-panel sticky top-0 md:relative z-30 p-4 flex flex-wrap items-center justify-between gap-4 shadow-premium">

                    <div className="flex items-center gap-4 flex-1">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2.5 -ml-2 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all md:hidden"
                        >
                            <Menu size={24} />
                        </button>

                        {viewMode === 'CLASS' || viewMode === 'DIARY' ? (
                            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                                <div className="flex items-center bg-slate-100/80 rounded-xl p-1 border border-slate-200/50 shrink-0 shadow-inner">
                                    <button
                                        onClick={() => {
                                            if (month === 0) { setMonth(11); setYear(y => y - 1); }
                                            else { setMonth(m => m - 1); }
                                        }}
                                        className="p-1.5 hover:bg-white text-slate-600 hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <div className="px-3 sm:px-6 font-bold text-slate-800 min-w-[120px] sm:min-w-[160px] text-center text-sm sm:text-base tracking-tight">
                                        {MONTH_NAMES[month]} {year}
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (month === 11) { setMonth(0); setYear(y => y + 1); }
                                            else { setMonth(m => m + 1); }
                                        }}
                                        className="p-1.5 hover:bg-white text-slate-600 hover:text-indigo-600 hover:shadow-sm rounded-lg transition-all"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                        ) : viewMode === 'STUDENTS' ? (
                            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3 truncate tracking-tight">
                                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                                    <Users size={22} />
                                </div>
                                <span className="truncate">Protagonistas</span>
                            </h2>
                        ) : viewMode === 'REPORTS' ? (
                            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3 truncate tracking-tight">
                                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                                    <FileBarChart size={22} />
                                </div>
                                <span className="truncate">Relatórios</span>
                            </h2>
                        ) : viewMode === 'DIARY' ? (
                            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3 truncate tracking-tight">
                                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                                    <BookMarked size={22} />
                                </div>
                                <span className="truncate">Diário</span>
                            </h2>
                        ) : (
                            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3 truncate tracking-tight">
                                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                                    <LayoutDashboard size={22} />
                                </div>
                                <span className="truncate">Dashboard</span>
                            </h2>
                        )}
                    </div>

                    {viewMode === 'CLASS' && (
                        <div className="flex items-center gap-3">
                            {currentClass && (
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                                    <Filter size={14} className="text-slate-400" />
                                    <select
                                        className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer max-w-[120px] sm:max-w-none"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as EnrollmentStatus | 'ALL')}
                                    >
                                        <option value="ALL">Todos Alunos</option>
                                        {Object.values(EnrollmentStatus).map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </header>

                {/* Content Area */}
                {viewMode === 'CLASS' ? (
                    <main className="flex-1 overflow-hidden flex flex-col p-4 md:p-6 bg-slate-50/50 relative animate-fade-in">
                        <div className="flex flex-wrap gap-4 mb-4 text-[10px] font-bold uppercase tracking-wider px-1">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                                <span className="text-slate-500">Presente</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></span>
                                <span className="text-slate-500">Falta</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></span>
                                <span className="text-slate-500">Justificada</span>
                            </div>
                        </div>


                        <AttendanceGrid
                            onSelectStudent={setSelectedStudent}
                        />
                    </main>
                ) : viewMode === 'STUDENTS' ? (
                    <StudentManager />
                ) : viewMode === 'REPORTS' ? (
                    <ReportsDashboard />
                ) : viewMode === 'DIARY' ? (
                    <LessonDiary />
                ) : (
                    <GlobalDashboard />
                )}
            </div>

            {/* Floating Save Button */}
            {pendingChanges.length > 0 && viewMode === 'CLASS' && (
                <div className="fixed bottom-8 right-8 z-40 animate-in slide-in-from-bottom-8 fade-in duration-500">
                    <button
                        onClick={saveChanges}
                        disabled={isSaving || pendingChanges.length === 0}
                        className={`
                    flex items-center gap-4 px-8 py-4 rounded-2xl shadow-2xl transition-all 
                    hover:scale-105 active:scale-95 disabled:bg-slate-400 disabled:scale-100 
                    ${!isOnline ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'} 
                    text-white group
                `}
                    >
                        <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center 
                      ${!isOnline ? 'bg-amber-400/20' : 'bg-white/20'} 
                      group-hover:rotate-12 transition-transform
                  `}>
                            {isSaving ? (
                                <Loader2 className="animate-spin" size={24} />
                            ) : !isOnline ? (
                                <WifiOff size={24} />
                            ) : (
                                <Save size={24} />
                            )}
                        </div>
                        <div className="flex flex-col items-start pr-2">
                            <span className="font-extrabold text-sm uppercase tracking-wider">
                                {!isOnline ? 'Sincronizar' : 'Salvar Dados'}
                            </span>
                            <span className={`text-xs font-medium ${!isOnline ? 'text-amber-100' : 'text-indigo-100'}`}>
                                {pendingChanges.length} alterações na fila
                            </span>
                        </div>
                    </button>
                </div>
            )}

            {/* Bimester Config Modal */}
            {isConfigBimesters && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl shadow-premium w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                    <CalendarRange size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">Configurar Bimestres</h3>
                                    <p className="text-sm text-slate-500 font-medium">Defina os períodos letivos do ano</p>
                                </div>
                            </div>
                            <button onClick={() => setIsConfigBimesters(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid gap-4">
                                {bimesters.map((bim) => (
                                    <div key={bim.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/30 flex flex-wrap items-center gap-6">
                                        <div className="min-w-[120px]">
                                            <span className="text-sm font-bold text-indigo-600 uppercase tracking-wider">{bim.name}</span>
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-4 min-w-[300px]">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Início</label>
                                                <input
                                                    type="date"
                                                    value={bim.start}
                                                    onChange={(e) => updateBimesterConfig(bim.id, 'start', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Término</label>
                                                <input
                                                    type="date"
                                                    value={bim.end}
                                                    onChange={(e) => updateBimesterConfig(bim.id, 'end', e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
                            <button
                                onClick={() => setIsConfigBimesters(false)}
                                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-all text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    await saveBimesters();
                                    setIsConfigBimesters(false);
                                }}
                                className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all text-sm active:scale-95 flex items-center gap-2"
                            >
                                <Check size={18} />
                                Salvar Configuração
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Class Delete Confirmation Modal */}
            {classToDelete && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Excluir Turma?</h3>
                            <p className="text-sm text-slate-600 mb-6">
                                Você está prestes a apagar a turma <strong>{classToDelete.name}</strong>.
                                <br /><br />
                                <span className="font-bold text-rose-600">ATENÇÃO:</span> Todos os alunos e históricos de frequência serão perdidos permanentemente.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setClassToDelete(null)}
                                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={executeDeleteClass}
                                    className="flex-1 py-2.5 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 transition-colors"
                                >
                                    Excluir Tudo
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedStudent && (
                <StudentDetailModal
                    onClose={() => setSelectedStudent(null)}
                />
            )}
        </div>
    );
};

export default App;
