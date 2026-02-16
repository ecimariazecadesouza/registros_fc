import React, { useState, useMemo } from 'react';
import { BookOpen, Calendar, FileText, Search, GraduationCap, ChevronDown, Filter, Edit2, Trash2, Check, X } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { AttendanceStatus } from '../types';

interface Props { }

const LessonDiary: React.FC<Props> = () => {
    const {
        classes, dailyLessonConfig, lessonSubjects, lessonTopics, registeredSubjects,
        year, month, updateLessonConfig, attendance, classStudents
    } = useSchool();

    const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
    const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    // State for editing
    const [editingLesson, setEditingLesson] = useState<{ date: string, index: number } | null>(null);
    const [editSubject, setEditSubject] = useState('');
    const [editTopic, setEditTopic] = useState('');

    const rawMonthData = useMemo(() => {
        if (!selectedClassId) return [];
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const records = [];

        for (let day = daysInMonth; day >= 1; day--) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const configKey = `${selectedClassId}_${dateStr}`;
            const activeIndices = dailyLessonConfig[configKey];

            if (!activeIndices || activeIndices.length === 0) continue;

            const daySubjects = lessonSubjects[configKey] || {};
            const dayTopics = lessonTopics[configKey] || {};

            const lessons = activeIndices.map(idx => ({
                index: idx,
                subject: daySubjects[idx] || 'Não informada',
                topic: dayTopics[idx] || ''
            }));

            records.push({ date: dateStr, dateObj: new Date(dateStr + 'T12:00:00'), lessons });
        }
        return records;
    }, [selectedClassId, dailyLessonConfig, lessonSubjects, lessonTopics, year, month]);

    const availableSubjects = useMemo(() => {
        const subjectsInView = new Set<string>();
        rawMonthData.forEach(day => {
            day.lessons.forEach(lesson => {
                if (lesson.subject && lesson.subject !== 'Não informada') subjectsInView.add(lesson.subject);
            });
        });
        return Array.from(new Set([...registeredSubjects, ...Array.from(subjectsInView)])).sort();
    }, [rawMonthData, registeredSubjects]);

    const filteredDiaryData = useMemo(() => {
        return rawMonthData.map(dayRecord => {
            const filteredLessons = dayRecord.lessons.filter(l => {
                if (selectedSubject !== 'ALL' && l.subject !== selectedSubject) return false;
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    return l.subject.toLowerCase().includes(term) || l.topic.toLowerCase().includes(term);
                }
                return true;
            });
            return { ...dayRecord, lessons: filteredLessons };
        }).filter(dayRecord => dayRecord.lessons.length > 0);
    }, [rawMonthData, selectedSubject, searchTerm]);

    const handleStartEdit = (date: string, lesson: { index: number, subject: string, topic: string }) => {
        setEditingLesson({ date, index: lesson.index });
        setEditSubject(lesson.subject === 'Não informada' ? '' : lesson.subject);
        setEditTopic(lesson.topic);
    };

    const handleSaveEdit = async () => {
        if (!editingLesson) return;
        const { date, index } = editingLesson;
        const configKey = `${selectedClassId}_${date}`;

        const currentIndices = dailyLessonConfig[configKey] || [];
        const currentSubjects = { ...(lessonSubjects[configKey] || {}) };
        const currentTopics = { ...(lessonTopics[configKey] || {}) };

        currentSubjects[index] = editSubject;
        currentTopics[index] = editTopic;

        await updateLessonConfig(date, currentIndices, currentSubjects, currentTopics, selectedClassId);
        setEditingLesson(null);
    };

    const handleDeleteLesson = async (date: string, lessonIndex: number) => {
        const configKey = `${selectedClassId}_${date}`;

        // Check for existing attendance
        const hasAttendance = classStudents.some(s => {
            const record = attendance[s.id]?.[date];
            return record && record[lessonIndex] && record[lessonIndex] !== AttendanceStatus.UNDEFINED;
        });

        const msg = hasAttendance
            ? `ATENÇÃO: Existem registros de frequência para esta aula. \n\nAo excluir, TODA a frequência desta aula no dia ${date} será APAGADA permanentemente.\n\nDeseja continuar?`
            : `Deseja realmente excluir o conteúdo da ${lessonIndex + 1}ª aula do dia ${date}?`;

        if (!window.confirm(msg)) return;

        const currentIndices = dailyLessonConfig[configKey] || [];
        const newIndices = currentIndices.filter(idx => idx !== lessonIndex);

        const currentSubjects = { ...(lessonSubjects[configKey] || {}) };
        const currentTopics = { ...(lessonTopics[configKey] || {}) };

        delete currentSubjects[lessonIndex];
        delete currentTopics[lessonIndex];

        await updateLessonConfig(date, newIndices, currentSubjects, currentTopics, selectedClassId);
    };

    if (classes.length === 0) return <div className="p-8 text-center text-slate-500">Nenhuma turma cadastrada.</div>;

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="bg-white border-b border-gray-200 p-6 shadow-sm z-10">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><BookOpen className="text-indigo-600" /> Diário de Conteúdos</h2>
                        <p className="text-sm text-slate-500 mt-1">Histórico de matérias e temas lecionados.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative group flex-1 sm:flex-none">
                            <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="appearance-none pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 outline-none w-full sm:w-64 font-medium truncate">
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <div className="relative group flex-1 sm:flex-none">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="appearance-none pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 outline-none w-full sm:w-56 font-medium truncate">
                                <option value="ALL">Todas Disciplinas</option>
                                {availableSubjects.map(subj => <option key={subj} value={subj}>{subj}</option>)}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <div className="relative group flex-1 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input type="text" placeholder="Buscar conteúdo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 outline-none w-full sm:w-64" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-8">
                    {filteredDiaryData.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400"><FileText size={32} /></div>
                            <h3 className="text-lg font-medium text-slate-700">Nenhum registro encontrado</h3>
                            <p className="text-slate-500 text-sm mt-1">Não há aulas correspondentes aos filtros selecionados neste mês.</p>
                        </div>
                    ) : (
                        filteredDiaryData.map((dayRecord) => (
                            <div key={dayRecord.date} className="relative pl-8 before:absolute before:left-[11px] before:top-8 before:bottom-[-32px] before:w-0.5 before:bg-slate-200 last:before:hidden">
                                <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-indigo-100 border-2 border-indigo-500 z-10"></div>
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                                        <Calendar size={16} className="text-indigo-500" />
                                        <span className="font-bold text-slate-700 capitalize">{dayRecord.dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                        <span className="ml-auto text-xs font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">{dayRecord.date}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {dayRecord.lessons.map((lesson, idx) => {
                                            const isEditing = editingLesson?.date === dayRecord.date && editingLesson?.index === lesson.index;

                                            return (
                                                <div key={idx} className={`p-4 transition-colors flex gap-4 ${isEditing ? 'bg-indigo-50' : 'hover:bg-indigo-50/30'}`}>
                                                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                                                        <span className="text-xs font-bold uppercase">Aula</span>
                                                        <span className="text-lg font-bold leading-none">{lesson.index + 1}ª</span>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        {isEditing ? (
                                                            <div className="space-y-2">
                                                                <input
                                                                    list="registered-subjects"
                                                                    type="text"
                                                                    className="w-full bg-white border border-indigo-200 rounded px-2 py-1.5 text-xs font-bold outline-none focus:border-indigo-500"
                                                                    placeholder="Disciplina"
                                                                    value={editSubject}
                                                                    onChange={(e) => setEditSubject(e.target.value)}
                                                                />
                                                                <textarea
                                                                    className="w-full bg-white border border-indigo-200 rounded px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-500 min-h-[60px] resize-none"
                                                                    placeholder="Conteúdo"
                                                                    value={editTopic}
                                                                    onChange={(e) => setEditTopic(e.target.value)}
                                                                />
                                                                <div className="flex gap-2">
                                                                    <button onClick={handleSaveEdit} className="bg-emerald-600 text-white px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-700 transition-colors">
                                                                        <Check size={12} /> Salvar
                                                                    </button>
                                                                    <button onClick={() => setEditingLesson(null)} className="bg-slate-200 text-slate-600 px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 hover:bg-slate-300 transition-colors">
                                                                        <X size={12} /> Cancelar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 truncate max-w-[200px]">
                                                                        {lesson.subject}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-slate-700 leading-relaxed">
                                                                    {lesson.topic || <span className="text-slate-400 italic">Sem descrição do conteúdo.</span>}
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>

                                                    {!isEditing && (
                                                        <div className="flex gap-1 items-start opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => handleStartEdit(dayRecord.date, lesson)}
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-all"
                                                                title="Editar Conteúdo"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteLesson(dayRecord.date, lesson.index)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition-all"
                                                                title="Excluir Aula"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <datalist id="registered-subjects">
                {registeredSubjects.map(s => <option key={s} value={s} />)}
            </datalist>
        </div>
    );
};

export default LessonDiary;
