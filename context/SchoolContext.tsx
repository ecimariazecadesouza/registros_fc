import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
    Student, ClassGroup, ClassAttendance, AttendanceStatus,
    EnrollmentStatus, PendingChange, Holiday, BimesterConfig
} from '../types';
import { api, transformAttendanceFromApi, transformConfigFromApi } from '../services/api';
import { BIMESTERS, CURRENT_YEAR } from '../constants';

interface SchoolContextType {
    classes: ClassGroup[];
    allStudents: Student[];
    attendance: ClassAttendance;
    bimesters: BimesterConfig[];
    holidays: Holiday[];
    dailyLessonConfig: Record<string, number[]>;
    lessonSubjects: Record<string, Record<number, string>>;
    lessonTopics: Record<string, Record<number, string>>;
    isOnline: boolean;
    isSaving: boolean;
    isLoading: boolean;
    pendingChanges: PendingChange[];
    registeredSubjects: string[];

    // UI state
    year: number;
    month: number;
    selectedClassId: string;
    statusFilter: EnrollmentStatus | 'ALL';
    selectedStudent: Student | null;
    dateList: string[];
    classStudents: Student[];

    // Actions
    setYear: (year: number) => void;
    setMonth: (month: number) => void;
    setSelectedClassId: (id: string) => void;
    setStatusFilter: (filter: EnrollmentStatus | 'ALL') => void;
    setSelectedStudent: (student: Student | null) => void;
    refreshData: (silent?: boolean) => Promise<void>;
    updateStudentStatus: (studentId: string, newStatus: EnrollmentStatus) => Promise<void>;
    toggleAttendance: (studentId: string, date: string, lessonIndex: number, classId: string, forcedStatus?: AttendanceStatus) => void;
    bulkAttendanceUpdate: (date: string, lessonIndex: number, status: AttendanceStatus, classId: string, classStudents: Student[]) => void;
    saveChanges: () => Promise<void>;
    addStudent: (student: Student) => Promise<void>;
    updateStudent: (student: Student) => Promise<void>;
    deleteStudent: (studentId: string) => Promise<void>;
    batchAddStudents: (names: string[], classId: string, status: EnrollmentStatus) => Promise<void>;
    createClass: (name: string) => Promise<string>;
    updateClass: (id: string, name: string) => Promise<void>;
    deleteClass: (id: string) => Promise<void>;
    updateBimesterConfig: (id: number, field: 'start' | 'end', value: string) => void;
    saveBimesters: () => Promise<void>;
    updateLessonConfig: (date: string, activeIndices: number[], subjects: Record<number, string>, topics: Record<number, string>, classId: string) => Promise<void>;
    saveSchoolSubjects: (subjects: string[]) => Promise<void>;
    saveHolidays: (holidays: Holiday[]) => Promise<void>;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [classes, setClasses] = useState<ClassGroup[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [attendance, setAttendance] = useState<ClassAttendance>({});
    const [bimesters, setBimesters] = useState<BimesterConfig[]>(BIMESTERS);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [dailyLessonConfig, setDailyLessonConfig] = useState<Record<string, number[]>>({});
    const [lessonSubjects, setLessonSubjects] = useState<Record<string, Record<number, string>>>({});
    const [lessonTopics, setLessonTopics] = useState<Record<string, Record<number, string>>>({});

    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
    const [registeredSubjects, setRegisteredSubjects] = useState<string[]>([]);

    // --- UI State ---
    const [year, setYear] = useState<number>(CURRENT_YEAR);
    const [month, setMonth] = useState<number>(new Date().getMonth());
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | 'ALL'>('ALL');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

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

    const loadData = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const data = await api.getData();
            setClasses(data.classes || []);
            setAllStudents(data.students || []);
            setAttendance(transformAttendanceFromApi(data.attendance || []));
            setBimesters(data.bimesters?.length ? data.bimesters : BIMESTERS);

            if (!selectedClassId && data.classes?.length > 0) {
                setSelectedClassId(data.classes[0].id);
            }

            if (data.config) {
                const configMap = transformConfigFromApi(data.config);
                const rawConfig = configMap['dailyLessonCounts'] || {};
                const normalizedConfig: Record<string, number[]> = {};

                Object.keys(rawConfig).forEach(key => {
                    const val = rawConfig[key];
                    if (typeof val === 'number') {
                        normalizedConfig[key] = Array.from({ length: val }, (_, i) => i);
                    } else if (Array.isArray(val)) {
                        normalizedConfig[key] = val;
                    }
                });

                setDailyLessonConfig(normalizedConfig);
                setLessonSubjects(configMap['lessonSubjects'] || {});
                setLessonTopics(configMap['lessonTopics'] || {});
                setRegisteredSubjects(configMap['registeredSubjects'] || []);
                setHolidays(configMap['holidays'] || []);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [selectedClassId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // --- Derived UI Data ---
    const dateList = useMemo(() => {
        const days = new Date(year, month + 1, 0).getDate();
        const dates: string[] = [];
        for (let i = 1; i <= days; i++) {
            dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
        }
        return dates;
    }, [year, month]);

    const classStudents = useMemo(() => {
        let filtered = allStudents.filter(s => s.classId === selectedClassId);
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter(s => s.status === statusFilter);
        }
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }, [allStudents, selectedClassId, statusFilter]);

    const toggleAttendance = (studentId: string, date: string, lessonIndex: number, classId: string, forcedStatus?: AttendanceStatus) => {
        const configKey = classId + '_' + date;
        const studentRecord = attendance[studentId] || {};
        const currentDailyStatuses = studentRecord[date]
            ? [...studentRecord[date]]
            : Array(lessonIndex + 1).fill(AttendanceStatus.UNDEFINED);

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

        if (currentDailyStatuses[lessonIndex] === nextStatus) return;

        const updatedDailyStatuses = [...currentDailyStatuses];
        updatedDailyStatuses[lessonIndex] = nextStatus;

        setAttendance(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], [date]: updatedDailyStatuses }
        }));

        const subjectsMap = lessonSubjects[configKey] || lessonSubjects[date] || {};
        const topicsMap = lessonTopics[configKey] || lessonTopics[date] || {};
        const subject = subjectsMap[lessonIndex] || '';
        const topic = topicsMap[lessonIndex] || '';

        setPendingChanges(prev => {
            const filtered = prev.filter(c => !(c.studentId === studentId && c.date === date && c.lessonIndex === lessonIndex));
            return [...filtered, { studentId, date, lessonIndex, status: nextStatus, subject, topic }];
        });
    };

    const bulkAttendanceUpdate = (date: string, lessonIndex: number, status: AttendanceStatus, classId: string, classStudentsArr: Student[]) => {
        classStudentsArr.forEach(student => {
            if (student.status !== EnrollmentStatus.ACTIVE) return;
            const studentRecord = attendance[student.id] || {};
            const currentStatus = (studentRecord[date] && studentRecord[date][lessonIndex]) || AttendanceStatus.UNDEFINED;
            if (currentStatus === AttendanceStatus.UNDEFINED) {
                toggleAttendance(student.id, date, lessonIndex, classId, status);
            }
        });
    };

    const saveChanges = async () => {
        if (pendingChanges.length === 0 || isSaving) return;
        if (!isOnline) {
            alert("Offline. Alterações permanecem na fila.");
            return;
        }
        setIsSaving(true);
        try {
            await api.saveAttendanceBatch(pendingChanges);
            setPendingChanges([]);
            await loadData(true);
        } catch (err) {
            console.error("Save failed:", err);
            alert("Erro ao sincronizar.");
        } finally {
            setIsSaving(false);
        }
    };

    const addStudent = async (student: Student) => {
        const s = { ...student, status: student.status || EnrollmentStatus.ACTIVE };
        setAllStudents(prev => [...prev, s]);
        if (isOnline) await api.saveStudent(s);
    };

    const updateStudent = async (updatedStudent: Student) => {
        setAllStudents(prev => prev.map(s => s.id === updatedStudent.id ? { ...s, ...updatedStudent } : s));
        if (isOnline) await api.saveStudent({ ...allStudents.find(s => s.id === updatedStudent.id), ...updatedStudent } as Student);
    };

    const deleteStudent = async (studentId: string) => {
        setAllStudents(prev => prev.filter(s => s.id !== studentId));
        setAttendance(prev => {
            const newAtt = { ...prev };
            delete newAtt[studentId];
            return newAtt;
        });
        if (isOnline) await api.deleteStudent(studentId);
    };

    const batchAddStudents = async (names: string[], classId: string, status: EnrollmentStatus) => {
        const newStudents: Student[] = names.map((name, idx) => ({
            id: 's-' + Date.now() + '-' + idx,
            name,
            classId,
            status: status || EnrollmentStatus.ACTIVE
        }));
        setAllStudents(prev => [...prev, ...newStudents]);
        if (isOnline) await api.syncAll({ students: [...allStudents, ...newStudents], classes, bimesters });
    };

    const createClass = async (name: string): Promise<string> => {
        const newClass: ClassGroup = { id: 'c-' + Date.now(), name };
        setClasses(prev => [...prev, newClass].sort((a, b) => a.name.localeCompare(b.name)));
        if (isOnline) await api.saveClass(newClass);
        return newClass.id;
    };

    const updateClass = async (id: string, name: string) => {
        setClasses(prev => prev.map(c => c.id === id ? { ...c, name } : c).sort((a, b) => a.name.localeCompare(b.name)));
        if (isOnline) await api.saveClass({ id, name });
    };

    const deleteClass = async (id: string) => {
        setClasses(prev => prev.filter(c => c.id !== id));
        setAllStudents(prev => prev.filter(s => String(s.classId) !== String(id)));
        if (isOnline) await api.deleteClass(id);
    };

    const updateBimesterConfig = (id: number, field: 'start' | 'end', value: string) => {
        setBimesters(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    const saveBimesters = async () => {
        if (isOnline) await api.saveBimester(bimesters);
    };

    const updateLessonConfig = async (date: string, activeIndices: number[], subjects: Record<number, string>, topics: Record<number, string>, classId: string) => {
        const configKey = classId + '_' + date;
        setDailyLessonConfig(prev => ({ ...prev, [configKey]: activeIndices }));
        setLessonSubjects(prev => ({ ...prev, [configKey]: subjects }));
        setLessonTopics(prev => ({ ...prev, [configKey]: topics }));
        if (isOnline) {
            await api.saveDailyLessonConfig(date, activeIndices, classId);
            await api.saveLessonContents(date, subjects, topics, classId);
        }
    };

    const saveSchoolSubjects = async (subjects: string[]) => {
        setRegisteredSubjects(subjects);
        if (isOnline) await api.saveConfig('registeredSubjects', subjects);
    };

    const saveHolidays = async (holidaysList: Holiday[]) => {
        setHolidays(holidaysList);
        if (isOnline) await api.saveConfig('holidays', holidaysList);
    };

    return (
        <SchoolContext.Provider value={{
            classes, allStudents, attendance, bimesters, holidays, dailyLessonConfig,
            lessonSubjects, lessonTopics, isOnline, isSaving, isLoading, pendingChanges, registeredSubjects,
            year, month, selectedClassId, statusFilter, selectedStudent, dateList, classStudents,
            setYear, setMonth, setSelectedClassId, setStatusFilter, setSelectedStudent,
            refreshData: loadData, updateStudentStatus: (sid, s) => updateStudent({ id: sid, status: s } as Student),
            toggleAttendance, bulkAttendanceUpdate, saveChanges, addStudent, updateStudent, deleteStudent,
            batchAddStudents, createClass, updateClass, deleteClass, updateBimesterConfig, saveBimesters,
            updateLessonConfig, saveSchoolSubjects, saveHolidays
        }}>
            {children}
        </SchoolContext.Provider>
    );
};

export const useSchool = () => {
    const context = useContext(SchoolContext);
    if (context === undefined) throw new Error('useSchool must be used within a SchoolProvider');
    return context;
};
