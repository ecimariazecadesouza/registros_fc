import React, { useMemo, useState } from 'react';
import { AttendanceStatus, EnrollmentStatus, AttendanceRecord } from '../types';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FileText, TrendingUp, Users, Award, AlertTriangle, BookOpen, PieChart as PieIcon, Table } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

const LEVEL_COLORS = {
    'EXCELLENT': '#10b981',
    'REGULAR': '#f59e0b',
    'CRITICAL': '#f43f5e'
};

const ReportsDashboard: React.FC = () => {
    const { allStudents: students, classes, attendance, bimesters, lessonSubjects } = useSchool();

    const [selectedClass, setSelectedClass] = useState<string>('ALL');
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
    const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
    const [selectedBimester, setSelectedBimester] = useState<string>('ANNUAL');

    const processedData = useMemo(() => {
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        if (selectedBimester !== 'ANNUAL') {
            const bim = bimesters.find(b => b.id.toString() === selectedBimester);
            if (bim) {
                startDate = new Date(bim.start);
                endDate = new Date(bim.end);
            }
        }

        const studentStats = students.map(student => {
            if (selectedClass !== 'ALL' && student.classId !== selectedClass) return null;
            if (selectedStatus !== 'ALL' && student.status !== selectedStatus) return null;

            const record: AttendanceRecord = attendance[student.id] || {};
            let present = 0, excused = 0, absent = 0, total = 0;

            Object.entries(record).forEach(([dateStr, statuses]) => {
                const date = new Date(dateStr + 'T12:00:00');
                if (startDate && endDate) {
                    if (date < startDate || date > endDate) return;
                }

                statuses.forEach(status => {
                    if (status === AttendanceStatus.PRESENT) present++;
                    if (status === AttendanceStatus.EXCUSED) excused++;
                    if (status === AttendanceStatus.ABSENT) absent++;
                    if (status !== AttendanceStatus.UNDEFINED) total++;
                });
            });

            const percentage = total > 0 ? ((present + excused) / total) * 100 : 0;
            let level = 'CRITICAL';
            if (percentage >= 90) level = 'EXCELLENT';
            else if (percentage >= 75) level = 'REGULAR';

            if (selectedLevel !== 'ALL' && level !== selectedLevel) return null;

            return {
                ...student,
                className: classes.find(c => c.id === student.classId)?.name || 'Sem Turma',
                stats: { present, excused, absent, total, percentage, level }
            };
        }).filter(s => s !== null) as any[];

        const distribution = [
            { name: 'Excelente (≥90%)', value: 0, key: 'EXCELLENT' },
            { name: 'Regular (75-89%)', value: 0, key: 'REGULAR' },
            { name: 'Crítico (<75%)', value: 0, key: 'CRITICAL' }
        ];

        studentStats.forEach(s => {
            const idx = distribution.findIndex(d => d.key === s.stats.level);
            if (idx !== -1) distribution[idx].value++;
        });

        const classIds = Array.from(new Set(studentStats.map(s => s.classId))).filter(Boolean);
        const classAvgData = classIds.map(clsId => {
            const cls = classes.find(c => c.id === clsId);
            const studentsInClass = studentStats.filter(s => s.classId === clsId);
            const totalPct = studentsInClass.reduce((acc, s) => acc + s.stats.percentage, 0);
            const avg = studentsInClass.length > 0 ? totalPct / studentsInClass.length : 0;

            return {
                name: cls?.name || 'Sem Turma',
                avg: parseFloat(avg.toFixed(1)),
                count: studentsInClass.length
            };
        }).sort((a, b) => b.avg - a.avg);

        let evolutionData: any[] = [];
        if (selectedBimester === 'ANNUAL') {
            evolutionData = bimesters.map(bim => {
                const start = new Date(bim.start);
                const end = new Date(bim.end);
                let bimTotalPct = 0, bimStudentCount = 0;

                studentStats.forEach(student => {
                    const record: AttendanceRecord = attendance[student.id] || {};
                    let p = 0, e = 0, t = 0;
                    Object.entries(record).forEach(([dateStr, statuses]) => {
                        const d = new Date(dateStr + 'T12:00:00');
                        if (d >= start && d <= end) {
                            statuses.forEach(s => {
                                if (s === AttendanceStatus.PRESENT) p++;
                                if (s === AttendanceStatus.EXCUSED) e++;
                                if (s !== AttendanceStatus.UNDEFINED) t++;
                            });
                        }
                    });
                    if (t > 0) {
                        bimTotalPct += ((p + e) / t) * 100;
                        bimStudentCount++;
                    }
                });

                return {
                    name: bim.name,
                    avg: bimStudentCount > 0 ? parseFloat((bimTotalPct / bimStudentCount).toFixed(1)) : 0
                };
            });
        }

        const topStudents = [...studentStats].sort((a, b) => b.stats.percentage - a.stats.percentage).slice(0, 10);

        const subjectAggregates: Record<string, { present: number, total: number }> = {};
        studentStats.forEach(student => {
            const rec = attendance[student.id] || {};
            const classId = student.classId || '';

            Object.entries(rec).forEach(([dateStr, rawStatuses]) => {
                const statuses = rawStatuses as AttendanceStatus[];
                const date = new Date(dateStr + 'T12:00:00');
                if (startDate && endDate) {
                    if (date < startDate || date > endDate) return;
                }

                const configKey = `${classId}_${dateStr}`;
                const daySubjects = lessonSubjects[configKey] || lessonSubjects[dateStr] || {};

                statuses.forEach((status, idx) => {
                    if (status === AttendanceStatus.UNDEFINED) return;

                    const subjectName = daySubjects[idx] || 'Não informada';
                    if (!subjectAggregates[subjectName]) {
                        subjectAggregates[subjectName] = { present: 0, total: 0 };
                    }

                    subjectAggregates[subjectName].total++;
                    if (status === AttendanceStatus.PRESENT || status === AttendanceStatus.EXCUSED) {
                        subjectAggregates[subjectName].present++;
                    }
                });
            });
        });

        const subjectStatsData = Object.entries(subjectAggregates).map(([name, data]) => ({
            name,
            percentage: data.total > 0 ? (data.present / data.total) * 100 : 0,
            total: data.total
        })).sort((a, b) => b.percentage - a.percentage);

        return { studentStats, distribution, classAvgData, evolutionData, topStudents, subjectStatsData };
    }, [students, attendance, classes, bimesters, selectedClass, selectedStatus, selectedLevel, selectedBimester, lessonSubjects]);

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><FileText size={24} /></div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Relatórios Pedagógicos</h2>
                            <p className="text-sm text-slate-500">Análise detalhada de desempenho e frequência.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Turma</label>
                            <select className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
                                <option value="ALL">Todas as Turmas</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Situação Matrícula</label>
                            <select className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
                                <option value="ALL">Todas as Situações</option>
                                {Object.values(EnrollmentStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nível de Frequência</label>
                            <select className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500" value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)}>
                                <option value="ALL">Todos os Níveis</option>
                                <option value="EXCELLENT">Excelente (≥ 90%)</option>
                                <option value="REGULAR">Regular (75-89%)</option>
                                <option value="CRITICAL">Crítico (&lt; 75%)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Período</label>
                            <select className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500" value={selectedBimester} onChange={e => setSelectedBimester(e.target.value)}>
                                <option value="ANNUAL">Acumulado Anual</option>
                                {bimesters.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-full"><Users size={24} /></div>
                        <div><p className="text-sm text-slate-500">Alunos Filtrados</p><p className="text-2xl font-bold text-slate-800">{processedData.studentStats.length}</p></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full"><TrendingUp size={24} /></div>
                        <div><p className="text-sm text-slate-500">Média do Grupo</p><p className="text-2xl font-bold text-slate-800">{processedData.studentStats.length > 0 ? (processedData.studentStats.reduce((acc, s) => acc + s.stats.percentage, 0) / processedData.studentStats.length).toFixed(1) : 0}%</p></div>
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="p-3 bg-rose-100 text-rose-600 rounded-full"><AlertTriangle size={24} /></div>
                        <div><p className="text-sm text-slate-500">Nível Crítico</p><p className="text-2xl font-bold text-rose-600">{processedData.distribution.find(d => d.key === 'CRITICAL')?.value || 0}</p></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px]">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><BookOpen size={18} className="text-indigo-500" /> Taxa de Frequência por Disciplina</h3>
                        <div className="h-[300px]">
                            {processedData.subjectStatsData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={processedData.subjectStatsData} layout="vertical" margin={{ left: 40, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                        <XAxis type="number" domain={[0, 100]} />
                                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Frequência']} />
                                        <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={25}>
                                            {processedData.subjectStatsData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.percentage < 75 ? '#f43f5e' : entry.percentage < 90 ? '#f59e0b' : '#10b981'} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <div className="flex h-full items-center justify-center text-slate-400">Pela filtros para ver dados.</div>}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-full min-h-[400px]">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Detalhes por Disciplina</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold sticky top-0">
                                    <tr><th className="p-3">Disciplina</th><th className="p-3 text-center">Aulas</th><th className="p-3 text-right">Taxa</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {processedData.subjectStatsData.map((stat, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="p-3 font-medium text-slate-700">{stat.name}</td>
                                            <td className="p-3 text-center text-slate-500">{stat.total}</td>
                                            <td className="p-3 text-right font-bold"><span className={`${stat.percentage < 75 ? 'text-rose-600' : stat.percentage < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{stat.percentage.toFixed(0)}%</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[350px]">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><PieIcon size={18} className="text-indigo-500" /> Distribuição por Nível</h3>
                        <div className="w-full h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={processedData.distribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {processedData.distribution.map((entry, index) => <Cell key={`cell-${index}`} fill={LEVEL_COLORS[entry.key as keyof typeof LEVEL_COLORS]} />)}
                                    </Pie>
                                    <Tooltip /><Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[350px]">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Users size={18} className="text-indigo-500" /> Média por Turma</h3>
                        <div className="w-full h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={processedData.classAvgData} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                    <XAxis type="number" domain={[0, 100]} />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip formatter={(value: number) => [`${value}%`, 'Média']} />
                                    <Bar dataKey="avg" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                                        {processedData.classAvgData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.avg < 75 ? '#f43f5e' : '#6366f1'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {selectedBimester === 'ANNUAL' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[350px]">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><TrendingUp size={18} className="text-indigo-500" /> Evolução Bimestral</h3>
                        <div className="w-full h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={processedData.evolutionData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" /><YAxis domain={[0, 100]} />
                                    <Tooltip /><Line type="monotone" dataKey="avg" stroke="#10b981" strokeWidth={3} dot={{ r: 6 }} name="Média (%)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Award size={18} className="text-amber-500" /> Top 10 Protagonistas</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                                <tr><th className="p-3">#</th><th className="p-3">Nome</th><th className="p-3">Turma</th><th className="p-3 text-center">Presenças</th><th className="p-3 text-center">Faltas</th><th className="p-3 text-right">Frequência</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {processedData.topStudents.map((student, idx) => (
                                    <tr key={student.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                                        <td className="p-3 font-medium text-slate-700">{student.name}</td>
                                        <td className="p-3 text-slate-600 text-xs">{student.className}</td>
                                        <td className="p-3 text-center text-emerald-600">{student.stats.present}</td>
                                        <td className="p-3 text-center text-rose-600">{student.stats.absent}</td>
                                        <td className="p-3 text-right font-bold"><span className={`px-2 py-1 rounded ${student.stats.percentage >= 90 ? 'bg-emerald-100 text-emerald-700' : student.stats.percentage >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{student.stats.percentage.toFixed(1)}%</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><Table size={18} className="text-slate-500" /> Relatório Geral Anual</h3>
                    <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                        <table className="w-full text-sm text-left relative">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs sticky top-0 z-10 shadow-sm">
                                <tr><th className="p-3">Protagonista</th><th className="p-3">Turma</th><th className="p-3 text-center">Presenças</th><th className="p-3 text-center">Faltas</th><th className="p-3 text-center">Justif.</th><th className="p-3 text-center">Aulas</th><th className="p-3 text-right">Taxa (%)</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {processedData.studentStats.map((student) => (
                                    <tr key={student.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-medium text-slate-700">{student.name}</td>
                                        <td className="p-3 text-slate-600 text-xs">{student.className}</td>
                                        <td className="p-3 text-center text-emerald-600 font-medium">{student.stats.present}</td>
                                        <td className="p-3 text-center text-rose-600 font-medium">{student.stats.absent}</td>
                                        <td className="p-3 text-center text-amber-600">{student.stats.excused}</td>
                                        <td className="p-3 text-center text-slate-600">{student.stats.total}</td>
                                        <td className="p-3 text-right font-bold"><span className={`${student.stats.percentage < 75 ? 'text-rose-600' : student.stats.percentage < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{student.stats.percentage.toFixed(1)}%</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsDashboard;
