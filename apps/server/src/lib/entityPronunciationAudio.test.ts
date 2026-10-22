import { expect, test } from "vitest";
import {
  buildPronunciationSynthesisRequest,
  getPronunciationAudioUrl,
  PRONUNCIATION_VOICE,
} from "./entityPronunciationAudio";

test("asks for British English MP3 audio of the IPA", () => {
  expect(
    buildPronunciationSynthesisRequest({
      name: "Glen Garioch",
      ipa: "ɡlɛn ˈɡɪəri",
    }),
  ).toEqual({
    input: {
      ssml: '<speak><phoneme alphabet="ipa" ph="ɡlɛn ˈɡɪəri">Glen Garioch</phoneme></speak>',
    },
    voice: PRONUNCIATION_VOICE,
    audioConfig: { audioEncoding: "MP3" },
  });
  expect(PRONUNCIATION_VOICE.languageCode).toBe("en-GB");
});

test("escapes XML in the name and IPA", () => {
  const { input } = buildPronunciationSynthesisRequest({
    name: `Smith & Sons <"Bottlers">`,
    ipa: `a"b<c>&'d`,
  });

  expect(input.ssml).toBe(
    '<speak><phoneme alphabet="ipa" ph="a&quot;b&lt;c&gt;&amp;&apos;d">Smith &amp; Sons &lt;&quot;Bottlers&quot;&gt;</phoneme></speak>',
  );
});

test("names audio files by Entity, voice, and IPA", () => {
  expect(getPronunciationAudioUrl(1, "ɡlɛn")).toBe(
    getPronunciationAudioUrl(1, "ɡlɛn"),
  );
  expect(getPronunciationAudioUrl(1, "ɡlɛn")).not.toBe(
    getPronunciationAudioUrl(1, "ɡlɛm"),
  );
  expect(getPronunciationAudioUrl(1, "ɡlɛn")).not.toBe(
    getPronunciationAudioUrl(2, "ɡlɛn"),
  );
});
