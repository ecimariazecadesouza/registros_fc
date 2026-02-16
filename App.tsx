
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
import { api, getApiUrl, transformAttendanceFromApi, transformConfigFromApi } from './services/api';
import { ChevronLeft, ChevronRight, Plus, GraduationCap, School, X, Settings, Filter, CalendarRange, LayoutDashboard, Users, Pencil, Trash2, Check, Loader2, Database, Save, AlertCircle, BookOpen, FileBarChart, Menu, Wifi, WifiOff, RefreshCw, BookMarked } from 'lucide-react';

type ViewMode = 'CLASS' | 'DASHBOARD' | 'STUDENTS' | 'REPORTS' | 'DIARY';

const DATA_CACHE_KEY = 'frequencia_escolar_data_cache';
const QUEUE_CACHE_KEY = 'frequencia_escolar_offline_queue';

const App: React.FC = () => {
  // --- STATE ---
  
  // App Config
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSchoolConfigOpen, setIsSchoolConfigOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile Menu State
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Data State
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<ClassAttendance>({}); 
  const [bimesters, setBimesters] = useState<BimesterConfig[]>(BIMESTERS);

  // Configuration State: Map "classId_date" -> Array of active lesson indices [0, 1, 3...]
  const [dailyLessonConfig, setDailyLessonConfig] = useState<Record<string, number[]>>({});
  // Subject State: Map "classId_date" -> lessonIndex -> Subject Name
  const [lessonSubjects, setLessonSubjects] = useState<LessonSubjectMap>({});
  // Topic State: Map "classId_date" -> lessonIndex -> Lesson Content
  const [lessonTopics, setLessonTopics] = useState<LessonTopicMap>({});
  
  // School Settings
  const [registeredSubjects, setRegisteredSubjects] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // Pending Changes State (For Manual Save & Offline Queue)
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);

  // Navigation State
  const [viewMode, setViewMode] = useState<ViewMode>('CLASS');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [month, setMonth] = useState<number>(new Date().getMonth()); // 0-11
  
  // UI/Modal State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [isConfigBimesters, setIsConfigBimesters] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassGroup | null>(null);
  
  // Edit Class State
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | 'ALL'>('ALL');

  // Form State
  const [newEntryName, setNewEntryName] = useState('');

  // --- HELPER: SORT CLASSES ---
  const sortClasses = (list: ClassGroup[]) => {
    return [...list].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  };

  // --- NETWORK LISTENERS ---
  useEffect(() => {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);

  // --- PERSISTENCE: QUEUE ---
  // Load queue on startup
  useEffect(() => {
      const savedQueue = localStorage.getItem(QUEUE_CACHE_KEY);
      if (savedQueue) {
          try {
              const parsed = JSON.parse(savedQueue);
              if (Array.isArray(parsed) && parsed.length > 0) {
                  setPendingChanges(parsed);
              }
          } catch (e) {
              console.error("Error loading offline queue", e);
          }
      }
  }, []);

  // Save queue whenever it changes
  useEffect(() => {
      localStorage.setItem(QUEUE_CACHE_KEY, JSON.stringify(pendingChanges));
  }, [pendingChanges]);

  // --- DATA LOADING & CACHING ---
  const processApiData = useCallback((data: ApiData) => {
    if (data.classes) {
        setClasses(sortClasses(data.classes));
    }
    if (data.students) setAllStudents(data.students);
    
    if (data.bimesters && data.bimesters.length > 0) {
        setBimesters(data.bimesters);
    }
    
    if (data.attendance) {
        setAttendance(transformAttendanceFromApi(data.attendance));
    }

    if (data.config) {
        const configMap = transformConfigFromApi(data.config);
        const rawConfig = configMap['dailyLessonCounts'] || {};
        const normalizedConfig: Record<string, number[]> = {};
        
        // Ensure compatibility with old format (just date) and new format (classId_date)
        Object.keys(rawConfig).forEach(key => {
            const val = rawConfig[key];
            if (typeof val === 'number') {
                normalizedConfig[key] = Array.from({ length: val }, (_, i) => i);
            } else if (Array.isArray(val)) {
                normalizedConfig[key] = val;
            }
        });
        
        setDailyLessonConfig(normalizedConfig);

        if (configMap['lessonSubjects']) setLessonSubjects(configMap['lessonSubjects']);
        if (configMap['lessonTopics']) setLessonTopics(configMap['lessonTopics']);
        if (configMap['registeredSubjects']) setRegisteredSubjects(configMap['registeredSubjects']);
        if (configMap['holidays']) setHolidays(configMap['holidays']);
    }
  }, []);

  const loadData = async () => {
    if (!getApiUrl()) {
        setIsSettingsOpen(true);
        setLoading(false);
        return;
    }

    setLoading(true);
    try {
        // Try to fetch fresh data
        const data = await api.getData();
        processApiData(data);
        
        // Cache fresh data
        localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(data));

        // Initial Selection
        if (!selectedClassId && data.classes && data.classes.length > 0) {
            const sorted = sortClasses(data.classes);
            setSelectedClassId(sorted[0].id);
        }

    } catch (err) {
        console.error("Failed to load from API, trying cache", err);
        
        // Fallback to cache if offline or error
        const cached = localStorage.getItem(DATA_CACHE_KEY);
        if (cached) {
            try {
                const data = JSON.parse(cached);
                processApiData(data);
                
                if (!selectedClassId && data.classes && data.classes.length > 0) {
                    const sorted = sortClasses(data.classes);
                    setSelectedClassId(sorted[0].id);
                }
                
                if (!navigator.onLine) {
                     // Silent success for offline mode
                } else {
                    alert("Erro ao conectar ao servidor. Carregando dados salvos localmente (Cache).");
                }
            } catch (e) {
                console.error("Cache corrupted", e);
                alert("Erro ao carregar dados. Verifique sua conexão.");
            }
        } else {
            alert("Erro ao carregar dados e nenhum cache encontrado. Verifique a URL do Script e sua conexão.");
            setIsSettingsOpen(true);
        }
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close sidebar when changing view on mobile
  useEffect(() => {
      setIsSidebarOpen(false);
  }, [viewMode, selectedClassId]);

  // --- DERIVED DATA ---

  const currentClass = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);

  const classStudents = useMemo(() => {
    if (!currentClass) return [];
    
    // Filter by Student.classId
    let filtered = allStudents.filter(s => s.classId === currentClass.id);

    // Apply Status Filter
    if (statusFilter !== 'ALL') {
        filtered = filtered.filter(s => s.status === statusFilter);
    }

    // Sort alphabetically for consistent navigation
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [currentClass, allStudents, statusFilter]);

  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const dateList = useMemo(() => {
    const dates: string[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
    return dates;
  }, [year, month, daysInMonth]);

  // --- HANDLERS ---

  const handleUpdateLessonConfig = async (date: string, activeIndices: number[], subjects: Record<number, string>, topics: Record<number, string>) => {
    // Generate a unique key for this class and date
    // Format: "classId_YYYY-MM-DD"
    const key = `${selectedClassId}_${date}`;

    const newConfig = { ...dailyLessonConfig, [key]: activeIndices };
    const newSubjects = { ...lessonSubjects, [key]: subjects };
    const newTopics = { ...lessonTopics, [key]: topics };

    setDailyLessonConfig(newConfig);
    setLessonSubjects(newSubjects);
    setLessonTopics(newTopics);

    // Persist Config
    try {
        if (isOnline) {
             await api.saveConfig('dailyLessonCounts', newConfig);
             await api.saveConfig('lessonSubjects', newSubjects);
             await api.saveConfig('lessonTopics', newTopics);
        } else {
             console.warn("Offline: Config saved locally but not synced.");
        }
    } catch (e) {
        console.error("Failed to save config", e);
    }
  };

  const handleSaveSchoolSubjects = async (subjects: string[]) => {
      setRegisteredSubjects(subjects);
      if (isOnline) await api.saveConfig('registeredSubjects', subjects);
  };

  const handleSaveHolidays = async (newHolidays: Holiday[]) => {
      setHolidays(newHolidays);
      if (isOnline) await api.saveConfig('holidays', newHolidays);
  }

  const handleToggleStatus = (studentId: string, date: string, lessonIndex: number, forcedStatus?: AttendanceStatus) => {
    // 1. Determine new status
    // Use composite key first, fallback to simple date (legacy data)
    const configKey = `${selectedClassId}_${date}`;
    const activeLessons = dailyLessonConfig[configKey] || dailyLessonConfig[date] || [0];
    const maxIndex = Math.max(...activeLessons, lessonIndex);

    const studentRecord = attendance[studentId] || {};
    const currentDailyStatuses = studentRecord[date] 
        ? [...studentRecord[date]] 
        : Array(maxIndex + 1).fill(AttendanceStatus.UNDEFINED);

    // Ensure array is big enough
    while (currentDailyStatuses.length <= lessonIndex) {
          currentDailyStatuses.push(AttendanceStatus.UNDEFINED);
    }

    let nextStatus: AttendanceStatus;
    
    if (forcedStatus) {
        nextStatus = forcedStatus;
    } else {
        const currentStatus = currentDailyStatuses[lessonIndex] || AttendanceStatus.UNDEFINED;
        if (currentStatus === AttendanceStatus.UNDEFINED) nextStatus = AttendanceStatus.PRESENT;
        else if (currentStatus === AttendanceStatus.PRESENT) nextStatus = AttendanceStatus.ABSENT;
        else if (currentStatus === AttendanceStatus.ABSENT) nextStatus = AttendanceStatus.EXCUSED;
        else nextStatus = AttendanceStatus.UNDEFINED;
    }

    // Don't update if it's the same
    if (currentDailyStatuses[lessonIndex] === nextStatus) return;

    // 2. Update Local State (UI)
    const updatedDailyStatuses = [...currentDailyStatuses];
    updatedDailyStatuses[lessonIndex] = nextStatus;

    setAttendance(prev => ({
        ...prev,
        [studentId]: {
            ...prev[studentId],
            [date]: updatedDailyStatuses
        }
    }));

    // Get subject and topic using composite key or fallback
    const subjectsMap = lessonSubjects[configKey] || lessonSubjects[date] || {};
    const topicsMap = lessonTopics[configKey] || lessonTopics[date] || {};

    const subject = subjectsMap[lessonIndex] || '';
    const topic = topicsMap[lessonIndex] || '';

    // 3. Queue Change
    setPendingChanges(prev => {
        // Remove existing pending change for same cell if exists (deduplication)
        const filtered = prev.filter(c => 
            !(c.studentId === studentId && c.date === date && c.lessonIndex === lessonIndex)
        );
        return [...filtered, { studentId, date, lessonIndex, status: nextStatus, subject, topic }];
    });
  };

  const handleBulkStatusUpdate = (date: string, lessonIndex: number, status: AttendanceStatus) => {
      classStudents.forEach(student => {
          if (student.status !== EnrollmentStatus.ACTIVE) return; 

          const studentRecord = attendance[student.id] || {};
          const currentStatus = (studentRecord[date] && studentRecord[date][lessonIndex]) || AttendanceStatus.UNDEFINED;

          if (currentStatus === AttendanceStatus.UNDEFINED) {
              handleToggleStatus(student.id, date, lessonIndex, status);
          }
      });
  };

  const handleSaveChanges = async () => {
      if (pendingChanges.length === 0) return;
      
      if (!isOnline) {
          alert("Você está OFFLINE. \n\nSuas alterações foram salvas no dispositivo e permanecerão na fila. Clique em 'Sincronizar' quando a conexão retornar.");
          return;
      }

      setIsSaving(true);
      
      try {
          // Send all changes in a single batch request
          await api.saveAttendanceBatch(pendingChanges);
          
          // Clear queue only on success
          setPendingChanges([]);
      } catch (error) {
          console.error("Sync error", error);
          alert("Erro ao sincronizar dados. Tente novamente.");
          // Queue remains populated so user can try again
      } finally {
          setIsSaving(false);
      }
  };

  // Student Management Handlers
  const handleAddStudent = async (student: Student) => {
    const s = { ...student, status: student.status || EnrollmentStatus.ACTIVE };
    setAllStudents(prev => [...prev, s]);
    if (isOnline) {
        try { await api.saveStudent(s); } catch(e) { alert("Erro ao salvar online. Verifique conexão."); }
    } else {
        alert("Aluno adicionado localmente. Sincronize quando estiver online.");
    }
  };

  const handleUpdateStudent = async (updatedStudent: Student) => {
    setAllStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    if (isOnline) {
        try { await api.saveStudent(updatedStudent); } catch(e) { alert("Erro ao salvar online."); }
    }
  };

  const handleUpdateStudentStatus = async (studentId: string, newStatus: EnrollmentStatus) => {
      const student = allStudents.find(s => s.id === studentId);
      if (!student) return;

      const updatedStudent = { ...student, status: newStatus };
      await handleUpdateStudent(updatedStudent);
  };

  const handleDeleteStudent = async (id: string) => {
    const previousStudents = [...allStudents];
    const previousAttendance = { ...attendance };
    
    setAllStudents(prev => prev.filter(s => s.id !== id));
    setAttendance(prev => {
        const newAttendance = { ...prev };
        delete newAttendance[id];
        return newAttendance;
    });

    if (isOnline) {
        try {
            await api.deleteStudent(id);
        } catch (error) {
            console.error("Erro ao excluir", error);
            alert("Erro ao excluir online. Revertendo localmente.");
            setAllStudents(previousStudents);
            setAttendance(previousAttendance);
        }
    } else {
        alert("Atenção: A exclusão foi feita localmente. Se você recarregar a página antes de conectar, o aluno voltará.");
    }
  };

  const handleBatchAddStudents = async (names: string[], classId: string, status: EnrollmentStatus) => {
      const newStudents: Student[] = names.map((name, idx) => ({
          id: `s-${Date.now()}-${idx}`,
          name: name,
          classId: classId,
          status: status || EnrollmentStatus.ACTIVE
      }));
      setAllStudents(prev => [...prev, ...newStudents]);
      
      if (isOnline) {
          await api.syncAll({
            students: [...allStudents, ...newStudents], 
            classes,
            bimesters
          });
      } else {
          alert("Alunos adicionados localmente. Sincronização pendente.");
      }
  };

  const handleCreateClass = async () => {
    if (!newEntryName.trim()) return;
    const newClass: ClassGroup = {
      id: `c-${Date.now()}`,
      name: newEntryName,
    };
    
    const updatedClasses = sortClasses([...classes, newClass]);
    setClasses(updatedClasses);
    
    setSelectedClassId(newClass.id);
    setViewMode('CLASS'); 
    setNewEntryName('');
    setIsAddingClass(false);
    if(isOnline) await api.saveClass(newClass);
  };

  const handleStartEditClass = (c: ClassGroup) => {
    setEditingClassId(c.id);
    setEditClassName(c.name);
  };

  const handleSaveEditClass = async () => {
    if (!editClassName.trim() || !editingClassId) return;
    const cls = classes.find(c => c.id === editingClassId);
    if (!cls) return;

    const updated = { ...cls, name: editClassName };
    const updatedList = classes.map(c => c.id === editingClassId ? updated : c);
    
    setClasses(sortClasses(updatedList));
    setEditingClassId(null);
    setEditClassName('');
    if(isOnline) await api.saveClass(updated);
  };

  const promptDeleteClass = (c: ClassGroup) => {
      setClassToDelete(c);
  };

  const executeDeleteClass = async () => {
    if (!classToDelete) return;
    const id = classToDelete.id;
    
    const studentsInClass = allStudents.filter(s => String(s.classId) === String(id));
    const studentIdsToRemove = studentsInClass.map(s => s.id);

    if (String(selectedClassId) === String(id)) {
        setSelectedClassId(''); 
        setViewMode('DASHBOARD');
    }

    setClasses(prev => prev.filter(c => String(c.id) !== String(id)));
    setAllStudents(prev => prev.filter(s => String(s.classId) !== String(id))); 
    
    setAttendance(prev => {
        const newAtt = { ...prev };
        studentIdsToRemove.forEach(sid => delete newAtt[sid]);
        return newAtt;
    });

    setClassToDelete(null);
    
    if (isOnline) {
        try {
            await api.deleteClass(id);
        } catch (error) {
            console.error("Erro ao excluir", error);
            loadData();
        }
    }
  };

  const updateBimesterConfig = (id: number, field: 'start' | 'end', value: string) => {
      setBimesters(prev => prev.map(b => 
          b.id === id ? { ...b, [field]: value } : b
      ));
  };

  const handleSaveBimesters = async () => {
      if (isOnline) await api.saveBimester(bimesters);
      setIsConfigBimesters(false);
  }

  if (loading) {
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
        onSave={loadData}
      />

      <SchoolConfigModal
        isOpen={isSchoolConfigOpen}
        onClose={() => setIsSchoolConfigOpen(false)}
        subjects={registeredSubjects}
        holidays={holidays}
        onSaveSubjects={handleSaveSchoolSubjects}
        onSaveHolidays={handleSaveHolidays}
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
          fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 
          transform transition-transform duration-300 ease-in-out shadow-2xl
          md:relative md:translate-x-0 md:shadow-none
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <School className="text-indigo-400" />
                <h1 className="font-bold text-white tracking-tight">Frequência</h1>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setIsSettingsOpen(true)} className="text-slate-500 hover:text-white" title="Configurar Banco de Dados">
                    <Database size={16} />
                </button>
                <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-500 hover:text-white">
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Network Status Indicator */}
        <div className={`text-xs px-4 py-2 font-bold flex items-center gap-2 transition-colors ${isOnline ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
             {isOnline ? <Wifi size={14}/> : <WifiOff size={14}/>}
             {isOnline ? 'CONECTADO' : 'MODO OFFLINE'}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2 mt-2">Visão Geral</div>
            
            <button
                onClick={() => setViewMode('DASHBOARD')}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
                    viewMode === 'DASHBOARD'
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
            >
                <LayoutDashboard size={18} />
                <span className="text-sm font-medium">Dashboard</span>
            </button>

             <button
                onClick={() => setViewMode('REPORTS')}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
                    viewMode === 'REPORTS'
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
            >
                <FileBarChart size={18} />
                <span className="text-sm font-medium">Relatórios</span>
            </button>
            
            <button
                onClick={() => setViewMode('DIARY')}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
                    viewMode === 'DIARY'
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
            >
                <BookMarked size={18} />
                <span className="text-sm font-medium">Diário de Conteúdos</span>
            </button>

             <button
                onClick={() => setViewMode('STUDENTS')}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
                    viewMode === 'STUDENTS'
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'hover:bg-slate-800 text-slate-300'
                }`}
            >
                <Users size={18} />
                <span className="text-sm font-medium">Protagonistas</span>
            </button>

            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-2 mt-6">Minhas Turmas</div>
            {classes.map(c => (
                <div key={c.id} className={`group flex items-center gap-1 w-full rounded-md transition-colors pr-2 ${
                    selectedClassId === c.id && viewMode === 'CLASS'
                    ? 'bg-indigo-600/50 text-white border border-indigo-500/50' 
                    : 'hover:bg-slate-800'
                }`}>
                    {editingClassId === c.id ? (
                        <div className="flex items-center gap-1 flex-1 p-1">
                            <input 
                                className="w-full bg-slate-700 text-white text-xs p-1.5 rounded border border-slate-600 focus:outline-none focus:border-indigo-500"
                                value={editClassName}
                                onChange={e => setEditClassName(e.target.value)}
                                autoFocus
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveEditClass();
                                    if (e.key === 'Escape') setEditingClassId(null);
                                }}
                            />
                            <button onClick={handleSaveEditClass} className="text-emerald-400 hover:text-emerald-300 p-1"><Check size={14}/></button>
                            <button onClick={() => setEditingClassId(null)} className="text-rose-400 hover:text-rose-300 p-1"><X size={14}/></button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => { setSelectedClassId(c.id); setViewMode('CLASS'); }}
                                className="flex-1 text-left px-3 py-2 flex items-center gap-2 overflow-hidden"
                            >
                                <GraduationCap size={16} className="shrink-0" />
                                <span className="truncate text-sm font-medium">{c.name}</span>
                            </button>
                            <div className={`flex items-center gap-1 ${selectedClassId === c.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity z-10`}>
                                 <button 
                                    onClick={(e) => { 
                                        e.preventDefault();
                                        e.stopPropagation(); 
                                        handleStartEditClass(c); 
                                    }} 
                                    className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-700 focus:outline-none" 
                                    title="Editar Nome"
                                 >
                                     <Pencil size={14}/>
                                 </button>
                                 <button 
                                    onClick={(e) => { 
                                        e.preventDefault();
                                        e.stopPropagation(); 
                                        promptDeleteClass(c); 
                                    }} 
                                    className="text-slate-400 hover:text-rose-400 p-1.5 rounded hover:bg-slate-700 focus:outline-none" 
                                    title="Excluir Turma"
                                 >
                                     <Trash2 size={14}/>
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
            
            <div className="mt-8 px-2 border-t border-slate-800 pt-4 space-y-2">
                <button 
                    onClick={() => setIsConfigBimesters(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                >
                    <Settings size={16} /> Configurar Bimestres
                </button>
                <button 
                    onClick={() => setIsSchoolConfigOpen(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
                >
                    <BookOpen size={16} /> Configurações Escolares
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
        <header className="bg-white border-b border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4">
            
            <div className="flex items-center gap-4 flex-1">
                <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden"
                >
                    <Menu size={24} />
                </button>

                {viewMode === 'CLASS' || viewMode === 'DIARY' ? (
                  <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                    <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200 shrink-0">
                        <button 
                            onClick={() => {
                                if (month === 0) { setMonth(11); setYear(y => y - 1); }
                                else { setMonth(m => m - 1); }
                            }}
                            className="p-1 hover:bg-white rounded-md transition-shadow shadow-sm"
                        >
                            <ChevronLeft size={18} className="text-gray-600"/>
                        </button>
                        <div className="px-2 sm:px-4 font-semibold text-gray-700 min-w-[100px] sm:min-w-[140px] text-center text-sm sm:text-base">
                            {MONTH_NAMES[month]} {year}
                        </div>
                        <button 
                            onClick={() => {
                                if (month === 11) { setMonth(0); setYear(y => y + 1); }
                                else { setMonth(m => m + 1); }
                            }}
                            className="p-1 hover:bg-white rounded-md transition-shadow shadow-sm"
                        >
                            <ChevronRight size={18} className="text-gray-600"/>
                        </button>
                    </div>
                  </div>
                ) : viewMode === 'STUDENTS' ? (
                     <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 truncate">
                        <Users size={20} className="text-indigo-600 shrink-0"/> 
                        <span className="truncate">Gerenciar Protagonistas</span>
                    </h2>
                ) : viewMode === 'REPORTS' ? (
                     <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 truncate">
                        <FileBarChart size={20} className="text-indigo-600 shrink-0"/> 
                        <span className="truncate">Relatórios Pedagógicos</span>
                    </h2>
                ) : (
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 truncate">
                        <LayoutDashboard size={20} className="text-indigo-600 shrink-0"/> 
                        <span className="truncate">Painel Geral</span>
                    </h2>
                )}
            </div>

            {viewMode === 'CLASS' && (
                <div className="flex items-center gap-3">
                    {currentClass && (
                        <>
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                                <Filter size={14} className="text-gray-400"/>
                                <select 
                                    className="bg-transparent text-sm text-gray-600 outline-none cursor-pointer max-w-[100px] sm:max-w-none"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as EnrollmentStatus | 'ALL')}
                                >
                                    <option value="ALL">Todos</option>
                                    {Object.values(EnrollmentStatus).map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </div>
            )}
        </header>

        {/* Content Area */}
        {viewMode === 'CLASS' ? (
            <main className="flex-1 overflow-hidden flex flex-col p-4 bg-slate-50/50 relative">
                <div className="flex flex-wrap gap-4 mb-3 text-xs font-medium px-1">
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span className="text-slate-600">Presente (P)</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <span className="text-slate-600">Falta (F)</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span className="text-slate-600">Justificada (J)</span>
                    </div>
                </div>

                <AttendanceGrid 
                    classId={selectedClassId}
                    students={classStudents}
                    dates={dateList}
                    attendance={attendance}
                    dailyLessonConfig={dailyLessonConfig}
                    lessonSubjects={lessonSubjects}
                    lessonTopics={lessonTopics}
                    pendingChanges={pendingChanges}
                    holidays={holidays}
                    registeredSubjects={registeredSubjects}
                    onToggleStatus={(sid, date, idx) => handleToggleStatus(sid, date, idx)}
                    onBulkStatusUpdate={handleBulkStatusUpdate}
                    onSelectStudent={setSelectedStudent}
                    onUpdateLessonConfig={handleUpdateLessonConfig}
                    onUpdateStudentStatus={handleUpdateStudentStatus}
                />
            </main>
        ) : viewMode === 'STUDENTS' ? (
            <StudentManager 
                students={allStudents}
                classes={classes}
                onAddStudent={handleAddStudent}
                onUpdateStudent={handleUpdateStudent}
                onDeleteStudent={handleDeleteStudent}
                onBatchAdd={handleBatchAddStudents}
            />
        ) : viewMode === 'REPORTS' ? (
            <ReportsDashboard 
                students={allStudents}
                classes={classes}
                attendance={attendance}
                bimesters={bimesters}
                dailyLessonConfig={dailyLessonConfig}
                lessonSubjects={lessonSubjects}
            />
        ) : viewMode === 'DIARY' ? (
            <LessonDiary 
                classes={classes}
                dailyLessonConfig={dailyLessonConfig}
                lessonSubjects={lessonSubjects}
                lessonTopics={lessonTopics}
                registeredSubjects={registeredSubjects}
                year={year}
                month={month}
            />
        ) : (
            <GlobalDashboard 
                students={allStudents}
                classes={classes}
                attendance={attendance}
                bimesters={bimesters}
                year={year}
            />
        )}
      </div>
      
      {/* Floating Save Button */}
      {pendingChanges.length > 0 && viewMode === 'CLASS' && (
          <div className="absolute bottom-6 right-6 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300">
              <button 
                onClick={handleSaveChanges}
                disabled={isSaving}
                className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-xl transition-all hover:scale-105 disabled:bg-slate-400 disabled:scale-100 ${!isOnline ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
              >
                  {isSaving ? (
                      <Loader2 className="animate-spin" size={20} />
                  ) : !isOnline ? (
                      <WifiOff size={20} />
                  ) : (
                      <Save size={20} />
                  )}
                  <div className="flex flex-col items-start">
                      <span className="font-bold text-sm">
                          {!isOnline ? 'Sincronizar Depois' : 'Salvar Alterações'}
                      </span>
                      <span className={`text-xs ${!isOnline ? 'text-amber-100' : 'text-indigo-200'}`}>
                          {pendingChanges.length} pendentes
                      </span>
                  </div>
              </button>
          </div>
      )}

      {/* Bimester Config Modal */}
      {isConfigBimesters && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                  <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2"><CalendarRange size={18}/> Configuração de Bimestres</h3>
                      <button onClick={() => setIsConfigBimesters(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-sm text-slate-500 mb-4">Defina as datas de início e fim para cada período escolar.</p>
                      
                      <div className="space-y-4">
                          {bimesters.map((bim) => (
                              <div key={bim.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
                                  <span className="text-sm font-bold text-slate-700 w-24">{bim.name}</span>
                                  <div className="flex items-center gap-2 flex-1">
                                      <input 
                                        type="date"
                                        className="flex-1 p-1 text-sm border rounded text-slate-600"
                                        value={bim.start}
                                        onChange={(e) => updateBimesterConfig(bim.id, 'start', e.target.value)}
                                      />
                                      <span className="text-slate-400 text-xs">até</span>
                                      <input 
                                        type="date"
                                        className="flex-1 p-1 text-sm border rounded text-slate-600"
                                        value={bim.end}
                                        onChange={(e) => updateBimesterConfig(bim.id, 'end', e.target.value)}
                                      />
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="mt-6 flex justify-end">
                          <button 
                              onClick={handleSaveBimesters}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                          >
                              Salvar e Sincronizar
                          </button>
                      </div>
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
                          <br/><br/>
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
            student={selectedStudent}
            studentsList={classStudents}
            onSelectStudent={setSelectedStudent}
            attendanceRecord={attendance[selectedStudent.id] || {}}
            year={year}
            bimesters={bimesters}
            onClose={() => setSelectedStudent(null)}
            dailyLessonConfig={dailyLessonConfig}
            lessonSubjects={lessonSubjects}
          />
      )}
    </div>
  );
};

export default App;
