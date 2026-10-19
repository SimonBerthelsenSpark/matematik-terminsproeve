/**
 * Udled hvor langt en prøve er nået, og hvad næste skridt er.
 * Bruges af forsiden og af prøvens trin-navigation.
 */
export function harMateriale(exam) {
  if (!exam) return false;
  if (exam.type === 'Dansk') return Boolean(exam.bedoemmelseskemaRef);
  return Boolean(exam.rettevejledningRef && (exam.omsætningstabelRef || exam.omsaetningstabelData?.length));
}

export function examStatus(exam) {
  const stats = exam?.stats || {};
  const uploaded = stats.totalSubmissions || 0;
  const graded = stats.gradedCount || 0;
  const reviewed = stats.reviewedCount || 0;
  const materialeOk = harMateriale(exam);
  const base = `/exams/${exam?.id}`;

  let next;
  if (!materialeOk) {
    next = { label: 'Tilføj materiale', to: `${base}/edit`, tone: 'attention' };
  } else if (uploaded === 0) {
    next = { label: 'Upload besvarelser', to: `${base}/matrix`, tone: 'attention' };
  } else if (graded < uploaded) {
    next = { label: `Ret ${uploaded - graded} ${uploaded - graded === 1 ? 'besvarelse' : 'besvarelser'}`, to: base, tone: 'attention' };
  } else if (reviewed < graded) {
    next = { label: `Gennemse ${graded - reviewed} ${graded - reviewed === 1 ? 'karakter' : 'karakterer'}`, to: base, tone: 'attention' };
  } else {
    next = { label: 'Færdig', to: base, tone: 'ok' };
  }

  return { materialeOk, uploaded, graded, reviewed, averageGrade: stats.averageGrade || null, next };
}
