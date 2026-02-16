
import React, { useState, useMemo } from 'react';
import { ClassGroup, LessonSubjectMap, LessonTopicMap } from '../types';
import { BookOpen, Calendar, FileText, Search, GraduationCap, ChevronDown, Filter } from 'lucide-react';

interface Props {
  classes: ClassGroup[];
  dailyLessonConfig: Record<string, number[]>;
  lessonSubjects: LessonSubjectMap;
  lessonTopics: LessonTopicMap;
  registeredSubjects: string[];
  year: number;
  month: number; // 0-11
}

const LessonDiary: React.FC<Props> = ({ 
    classes, 
    dailyLessonConfig, 
    lessonSubjects, 
    lessonTopics,
    registeredSubjects,
    year, 
    month 
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. First, gather all raw data for the month (before filtering by subject/search)
  // This allows us to extract available subjects dynamically
  const rawMonthData = useMemo(() => {
    if (!selectedClassId) return [];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const records = [];

    // Iterate backwards (newest first)
    for (let day = daysInMonth; day >= 1; day--) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Construct composite key
        const configKey = `${selectedClassId}_${dateStr}`;
        const activeIndices = dailyLessonConfig[configKey]; 
        
        if (!activeIndices || activeIndices.length === 0) continue;

        const daySubjects = lessonSubjects[configKey] || lessonSubjects[dateStr] || {};
        const dayTopics = lessonTopics[configKey] || lessonTopics[dateStr] || {};

        const lessons = activeIndices.map(idx => ({
            index: idx,
            subject: daySubjects[idx] || 'Não informada',
            topic: dayTopics[idx] || ''
        }));

        records.push({
            date: dateStr,
            dateObj: new Date(dateStr + 'T12:00:00'),
            lessons
        });
    }
    return records;
  }, [selectedClassId, dailyLessonConfig, lessonSubjects, lessonTopics, year, month]);

  // 2. Extract unique subjects present in the current month's data
  // Combine with registeredSubjects to ensure the dropdown is comprehensive
  const availableSubjects = useMemo(() => {
      const subjectsInView = new Set<string>();
      
      rawMonthData.forEach(day => {
          day.lessons.forEach(lesson => {
              if (lesson.subject && lesson.subject !== 'Não informada') {
                  subjectsInView.add(lesson.subject);
              }
          });
      });

      // Merge with registered subjects
      const combined = Array.from(new Set([...registeredSubjects, ...Array.from(subjectsInView)]));
      return combined.sort();
  }, [rawMonthData, registeredSubjects]);

  // 3. Filter data based on user selection
  const filteredDiaryData = useMemo(() => {
      return rawMonthData.map(dayRecord => {
          const filteredLessons = dayRecord.lessons.filter(l => {
              // Subject Filter
              if (selectedSubject !== 'ALL' && l.subject !== selectedSubject) return false;

              // Search Filter
              if (searchTerm) {
                  const term = searchTerm.toLowerCase();
                  return l.subject.toLowerCase().includes(term) || l.topic.toLowerCase().includes(term);
              }

              return true;
          });

          return {
              ...dayRecord,
              lessons: filteredLessons
          };
      }).filter(dayRecord => dayRecord.lessons.length > 0); // Remove days with no matching lessons
  }, [rawMonthData, selectedSubject, searchTerm]);


  if (classes.length === 0) {
      return <div className="p-8 text-center text-slate-500">Nenhuma turma cadastrada.</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
        {/* Header & Filters */}
        <div className="bg-white border-b border-gray-200 p-6 shadow-sm z-10">
             <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                 <div>
                     <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                         <BookOpen className="text-indigo-600" /> Diário de Conteúdos
                     </h2>
                     <p className="text-sm text-slate-500 mt-1">
                         Histórico de matérias e temas lecionados.
                     </p>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-3">
                     {/* Class Selector */}
                     <div className="relative group flex-1 sm:flex-none">
                         <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                         <select 
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            className="appearance-none pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full sm:w-64 transition-all shadow-sm cursor-pointer font-medium truncate"
                         >
                             {classes.map(c => (
                                 <option key={c.id} value={c.id}>{c.name}</option>
                             ))}
                         </select>
                         <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                     </div>

                     {/* Subject Filter */}
                     <div className="relative group flex-1 sm:flex-none">
                         <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                         <select 
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="appearance-none pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full sm:w-56 transition-all shadow-sm cursor-pointer font-medium truncate"
                         >
                             <option value="ALL">Todas Disciplinas</option>
                             {availableSubjects.map(subj => (
                                 <option key={subj} value={subj}>{subj}</option>
                             ))}
                         </select>
                         <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors" />
                     </div>

                     {/* Search Input */}
                     <div className="relative group flex-1 sm:flex-none">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                         <input 
                            type="text"
                            placeholder="Buscar conteúdo..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full sm:w-64 transition-all shadow-sm placeholder:text-slate-400"
                         />
                     </div>
                 </div>
             </div>
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8">
                {filteredDiaryData.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <FileText size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-slate-700">Nenhum registro encontrado</h3>
                        <p className="text-slate-500 text-sm mt-1">
                            Não há aulas correspondentes aos filtros selecionados neste mês.
                        </p>
                    </div>
                ) : (
                    filteredDiaryData.map((dayRecord) => (
                        <div key={dayRecord.date} className="relative pl-8 before:absolute before:left-[11px] before:top-8 before:bottom-[-32px] before:w-0.5 before:bg-slate-200 last:before:hidden">
                            {/* Date Badge */}
                            <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-indigo-100 border-2 border-indigo-500 z-10"></div>
                            
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                {/* Day Header */}
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                                    <Calendar size={16} className="text-indigo-500" />
                                    <span className="font-bold text-slate-700 capitalize">
                                        {dayRecord.dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </span>
                                    <span className="ml-auto text-xs font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                                        {dayRecord.date}
                                    </span>
                                </div>

                                {/* Lessons List */}
                                <div className="divide-y divide-slate-100">
                                    {dayRecord.lessons.map((lesson, idx) => (
                                        <div key={idx} className="p-4 hover:bg-indigo-50/30 transition-colors flex gap-4">
                                            <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-slate-100 text-slate-500 shrink-0">
                                                <span className="text-xs font-bold uppercase">Aula</span>
                                                <span className="text-lg font-bold leading-none">{lesson.index + 1}ª</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 truncate max-w-[200px]">
                                                        {lesson.subject}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-700 leading-relaxed">
                                                    {lesson.topic || <span className="text-slate-400 italic">Sem descrição do conteúdo.</span>}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );
};

export default LessonDiary;
