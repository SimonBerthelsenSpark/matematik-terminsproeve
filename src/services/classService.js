import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase.js';

// ==================== CLASS OPERATIONS ====================

/**
 * Create a new class
 * @param {Object} classData - Class data (className)
 * @returns {Promise<string>} Created class ID
 */
export async function createClass(classData) {
  try {
    const docRef = await addDoc(collection(db, 'classes'), {
      className: classData.className || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      studentCount: 0
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating class:', error);
    throw new Error(`Failed to create class: ${error.message}`);
  }
}

/**
 * Get all classes
 * @returns {Promise<Array>} Array of class objects
 */
export async function getAllClasses() {
  try {
    const q = query(
      collection(db, 'classes'),
      orderBy('className', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const classes = [];
    
    querySnapshot.forEach((doc) => {
      classes.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return classes;
  } catch (error) {
    console.error('Error getting classes:', error);
    throw new Error(`Failed to get classes: ${error.message}`);
  }
}

/**
 * Get a single class by ID
 * @param {string} classId - Class document ID
 * @returns {Promise<Object|null>} Class data with id, or null if not found
 */
export async function getClass(classId) {
  try {
    const docRef = doc(db, 'classes', classId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting class:', error);
    throw new Error(`Failed to get class: ${error.message}`);
  }
}

/**
 * Update class name
 * @param {string} classId - Class document ID
 * @param {string} className - New class name
 * @returns {Promise<void>}
 */
export async function updateClassName(classId, className) {
  try {
    const docRef = doc(db, 'classes', classId);
    await updateDoc(docRef, {
      className,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating class name:', error);
    throw new Error(`Failed to update class name: ${error.message}`);
  }
}

/**
 * Delete a class and all its students
 * @param {string} classId - Class document ID
 * @returns {Promise<void>}
 */
export async function deleteClass(classId) {
  try {
    // Get all students first
    const students = await getStudents(classId);
    
    // Use batch to delete all students and the class
    const batch = writeBatch(db);
    
    // Delete all students
    students.forEach(student => {
      const studentRef = doc(db, 'classes', classId, 'students', student.id);
      batch.delete(studentRef);
    });
    
    // Delete the class
    const classRef = doc(db, 'classes', classId);
    batch.delete(classRef);
    
    await batch.commit();
  } catch (error) {
    console.error('Error deleting class:', error);
    throw new Error(`Failed to delete class: ${error.message}`);
  }
}

// ==================== STUDENT OPERATIONS ====================

/**
 * Add a student to a class
 * @param {string} classId - Class document ID
 * @param {Object} studentData - Student data (studentNumber, studentName)
 * @returns {Promise<string>} Created student ID
 */
export async function addStudent(classId, studentData) {
  try {
    const docRef = await addDoc(collection(db, 'classes', classId, 'students'), {
      studentNumber: studentData.studentNumber || '',
      studentName: studentData.studentName || '',
      createdAt: serverTimestamp()
    });
    
    // Update student count in class
    const classRef = doc(db, 'classes', classId);
    const classSnap = await getDoc(classRef);
    const currentCount = classSnap.data()?.studentCount || 0;
    
    await updateDoc(classRef, {
      studentCount: currentCount + 1,
      updatedAt: serverTimestamp()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding student:', error);
    throw new Error(`Failed to add student: ${error.message}`);
  }
}

/**
 * Get all students for a class
 * @param {string} classId - Class document ID
 * @returns {Promise<Array>} Array of student objects
 */
export async function getStudents(classId) {
  try {
    const q = query(
      collection(db, 'classes', classId, 'students'),
      orderBy('studentNumber', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const students = [];
    
    querySnapshot.forEach((doc) => {
      students.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return students;
  } catch (error) {
    console.error('Error getting students:', error);
    throw new Error(`Failed to get students: ${error.message}`);
  }
}

/**
 * Update student information
 * @param {string} classId - Class document ID
 * @param {string} studentId - Student document ID
 * @param {Object} studentData - Student data to update
 * @returns {Promise<void>}
 */
export async function updateStudent(classId, studentId, studentData) {
  try {
    const docRef = doc(db, 'classes', classId, 'students', studentId);
    await updateDoc(docRef, {
      ...studentData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating student:', error);
    throw new Error(`Failed to update student: ${error.message}`);
  }
}

/**
 * Delete a student from a class
 * @param {string} classId - Class document ID
 * @param {string} studentId - Student document ID
 * @returns {Promise<void>}
 */
export async function deleteStudent(classId, studentId) {
  try {
    const docRef = doc(db, 'classes', classId, 'students', studentId);
    await deleteDoc(docRef);
    
    // Update student count in class
    const classRef = doc(db, 'classes', classId);
    const classSnap = await getDoc(classRef);
    const currentCount = classSnap.data()?.studentCount || 0;
    
    await updateDoc(classRef, {
      studentCount: Math.max(0, currentCount - 1),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    throw new Error(`Failed to delete student: ${error.message}`);
  }
}
