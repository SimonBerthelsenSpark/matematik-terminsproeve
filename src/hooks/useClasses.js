import { useState, useEffect } from 'react';
import {
  getAllClasses,
  createClass,
  updateClassName,
  deleteClass,
  addStudent,
  getStudents,
  updateStudent,
  deleteStudent
} from '../services/classService.js';

/**
 * Custom hook for managing classes and students
 */
export function useClasses() {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Load all classes
   */
  const loadClasses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllClasses();
      setClasses(data);
    } catch (err) {
      console.error('Error loading classes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create a new class
   */
  const handleCreateClass = async (className) => {
    try {
      const classId = await createClass({ className });
      await loadClasses(); // Reload classes
      return classId;
    } catch (err) {
      console.error('Error creating class:', err);
      throw err;
    }
  };

  /**
   * Update class name
   */
  const handleUpdateClassName = async (classId, className) => {
    try {
      await updateClassName(classId, className);
      await loadClasses(); // Reload classes
    } catch (err) {
      console.error('Error updating class name:', err);
      throw err;
    }
  };

  /**
   * Delete a class
   */
  const handleDeleteClass = async (classId) => {
    try {
      await deleteClass(classId);
      await loadClasses(); // Reload classes
    } catch (err) {
      console.error('Error deleting class:', err);
      throw err;
    }
  };

  /**
   * Add a student to a class
   */
  const handleAddStudent = async (classId, studentData) => {
    try {
      const studentId = await addStudent(classId, studentData);
      await loadClasses(); // Reload classes to update student count
      return studentId;
    } catch (err) {
      console.error('Error adding student:', err);
      throw err;
    }
  };

  /**
   * Update student information
   */
  const handleUpdateStudent = async (classId, studentId, studentData) => {
    try {
      await updateStudent(classId, studentId, studentData);
      // No need to reload classes, just students for that class
    } catch (err) {
      console.error('Error updating student:', err);
      throw err;
    }
  };

  /**
   * Delete a student
   */
  const handleDeleteStudent = async (classId, studentId) => {
    try {
      await deleteStudent(classId, studentId);
      await loadClasses(); // Reload classes to update student count
    } catch (err) {
      console.error('Error deleting student:', err);
      throw err;
    }
  };

  /**
   * Get students for a specific class
   */
  const handleGetStudents = async (classId) => {
    try {
      return await getStudents(classId);
    } catch (err) {
      console.error('Error getting students:', err);
      throw err;
    }
  };

  // Load classes on mount
  useEffect(() => {
    loadClasses();
  }, []);

  return {
    classes,
    loading,
    error,
    refreshClasses: loadClasses,
    createClass: handleCreateClass,
    updateClassName: handleUpdateClassName,
    deleteClass: handleDeleteClass,
    addStudent: handleAddStudent,
    updateStudent: handleUpdateStudent,
    deleteStudent: handleDeleteStudent,
    getStudents: handleGetStudents
  };
}
