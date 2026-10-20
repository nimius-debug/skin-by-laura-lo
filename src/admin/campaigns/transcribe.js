// Turns Laura's voice recording into text with Cloudflare's speech-to-text
// (Whisper on Workers AI, the AI binding in wrangler.toml). The audio is only
// held in memory for the request; nothing is stored.

const MODEL = "@cf/openai/whisper-large-v3-turbo";
const MAX_BYTES = 8 * 1024 * 1024; // About 3 minutes of phone audio; the recorder stops at 90 seconds.

function toBase64(bytes) {
  let text = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) text += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(text);
}

/** Returns the spoken text, or throws an error with a message Laura can act on. */
export async function transcribeAudio(env, bytes) {
  if (!env.AI) throw new Error("Voice typing isn't switched on yet (the AI binding). Type the idea instead for now.");
  if (!bytes.length) throw new Error("The recording was empty. Try again, a little closer to the phone.");
  if (bytes.length > MAX_BYTES) throw new Error("That recording is too long. Keep it under a minute and a half.");
  const result = await env.AI.run(MODEL, { audio: toBase64(bytes), language: "en" });
  const text = String(result?.text || "").trim();
  if (!text) throw new Error("Couldn't hear any words in that recording. Try again.");
  return text;
}
