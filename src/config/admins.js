/**
 * Administratorer, der altid er godkendt. Skal svare til listen i firestore.rules og storage.rules.
 * Administratorer kan godkende andre lærere under Indstillinger.
 */
export const ADMIN_EMAILS = ['s.berhelsen@gmail.com', 'simonberthelsen@hotmail.com'];

export const erAdminEmail = (email) => ADMIN_EMAILS.includes(String(email || '').toLowerCase());
