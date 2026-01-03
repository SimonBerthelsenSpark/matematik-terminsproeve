/**
 * DanskStudentResult Component
 * 
 * Viser dansk bedømmelse med DYNAMISK rendering af alle dele og kriterier
 * INGEN hardcoded kategorier - tilpasser sig automatisk til bedømmelseskemaet
 */

import React, { useState, useEffect } from 'react';
import { getFileDownloadURL } from '../services/storageService.js';
import { getSubmissions } from '../services/firestoreService.js';
import { calculateLaererGrading } from '../hooks/useDanskGrading.js';
import { updateTeacherGrading, recalculateExamStats } from '../services/firestoreService.js';

export function DanskStudentResult({
  result,
  index,
  parsedBedoemmelse,
  examId,
  onSave
}) {
  const [submissionPath, setSubmissionPath] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [tempKarakterer, setTempKarakterer] = useState({});
  const [saving, setSaving] = useState(false);

  /**
   * Load submission metadata to get correct storage path
   */
  useEffect(() => {
    const loadSubmissionPath = async () => {
      if (!examId || !result.submissionId) return;
      
      try {
        const submissions = await getSubmissions(examId);
        const submission = submissions.find(sub => sub.id === result.submissionId);
        
        if (submission?.storagePath) {
          setSubmissionPath(submission.storagePath);
        }
      } catch (err) {
        console.debug('Error loading submission path:', err.message);
      }
    };
    
    loadSubmissionPath();
  }, [examId, result.submissionId]);

  /**
   * Open student submission in new tab
   */
  const handleOpenSubmission = async (e) => {
    e.preventDefault();
    try {
      if (!submissionPath) {
        throw new Error('Submission fil kunne ikke findes');
      }
      
      const url = await getFileDownloadURL(submissionPath);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error opening submission:', err);
      alert('Kunne ikke åbne opgaven: ' + err.message);
    }
  };

  /**
   * Handle error case
   */
  if (result.error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{result.elevNavn}</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Fejl: {result.error}</p>
        </div>
      </div>
    );
  }

  /**
   * Calculate current displayed grading (lærer if exists, otherwise AI)
   */
  const displayGrading = result.lærerGrading || {
    dele: result.dele,
    samletKarakter: result.samletKarakter,
    afrundetKarakter: result.afrundetKarakter
  };

  /**
   * Start editing mode
   */
  const handleStartEdit = () => {
    setEditMode(true);
    
    // Initialize temp karakterer med current values (lærer hvis findes, ellers AI)
    const initial = {};
    displayGrading.dele.forEach((del, delIdx) => {
      del.kriterier.forEach((krit, kritIdx) => {
        initial[`${delIdx}-${kritIdx}`] = krit.delKarakter;
      });
    });
    setTempKarakterer(initial);
  };

  /**
   * Update temp karakter for et kriterium
   */
  const handleKarakterChange = (delIdx, kritIdx, newKarakter) => {
    const key = `${delIdx}-${kritIdx}`; 
    setTempKarakterer(prev => ({
      ...prev,
      [key]: parseInt(newKarakter)
    }));
  };

  /**
   * Calculate live preview based on temp karakterer
   */
  const calculateLivePreview = () => {
    if (!editMode) return displayGrading;
    
    let samletKarakter = 0;
    
    const dele = parsedBedoemmelse.dele.map((del, delIdx) => {
      let delTotal = 0;
      
      const kriterier = del.kriterier.map((krit, kritIdx) => {
        const key = `${delIdx}-${kritIdx}`;
        const delKarakter = tempKarakterer[key] ?? displayGrading.dele[delIdx].kriterier[kritIdx].delKarakter;
        const vaegtetScore = (delKarakter * krit.vaegt) / 100;
        delTotal += vaegtetScore;
        
        return {
          navn: krit.navn,
          vaegt: krit.vaegt,
          delKarakter,
          vaegtetScore
        };
      });
      
      samletKarakter += delTotal;
      
      return {
        navn: del.navn,
        totalVaegt: del.totalVaegt,
        kriterier,
        delTotal
      };
    });
    
    // Afrund til 7-trins
    const trins = [-3, 0, 2, 4, 7, 10, 12];
    let nearest = trins[0];
    let minDiff = Math.abs(samletKarakter - nearest);
    for (const trin of trins) {
      const diff = Math.abs(samletKarakter - trin);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = trin;
      }
    }
    
    return {
      dele,
      samletKarakter,
      afrundetKarakter: nearest
    };
  };

  const livePreview = calculateLivePreview();

  /**
   * Save lærer grading
   */
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Build lærer grading from temp values
      const lærerGrading = {
        dele: livePreview.dele,
        samletKarakter: livePreview.samletKarakter,
        afrundetKarakter: livePreview.afrundetKarakter,
        timestamp: new Date()
      };
      
      // Save to database if examId and result.id available
      if (examId && result.id) {
        await updateTeacherGrading(examId, result.id, lærerGrading);
        await recalculateExamStats(examId);
      }
      
      // Update parent
      if (onSave) {
        onSave(index, lærerGrading);
      }
      
      setEditMode(false);
      console.log('✅ Lærer bedømmelse gemt');
    } catch (error) {
      console.error('Error saving lærer grading:', error);
      alert(`Fejl ved gemning: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Cancel editing
   */
  const handleCancel = () => {
    setEditMode(false);
    setTempKarakterer({});
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-lg font-bold text-gray-800">{result.elevNavn}</h3>
        {examId && submissionPath && (
          <a
            href="#"
            onClick={handleOpenSubmission}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
            title="Åbn opgave i ny fane"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>Se opgave</span>
          </a>
        )}
      </div>

      {/* Samlet oversigt */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {/* AI's Vurdering */}
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-300">
          <p className="text-xs text-gray-600 mb-2 font-semibold">🤖 AI's Vurdering</p>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-gray-500">Karakter</p>
              <p className="text-2xl font-bold text-blue-600">{result.afrundetKarakter}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Beregnet</p>
              <p className="text-lg font-semibold text-blue-600">{result.samletKarakter.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Lærerens Vurdering */}
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-400">
          <p className="text-xs text-gray-600 mb-2 font-semibold">👨‍🏫 Lærerens Vurdering</p>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-gray-500">Karakter</p>
              <p className="text-2xl font-bold text-amber-700">
                {livePreview.afrundetKarakter}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Beregnet</p>
              <p className="text-lg font-semibold text-amber-700">
                {livePreview.samletKarakter.toFixed(2)}
              </p>
            </div>
          </div>
          <p className="text-xs text-amber-800 mt-2">
            {result.lærerGrading ? (editMode ? 'Redigerer...' : 'Lærer har rettet') : 'Urettet - viser AI'}
          </p>
        </div>
      </div>

      {/* Karakterbegrundelse */}
      {result.karakterBegrundelse && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs font-semibold text-gray-700 mb-1">Samlet vurdering:</p>
          <p className="text-gray-600 text-sm">{result.karakterBegrundelse}</p>
        </div>
      )}

      {/* Edit controls */}
      {!editMode ? (
        <button
          onClick={handleStartEdit}
          className="mb-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          ✏️ Rediger lærer bedømmelse
        </button>
      ) : (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-400 rounded-lg">
          <p className="text-amber-900 font-semibold text-xs mb-2">
            ✏️ Ret karakterer nedenfor - ændringer opdateres live
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xs font-semibold rounded transition-colors"
            >
              {saving ? '💾 Gemmer...' : '✅ Gem og beregn karakter'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-3 py-1.5 bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 text-white text-xs font-semibold rounded transition-colors"
            >
              ❌ Annuller
            </button>
          </div>
        </div>
      )}

      {/* DYNAMISK rendering af ALLE dele */}
      <details open className="cursor-pointer">
        <summary className="font-semibold text-sm text-gray-700 hover:text-indigo-600 mb-3">
          📋 Detaljeret bedømmelse ({result.dele?.length || 0} dele)
        </summary>

        <div className="space-y-4 mt-2">
          {/* Render hver del DYNAMISK */}
          {result.dele?.map((aiDel, delIdx) => {
            const currentDel = livePreview.dele[delIdx];
            
            return (
              <div key={delIdx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                {/* Del header */}
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-800">{aiDel.navn}</h4>
                  <div className="text-sm">
                    <span className="text-gray-600">Vægt: </span>
                    <span className="font-semibold text-gray-800">{aiDel.totalVaegt}%</span>
                    <span className="text-gray-600 ml-3">Total: </span>
                    <span className="font-semibold text-indigo-600">{currentDel.delTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Render alle kriterier DYNAMISK */}
                <div className="space-y-2">
                  {aiDel.kriterier.map((aiKrit, kritIdx) => {
                    const currentKrit = currentDel.kriterier[kritIdx];
                    const key = `${delIdx}-${kritIdx}`;
                    
                    return (
                      <div key={kritIdx} className="bg-white p-3 rounded border border-gray-200">
                        {/* Kriterium header */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-800 text-sm">{aiKrit.navn}</p>
                            <p className="text-xs text-gray-600">Vægt: {aiKrit.vaegt}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-600">Vægtet score</p>
                            <p className="font-semibold text-indigo-600">{currentKrit.vaegtetScore.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Karakterer */}
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          {/* AI karakter */}
                          <div className="bg-blue-50 p-2 rounded">
                            <p className="text-xs text-gray-600 mb-1">🤖 AI karakter</p>
                            <p className="text-lg font-bold text-blue-600">{aiKrit.delKarakter}</p>
                          </div>

                          {/* Lærer karakter */}
                          <div className="bg-amber-50 p-2 rounded">
                            <p className="text-xs text-gray-600 mb-1">👨‍🏫 Lærer karakter</p>
                            {editMode ? (
                              <select
                                value={tempKarakterer[key] ?? currentKrit.delKarakter}
                                onChange={(e) => handleKarakterChange(delIdx, kritIdx, e.target.value)}
                                className="w-full px-2 py-1 border border-amber-300 rounded text-sm font-bold text-amber-700 bg-white"
                              >
                                <option value="-3">-3</option>
                                <option value="0">00</option>
                                <option value="2">02</option>
                                <option value="4">4</option>
                                <option value="7">7</option>
                                <option value="10">10</option>
                                <option value="12">12</option>
                              </select>
                            ) : (
                              <p className="text-lg font-bold text-amber-700">{currentKrit.delKarakter}</p>
                            )}
                          </div>
                        </div>

                        {/* Feedback */}
                        {aiKrit.feedback && (
                          <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                            <p className="text-xs font-semibold text-gray-700">Feedback:</p>
                            <p className="text-xs text-gray-600 mt-1">{aiKrit.feedback}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
