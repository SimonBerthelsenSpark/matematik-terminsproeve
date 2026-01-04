/**
 * Dansk Grading Hook
 * 
 * Håndterer AI-bedømmelse af dansk prøver baseret på dynamisk parsede kriterier
 * INGEN hardcoded kategorier - alt er dynamisk
 */

/**
 * Bed AI om at bedømme dansk opgave DYNAMISK baseret på parsede kriterier
 * @param {Object} parsedBedoemmelse - Dynamisk parsede kriterier fra bedømmelseskema
 * @param {string} elevbesvarelse - Elevens tekst
 * @param {string} elevNavn - Elevens navn/filnavn
 * @param {string} submissionId - Submission ID
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Bedømmelse per kriterium i dynamisk struktur
 */
export async function bedoemDanskOpgave(
  parsedBedoemmelse,
  elevbesvarelse,
  elevNavn,
  submissionId,
  onProgress = null
) {
  try {
    // 1. Generer dynamisk prompt baseret på parsedBedoemmelse
    const { systemPrompt, userPrompt } = generateDynamicPrompt(
      parsedBedoemmelse,
      elevbesvarelse,
      elevNavn
    );
    
    if (onProgress) {
      onProgress('Sender til AI...');
    }
    
    // 2. Send til AI (OpenAI GPT-4)
    const aiResponse = await callOpenAI(systemPrompt, userPrompt);
    
    if (onProgress) {
      onProgress('Behandler svar...');
    }
    
    // 3. Parse AI's JSON response
    const aiGrading = parseAIResponse(aiResponse.content);
    
    if (onProgress) {
      onProgress('Beregner karakterer...');
    }
    
    // 4. Beregn vægtede scorer og total karakter
    const gradingResult = calculateGradingResult(
      parsedBedoemmelse,
      aiGrading,
      elevNavn,
      submissionId
    );
    
    // Inkluder cost hvis tilgængeligt
    if (aiResponse.usage) {
      gradingResult.metadata = {
        aiProvider: 'openai',
        aiModel: 'gpt-4o',
        promptTokens: aiResponse.usage.prompt_tokens,
        completionTokens: aiResponse.usage.completion_tokens,
        cost: calculateCost(aiResponse.usage)
      };
    }
    
    return gradingResult;
  } catch (error) {
    console.error('❌ Error grading dansk opgave:', error);
    throw new Error(`Kunne ikke bedømme opgave: ${error.message}`);
  }
}

/**
 * Generer dynamisk prompt baseret på bedømmelseskema
 * INGEN hardcoded kategorier - alt læses fra parsedBedoemmelse
 * @param {Object} parsedBedoemmelse - Parsed bedømmelseskema
 * @param {string} elevbesvarelse - Elevens besvarelse
 * @param {string} elevNavn - Elevens navn
 * @returns {Object} { systemPrompt, userPrompt }
 */
function generateDynamicPrompt(parsedBedoemmelse, elevbesvarelse, elevNavn) {
  const systemPrompt = `Du er censor ved en dansk prøve.

Din opgave er at bedømme elevbesvarelsen baseret PRÆCIST på de givne kriterier.

For HVERT kriterium skal du:
1. Giv en delkarakter på 7-trins skalaen: -3, 00, 02, 4, 7, 10, 12
2. Giv KORT, konkret feedback (MAX 2-3 sætninger)

VIGTIGE REGLER:
- Brug KUN de 7 gyldige karakterer: -3, 00, 02, 4, 7, 10, 12
- Ingen andre tal er tilladt
- Hold feedback KORT og specifik
- ALTID returner KOMPLET og VALID JSON
- Brug PRÆCIS det elevnavn der gives: "${elevNavn}"

RETURNER JSON med denne struktur:
{
  "elevNavn": "${elevNavn}",
  "dele": [
    {
      "navn": "Del X: ...",
      "kriterier": [
        {
          "navn": "Kriterie navn",
          "delKarakter": 7,
          "feedback": "Kort specifik feedback..."
        }
      ]
    }
  ],
  "samletVurdering": "Kort overordnet vurdering (max 200 ord)"
}`;

  // Byg user prompt med alle dele og kriterier DYNAMISK
  let userPrompt = `Bedøm følgende elevbesvarelse baseret på PRÆCIS disse kriterier fra bedømmelseskemaet:\n\n`;
  
  // Tilføj alle dele og kriterier DYNAMISK
  parsedBedoemmelse.dele.forEach(del => {
    userPrompt += `## ${del.navn} (${del.totalVaegt}%)\n\n`;
    
    del.kriterier.forEach(krit => {
      userPrompt += `### ${krit.navn} (${krit.vaegt}%)\n`;
      userPrompt += `${krit.beskrivelse}\n\n`;
    });
  });
  
  userPrompt += `\n---\n\nELEVNAVN (SKAL bruges i JSON): ${elevNavn}\n\n`;
  userPrompt += `ELEVBESVARELSE:\n${elevbesvarelse}\n\n`;
  userPrompt += `Bedøm nu elevbesvarelsen og returner JSON.`;
  
  return { systemPrompt, userPrompt };
}

/**
 * Kald OpenAI API via Netlify function
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @returns {Promise<Object>} AI response data
 */
async function callOpenAI(systemPrompt, userPrompt) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // 45 sekunder
    
    const response = await fetch('/.netlify/functions/grade-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        userPrompt,
        apiProvider: 'openai'
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API fejl: ${response.status} - ${errorText}`);
    }
    
    const responseData = await response.json();
    
    if (!responseData.success) {
      throw new Error(responseData.error || 'Ukendt API fejl');
    }
    
    return {
      content: responseData.data.choices[0].message.content,
      usage: responseData.data.usage
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Timeout: AI tog for lang tid at svare');
    }
    throw error;
  }
}

/**
 * Parse AI response til struktureret data
 * @param {string} content - AI response content
 * @returns {Object} Parsed AI grading
 */
function parseAIResponse(content) {
  try {
    // Remove markdown code fences if present
    let cleanContent = content.trim();
    
    // Remove ```json and ``` if present
    cleanContent = cleanContent.replace(/^```json\s*/i, '');
    cleanContent = cleanContent.replace(/^```\s*/i, '');
    cleanContent = cleanContent.replace(/\s*```$/i, '');
    
    // Find JSON i response
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Kunne ikke finde JSON i AI svar');
    }
    
    let jsonText = jsonMatch[0];
    
    // ULTRA-ROBUST JSON REPAIR for truncated AI responses
    // This handles the case where AI response is cut mid-string like: "feedback": "Struktur
    console.log('🔍 Checking JSON integrity...');
    console.log('📏 JSON length:', jsonText.length);
    console.log('📄 Last 100 chars:', jsonText.substring(Math.max(0, jsonText.length - 100)));
    
    let repaired = false;
    let repairedText = jsonText;
    
    // First, try to parse as-is
    try {
      JSON.parse(jsonText);
      console.log('✅ JSON is valid, no repair needed');
      repaired = true;
    } catch (initialError) {
      console.warn('⚠️ JSON appears corrupted/truncated:', initialError.message);
      console.log('🔧 Attempting to repair...');
      
      // STRATEGY: Find last COMPLETE property-value pair
      // Look for patterns like: "property": "value"} or "property": number}
      
      // Find all closing braces and try each one from right to left
      let allClosingBraces = [];
      for (let i = jsonText.length - 1; i >= 0; i--) {
        if (jsonText[i] === '}') {
          allClosingBraces.push(i);
        }
      }
      
      console.log(`📍 Found ${allClosingBraces.length} closing braces to try`);
      
      // Try each closing brace position
      for (const bracePos of allClosingBraces) {
        if (repaired) break;
        
        // Extract text up to and including this brace
        let candidate = jsonText.substring(0, bracePos + 1);
        
        // Remove any trailing incomplete text after the last complete property
        // Pattern to find: anything after a complete "property": value pair
        
        // Check if we have an incomplete string after the last complete object
        // by looking for unclosed quotes after the last }
        const afterBrace = candidate.substring(candidate.lastIndexOf('}'));
        const quoteCount = (afterBrace.match(/"/g) || []).length;
        
        // If odd quotes, we have an incomplete string - remove it
        if (quoteCount % 2 !== 0) {
          // Find the position of the opening quote of the incomplete string
          const lastQuote = candidate.lastIndexOf('"');
          const beforeQuote = candidate.substring(0, lastQuote);
          
          // Look back to find the comma or opening brace before this incomplete property
          let cutPoint = lastQuote;
          for (let i = lastQuote - 1; i >= 0; i--) {
            if (candidate[i] === ',' || candidate[i] === '{' || candidate[i] === '[') {
              cutPoint = candidate[i] === ',' ? i : i + 1;
              break;
            }
          }
          
          candidate = candidate.substring(0, cutPoint);
          console.log(`🔪 Removed incomplete string property starting at position ${lastQuote}`);
        }
        
        // Now properly close all open structures
        const openBraces = (candidate.match(/\{/g) || []).length;
        const closeBraces = (candidate.match(/\}/g) || []).length;
        const openBrackets = (candidate.match(/\[/g) || []).length;
        const closeBrackets = (candidate.match(/\]/g) || []).length;
        
        const needBrackets = openBrackets - closeBrackets;
        const needBraces = openBraces - closeBraces;
        
        let testCandidate = candidate;
        if (needBrackets > 0) testCandidate += ']'.repeat(needBrackets);
        if (needBraces > 0) testCandidate += '}'.repeat(needBraces);
        
        // Try to parse
        try {
          const parsed = JSON.parse(testCandidate);
          
          // Validate it has the expected structure
          if (parsed.elevNavn && Array.isArray(parsed.dele) && parsed.dele.length > 0) {
            repairedText = testCandidate;
            repaired = true;
            console.log(`✅ Successfully repaired JSON by truncating at brace position ${bracePos}`);
            console.log(`   Added ${needBrackets} ']' and ${needBraces} '}'`);
            console.log(`   Recovered ${parsed.dele.length} dele with valid structure`);
            break;
          }
        } catch (e) {
          // This position didn't work, try next
          continue;
        }
      }
      
      if (!repaired) {
        console.error('❌ Could not repair JSON after trying all strategies');
        console.error('💡 AI response severely truncated - max_tokens too low');
        console.error('📄 Raw JSON (first 500):', jsonText.substring(0, 500));
        throw new Error('AI response truncated og kunne ikke repareres automatisk. Prøv med kortere dokument eller kontakt support.');
      }
    }
    
    jsonText = repairedText;
    
    // Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
      console.log('✅ Successfully parsed JSON');
    } catch (parseError) {
      console.warn('⚠️ First parse failed:', parseError.message);
      
      // Additional fixes for common JSON errors
      let fixedJson = jsonText;
      
      // Remove trailing commas before closing brackets/braces
      fixedJson = fixedJson.replace(/,(\s*[\]}])/g, '$1');
      
      // Try to parse again
      try {
        parsed = JSON.parse(fixedJson);
        console.log('✅ Successfully parsed after removing trailing commas');
      } catch (secondError) {
        console.error('📄 Failed JSON text:', jsonText.substring(0, 500));
        console.error('📄 After fixes:', fixedJson.substring(0, 500));
        throw new Error(`JSON parse failed: ${parseError.message}`);
      }
    }
    
    // Valider struktur
    if (!parsed.dele || !Array.isArray(parsed.dele)) {
      throw new Error('Manglende eller ugyldig "dele" array i AI svar');
    }
    
    return parsed;
  } catch (error) {
    console.error('❌ Error parsing AI response:', error);
    console.error('📄 Content:', content.substring(0, 500));
    throw new Error(`Kunne ikke parse AI svar: ${error.message}`);
  }
}

/**
 * Beregn grading result med vægtede scorer
 * @param {Object} parsedBedoemmelse - Original bedømmelse med vægte
 * @param {Object} aiGrading - AI's bedømmelse
 * @param {string} elevNavn - Elevens navn
 * @param {string} submissionId - Submission ID
 * @returns {Object} Komplet grading result
 */
function calculateGradingResult(parsedBedoemmelse, aiGrading, elevNavn, submissionId) {
  console.error('💚💚💚 calculateGradingResult CALLED 💚💚💚');
  console.error('💚 parsedBedoemmelse:', parsedBedoemmelse);
  console.error('💚 parsedBedoemmelse.dele:', parsedBedoemmelse?.dele);
  console.error('💚 parsedBedoemmelse.dele.length:', parsedBedoemmelse?.dele?.length);
  console.error('💚 aiGrading:', aiGrading);
  console.error('💚 aiGrading.dele:', aiGrading?.dele);
  console.error('💚 aiGrading.dele.length:', aiGrading?.dele?.length);
  
  let samletKarakter = 0;
  
  const dele = parsedBedoemmelse.dele.map((del, delIdx) => {
    const aiDel = aiGrading.dele[delIdx];
    console.error(`💚 Processing del ${delIdx}: ${del.navn}`);
    console.error(`💚 Found aiDel:`, aiDel);
    if (!aiDel) {
      throw new Error(`AI mangler bedømmelse for del: ${del.navn}`);
    }
    
    let delTotal = 0;
    
    const kriterier = del.kriterier.map((krit, kritIdx) => {
      const aiKrit = aiDel.kriterier[kritIdx];
      if (!aiKrit) {
        throw new Error(`AI mangler bedømmelse for kriterium: ${krit.navn}`);
      }
      
      // Valider delkarakter
      const validKarakterer = [-3, 0, 2, 4, 7, 10, 12];
      if (!validKarakterer.includes(aiKrit.delKarakter)) {
        console.warn(`⚠️ Ugyldig karakter ${aiKrit.delKarakter} for ${krit.navn}, sætter til 0`);
        aiKrit.delKarakter = 0;
      }
      
      // Beregn vægtet score
      const vaegtetScore = (aiKrit.delKarakter * krit.vaegt) / 100;
      delTotal += vaegtetScore;
      
      return {
        navn: krit.navn,
        vaegt: krit.vaegt,
        delKarakter: aiKrit.delKarakter,
        vaegtetScore: vaegtetScore,
        feedback: aiKrit.feedback || ''
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
  
  // Afrund til nærmeste 7-trins karakter
  const afrundetKarakter = roundTo7trins(samletKarakter);
  
  return {
    submissionId,
    elevNavn,
    fileName: elevNavn,
    dele,
    samletKarakter,
    afrundetKarakter,
    karakterBegrundelse: aiGrading.samletVurdering || ''
  };
}

/**
 * Afrund til nærmeste 7-trins karakter
 * @param {number} karakter - Beregnet karakter
 * @returns {number} Afrundet til 7-trins skala
 */
function roundTo7trins(karakter) {
  const trins = [-3, 0, 2, 4, 7, 10, 12];
  
  // Find nærmeste trin
  let nearest = trins[0];
  let minDiff = Math.abs(karakter - nearest);
  
  for (const trin of trins) {
    const diff = Math.abs(karakter - trin);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = trin;
    }
  }
  
  return nearest;
}

/**
 * Beregn API cost
 * @param {Object} usage - Usage data fra OpenAI
 * @returns {number} Cost i USD
 */
function calculateCost(usage) {
  // GPT-4o pricing (pr. 1M tokens)
  const promptCost = (usage.prompt_tokens / 1000000) * 2.50;
  const completionCost = (usage.completion_tokens / 1000000) * 10.00;
  return promptCost + completionCost;
}

/**
 * Genér lærer-bedømmelse baseret på AI bedømmelse
 * @param {Object} aiGrading - AI's bedømmelse
 * @param {Object} lærerAdjustments - Lærer justeringer { delIdx: { kritIdx: delKarakter } }
 * @param {Object} parsedBedoemmelse - Original bedømmelseskema
 * @returns {Object} Lærer bedømmelse
 */
export function calculateLaererGrading(aiGrading, lærerAdjustments, parsedBedoemmelse) {
  let samletKarakter = 0;
  
  const dele = aiGrading.dele.map((aiDel, delIdx) => {
    let delTotal = 0;
    
    const kriterier = aiDel.kriterier.map((aiKrit, kritIdx) => {
      // Brug lærer karakter hvis justeret, ellers AI's karakter
      const delKarakter = lærerAdjustments[delIdx]?.[kritIdx] ?? aiKrit.delKarakter;
      
      // Beregn vægtet score
      const vaegtetScore = (delKarakter * aiKrit.vaegt) / 100;
      delTotal += vaegtetScore;
      
      return {
        ...aiKrit,
        delKarakter,
        vaegtetScore
      };
    });
    
    samletKarakter += delTotal;
    
    return {
      ...aiDel,
      kriterier,
      delTotal
    };
  });
  
  const afrundetKarakter = roundTo7trins(samletKarakter);
  
  return {
    dele,
    samletKarakter,
    afrundetKarakter,
    timestamp: new Date()
  };
}
