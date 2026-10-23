/**
 * Owns Entity pronunciation audio: the synthesis request, the stored file
 * name, and file cleanup. GenerateEntityPronunciationAudio owns when audio is
 * made and saved. Database rows are authoritative; file cleanup is best effort.
 */
import config from "@peated/server/config";
import { logError } from "@peated/server/lib/log";
import { deleteFile, storeFile } from "@peated/server/lib/uploads";
import { GoogleAuth } from "google-auth-library";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { z } from "zod";

// A British English voice that accepts SSML <phoneme> tags. Changing it gives
// every Entity a new audio file name, so the backfill route regenerates all
// audio with the new voice.
export const PRONUNCIATION_VOICE = {
  languageCode: "en-GB",
  name: "en-GB-Neural2-B",
} as const;

const SYNTHESIZE_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const REQUEST_TIMEOUT_MS = 15_000;
const AUDIO_DIRECTORY = "entity-pronunciations";
const AUDIO_URL_PREFIX = `/uploads/${AUDIO_DIRECTORY}/`;

const SynthesizeResponseSchema = z.object({
  audioContent: z.string().min(1),
});

let auth: GoogleAuth | null = null;

function getAuth() {
  auth ??= new GoogleAuth({
    credentials: config.GCP_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    // Worker rule: every outbound request on the default queue has a
    // timeout, including the access token request.
    clientOptions: { transporterOptions: { timeout: REQUEST_TIMEOUT_MS } },
  });
  return auth;
}

/** Whether this server has the Google Cloud credentials synthesis needs. */
export function isPronunciationAudioEnabled() {
  return Boolean(config.GCP_CREDENTIALS);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Builds the Cloud Text-to-Speech request that reads `ipa` aloud. */
export function buildPronunciationSynthesisRequest({
  name,
  ipa,
}: {
  name: string;
  ipa: string;
}) {
  return {
    input: {
      ssml: `<speak><phoneme alphabet="ipa" ph="${escapeXml(ipa)}">${escapeXml(name)}</phoneme></speak>`,
    },
    voice: PRONUNCIATION_VOICE,
    audioConfig: { audioEncoding: "MP3" },
  };
}

/** Returns MP3 audio for the IPA from Cloud Text-to-Speech. */
export async function synthesizePronunciationAudio(input: {
  name: string;
  ipa: string;
}): Promise<Buffer> {
  const response = await getAuth().request({
    url: SYNTHESIZE_URL,
    method: "POST",
    data: buildPronunciationSynthesisRequest(input),
    timeout: REQUEST_TIMEOUT_MS,
  });
  const { audioContent } = SynthesizeResponseSchema.parse(response.data);
  return Buffer.from(audioContent, "base64");
}

/**
 * Returns the stored URL for an Entity's audio. The file name hashes the voice
 * and IPA, so the same IPA reuses one file and a new IPA gets a new file.
 */
export function getPronunciationAudioUrl(entityId: number, ipa: string) {
  const hash = createHash("sha256")
    .update(`${PRONUNCIATION_VOICE.name}\n${ipa}`)
    .digest("hex")
    .slice(0, 16);
  return `${AUDIO_URL_PREFIX}${entityId}-${hash}.mp3`;
}

/** Returns the audio URL an Entity should store: none without IPA. */
export function getExpectedPronunciationAudioUrl(entity: {
  id: number;
  pronunciationIpa: string | null;
}) {
  return entity.pronunciationIpa
    ? getPronunciationAudioUrl(entity.id, entity.pronunciationIpa)
    : null;
}

/**
 * Whether an upload path is pronunciation audio. Its file name changes
 * whenever its content does, so it can be cached forever.
 */
export function isPronunciationAudioUpload(filename: string) {
  return filename.startsWith(`${AUDIO_DIRECTORY}/`);
}

/** Writes audio at the URL from `getPronunciationAudioUrl`. */
export async function storePronunciationAudio(audioUrl: string, audio: Buffer) {
  const filename = audioUrl.slice(AUDIO_URL_PREFIX.length);
  return await storeFile({
    data: { file: Readable.from(audio), filename },
    namespace: "entity-pronunciation",
    directory: AUDIO_DIRECTORY,
    urlPrefix: "/uploads",
    onProcess: (stream) => ({ stream, filename }),
  });
}

/** Removes a server-owned pronunciation file without changing database state. */
export async function deleteOwnedPronunciationAudio(audioUrl: string | null) {
  if (!audioUrl?.startsWith(AUDIO_URL_PREFIX)) return;
  const filename = audioUrl.slice("/uploads/".length);
  if (filename.includes("..") || filename.includes("\\")) return;
  try {
    await deleteFile({ filename });
  } catch (error) {
    logError(error, {
      entityPronunciationAudio: {
        audioUrl,
        source: "entity_pronunciation_audio_cleanup",
      },
    });
  }
}
