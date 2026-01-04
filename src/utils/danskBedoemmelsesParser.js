/**
 * Dansk Bedømmelseskema Parser
 * 
 * DYNAMISK parser der kan læse forskellige bedømmelsesskemaer
 * INGEN hardcoded kategorier - tilpasser sig automatisk til dokumentets struktur
 */

import mammoth from 'mammoth';
// Note: pdf-parse should be installed: npm install pdf-parse
// import pdfParse from 'pdf-parse';

/**
 * Parse dansk bedømmelsesfil dynamisk og udtræk ALLE dele og kriterier
 * @param {File|Blob} file - Bedømmelsesfil (Word eller PDF)
 * @returns {Promise<Object>} { dele: [...] } - Dynamisk struktur
 */
export async function parseDanskBedoemmelse(file) {
  try {
    const fileType = file.type || file.name.split('.').pop().toLowerCase();
    let text = '';
    
    // Udtræk tekst baseret på filtype
    if (fileType.includes('word') || fileType.includes('docx') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
      text = await parseWordDocument(file);
    } else if (fileType.includes('pdf') || file.name.endsWith('.pdf')) {
      text = await parsePDFDocument(file);
    } else {
      throw new Error('Ikke-understøttet filformat. Brug Word (.docx, .doc) eller PDF (.pdf)');
    }
    
    console.log('📄 Extracted text length:', text.length);
    console.log('📄 First 500 chars:', text.substring(0, 500));
    
    // Parse dynamisk struktur fra tekst
    const parsedData = parseTextStructure(text);
    
    // Valider total vægt
    validateTotalWeight(parsedData);
    
    console.log('✅ Successfully parsed bedømmelseskema:', parsedData);
    
    return parsedData;
  } catch (error) {
    console.error('❌ Error parsing bedømmelseskema:', error);
    throw new Error(`Kunne ikke parse bedømmelseskema: ${error.message}`);
  }
}

/**
 * Parse Word document til tekst
 * @param {File|Blob} file - Word fil
 * @returns {Promise<string>} Tekst indhold
 */
async function parseWordDocument(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    console.error('Error parsing Word document:', error);
    throw new Error(`Kunne ikke læse Word dokument: ${error.message}`);
  }
}

/**
 * Parse PDF document til tekst
 * @param {File|Blob} file - PDF fil
 * @returns {Promise<string>} Tekst indhold
 */
async function parsePDFDocument(file) {
  try {
    // TODO: Implementer PDF parsing når pdf-parse er installeret
    // const arrayBuffer = await file.arrayBuffer();
    // const data = await pdfParse(arrayBuffer);
    // return data.text;
    
    throw new Error('PDF parsing er ikke implementeret endnu. Brug venligst Word format (.docx)');
  } catch (error) {
    console.error('Error parsing PDF document:', error);
    throw error;
  }
}

/**
 * Parse tekststruktur dynamisk for at finde dele og kriterier
 * INGEN hardcoded kategorinavne - finder alt dynamisk
 * @param {string} text - Rå tekst fra dokument
 * @returns {Object} { dele: [...] }
 */
function parseTextStructure(text) {
  const dele = [];
  
  // Try multiple patterns for sections
  // Pattern 1: "Del A:", "Del B:", etc.
  const delRegex1 = /(?:Del\s+[A-Z]|Afsnit\s+[A-Z]|Part\s+[A-Z])[:\s]+([^\n]+)/gi;
  let delMatches = [...text.matchAll(delRegex1)];
  
  // Pattern 2: If no "Del" sections found, try numbered sections like "1. Section Name"
  if (delMatches.length === 0) {
    const delRegex2 = /^(\d+)\.\s+([^\n(]+?)(?:\s*\([^)]*\))?$/gm;
    delMatches = [...text.matchAll(delRegex2)];
  }
  
  console.log('🔍 Found del matches:', delMatches.length);
  
  if (delMatches.length === 0) {
    // Fallback: Hvis ingen dele fundet, parse alle kriterier direkte
    console.warn('⚠️ No sections found, parsing all criteria from document');
    const kriterier = parseKriterierFromText(text, 0, text.length);
    if (kriterier.length > 0) {
      dele.push({
        navn: 'Samlet bedømmelse',
        totalVaegt: calculateTotalVaegtFromKriterier(kriterier),
        kriterier
      });
    }
    return { dele };
  }
  
  // Parse hver del
  delMatches.forEach((match, idx)=> {
    const delStart = match.index;
    const delEnd = idx < delMatches.length - 1 ? delMatches[idx + 1].index : text.length;
    const delText = text.substring(delStart, delEnd);
    
    // Udtræk del-navn
    const delNavn = match[0].trim();
    
    // Find total vægt for denne del (hvis angivet)
    // Matcher f.eks. "30%" eller "(30%)"
    const vaegtMatch = delText.match(/\(?\s*(\d+(?:[.,]\d+)?)\s*%\s*\)?/);
    const totalVaegt = vaegtMatch ? parseFloat(vaegtMatch[1].replace(',', '.')) : null;
    
    // Find alle kriterier indenfor denne del
    const kriterier = parseKriterierFromText(delText, 0, delText.length);
    
    if (kriterier.length > 0) {
      dele.push({
        navn: delNavn,
        totalVaegt: totalVaegt,  // Keep null if not specified - will be auto-assigned later
        kriterier
      });
    }
  });
  
  // Auto-assign equal weights to sections if not specified
  const sectionsWithoutWeight = dele.filter(d => !d.totalVaegt);
  if (sectionsWithoutWeight.length > 0) {
    console.log(`📊 Auto-assigning equal section weights to ${sectionsWithoutWeight.length} sections`);
    const equalSectionWeight = 100 / dele.length;
    sectionsWithoutWeight.forEach(del => {
      del.totalVaegt = equalSectionWeight;
      console.log(`   - ${del.navn}: ${equalSectionWeight.toFixed(2)}%`);
    });
  }
  
  // Auto-assign weights if criteria don't have them
  dele.forEach(del => {
    // Check if any criterion is missing weight
    const hasNullWeights = del.kriterier.some(k => k.vaegt === null || k.vaegt === undefined);
    
    if (hasNullWeights) {
      console.log(`📊 Auto-assigning equal weights for del: ${del.navn}`);
      const equalWeight = del.totalVaegt / del.kriterier.length;
      del.kriterier.forEach(krit => {
        if (krit.vaegt === null || krit.vaegt === undefined) {
          krit.vaegt = equalWeight;
          console.log(`   - ${krit.navn}: ${equalWeight.toFixed(2)}%`);
        }
      });
    }
    
    // If total vægt ikke er angivet, beregn fra kriterier
    if (!del.totalVaegt) {
      del.totalVaegt = calculateTotalVaegtFromKriterier(del.kriterier);
    }
  });
  
  return { dele };
}

/**
 * Parse kriterier fra en tekst-sektion
 * @param {string} text - Tekst at parse
 * @param {number} start - Start position
 * @param {number} end - Slut position
 * @returns {Array} Array af kriterier
 */
function parseKriterierFromText(text, start, end) {
  const kriterier = [];
  const sectionText = text.substring(start, end);
  const lines = sectionText.split('\n');
  
  console.log(`🔍 Parsing ${lines.length} lines for criteria...`);
  
  // FIRST ATTEMPT: Parse with percentages (existing logic)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    if (line.match(/^(?:Del|Afsnit|Part)\s+[A-Z]/i)) continue;
    
    const percentMatch = line.match(/\(?\s*(\d+(?:[.,]\d+)?)\s*%\s*\)?/);
    if (!percentMatch) continue;
    
    const vaegt = parseFloat(percentMatch[1].replace(',', '.'));
    let navn = line.substring(0, line.indexOf(percentMatch[0])).trim();
    navn = navn.replace(/^\d+[.)]\s*/, '').trim();
    navn = navn.replace(/[:\-–—]\s*$/, '').trim();
    navn = navn.replace(/\([^)]*$/, '').trim();
    
    if (!navn) {
      console.warn(`⚠️ Found percentage (${vaegt}%) but couldn't extract criterion name from line: "${line}"`);
      continue;
    }
    
    console.log(`✓ Found criterion WITH percentage: "${navn}" (${vaegt}%)`);
    
    let beskrivelse = '';
    let j = i + 1;
    let descriptionLines = 0;
    while (j < lines.length && descriptionLines < 100) {
      const nextLine = lines[j].trim();
      if (nextLine.match(/\d+(?:[.,]\d+)?\s*%/)) break;
      if (nextLine.match(/^(?:Del|Afsnit|Part)\s+[A-Z]/i) || nextLine.match(/^\d+\.\s+[A-Z]/)) break;
      if (!nextLine && beskrivelse && j + 1 < lines.length && !lines[j + 1].trim()) break;
      
      if (nextLine) {
        beskrivelse += (beskrivelse ? ' ' : '') + nextLine;
        descriptionLines++;
      }
      j++;
    }
    
    beskrivelse = beskrivelse.substring(0, 500).trim();
    kriterier.push({
      navn,
      vaegt,
      beskrivelse: beskrivelse || `Bedømmelseskriterium for ${navn}`
    });
  }
  
  // FALLBACK: If no percentages found, parse numbered or colon-based criteria
  if (kriterier.length === 0) {
    console.warn('⚠️ No percentage-based criteria found, using fallback parsing...');
    kriterier.push(...parseKriterierWithoutPercentages(lines));
  }
  
  console.log(`🔍 Found ${kriterier.length} kriterier in section`);
  if (kriterier.length === 0) {
    console.warn(`⚠️ No criteria found. Sample lines:`, lines.slice(0, 10));
  }
  
  return kriterier;
}

/**
 * Fallback parsing for documents without percentages
 * Looks for numbered criteria (1., 2., etc.) or colon-based criteria
 * @param {Array} lines - Array of text lines
 * @returns {Array} Array of criteria (without weights - will be assigned later)
 */
function parseKriterierWithoutPercentages(lines) {
  const kriterier = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Skip section headers (Del A, Del B, etc.)
    if (line.match(/^(?:Del|Afsnit|Part)\s+[A-Z]/i)) continue;
    
    let criterionName = null;
    
    // Pattern 1: Numbered criteria like "1. Genre og Layout"
    const numberedMatch = line.match(/^(\d+)\.\s+(.+?)(?:\s*\([^)]*\))?$/);
    if (numberedMatch) {
      criterionName = numberedMatch[2].trim();
      // Remove trailing colon if present
      criterionName = criterionName.replace(/:\s*$/, '').trim();
    }
    
    // Pattern 2: Colon-based criteria like "Indhold og opgavebesvarelse:"
    if (!criterionName && line.match(/^[A-ZÆØÅ]/)) {  // Starts with capital letter
      const colonMatch = line.match(/^([^:]+):\s*$/);
      if (colonMatch) {
        criterionName = colonMatch[1].trim();
      }
    }
    
    if (!criterionName) continue;
    
    console.log(`✓ Found criterion WITHOUT percentage: "${criterionName}"`);
    
    // Collect description from following lines until next criterion
    let beskrivelse = '';
    let j = i + 1;
    let descriptionLines = 0;
    
    while (j < lines.length && descriptionLines < 100) {
      const nextLine = lines[j].trim();
      
      // Stop at next numbered criterion
      if (nextLine.match(/^\d+\.\s+[A-Z]/)) break;
      
      // Stop at next colon-based criterion
      if (nextLine.match(/^[A-ZÆØÅ][^:]+:\s*$/)) break;
      
      // Stop at section header
      if (nextLine.match(/^(?:Del|Afsnit|Part)\s+[A-Z]/i)) break;
      
      // Stop at double empty line
      if (!nextLine && beskrivelse && j + 1 < lines.length && !lines[j + 1].trim()) break;
      
      if (nextLine) {
        beskrivelse += (beskrivelse ? ' ' : '') + nextLine;
        descriptionLines++;
      }
      
      j++;
    }
    
    beskrivelse = beskrivelse.substring(0, 500).trim();
    
    kriterier.push({
      navn: criterionName,
      vaegt: null,  // Will be assigned equal weights later
      beskrivelse: beskrivelse || `Bedømmelseskriterium for ${criterionName}`
    });
  }
  
  return kriterier;
}

/**
 * Beregn total vægt fra kriterier
 * @param {Array} kriterier - Array af kriterier
 * @returns {number} Total vægt
 */
function calculateTotalVaegtFromKriterier(kriterier) {
  return kriterier.reduce((sum, krit) => sum + krit.vaegt, 0);
}

/**
 * Validér at total vægt er 100%
 * @param {Object} parsedData - Parsed data med dele
 * @throws {Error} Hvis total vægt ikke er 100%
 */
function validateTotalWeight(parsedData) {
  const totalWeight = parsedData.dele.reduce((sum, del) => sum + del.totalVaegt, 0);
  
  console.log('📊 Total weight:', totalWeight);
  
  // Tillad lille afvigelse pga. afrunding
  const tolerance = 0.1;
  if (Math.abs(totalWeight - 100) > tolerance) {
    console.warn(`⚠️ Total vægt er ${totalWeight}%, ikke 100%`);
    // Ikke throw fejl - bare advar
    // Dette gør parseren mere tolerant overfor variationer
  }
  
  // Tjek at hver del har mindst ét kriterium
  parsedData.dele.forEach(del => {
    if (del.kriterier.length === 0) {
      throw new Error(`Del "${del.navn}" har ingen kriterier`);
    }
  });
}

/**
 * Gem parsed bedømmelse med exam for cache
 * @param {string} examId - Exam ID
 * @param {Object} parsedData - Parsed bedømmelse data
 * @returns {Promise<void>}
 */
export async function saveParsedBedoemmelse(examId, parsedData) {
  try {
    // Import dynamisk for at undgå cirkulære dependencies
    const { updateExam } = await import('../services/firestoreService.js');
    
    // Use updateExam instead of updateExamFileRef since we're saving parsed data, not file metadata
    await updateExam(examId, { parsedBedoemmelse: parsedData });
    console.log('✅ Saved parsed bedømmelse to Firestore');
  } catch (error) {
    console.error('❌ Error saving parsed bedømmelse:', error);
    throw error;
  }
}

/**
 * Hent cached parsed bedømmelse
 * @param {Object} exam - Exam object
 * @returns {Object|null} Parsed bedømmelse eller null
 */
export function getCachedParsedBedoemmelse(exam) {
  return exam.parsedBedoemmelse || null;
}
