import React, { useState, useEffect } from 'react';
import { useClasses } from '../hooks/useClasses.js';
import { Loader2, AlertCircle, Trash2, X, CheckCircle } from './Icons.jsx';

/**
 * ClassManagement - Component for managing classes and students
 */
export function ClassManagement() {
  const {
    classes,
    loading,
    error,
    createClass,
    deleteClass,
    addStudent,
    getStudents,
    deleteStudent
  } = useClasses();

  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedClass, setExpandedClass] = useState(null);
  const [classStudents, setClassStudents] = useState({});
  const [loadingStudents, setLoadingStudents] = useState({});

  /**
   * Handle class creation
   */
  const handleCreateClass = async (e) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    try {
      setCreating(true);
      await createClass(newClassName.trim());
      setNewClassName('');
      setShowCreateClass(false);
    } catch (err) {
      alert(`Fejl ved oprettelse af klasse: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  /**
   * Handle class deletion
   */
  const handleDeleteClass = async (classId, className) => {
    const confirmed = window.confirm(
      `Er du sikker på at du vil slette klassen "${className}"?\n\n` +
      `Dette vil også slette alle elever i klassen.\n\n` +
      `Denne handling kan ikke fortrydes!`
    );

    if (!confirmed) return;

    try {
      await deleteClass(classId);
      // Clear students from local state if the class was expanded
      if (classStudents[classId]) {
        const newStudents = { ...classStudents };
        delete newStudents[classId];
        setClassStudents(newStudents);
      }
      if (expandedClass === classId) {
        setExpandedClass(null);
      }
    } catch (err) {
      alert(`Fejl ved sletning af klasse: ${err.message}`);
    }
  };

  /**
   * Toggle class expansion and load students
   */
  const toggleClass = async (classId) => {
    if (expandedClass === classId) {
      setExpandedClass(null);
    } else {
      setExpandedClass(classId);
      // Load students if not already loaded
      if (!classStudents[classId]) {
        try {
          setLoadingStudents({ ...loadingStudents, [classId]: true });
          const students = await getStudents(classId);
          setClassStudents({ ...classStudents, [classId]: students });
        } catch (err) {
          alert(`Fejl ved indlæsning af elever: ${err.message}`);
        } finally {
          setLoadingStudents({ ...loadingStudents, [classId]: false });
        }
      }
    }
  };

  /**
   * Reload students for a class
   */
  const reloadStudents = async (classId) => {
    try {
      setLoadingStudents({ ...loadingStudents, [classId]: true });
      const students = await getStudents(classId);
      setClassStudents({ ...classStudents, [classId]: students });
    } catch (err) {
      alert(`Fejl ved genindlæsning af elever: ${err.message}`);
    } finally {
      setLoadingStudents({ ...loadingStudents, [classId]: false });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Klasser</h2>
          <p className="text-gray-600 mt-1">Administrer klasser og elever</p>
        </div>
        <button
          onClick={() => setShowCreateClass(!showCreateClass)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
        >
          {showCreateClass ? 'Annuller' : '+ Opret klasse'}
        </button>
      </div>

      {/* Create Class Form */}
      {showCreateClass && (
        <form onSubmit={handleCreateClass} className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex gap-3">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Klassenavn (f.eks. 9A)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoFocus
            />
            <button
              type="submit"
              disabled={creating || !newClassName.trim()}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              {creating ? <Loader2 /> : 'Opret'}
            </button>
          </div>
        </form>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 />
          <p className="text-gray-600 mt-4">Indlæser klasser...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle />
            <div>
              <p className="font-semibold text-red-800">Kunne ikke indlæse klasser</p>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && classes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Ingen klasser endnu
          </h3>
          <p className="text-gray-600">
            Opret din første klasse for at komme i gang
          </p>
        </div>
      )}

      {/* Classes List */}
      {!loading && !error && classes.length > 0 && (
        <div className="space-y-3">
          {classes.map((cls) => (
            <ClassCard
              key={cls.id}
              classData={cls}
              isExpanded={expandedClass === cls.id}
              students={classStudents[cls.id] || []}
              loadingStudents={loadingStudents[cls.id] || false}
              onToggle={() => toggleClass(cls.id)}
              onDelete={() => handleDeleteClass(cls.id, cls.className)}
              onStudentAdded={() => reloadStudents(cls.id)}
              onStudentDeleted={() => reloadStudents(cls.id)}
              addStudent={addStudent}
              deleteStudent={deleteStudent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ClassCard - Individual class card with student management
 */
function ClassCard({
  classData,
  isExpanded,
  students,
  loadingStudents,
  onToggle,
  onDelete,
  onStudentAdded,
  onStudentDeleted,
  addStudent,
  deleteStudent
}) {
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentNumber, setStudentNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [adding, setAdding] = useState(false);

  /**
   * Handle student addition
   */
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!studentNumber.trim() || !studentName.trim()) return;

    try {
      setAdding(true);
      await addStudent(classData.id, {
        studentNumber: studentNumber.trim(),
        studentName: studentName.trim()
      });
      setStudentNumber('');
      setStudentName('');
      setShowAddStudent(false);
      onStudentAdded();
    } catch (err) {
      alert(`Fejl ved tilføjelse af elev: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  /**
   * Handle student deletion
   */
  const handleDeleteStudent = async (studentId, studentName) => {
    const confirmed = window.confirm(
      `Er du sikker på at du vil slette eleven "${studentName}"?`
    );

    if (!confirmed) return;

    try {
      await deleteStudent(classData.id, studentId);
      onStudentDeleted();
    } catch (err) {
      alert(`Fejl ved sletning af elev: ${err.message}`);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Class Header */}
      <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer">
        <div className="flex items-center gap-4 flex-1" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            <h3 className="text-lg font-bold text-gray-800">
              {classData.className}
            </h3>
          </div>
          <span className="text-sm text-gray-600">
            {classData.studentCount || 0} elever
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
          title="Slet klasse"
        >
          <Trash2 />
        </button>
      </div>

      {/* Expanded Content - Students */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200">
          {/* Add Student Button */}
          <div className="mb-4">
            <button
              onClick={() => setShowAddStudent(!showAddStudent)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {showAddStudent ? 'Annuller' : '+ Tilføj elev'}
            </button>
          </div>

          {/* Add Student Form */}
          {showAddStudent && (
            <form onSubmit={handleAddStudent} className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  placeholder="Elevnummer"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  autoFocus
                />
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Elevnavn"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={adding || !studentNumber.trim() || !studentName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                {adding ? <Loader2 /> : 'Tilføj elev'}
              </button>
            </form>
          )}

          {/* Loading Students */}
          {loadingStudents && (
            <div className="text-center py-8">
              <Loader2 />
              <p className="text-gray-600 text-sm mt-2">Indlæser elever...</p>
            </div>
          )}

          {/* Students List */}
          {!loadingStudents && students.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">Ingen elever i denne klasse endnu</p>
            </div>
          )}

          {!loadingStudents && students.length > 0 && (
            <div className="space-y-2">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                      {student.studentNumber}
                    </span>
                    <span className="text-sm text-gray-800">{student.studentName}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteStudent(student.id, student.studentName)}
                    className="p-1.5 hover:bg-red-50 text-red-600 rounded transition-colors"
                    title="Slet elev"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
