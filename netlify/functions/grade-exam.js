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
    const { systemPrompt, userPrompt, apiProvider, imageBase64, pdfImages } = JSON.parse(event.body);
    
    console.log('🔍 DEBUG: Netlify function called');
    console.log('  - Has imageBase64 (single):', !!imageBase64);
    console.log('  - Has pdfImages (array):', !!pdfImages);
    
    if (imageBase64) {
      console.log('  - imageBase64 length:', imageBase64.length);
      console.log('  - imageBase64 format:', imageBase64.substring(0, 30));
    }
    
    if (pdfImages) {
      console.log('  - pdfImages count:', pdfImages.length);
      console.log('  - Total PDF images size:', (pdfImages.reduce((sum, img) => sum + img.length, 0) / 1024 / 1024).toFixed(2), 'MB');
    }
    
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
    
    // Build user message - with or without images
    let userMessage;
    if (pdfImages && pdfImages.length > 0) {
      // Vision API format - multiple PDF page images
      const imageContent = pdfImages.map((imageDataUrl, idx) => ({
        type: "image_url",
        image_url: {
          url: imageDataUrl,
          detail: "high"  // Use high detail for math diagrams/drawings
        }
      }));
      
      userMessage = {
        role: "user",
        content: [
          {
            type: "text",
            text: userPrompt
          },
          ...imageContent  // Add all PDF page images
        ]
      };
      
      console.log(`📸 Sending ${pdfImages.length} PDF page images to Vision API`);
    } else if (imageBase64) {
      // Vision API format - single custom question image
      userMessage = {
        role: "user",
        content: [
          {
            type: "text",
            text: userPrompt
          },
          {
            type: "image_url",
            image_url: {
              url: imageBase64,
              detail: "high"
            }
          }
        ]
      };
      console.log('📸 Sending 1 custom image to Vision API');
    } else {
      // Standard text-only format
      userMessage = {
        role: "user",
        content: userPrompt
      };
      console.log('📝 Text-only mode (no images)');
    }
    
    const requestBody = {
      model: 'gpt-4o',  // gpt-4o supports vision
      messages: [
        { role: "system", content: optimizedSystemPrompt },
        userMessage
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
    if (imageBase64) {
      console.log('📷 Single image attached to request (vision API will be used)');
    }
    if (pdfImages) {
      console.log(`📷 ${pdfImages.length} PDF page images attached (vision API will be used)`);
    }
    
    // Create AbortController for timeout handling
    // Vision API needs more time due to image processing
    const isVisionRequest = !!(imageBase64 || pdfImages);
    const timeoutDuration = isVisionRequest ? 50000 : 26000;  // 50s for Vision, 26s for text-only
    
    console.log(`⏱️ Server timeout set to ${timeoutDuration / 1000}s (${isVisionRequest ? 'Vision' : 'Text'} mode)`);
    
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      abortController.abort();
    }, timeoutDuration);
    
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
