// Netlify Function til at rette eksamen - beskytter din OpenAI API key med streaming support
import { StringDecoder } from 'string_decoder';

export const handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { systemPrompt, userPrompt, apiProvider } = JSON.parse(event.body);
    
    // 🔒 SIKKERHED: Kun OpenAI ChatGPT er tilladt
    if (apiProvider && apiProvider !== 'openai') {
      throw new Error('Kun OpenAI ChatGPT er understøttet. Andre providers er deaktiveret af sikkerhedsmæssige årsager.');
    }
    
    // OpenAI API - bruger environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY not found in environment variables');
      console.error('Available env vars:', Object.keys(process.env));
      throw new Error('OPENAI_API_KEY environment variable mangler. Har du husket at redeploy efter du tilføjede den?');
    }
    
    console.log('✅ OPENAI_API_KEY found, calling OpenAI ChatGPT API with streaming...');
    console.log('🤖 Model: GPT-4o (ChatGPT)');
    
    // OPTIMIZATION: Append conciseness instructions to system prompt
    // This reduces token usage while maintaining quality
    const concisenessSupplement = `

🎯 CONCISENESS REQUIREMENTS (CRITICAL - MUST FOLLOW):
- MAXIMUM 1 short sentence per task feedback (5-10 words)
- Use ONLY essential words: "Korrekt" or "Mangler X" or "Fejl: Y"
- For "samletFeedback": MAXIMUM 2 sentences total
- NO verbose explanations or filler words
- COMPLETE ALL tasks - do not truncate
- Speed is critical - keep responses minimal`;

    const optimizedSystemPrompt = systemPrompt + concisenessSupplement;
    
    const endpoint = "https://api.openai.com/v1/chat/completions";
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    const requestBody = {
      model: 'gpt-4o',
      messages: [
        { role: "system", content: optimizedSystemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 16000,  // Increased for complex Dansk grading with many criteria
      temperature: 0.2,  // Reduced from 0.3 for more deterministic, faster responses
      top_p: 0.9,       // Reduced from 0.95 to speed up generation
      stream: true,  // Enable streaming to prevent timeout
      stream_options: {
        include_usage: true  // Ensure we get usage data at the end of stream
      }
    };

    console.log('🔐 Calling AI API securely from Netlify Function with streaming');
    console.log('⚡ Max tokens: 16000 (optimized for complex Dansk grading)');
    
    // Create AbortController for timeout handling (26s provides safety margin under Netlify's 30s limit)
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, 26000);  // Reduced from 28s to 26s for earlier timeout detection
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        signal: abortController.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API error: ${response.status} - ${errorData}`);
      }

      // Process streaming response - accumulate all chunks
      let fullContent = '';
      let usageData = null;
      let buffer = '';
      
      // Create StringDecoder for proper UTF-8 handling across chunk boundaries
      const decoder = new StringDecoder('utf-8');
      
      // Read the stream chunk by chunk
      for await (const chunk of response.body) {
        const text = decoder.write(chunk);
        buffer += text;
        
        // Process complete lines from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            
            // Accumulate content from delta
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              fullContent += parsed.choices[0].delta.content;
            }
            
            // Capture usage data from the final chunk (with stream_options)
            if (parsed.usage) {
              usageData = parsed.usage;
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE chunk:', parseError.message);
          }
        }
      }
      
      // Flush any remaining bytes in the decoder buffer
      const remaining = decoder.end();
      if (remaining) {
        buffer += remaining;
      }
      
      console.log('📊 Stream completed successfully');
      console.log('📊 Content length:', fullContent.length);
      console.log('📊 Usage data:', usageData);
      
      // CRITICAL: Ensure usage data exists
      if (!usageData) {
        console.error('⚠️ KRITISK: OpenAI streaming response mangler usage field!');
        console.warn('Pris kan ikke beregnes uden usage data');
      } else {
        // Log detailed usage for price calculation verification
        console.log('✅ Usage data fundet:');
        console.log('   - Input tokens:', usageData.prompt_tokens);
        console.log('   - Output tokens:', usageData.completion_tokens);
        console.log('   - Total tokens:', usageData.total_tokens);
      }
      
      // Construct response in the same format as non-streaming (backwards compatible)
      const data = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: fullContent
            },
            finish_reason: 'stop',
            index: 0
          }
        ],
        usage: usageData || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          success: true,
          data: data
        })
      };
      
    } catch (fetchError) {
      clearTimeout(timeout);
      
      // Handle timeout errors specifically
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout: AI response took too long. Try with a shorter document.');
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('❌ Function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
