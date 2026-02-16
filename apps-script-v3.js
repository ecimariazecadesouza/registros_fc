/**
 * SISTEMA DE FREQUÊNCIA MZS - SCRIPT CENTRAL (V3.0)
 * ================================================
 * Suporte a: Lote, Configurações de Diário, Feriados e Disciplinas.
 */

// ==========================================
// CONFIGURAÇÃO DO BANCO DE DADOS (PLANILHAS)
// ==========================================

function getDb() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const getOrCreateSheet = (name) => {
        let sheet = ss.getSheetByName(name);
        if (!sheet) {
            sheet = ss.insertSheet(name);
            if (name === 'Frequencia') sheet.appendRow(['id', 'studentId', 'date', 'lessonIndex', 'status', 'subject', 'notes']);
            if (name === 'Protagonistas') sheet.appendRow(['id', 'name', 'registration', 'classId', 'situation', 'createdAt']);
            if (name === 'Turmas') sheet.appendRow(['id', 'name']);
            if (name === 'Configuracoes') sheet.appendRow(['key', 'value']);
        }
        return sheet;
    };

    return {
        students: getOrCreateSheet('Protagonistas'),
        classes: getOrCreateSheet('Turmas'),
        attendance: getOrCreateSheet('Frequencia'),
        config: getOrCreateSheet('Configuracoes')
    };
}

// ==========================================
// API - PONTO DE ENTRADA (DOPOST)
// ==========================================

function doPost(e) {
    const lock = LockService.getScriptLock();
    lock.tryLock(30000);

    try {
        const params = JSON.parse(e.postData.contents);
        const action = params.action;
        let result = {};

        switch (action) {
            case 'getData':
                result = getAllData();
                break;

            case 'saveStudent':
                result = saveStudent(params.student);
                break;
            case 'deleteStudent':
                result = deleteStudent(params.id, params.cascade);
                break;
            case 'saveClass':
                result = saveClass(params.classGroup);
                break;
            case 'deleteClass':
                result = deleteClass(params.id, params.cascade);
                break;

            case 'saveAttendance':
                result = saveAttendance(params.record);
                break;
            case 'saveAttendanceBatch':
                result = saveAttendanceBatch(params.records);
                break;

            case 'saveConfig':
                result = saveConfig(params.key, params.value);
                break;

            case 'saveDailyLessonConfig':
                result = updateNestedConfig('dailyLessonCounts', params.classId, params.date, params.activeIndices);
                break;

            case 'saveLessonContents':
                updateNestedConfig('lessonSubjects', params.classId, params.date, params.subjects);
                result = updateNestedConfig('lessonTopics', params.classId, params.date, params.topics);
                break;

            case 'saveAll':
                result = saveAll(params);
                break;

            default:
                result = { error: "Ação '" + action + "' não reconhecida pelo servidor." };
        }

        return ContentService.createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ error: err.toString(), stack: err.stack }))
            .setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

// ==========================================
// FUNÇÕES DE LEITURA (GET)
// ==========================================

function getAllData() {
    const db = getDb();
    const students = readSheetAsObjects(db.students, {
        id: 0, name: 1, registration: 2, classId: 3, situation: 4
    });
    const classes = readSheetAsObjects(db.classes, {
        id: 0, name: 1
    });

    const rawAttendance = db.attendance.getDataRange().getValues();
    const attendance = [];
    if (rawAttendance.length > 1) {
        for (let i = 1; i < rawAttendance.length; i++) {
            const studentId = String(rawAttendance[i][1]).trim();
            if (!studentId) continue;
            let d = rawAttendance[i][2];
            let dateISO = (d instanceof Date) ? d.toISOString().split('T')[0] : String(d).substring(0, 10);
            attendance.push({
                studentId: studentId,
                date: dateISO,
                lessonIndex: rawAttendance[i][3],
                status: rawAttendance[i][4],
                subject: rawAttendance[i][5] || '',
                notes: rawAttendance[i][6] || ''
            });
        }
    }

    const cfgData = db.config.getDataRange().getValues();
    const config = [];
    let bimesters = [];
    for (let i = 0; i < cfgData.length; i++) {
        const key = String(cfgData[i][0]);
        const val = String(cfgData[i][1]);
        if (!key || key === 'key') continue;
        if (key === 'bimesters') {
            try { bimesters = JSON.parse(val); } catch (e) { }
        } else {
            config.push({ key: key, value: val });
        }
    }

    return { students, classes, attendance, config, bimesters };
}

function updateNestedConfig(mainKey, classId, date, newData) {
    const db = getDb();
    const sheet = db.config;
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    let currentVal = {};
    for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]) === mainKey) {
            rowIndex = i + 1;
            try { currentVal = JSON.parse(data[i][1]); } catch (e) { currentVal = {}; }
            break;
        }
    }
    const subKey = classId + "_" + date;
    currentVal[subKey] = newData;
    const jsonString = JSON.stringify(currentVal);
    if (rowIndex > 0) sheet.getRange(rowIndex, 2).setValue(jsonString);
    else sheet.appendRow([mainKey, jsonString]);
    return { status: "success", key: mainKey };
}

function saveAttendance(record) {
    return saveAttendanceBatch([record]);
}

function saveAttendanceBatch(records) {
    const db = getDb();
    const sheet = db.attendance;
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    const idMap = new Map();
    for (let i = 0; i < data.length; i++) idMap.set(String(data[i][0]), i);

    const idsToDelete = new Set();
    const newRows = [];
    let hasUpdates = false;

    records.forEach(rec => {
        const uniqueId = rec.studentId + "_" + rec.date + "_" + rec.lessonIndex;

        if (rec.status === '-' || rec.status === 'UNDEFINED') {
            if (idMap.has(uniqueId)) idsToDelete.add(uniqueId);
            return;
        }

        const rowData = [uniqueId, rec.studentId, rec.date, rec.lessonIndex, rec.status, rec.subject || '', rec.notes || ''];
        if (idMap.has(uniqueId)) {
            data[idMap.get(uniqueId)] = rowData;
            hasUpdates = true;
        } else {
            newRows.push(rowData);
        }
    });

    if (hasUpdates) {
        sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }

    if (idsToDelete.size > 0) {
        const freshData = sheet.getDataRange().getValues();
        for (let i = freshData.length - 1; i >= 1; i--) {
            if (idsToDelete.has(String(freshData[i][0]))) {
                sheet.deleteRow(i + 1);
            }
        }
    }

    if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }

    return { status: "success", processed: records.length, deleted: idsToDelete.size };
}

function saveStudent(s) {
    const db = getDb();
    const data = db.students.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]) === String(s.id)) { rowIndex = i + 1; break; }
    }
    const rowData = [s.id, s.name, s.registration || '', s.classId || '', s.situation || 'Cursando', s.createdAt || new Date().toISOString()];
    if (rowIndex > 0) db.students.getRange(rowIndex, 1, 1, 6).setValues([rowData]);
    else db.students.appendRow(rowData);
    return { status: "success", id: s.id };
}

function saveConfig(key, value) {
    const db = getDb();
    const data = db.config.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]) === String(key)) { rowIndex = i + 1; break; }
    }
    if (rowIndex > 0) db.config.getRange(rowIndex, 2).setValue(String(value));
    else db.config.appendRow([key, String(value)]);
    return { status: "success" };
}

function saveClass(c) {
    const db = getDb();
    const data = db.classes.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]) === String(c.id)) { rowIndex = i + 1; break; }
    }
    if (rowIndex > 0) db.classes.getRange(rowIndex, 2).setValue(c.name);
    else db.classes.appendRow([c.id, c.name]);
    return { status: "success", id: c.id };
}

function readSheetAsObjects(sheet, map) {
    const data = sheet.getDataRange().getValues();
    const results = [];
    if (data.length <= 1) return [];
    for (let i = 1; i < data.length; i++) {
        const obj = {};
        for (const key in map) obj[key] = data[i][map[key]];
        if (obj.id) results.push(obj);
    }
    return results;
}

function deleteStudent(id, cascade) {
    const db = getDb();
    deleteRowById(db.students, id);
    if (cascade) {
        const att = db.attendance;
        const data = att.getDataRange().getValues();
        for (let i = data.length - 1; i >= 1; i--) {
            if (String(data[i][1]) === String(id)) att.deleteRow(i + 1);
        }
    }
    return { status: "success" };
}

function deleteClass(id, cascade) {
    const db = getDb();
    deleteRowById(db.classes, id);
    if (cascade) {
        const sData = db.students.getDataRange().getValues();
        for (let i = sData.length - 1; i >= 1; i--) {
            if (String(sData[i][3]) === String(id)) db.students.deleteRow(i + 1);
        }
    }
    return { status: "success" };
}

function deleteRowById(sheet, id) {
    const data = sheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]) === String(id)) { sheet.deleteRow(i + 1); return; }
    }
}

function saveAll(payload) {
    if (payload.bimesters) saveConfig('bimesters', JSON.stringify(payload.bimesters));
    if (payload.students) payload.students.forEach(s => saveStudent(s));
    return { status: "success" };
}
