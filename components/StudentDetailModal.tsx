import React, { useState, useEffect, useMemo } from 'react';
import { Student, AttendanceStatus, EnrollmentStatus } from '../types';
import { X, Award, User, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { useSchool } from '../context/SchoolContext';

interface Props {
    onClose: () => void;
}

const StudentDetailModal: React.FC<Props> = ({
    onClose
}) => {
    const {
        selectedStudent: student,
        classStudents: studentsList,
        setSelectedStudent: onSelectStudent,
        year,
        attendance,
        bimesters,
        dailyLessonConfig,
        lessonSubjects
    } = useSchool();

    // Handle Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!student) return;
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [student, studentsList]);

    const currentIndex = useMemo(() => {
        if (!student) return -1;
        return studentsList.findIndex(s => s.id === student.id);
    }, [student, studentsList]);

    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < studentsList.length - 1;

    const handlePrev = () => {
        if (hasPrev) onSelectStudent(studentsList[currentIndex - 1]);
    };

    const handleNext = () => {
        if (hasNext) onSelectStudent(studentsList[currentIndex + 1]);
    };

    const attendanceRecord = useMemo(() => {
        if (!student) return {};
        return attendance[student.id] || {};
    }, [attendance, student]);

    const bimesterStats = useMemo(() => {
        return bimesters.map(bimester => {
            let present = 0, absent = 0, excused = 0, total = 0;

            const start = new Date(bimester.start);
            const end = new Date(bimester.end);

            Object.entries(attendanceRecord).forEach(([dateStr, statuses]) => {
                const date = new Date(dateStr + 'T12:00:00');
                const statusArray = statuses as AttendanceStatus[];

                if (date >= start && date <= end) {
                    statusArray.forEach(status => {
                        if (status === AttendanceStatus.PRESENT) present++;
                        else if (status === AttendanceStatus.ABSENT) absent++;
                        else if (status === AttendanceStatus.EXCUSED) excused++;

                        if (status !== AttendanceStatus.UNDEFINED) total++;
                    });
                }
            });

            const percentage = total > 0 ? ((present + excused) / total) * 100 : 0;
            return { ...bimester, present, absent, excused, total, percentage };
        });
    }, [attendanceRecord, bimesters]);

    const subjectStats = useMemo(() => {
        if (!student) return [];

        const stats: Record<string, { present: number, absent: number, total: number }> = {};

        Object.entries(attendanceRecord).forEach(([dateStr, rawStatuses]) => {
            const statuses = rawStatuses as AttendanceStatus[];
            const configKey = `${student.classId}_${dateStr}`;
            const daySubjects = lessonSubjects[configKey] || lessonSubjects[dateStr] || {};

            statuses.forEach((status, idx) => {
                if (status === AttendanceStatus.UNDEFINED) return;

                const subjectName = daySubjects[idx] || 'Não informada';

                if (!stats[subjectName]) {
                    stats[subjectName] = { present: 0, absent: 0, total: 0 };
                }

                stats[subjectName].total++;

                if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.EXCUSED) {
                    stats[subjectName].present++;
                } else {
                    stats[subjectName].absent++;
                }
            });
        });

        return Object.entries(stats).map(([name, data]) => ({
            name,
            ...data,
            percentage: data.total > 0 ? (data.present / data.total) * 100 : 0
        })).sort((a, b) => b.percentage - a.percentage);

    }, [attendanceRecord, lessonSubjects, student]);

    if (!student) return null;

    const annualStats = bimesterStats.reduce((acc, curr) => ({
        present: acc.present + curr.present,
        absent: acc.absent + curr.absent,
        excused: acc.excused + curr.excused,
        total: acc.total + curr.total
    }), { present: 0, absent: 0, excused: 0, total: 0 });

    const annualPercentage = annualStats.total > 0
        ? ((annualStats.present + annualStats.excused) / annualStats.total) * 100
        : 0;

    const chartData = [
        { name: 'Presença', value: annualStats.present, color: '#10b981' },
        { name: 'Falta', value: annualStats.absent, color: '#f43f5e' },
        { name: 'Justificada', value: annualStats.excused, color: '#f59e0b' },
    ].filter(d => d.value > 0);

    const isRisk = annualPercentage < 75;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95vh]">

                {/* Header */}
                <div className="bg-slate-900 text-white p-6 flex justify-between items-start shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center border-2 border-slate-600">
                            <User size={32} className="text-slate-300" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{student.name}</h2>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-slate-400 text-sm">Ano Letivo: {year}</span>
                                <span className={`text-xs px-2 py-0.5 rounded font-bold ${isRisk ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                                    {annualPercentage.toFixed(1)}% Anual
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-800 rounded-lg p-1 mr-4">
                            <button onClick={handlePrev} disabled={!hasPrev} className="p-2 hover:bg-slate-700 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-slate-300">
                                <ChevronLeft size={20} />
                            </button>
                            <div className="w-px h-6 bg-slate-700 mx-1"></div>
                            <button onClick={handleNext} disabled={!hasNext} className="p-2 hover:bg-slate-700 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-slate-300">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-2 rounded-lg hover:bg-rose-600">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto p-6 bg-slate-50">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Award size={16} /> Desempenho por Bimestre
                                </h3>
                                <div className="overflow-hidden border border-gray-100 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium text-gray-500">Período</th>
                                                <th className="px-4 py-3 text-center font-medium text-emerald-600">Presenças</th>
                                                <th className="px-4 py-3 text-center font-medium text-rose-600">Faltas</th>
                                                <th className="px-4 py-3 text-center font-medium text-amber-600">Justif.</th>
                                                <th className="px-4 py-3 text-right font-medium text-gray-700">% Freq</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {bimesterStats.map((b) => (
                                                <tr key={b.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                                                    <td className="px-4 py-3 text-center text-gray-600">{b.present}</td>
                                                    <td className="px-4 py-3 text-center text-gray-600">{b.absent}</td>
                                                    <td className="px-4 py-3 text-center text-gray-600">{b.excused}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-gray-800">
                                                        <span className={`${b.percentage < 75 && b.total > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                            {b.total === 0 ? '-' : `${b.percentage.toFixed(0)}%`}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 font-semibold text-slate-700">
                                            <tr>
                                                <td className="px-4 py-3">Total Anual</td>
                                                <td className="px-4 py-3 text-center">{annualStats.present}</td>
                                                <td className="px-4 py-3 text-center">{annualStats.absent}</td>
                                                <td className="px-4 py-3 text-center">{annualStats.excused}</td>
                                                <td className="px-4 py-3 text-right">{annualPercentage.toFixed(1)}%</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            <div className="h-64 w-full bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Visualização Anual</h3>
                                <div className="flex-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend verticalAlign="middle" align="right" layout="vertical" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 p-4 border-b border-slate-200">
                                <div className="flex items-center gap-2">
                                    <BookOpen size={18} className="text-indigo-600" />
                                    <h3 className="font-bold text-slate-800">Frequência por Disciplina</h3>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-0">
                                {subjectStats.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 p-6 text-center">
                                        <BookOpen size={32} className="mb-2 opacity-20" />
                                        <p>Nenhuma disciplina registrada nas aulas deste aluno ainda.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Disciplina</th>
                                                <th className="px-4 py-3 text-right">Faltas</th>
                                                <th className="px-4 py-3 text-right">% Freq</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {subjectStats.map((stat, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3 font-medium text-slate-700">
                                                        {stat.name}
                                                        <div className="text-[10px] text-slate-400 font-normal">{stat.total} aulas</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-rose-600 font-medium">{stat.absent}</td>
                                                    <td className="px-4 py-3 text-right font-bold">
                                                        <span className={`px-2 py-0.5 rounded text-xs ${stat.percentage < 75 ? 'bg-rose-100 text-rose-700' : stat.percentage < 90 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {stat.percentage.toFixed(0)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div className="p-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 text-center">
                                Cálculo baseado nas disciplinas informadas no diário de classe.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentDetailModal;
