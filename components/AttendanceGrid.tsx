import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Student, AttendanceStatus, StudentStats, EnrollmentStatus, Holiday } from '../types';
import { STATUS_COLORS, ENROLLMENT_COLORS } from '../constants';
import { Check, X, Clock, ChevronDown, CheckCheck, Loader2 } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

interface AttendanceGridProps {
  onSelectStudent: (student: Student) => void;
  isLocked?: boolean;
}

const AttendanceGrid: React.FC<AttendanceGridProps> = ({
  onSelectStudent,
  isLocked = false
}) => {
  const {
    selectedClassId: classId, classStudents: students, dateList: dates,
    attendance, holidays, dailyLessonConfig, lessonSubjects, lessonTopics,
    registeredSubjects, pendingChanges, toggleAttendance, bulkAttendanceUpdate,
    updateLessonConfig, updateStudentStatus
  } = useSchool();

  const [openConfigDate, setOpenConfigDate] = useState<string | null>(null);
  const [tempSubjects, setTempSubjects] = useState<Record<number, string>>({});
  const [tempTopics, setTempTopics] = useState<Record<number, string>>({});
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpenConfigDate(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Init temp subjects/topics when opening popover
  useEffect(() => {
    if (openConfigDate) {
      const configKey = `${classId}_${openConfigDate}`;
      setTempSubjects(lessonSubjects[configKey] || lessonSubjects[openConfigDate] || {});
      setTempTopics(lessonTopics[configKey] || lessonTopics[openConfigDate] || {});
    }
  }, [openConfigDate, lessonSubjects, lessonTopics, classId]);

  const calculateStats = (studentId: string): StudentStats => {
    const record = attendance[studentId] || {};
    let present = 0;
    let absent = 0;
    let excused = 0;
    let lessonsCounted = 0;

    dates.forEach(date => {
      const statuses = record[date] || [];
      const configKey = `${classId}_${date}`;
      const activeIndices = dailyLessonConfig[configKey] || dailyLessonConfig[date] || [0];

      activeIndices.forEach(idx => {
        const status = statuses[idx];
        if (status === AttendanceStatus.PRESENT) present++;
        else if (status === AttendanceStatus.ABSENT) absent++;
        else if (status === AttendanceStatus.EXCUSED) excused++;

        if (status && status !== AttendanceStatus.UNDEFINED) {
          lessonsCounted++;
        }
      });
    });

    const totalConsidered = lessonsCounted === 0 ? 1 : lessonsCounted;
    const percentage = ((present + excused) / totalConsidered) * 100;

    return { totalLessons: lessonsCounted, present, absent, excused, percentage };
  };

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDate().toString().padStart(2, '0');
    const weekDay = date.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3);
    return { day, weekDay };
  };

  const getHoliday = (date: string) => {
    return holidays.find(h => h.date === date);
  }

  const isPending = (studentId: string, date: string, lessonIndex: number) => {
    return pendingChanges.some(p =>
      p.studentId === studentId && p.date === date && p.lessonIndex === lessonIndex
    );
  };

  const handleConfigSave = (date: string, activeIndices: number[]) => {
    updateLessonConfig(date, activeIndices, tempSubjects, tempTopics, classId);
  };

  if (students.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white rounded-lg border border-dashed border-slate-300 m-4 p-8">
        <p className="font-medium">Nenhum aluno nesta turma ou filtro selecionado.</p>
        <p className="text-sm">Adicione protagonistas na aba "Protagonistas".</p>
      </div>
    );
  }

  const IDX_WIDTH = 50;
  const NAME_WIDTH = 350;
  const STATUS_WIDTH = 120;
  const NAME_LEFT = IDX_WIDTH;
  const STATUS_LEFT = IDX_WIDTH + NAME_WIDTH;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-premium flex flex-col h-full overflow-hidden animate-fade-in">
      <datalist id="registered-subjects">
        {registeredSubjects.map(subj => (
          <option key={subj} value={subj} />
        ))}
      </datalist>

      <div className="overflow-auto custom-scrollbar flex-1 relative min-h-0">
        <table className="min-w-max border-collapse text-sm text-left">
          <thead className="bg-slate-950 text-slate-300 md:sticky top-0 z-20">
            <tr>
              <th className="sticky bg-slate-950 p-4 border-b border-slate-900 border-r border-slate-900/50 text-center font-bold text-[10px] uppercase tracking-widest z-30" style={{ left: 0, minWidth: IDX_WIDTH }}>#</th>
              <th className="md:sticky bg-slate-950 p-4 border-b border-slate-900 font-bold text-[10px] uppercase tracking-widest z-30 min-w-[200px] md:min-w-[350px]" style={{ left: NAME_LEFT }}>Protagonista</th>
              <th className="md:sticky bg-slate-950 p-4 border-b border-slate-900 font-bold text-[10px] uppercase tracking-widest border-r border-slate-900 shadow-[8px_0_12px_-6px_rgba(0,0,0,0.5)] z-30" style={{ left: STATUS_LEFT, minWidth: STATUS_WIDTH }}>Situação</th>

              {dates.map((date) => {
                const { day, weekDay } = getDayLabel(date);
                const isWeekend = weekDay === 'sáb' || weekDay === 'dom';
                const holiday = getHoliday(date);
                const configKey = `${classId}_${date}`;
                const activeIndices = dailyLessonConfig[configKey] || dailyLessonConfig[date] || [0];
                const isOpen = openConfigDate === date;

                const headerClass = holiday ? 'bg-amber-100 text-amber-800 border-amber-200' : isWeekend ? 'bg-slate-700 text-slate-300' : '';

                return (
                  <th key={date} className={`p-1 min-w-[64px] border-b border-slate-900 text-center relative group/th ${headerClass}`}>
                    <div className="flex flex-col items-center justify-center gap-1 py-1">
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-[10px] uppercase opacity-70">{weekDay}</span>
                        <span className="font-bold text-lg">{day}</span>
                      </div>
                      {holiday && <div className="text-[9px] font-bold uppercase truncate max-w-[50px]" title={holiday.name}>{holiday.name}</div>}
                      {!isWeekend && !holiday && (
                        <div className="relative">
                          <button
                            onClick={() => setOpenConfigDate(isOpen ? null : date)}
                            className={`flex items-center justify-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors border ${isOpen ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700 border-slate-600 hover:border-slate-500'}`}
                          >
                            <Clock size={10} className={isOpen ? "text-white" : "text-indigo-400"} />
                            <span className={isOpen ? "text-white font-bold" : "font-mono font-bold text-indigo-200"}>{activeIndices.length}</span>
                          </button>

                          {isOpen && (
                            <div ref={popoverRef} className="fixed md:absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:translate-y-0 md:top-full md:mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 w-80 text-slate-800 animate-in fade-in zoom-in-95 duration-100 cursor-default">
                              <h4 className="text-xs font-bold text-slate-500 mb-3 text-left uppercase flex justify-between items-center">
                                <span>Configuração do Dia</span>
                                <button onClick={() => setOpenConfigDate(null)} className="text-slate-400 hover:text-rose-500"><X size={14} /></button>
                              </h4>
                              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {Array.from({ length: 9 }, (_, i) => i).map(idx => {
                                  const isActive = activeIndices.includes(idx);
                                  return (
                                    <div key={idx} className={`flex flex-col gap-1 p-2 rounded border transition-colors ${isActive ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-transparent'}`}>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            const newIndices = isActive ? activeIndices.filter(x => x !== idx) : [...activeIndices, idx].sort((a, b) => a - b);
                                            handleConfigSave(date, newIndices);
                                          }}
                                          className={`h-6 w-6 shrink-0 rounded text-xs font-bold flex items-center justify-center transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-400 hover:bg-slate-100'}`}
                                        >
                                          {idx + 1}ª
                                        </button>
                                        {isActive && (
                                          <div className="flex items-center justify-between flex-1">
                                            <span className="text-xs font-semibold text-indigo-900">Aula Ativa</span>
                                            <button
                                              onClick={() => bulkAttendanceUpdate(date, idx, AttendanceStatus.PRESENT, classId, students)}
                                              className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded hover:bg-emerald-200 transition-colors"
                                            >
                                              <CheckCheck size={12} /> Todos Presentes
                                            </button>
                                          </div>
                                        )}
                                        {!isActive && <span className="text-xs text-slate-400 italic">Inativo</span>}
                                      </div>
                                      {isActive && (
                                        <div className="ml-8 space-y-1">
                                          <input list="registered-subjects" type="text" className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500" placeholder="Disciplina" value={tempSubjects[idx] || ''} onChange={(e) => setTempSubjects(prev => ({ ...prev, [idx]: e.target.value }))} onBlur={() => handleConfigSave(date, activeIndices)} />
                                          <input type="text" className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500" placeholder="Conteúdo" value={tempTopics[idx] || ''} onChange={(e) => setTempTopics(prev => ({ ...prev, [idx]: e.target.value }))} onBlur={() => handleConfigSave(date, activeIndices)} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="md:sticky right-[120px] bg-slate-900 p-2 min-w-[60px] text-center text-[10px] font-bold uppercase tracking-widest border-l border-slate-800 z-20">Faltas</th>
              <th className="md:sticky right-[60px] bg-slate-900 p-2 min-w-[60px] text-center text-[10px] font-bold uppercase tracking-widest z-20">Pres.</th>
              <th className="md:sticky right-0 bg-slate-900 p-2 min-w-[60px] text-center text-[10px] font-bold uppercase tracking-widest z-20">Freq.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.map((student, index) => {
              const stats = calculateStats(student.id);
              const isLowAttendance = stats.percentage < 75 && stats.totalLessons > 0;
              return (
                <tr key={student.id} className="hover:bg-blue-50 transition-colors group">
                  <td className="sticky bg-white group-hover:bg-indigo-50/30 p-2 text-center text-slate-400 border-r border-slate-100 font-mono text-[10px] z-10" style={{ left: 0 }}>{(index + 1).toString().padStart(2, '0')}</td>
                  <td className="md:sticky bg-white group-hover:bg-indigo-50/30 p-3 border-r border-slate-100 z-10" style={{ left: NAME_LEFT }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => onSelectStudent(student)} className="flex-1 text-left group/name">
                        <span className="font-semibold text-slate-700 text-sm block leading-tight group-hover/name:text-indigo-600 transition-colors" title={student.name}>{student.name}</span>
                      </button>
                      {isLowAttendance && (
                        <div className="flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded text-[9px] font-bold text-rose-600 border border-rose-100">
                          <span className="flex h-1.5 w-1.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span></span>
                          ALERTA
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="md:sticky bg-white group-hover:bg-indigo-50/30 p-2 border-r border-slate-200 z-10 shadow-[8px_0_12px_-6px_rgba(0,0,0,0.1)] text-center" style={{ left: STATUS_LEFT }}>
                    <select value={student.status} onChange={(e) => updateStudentStatus(student.id, e.target.value as EnrollmentStatus)} className={`w-full appearance-none px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-500 ${ENROLLMENT_COLORS[student.status] || ENROLLMENT_COLORS[EnrollmentStatus.OTHER]}`}>
                      {Object.values(EnrollmentStatus).map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </td>

                  {dates.map((date) => {
                    const studentRecord = attendance[student.id] || {};
                    const statuses = studentRecord[date] || [];
                    const { weekDay } = getDayLabel(date);
                    const isWeekend = weekDay === 'sáb' || weekDay === 'dom';
                    const holiday = getHoliday(date);
                    const isStudentLocked = isLocked || student.status === EnrollmentStatus.DROPOUT || student.status === EnrollmentStatus.TRANSFERRED;
                    const configKey = `${classId}_${date}`;
                    const activeIndices = dailyLessonConfig[configKey] || dailyLessonConfig[date] || [0];
                    const subjects = lessonSubjects[configKey] || lessonSubjects[date] || {};
                    const topics = lessonTopics[configKey] || lessonTopics[date] || {};

                    return (
                      <td key={`${student.id}-${date}`} className={`p-1 text-center border-r border-gray-50 ${isWeekend ? 'bg-gray-50/50' : ''} ${holiday ? 'bg-amber-50/50' : ''}`}>
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {activeIndices.map((lessonIdx) => {
                            const status = statuses[lessonIdx] || AttendanceStatus.UNDEFINED;
                            const pending = isPending(student.id, date, lessonIdx);
                            const subject = subjects[lessonIdx];
                            const topic = topics[lessonIdx];
                            return (
                              <div key={lessonIdx} className="relative group/btn flex flex-col items-center">
                                <button
                                  onClick={() => !isWeekend && !holiday && toggleAttendance(student.id, date, lessonIdx, classId)}
                                  disabled={isWeekend || !!holiday || isStudentLocked}
                                  title={`${lessonIdx + 1}ª Aula${subject ? ` - ${subject}` : ''}${topic ? `\nConteúdo: ${topic}` : ''}`}
                                  className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all duration-200 attendance-cell ${STATUS_COLORS[status]} ${isWeekend || holiday || isStudentLocked ? 'opacity-20 cursor-not-allowed scale-90' : 'shadow-sm hover:scale-110 active:scale-95 border'} ${pending ? 'ring-2 ring-indigo-500 ring-offset-2 z-10 shadow-lg' : ''}`}
                                >
                                  {status === AttendanceStatus.PRESENT && <Check size={12} strokeWidth={3} />}
                                  {status === AttendanceStatus.ABSENT && <X size={12} strokeWidth={3} />}
                                  {status === AttendanceStatus.EXCUSED && <Clock size={12} strokeWidth={3} />}
                                  {status === AttendanceStatus.UNDEFINED && <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover/btn:bg-indigo-400 transition-colors" />}
                                </button>
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover/btn:block bg-black text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none shadow-lg">
                                  <div className="font-bold">{lessonIdx + 1}ª {subject ? `(${subject})` : ''}</div>
                                  {topic && <div className="font-normal opacity-80 max-w-[150px] truncate">{topic}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                  <td className="md:sticky right-[120px] bg-white group-hover:bg-rose-50/30 p-2 text-center text-sm font-bold text-rose-600 border-l border-slate-100 z-10">{stats.absent}</td>
                  <td className="md:sticky right-[60px] bg-white group-hover:bg-emerald-50/30 p-2 text-center text-sm font-bold text-emerald-600 z-10">{stats.present}</td>
                  <td className={`md:sticky right-0 bg-slate-50 group-hover:bg-indigo-50 p-2 text-center text-sm font-black z-10 ${isLowAttendance ? 'text-rose-600' : 'text-slate-900'}`}>{stats.totalLessons === 0 ? '-' : `${stats.percentage.toFixed(0)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceGrid;
