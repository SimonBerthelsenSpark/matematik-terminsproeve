import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useExams } from '../hooks/useExams.js';
import { useClasses } from '../hooks/useClasses.js';
import { Layout } from '../components/Layout.jsx';
import { Loader2, AlertCircle, CheckCircle } from '../components/Icons.jsx';
import { uploadExamFile } from '../services/storageService.js';
import { updateExam, updateExamFileRef } from '../services/firestoreService.js';

/**
 * EditExamPage - Form for editing an existing exam and uploading files
 */
export function EditExamPage() {
  const navigate = useNavigate();
  const { examId } = useParams();
  const { exams, refreshExams } = useExams();
  const { classes, loading: loadingClasses } = useClasses();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
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

  /**
   * Load exam data
   */
  useEffect(() => {
    const currentExam = exams.find(e => e.id === examId);
    if (currentExam) {
      console.log('📋 Loading exam data:', currentExam.id);
      console.log('🗂️ Rettevejledning:', currentExam.rettevejledningRef?.fileName || 'Ingen');
      console.log('🗂️ Omsætningstabel:', currentExam.omsætningstabelRef?.fileName || 'Ingen');
      
      setExam(currentExam);
      
      // Format date for input field (only if not already set)
      let dateString = '';
      if (currentExam.dato) {
        const dateObj = currentExam.dato.toDate ? currentExam.dato.toDate() : new Date(currentExam.dato);
        dateString = dateObj.toISOString().split('T')[0];
      }
      
      // Only update formData if it's the initial load
      if (loading || !formData.beskrivelse) {
        setFormData({
          beskrivelse: currentExam.beskrivelse || '',
          dato: dateString,
          klasse: currentExam.klasse || '',
          type: currentExam.type || 'Matematik'
        });
      }
      
      setLoading(false);
    } else if (exams.length > 0) {
      // Exam not found
      console.error('❌ Exam not found:', examId);
      setSubmitError('Prøve ikke fundet');
      setLoading(false);
    }
  }, [examId, exams]);

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
   * Upload a file
   */
  const handleFileUpload = async (fileType) => {
    let file, setUploading;
    
    if (fileType === 'rettevejledning') {
      file = rettevejledningFile;
      setUploading = setUploadingRettevejledning;
    } else if (fileType === 'omsætningstabel') {
      file = omsætningstabelFile;
      setUploading = setUploadingOmsætningstabel;
    } else if (fileType === 'bedoemmelseskema') {
      file = bedoemmelseskemaFile;
      setUploading = setUploadingBedoemmelseskema;
    }
    
    if (!file) {
      console.warn('⚠️ No file selected');
      alert('Vælg venligst en fil først');
      return;
    }
    
    try {
      setUploading(true);
      
      console.log('='.repeat(60));
      console.log(`📤 Starting upload for ${fileType}`);
      console.log(`📁 File name: ${file.name}`);
      console.log(`📊 File size: ${file.size} bytes`);
      console.log(`📋 File type: ${file.type}`);
      console.log(`🔑 Exam ID: ${examId}`);
      console.log('='.repeat(60));
      
      // Upload file to storage
      console.log('Step 1: Uploading to Firebase Storage...');
      const uploadResult = await uploadExamFile(examId, file, fileType);
      console.log('✅ Step 1 Complete - Upload result:', JSON.stringify(uploadResult, null, 2));
      
      // Update Firestore with file reference
      let fileRefField;
      if (fileType === 'rettevejledning') {
        fileRefField = 'rettevejledningRef';
      } else if (fileType === 'omsætningstabel') {
        fileRefField = 'omsætningstabelRef';
      } else if (fileType === 'bedoemmelseskema') {
        fileRefField = 'bedoemmelseskemaRef';
      }
      
      console.log(`Step 2: Updating Firestore field "${fileRefField}"...`);
      await updateExamFileRef(examId, fileRefField, uploadResult);
      console.log(`✅ Step 2 Complete - Firestore updated`);
      
      // Refresh exam data
      console.log('Step 3: Refreshing exam list...');
      await refreshExams();
      console.log(`✅ Step 3 Complete - Exams refreshed`);
      
      // Update local exam state with the new file reference
      console.log('Step 4: Updating local state...');
      setExam(prevExam => ({
        ...prevExam,
        [fileRefField]: {
          fileName: uploadResult.metadata.fileName,
          storagePath: uploadResult.storagePath,
          uploadedAt: new Date(),
          fileSize: uploadResult.metadata.fileSize,
          contentType: uploadResult.metadata.contentType
        }
      }));
      console.log(`✅ Step 4 Complete - Local state updated`);
      
      // Clear file input
      if (fileType === 'rettevejledning') {
        setRettevejledningFile(null);
      } else if (fileType === 'omsætningstabel') {
        setOmsætningstabelFile(null);
      } else if (fileType === 'bedoemmelseskema') {
        setBedoemmelseskemaFile(null);
      }
      
      console.log('='.repeat(60));
      console.log(`🎉 SUCCESS: ${fileType} uploaded successfully!`);
      console.log('='.repeat(60));
      
      const fileNames = {
        'rettevejledning': 'Rettevejledning',
        'omsætningstabel': 'Omsætningstabel',
        'bedoemmelseskema': 'Bedømmelseskema'
      };
      alert(`${fileNames[fileType]} uploadet succesfuldt!`);
    } catch (err) {
      console.error('='.repeat(60));
      console.error(`❌ ERROR uploading ${fileType}`);
      console.error('Error object:', err);
      console.error('Error message:', err.message);
      console.error('Error code:', err.code);
      console.error('Error stack:', err.stack);
      console.error('='.repeat(60));
      
      let errorMessage = 'Ukendt fejl';
      
      if (err.code === 'storage/unauthorized') {
        errorMessage = 'Du har ikke tilladelse til at uploade filer. Tjek Firebase Storage regler.';
      } else if (err.code === 'storage/canceled') {
        errorMessage = 'Upload blev annulleret.';
      } else if (err.code === 'storage/unknown') {
        errorMessage = 'Der opstod en ukendt fejl. Tjek din internetforbindelse.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      alert(`Fejl ved upload af ${fileType}:\n\n${errorMessage}\n\nSe browserkonsollen for detaljer.`);
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

      const className = useCustomClass ? customClassName.trim() : formData.klasse;

      // Update exam metadata
      const updates = {
        beskrivelse: formData.beskrivelse,
        klasse: className,
        type: formData.type,
        dato: new Date(formData.dato)
      };

      await updateExam(examId, updates);
      
      // Navigate back to home
      navigate('/');
    } catch (err) {
      console.error('Error updating exam:', err);
      setSubmitError(err.message || 'Kunne ikke opdatere prøve');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <Loader2 />
          <p className="text-gray-600 mt-4">Indlæser prøve...</p>
        </div>
      </Layout>
    );
  }

  if (!exam) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle />
            <div>
              <p className="font-semibold text-red-800">Prøve ikke fundet</p>
              <p className="text-red-700 text-sm mt-1">{submitError || 'Denne prøve eksisterer ikke.'}</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            Rediger prøve
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
                        value={customClassName || formData.klasse}
                        onChange={(e) => {
                          setCustomClassName(e.target.value);
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
            </div>

            {/* File Uploads Section - Conditional based on exam type */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload filer</h3>
              
              {formData.type === 'Matematik' ? (
                <>
                  {/* MATEMATIK: Rettevejledning Upload */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Rettevejledning
                      </label>
                      {exam.rettevejledningRef && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-xs font-medium">Uploadet</span>
                        </div>
                      )}
                    </div>
                    {exam.rettevejledningRef ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-800 font-medium">
                              {exam.rettevejledningRef.fileName}
                            </span>
                          </div>
                          <span className="text-xs text-green-600">
                            Gemt i systemet
                          </span>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleFileChange(e, 'rettevejledning')}
                        className="flex-1 text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        key={exam.rettevejledningRef?.uploadedAt || 'rettevejledning'}
                      />
                      <button
                        type="button"
                        onClick={() => handleFileUpload('rettevejledning')}
                        disabled={!rettevejledningFile || uploadingRettevejledning}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        {uploadingRettevejledning ? (
                          <>
                            <Loader2 />
                            Uploader...
                          </>
                        ) : (
                          exam.rettevejledningRef ? 'Erstat fil' : 'Upload'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* MATEMATIK: Omsætningstabel Upload */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Omsætningstabel
                      </label>
                      {exam.omsætningstabelRef && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-xs font-medium">Uploadet</span>
                        </div>
                      )}
                    </div>
                    {exam.omsætningstabelRef ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-800 font-medium">
                              {exam.omsætningstabelRef.fileName}
                            </span>
                          </div>
                          <span className="text-xs text-green-600">
                            Gemt i systemet
                          </span>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xlsx,.xls"
                        onChange={(e) => handleFileChange(e, 'omsætningstabel')}
                        className="flex-1 text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        key={exam.omsætningstabelRef?.uploadedAt || 'omsaetningstabel'}
                      />
                      <button
                        type="button"
                        onClick={() => handleFileUpload('omsætningstabel')}
                        disabled={!omsætningstabelFile || uploadingOmsætningstabel}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        {uploadingOmsætningstabel ? (
                          <>
                            <Loader2 />
                            Uploader...
                          </>
                        ) : (
                          exam.omsætningstabelRef ? 'Erstat fil' : 'Upload'
                        )}
                      </button>
                    </div>
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
                      {exam.bedoemmelseskemaRef && (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-xs font-medium">Uploadet</span>
                        </div>
                      )}
                    </div>
                    {exam.bedoemmelseskemaRef ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm text-green-800 font-medium">
                              {exam.bedoemmelseskemaRef.fileName}
                            </span>
                          </div>
                          <span className="text-xs text-green-600">
                            Gemt i systemet
                          </span>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleFileChange(e, 'bedoemmelseskema')}
                        className="flex-1 text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        key={exam.bedoemmelseskemaRef?.uploadedAt || 'bedoemmelseskema'}
                      />
                      <button
                        type="button"
                        onClick={() => handleFileUpload('bedoemmelseskema')}
                        disabled={!bedoemmelseskemaFile || uploadingBedoemmelseskema}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        {uploadingBedoemmelseskema ? (
                          <>
                            <Loader2 />
                            Uploader...
                          </>
                        ) : (
                          exam.bedoemmelseskemaRef ? 'Erstat fil' : 'Upload'
                        )}
                      </button>
                    </div>
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
                    Gemmer...
                  </>
                ) : (
                  'Gem ændringer'
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
