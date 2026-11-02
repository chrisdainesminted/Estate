// Reading a floor plan with Claude: a photo or PDF in, rooms with their sizes
// out, as JSON that matches BLUEPRINT_SCHEMA. The person checks every room
// before any quantity is worked out from them.

import Anthropic from '@anthropic-ai/sdk';
import { BLUEPRINT_PROMPT, BLUEPRINT_SCHEMA, cleanReading } from '../src/lib/build.js';
import { StoreError } from './store.js';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_PLAN_BYTES = 8 * 1024 * 1024; // of the file, before base64

/** The file as a content block Claude reads: an image, or a PDF document. */
function planBlock(type, data) {
  if (type === 'application/pdf') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } };
  if (IMAGE_TYPES.includes(type)) return { type: 'image', source: { type: 'base64', media_type: type, data } };
  throw new StoreError(400, 'Send a PDF, PNG, JPG or WebP of the plan.');
}

export async function readBlueprint(apiKey, { type, data }) {
  if (typeof data !== 'string' || !data || !/^[A-Za-z0-9+/=]+$/.test(data)) throw new StoreError(400, 'Couldn’t read that file.');
  if ((data.length * 3) / 4 > MAX_PLAN_BYTES) throw new StoreError(413, 'That file is over 8 MB. Try a smaller photo or a single page.');
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 120_000 });
  let response;
  try {
    response = await client.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: BLUEPRINT_SCHEMA } },
      messages: [{ role: 'user', content: [planBlock(type, data), { type: 'text', text: BLUEPRINT_PROMPT }] }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new StoreError(429, 'Too many plans are being read right now. Try again in a minute.');
    if (e instanceof Anthropic.BadRequestError) throw new StoreError(400, 'That file couldn’t be read. Try a clearer photo, or type the rooms in.');
    if (e instanceof Anthropic.APIError) throw new StoreError(502, 'Reading plans isn’t working right now. Type the rooms in, or try again later.');
    throw new StoreError(502, 'Couldn’t reach the plan reader. Try again in a minute.');
  }
  if (response.stop_reason === 'refusal') throw new StoreError(422, 'That file couldn’t be read as a floor plan. Type the rooms in instead.');
  if (response.stop_reason === 'max_tokens') throw new StoreError(422, 'That plan has too much on it to read at once. Try one floor at a time.');
  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new StoreError(502, 'The plan reader’s answer didn’t make sense. Try again, or type the rooms in.');
  }
  return cleanReading(parsed);
}
