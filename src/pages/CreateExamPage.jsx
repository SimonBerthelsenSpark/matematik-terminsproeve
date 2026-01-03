import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExams } from '../hooks/useExams.js';
import { useClasses } from '../hooks/useClasses.js';
import { Layout } from '../components/Layout.jsx';
import { Loader2, AlertCircle, CheckCircle } from '../components/Icons.jsx';
import { uploadExamFile } from '../services/storageService.js';
import { updateExamFileRef } from '../services/firestoreService.js';

/**
 * CreateExamPage - Form for creating a new exam
 */
export function CreateExamPage() {
  const navigate = useNavigate();
  const { createExam } = useExams();
  const { classes, loading: loadingClasses } = useClasses();

  const [formData, setFormData] = useState({
    beskrivelse: '',
    dato: '',
    klasse: '',
    type: 'Matematik'
  });
  
  const [useCustomClass, setUseCustomClass] = useState(false);
  const [customClassName, setCustomClassName] = useState('');

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // File upload states
  const [rettevejledningFile, setRettevejledningFile] = useState(null);
  const [omsætningstabelFile, setOmsætningstabelFile] = useState(null);
  const [bedoemmelseskemaFile, setBedoemmelseskemaFile] = useState(null);
  const [uploadingRettevejledning, setUploadingRettevejledning] = useState(false);
  const [uploadingOmsætningstabel, setUploadingOmsætningstabel] = useState(false);
  const [uploadingBedoemmelseskema, setUploadingBedoemmelseskema] = useState(false);
  const [uploadedRettevejledning, setUploadedRettevejledning] = useState(null);
  const [uploadedOmsætningstabel, setUploadedOmsætningstabel] = useState(null);
  const [uploadedBedoemmelseskema, setUploadedBedoemmelseskema] = useState(null);

  /**
   * Handle input change
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null
      }));
    }
  };

  /**
   * Handle file selection
   */
  const handleFileChange = (e, fileType) => {
    const file = e.target.files[0];
    if (file) {
      if (fileType === 'rettevejledning') {
        setRettevejledningFile(file);
      } else if (fileType === 'omsætningstabel') {
        setOmsætningstabelFile(file);
      } else if (fileType === 'bedoemmelseskema') {
        setBedoemmelseskemaFile(file);
      }
    }
  };

  /**
   * Upload a file for newly created exam
   */
  const handleFileUpload = async (examId, fileType) => {
    let file, setUploading, setUploaded, fileRefField;
    
    if (fileType === 'rettevejledning') {
      file = rettevejledningFile;
      setUploading = setUploadingRettevejledning;
      setUploaded = setUploadedRettevejledning;
      fileRefField = 'rettevejledningRef';
    } else if (fileType === 'omsætningstabel') {
      file = omsætningstabelFile;
      setUploading = setUploadingOmsætningstabel;
      setUploaded = setUploadedOmsætningstabel;
      fileRefField = 'omsætningstabelRef';
    } else if (fileType === 'bedoemmelseskema') {
      file = bedoemmelseskemaFile;
      setUploading = setUploadingBedoemmelseskema;
      setUploaded = setUploadedBedoemmelseskema;
      fileRefField = 'bedoemmelseskemaRef';
    }
    
    if (!file || !examId) return;
    
    try {
      setUploading(true);
      
      console.log(`📤 Uploading ${fileType} for new exam ${examId}`);
      
      // Upload file to storage
      const uploadResult = await uploadExamFile(examId, file, fileType);
      console.log('✅ Upload result:', uploadResult);
      
      // Update Firestore with file reference
      await updateExamFileRef(examId, fileRefField, uploadResult);
      console.log(`✅ Firestore updated with ${fileRefField}`);
      
      setUploaded(uploadResult);
      
      console.log(`🎉 ${fileType} uploaded successfully!`);
    } catch (err) {
      console.error(`❌ Error uploading ${fileType}:`, err);
      alert(`Fejl ved upload af ${fileType}: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Validate form
   */
  const validate = () => {
    const newErrors = {};

    if (!formData.beskrivelse.trim()) {
      newErrors.beskrivelse = 'Beskrivelse er påkrævet';
    }

    if (!formData.dato) {
      newErrors.dato = 'Dato er påkrævet';
    }

    // Check if using custom class or selected class
    const selectedClass = useCustomClass ? customClassName : formData.klasse;
    if (!selectedClass || !selectedClass.trim()) {
      newErrors.klasse = 'Klasse er påkrævet';
    }

    if (!formData.type) {
      newErrors.type = 'Type er påkrævet';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    try {
      setSubmitting(true);

      // Use custom class name if selected, otherwise use selected class
      const className = useCustomClass ? customClassName.trim() : formData.klasse;

      // Convert date string to Date object
      const examData = {
        ...formData,
        klasse: className,
        dato: new Date(formData.dato)
      };

      const examId = await createExam(examData);
      console.log('✅ Exam created with ID:', examId);
      
      // Upload files based on exam type
      if (formData.type === 'Matematik') {
        // Matematik: Upload rettevejledning + omsætningstabel
        if (rettevejledningFile) {
          console.log('📤 Uploading rettevejledning...');
          await handleFileUpload(examId, 'rettevejledning');
        }
        
        if (omsætningstabelFile) {
          console.log('📤 Uploading omsætningstabel...');
          await handleFileUpload(examId, 'omsætningstabel');
        }
      } else if (formData.type === 'Dansk') {
        // Dansk: Upload KUN bedømmelseskema
        if (bedoemmelseskemaFile) {
          console.log('📤 Uploading bedømmelseskema...');
          await handleFileUpload(examId, 'bedoemmelseskema');
        }
      }
      
      // Navigate to the new exam's detail page
      navigate(`/exams/${examId}`);
    } catch (err) {
      console.error('Error creating exam:', err);
      setSubmitError(err.message || 'Kunne ikke oprette prøve');
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Opret ny prøve
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Beskrivelse */}
            <div>
              <label
                htmlFor="beskrivelse"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Beskrivelse <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="beskrivelse"
                name="beskrivelse"
                value={formData.beskrivelse}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  errors.beskrivelse
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
                placeholder="f.eks. FP10 Matematik Efterår 2024"
              />
              {errors.beskrivelse && (
                <p className="mt-1 text-sm text-red-600">{errors.beskrivelse}</p>
              )}
            </div>

            {/* Dato */}
            <div>
              <label
                htmlFor="dato"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Dato <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="dato"
                name="dato"
                value={formData.dato}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  errors.dato
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
              />
              {errors.dato && (
                <p className="mt-1 text-sm text-red-600">{errors.dato}</p>
              )}
            </div>

            {/* Klasse */}
            <div>
              <label
                htmlFor="klasse"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Klasse <span className="text-red-500">*</span>
              </label>
              
              {loadingClasses ? (
                <div className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                  <Loader2 />
                  <span className="text-gray-600 text-sm">Indlæser klasser...</span>
                </div>
              ) : (
                <>
                  {!useCustomClass && classes.length > 0 ? (
                    <div className="space-y-2">
                      <select
                        id="klasse"
                        name="klasse"
                        value={formData.klasse}
                        onChange={handleChange}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                          errors.klasse
                            ? 'border-red-300 bg-red-50'
                            : 'border-gray-300'
                        }`}
                      >
                        <option value="">Vælg en klasse...</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.className}>
                            {cls.className}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setUseCustomClass(true)}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        Eller indtast et andet klassenavn
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        id="customKlasse"
                        value={customClassName}
                        onChange={(e) => {
                          setCustomClassName(e.target.value);
                          // Clear error when typing
                          if (errors.klasse) {
                            setErrors((prev) => ({ ...prev, klasse: null }));
                          }
                        }}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                          errors.klasse
                            ? 'border-red-300 bg-red-50'
                            : 'border-gray-300'
                        }`}
                        placeholder="f.eks. 9A"
                      />
                      {classes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setUseCustomClass(false);
                            setCustomClassName('');
                          }}
                          className="text-sm text-indigo-600 hover:text-indigo-700"
                        >
                          Eller vælg fra eksisterende klasser
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
              
              {errors.klasse && (
                <p className="mt-1 text-sm text-red-600">{errors.klasse}</p>
              )}
            </div>

            {/* Type */}
            <div>
              <label
                htmlFor="type"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Type <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  errors.type
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
              >
                <option value="Matematik">Matematik</option>
                <option value="Dansk">Dansk</option>
              </select>
              {errors.type && (
                <p className="mt-1 text-sm text-red-600">{errors.type}</p>
              )}
              {formData.type === 'Dansk' && (
                <p className="mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
                  ℹ️ Dansk prøver bruger bedømmelseskema i stedet for rettevejledning
                </p>
              )}
            </div>

            {/* File Uploads Section - Conditional based on exam type */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload filer (valgfrit)</h3>
              
              {formData.type === 'Matematik' ? (
                <>
                  {/* MATEMATIK: Rettevejledning Upload */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Rettevejledning
                      </label>
                      {rettevejledningFile && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-xs font-medium">Valgt</span>
                        </div>
                      )}
                    </div>
                    {rettevejledningFile && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-800 font-medium">
                              {rettevejledningFile.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setRettevejledningFile(null)}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Fjern
                          </button>
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileChange(e, 'rettevejledning')}
                      className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Accepterer PDF, Word dokumenter (.doc, .docx)
                    </p>
                  </div>

                  {/* MATEMATIK: Omsætningstabel Upload */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Omsætningstabel
                      </label>
                      {omsætningstabelFile && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-xs font-medium">Valgt</span>
                        </div>
                      )}
                    </div>
                    {omsætningstabelFile && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-800 font-medium">
                              {omsætningstabelFile.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setOmsætningstabelFile(null)}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Fjern
                          </button>
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xlsx,.xls"
                      onChange={(e) => handleFileChange(e, 'omsætningstabel')}
                      className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Accepterer PDF, Word dokumenter (.doc, .docx), Excel filer (.xlsx, .xls)
                    </p>
                  </div>
                </>
              ) : formData.type === 'Dansk' ? (
                <>
                  {/* DANSK: Bedømmelseskema Upload */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Bedømmelseskema
                      </label>
                      {bedoemmelseskemaFile && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-xs font-medium">Valgt</span>
                        </div>
                      )}
                    </div>
                    {bedoemmelseskemaFile && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-800 font-medium">
                              {bedoemmelseskemaFile.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBedoemmelseskemaFile(null)}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Fjern
                          </button>
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileChange(e, 'bedoemmelseskema')}
                      className="w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Accepterer PDF, Word dokumenter (.doc, .docx)
                    </p>
                    <p className="mt-2 text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
                      ℹ️ Bedømmelseskemaet skal indeholde alle kriterier med vægte og beskrivelser
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle />
                  <div>
                    <p className="font-semibold text-red-800">Fejl</p>
                    <p className="text-red-700 text-sm">{submitError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 />
                    Opretter...
                  </>
                ) : (
                  'Opret prøve'
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                disabled={submitting}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Annuller
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
