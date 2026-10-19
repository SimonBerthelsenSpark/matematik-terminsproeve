import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useExamContext } from '../hooks/useExamContext.jsx';
import { Layout } from '../components/Layout.jsx';
import { MathExamGrader } from '../components/MathExamGrader.jsx';
import { Spinner, Notice } from '../components/ui.jsx';

/**
 * Trin 3: Retning. Håndterer både Matematik og Dansk.
 */
export function ExamDetailPage() {
  const { examId } = useParams();
  const { exam, loading, error, setCurrentExamId } = useExamContext();

  useEffect(() => {
    if (examId) setCurrentExamId(examId);
  }, [examId, setCurrentExamId]);

  if (error && !exam) {
    return (
      <Layout>
        <Notice title="Prøven kunne ikke indlæses">
          {error}. <Link to="/" className="underline">Gå til alle prøver</Link>.
        </Notice>
      </Layout>
    );
  }

  // Vis spinner kun ved første indlæsning – ikke når prøven opdateres i baggrunden
  if (!exam || exam.id !== examId) {
    return <Layout><Spinner label="Indlæser prøve…" /></Layout>;
  }

  return <MathExamGrader />;
}
