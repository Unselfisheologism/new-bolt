import { getAPIKey } from '~/lib/.server/llm/api-key';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';

// Define the structure for messages, including image content
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: 'text' | 'image_url', text?: string, image_url?: { url: string } }>;
  toolInvocations?: any[]; // Keep this if your application uses tool calls
}

export type Messages = Message[];

export type StreamingOptions = Omit<RequestInit, 'body' | 'method'> & {
  onFinish?: (result: { text: string, finishReason: string }) => Promise<void> | void;
};


export async function streamText(messages: Messages, options?: StreamingOptions) {
  const apiKey = getAPIKey(); // Get the API token

  const systemPrompt = getSystemPrompt();

  // Prepare messages for the Pollinations.AI API (OpenAI format)
  const formattedMessages = messages.map(message => {
    if (typeof message.content === 'string') {
      return {
        role: message.role,
        content: message.content
      };
    } else {
      // Handle multimodal content
      return {
        role: message.role,
        content: message.content.map(part => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          } else if (part.type === 'image_url' && part.image_url) {
            return { type: 'image_url', image_url: { url: part.image_url.url } };
          }
          return part; // Return other types as is
        })
      };
    }
  });

  // Add system prompt to the beginning of messages
  const messagesWithSystemPrompt = [{ role: 'system', content: systemPrompt }, ...formattedMessages];

  const apiUrl = 'https://text.pollinations.ai/openai';
  const requestHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer 8pp_SurhBzcSzNtu`, // Include the API token
      // Add other headers from options if needed
      // ...options?.headers
    };

   const requestBody = {
    model: 'openai-large', // Specify the Pollinations.AI model
    messages: messagesWithSystemPrompt,
    max_tokens: MAX_TOKENS,
    stream: true,
    // Add other parameters from options if needed, e.g., temperature, top_p
    // ...options
  };

  console.log('Pollinations.AI API URL:', apiUrl);
  console.log('Request Headers:', requestHeaders);
  console.log('Request Body:', JSON.stringify(requestBody)); // Log the stringified body


  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });

    console.log('Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorDetail = await response.text();
      console.error('Pollinations.AI API Error Detail:', errorDetail); // Log error detail
      throw new Error(`Pollinations.AI API error: ${response.status} ${response.statusText} - ${errorDetail}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get reader from response body');
    }

    // Process the streamed response
    const textDecoder = new TextDecoder();
    let assistantResponse = '';
    let finishReason = 'stop'; // Assume 'stop' unless proven otherwise

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            const chunk = textDecoder.decode(value, { stream: true });
            // Process SSE chunks (data: ...)
            chunk.split('\n\n').forEach(sseMessage => {
              if (sseMessage.startsWith('data: ')) {
                const data = sseMessage.substring(6);
                if (data.trim() === '[DONE]') {
                  finishReason = 'stop'; // Or another appropriate reason if indicated
                  return;
                }
                try {
                  const jsonChunk = JSON.parse(data);
                  const content = jsonChunk.choices?.[0]?.delta?.content;
                  if (content) {
                    assistantResponse += content;
                    controller.enqueue(content); // Enqueue the text content
                  }
                   const currentFinishReason = jsonChunk.choices?.[0]?.finish_reason;
                   if (currentFinishReason) {
                       finishReason = currentFinishReason;
                   }
                } catch (error) {
                  console.error('Failed to parse SSE data:', error);
                }
              }
            });
          }

          textDecoder.decode(); // Flush the decoder
          controller.close();

          // Call onFinish if provided
          if (options?.onFinish) {
            await options.onFinish({ text: assistantResponse, finishReason });
          }

        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        } finally {
            reader.releaseLock();
        }
      }
    });

    // Return an object that resembles the AI SDK\'s streamText return
    return {
      toAIStream: () => readableStream,
    };
  } catch (error) {
      console.error('Error during fetch or stream setup:', error); // Log errors during fetch or stream setup
      throw error; // Re-throw the error so it's caught in api.chat.ts
  }
}
