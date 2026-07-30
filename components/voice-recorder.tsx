"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_VOICE_LANGUAGE,
  VOICE_LANGUAGES,
  type VoiceLanguageCode,
} from "@/lib/voice/languages";
import { transcriptWarnings } from "@/lib/voice/transcript-review";

type RecognitionResult = {
  isFinal: boolean;
  [index: number]: { transcript: string };
};

type RecognitionResultEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: RecognitionResult;
  };
};

type RecognitionErrorEvent = Event & { error: string };

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function subscribeToBrowserCapability() {
  return () => undefined;
}

function speechRecognitionSupported() {
  const speechWindow = window as SpeechRecognitionWindow;
  return Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition);
}

function serverSpeechRecognitionSupport() {
  return null;
}

function safeErrorMessage(error: string) {
  if (error === "not-allowed" || error === "service-not-allowed") return "Microphone permission was denied. Allow microphone access in your browser settings, or continue typing.";
  if (error === "no-speech") return "No speech was detected. Check your microphone and try again.";
  if (error === "audio-capture") return "No working microphone was found. Connect a microphone or continue typing.";
  if (error === "network") return "The browser speech service is unavailable. Check your connection and try again.";
  if (error === "language-not-supported") return "This language is not supported by your browser's speech recognition.";
  if (error === "aborted") return "Listening was stopped. Your existing description is unchanged.";
  return "Voice recognition encountered an error. Try again or continue typing.";
}

export function VoiceRecorder({
  onTranscript,
  initialLanguage = DEFAULT_VOICE_LANGUAGE,
  onLanguageChange,
  existingText = "",
  onReplaceTranscript,
}: {
  onTranscript: (transcript: string) => void;
  initialLanguage?: VoiceLanguageCode;
  onLanguageChange?: (language: VoiceLanguageCode) => void;
  existingText?: string;
  onReplaceTranscript?: (transcript: string) => void;
}) {
  const supported = useSyncExternalStore(subscribeToBrowserCapability, speechRecognitionSupported, serverSpeechRecognitionSupport);
  const [language, setLanguage] = useState<VoiceLanguageCode>(initialLanguage);
  const [starting, setStarting] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [message, setMessage] = useState("Select a language, then start listening when you are ready.");
  const [reviewTranscript, setReviewTranscript] = useState("");
  const [reviewWarnings, setReviewWarnings] = useState<ReturnType<typeof transcriptWarnings>>([]);
  const reviewRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const receivedSpeechRef = useRef(false);
  const stoppingRef = useRef(false);
  const unmountingRef = useRef(false);
  const recognitionErrorRef = useRef(false);

  useEffect(() => {
    return () => {
      unmountingRef.current = true;
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      if (recognition) {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
      }
    };
  }, []);

  function startListening() {
    if (!supported || starting || listening || recognitionRef.current) return;
    const speechWindow = window as SpeechRecognitionWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("Voice input is not supported by this browser. You can continue by typing normally.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    receivedSpeechRef.current = false;
    stoppingRef.current = false;
    recognitionErrorRef.current = false;
    setStarting(true);
    setInterimTranscript("");
    setMessage("Requesting microphone access…");

    recognition.onstart = () => {
      setStarting(false);
      setListening(true);
      setMessage("Listening. Speak naturally and pause when needed.");
    };

    recognition.onresult = (event) => {
      let interim = "";
      const finalSegments: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim();
        if (!transcript) continue;
        receivedSpeechRef.current = true;
        if (result.isFinal) finalSegments.push(transcript);
        else interim += `${transcript} `;
      }

      if (finalSegments.length) {
        const finalTranscript = finalSegments.join(" ");
        const warnings = transcriptWarnings(existingText, finalTranscript);
        if (warnings.length) {
          setReviewTranscript(finalTranscript);
          setReviewWarnings(warnings);
        } else onTranscript(finalTranscript);
      }
      setInterimTranscript(interim.trim());
    };

    recognition.onerror = (event) => {
      recognitionErrorRef.current = true;
      setStarting(false);
      setListening(false);
      setInterimTranscript("");
      setMessage(safeErrorMessage(event.error));
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setStarting(false);
      setListening(false);
      setInterimTranscript("");
      if (unmountingRef.current) return;
      if (recognitionErrorRef.current) return;
      if (stoppingRef.current) setMessage("Listening stopped. You can edit the description or start again.");
      else if (!receivedSpeechRef.current) setMessage("No speech was detected. Check your microphone and try again.");
      else setMessage("Speech added to the invention description. Review and edit it as needed.");
    };

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setStarting(false);
      setListening(false);
      setMessage("Voice recognition could not start. Wait a moment and try again.");
    }
  }

  function stopListening() {
    const recognition = recognitionRef.current;
    if (!recognition || (!starting && !listening)) return;
    stoppingRef.current = true;
    setMessage("Stopping listening…");
    if (starting) recognition.abort();
    else recognition.stop();
  }

  const active = starting || listening;

  return <section className={active ? "voice-recorder voice-recorder-active" : "voice-recorder"} aria-labelledby="voice-recorder-title">
    <header className="voice-recorder-heading">
      <span className="voice-recorder-icon" aria-hidden="true">◉</span>
      <div><h3 id="voice-recorder-title">Describe with your voice</h3><p>Speech is added to the description below and remains fully editable.</p></div>
      {active && <span className="voice-listening-status" role="status"><i aria-hidden="true" />{starting ? "Starting" : "Listening"}</span>}
    </header>

    <div className="voice-recorder-controls">
      <label><span>Voice language</span><select name="preferred_language" value={language} onChange={(event) => {
        const nextLanguage = event.target.value as VoiceLanguageCode;
        setLanguage(nextLanguage);
        onLanguageChange?.(nextLanguage);
      }} disabled={active}>{VOICE_LANGUAGES.map((option) => <option value={option.code} key={option.code}>{option.label}</option>)}</select></label>
      <div role="group" aria-label="Voice recording controls">
        <button type="button" className="voice-start-button" onClick={startListening} disabled={supported !== true || active}><span aria-hidden="true">●</span>Start listening</button>
        <button type="button" className="voice-stop-button" onClick={stopListening} disabled={!active}><span aria-hidden="true">■</span>Stop listening</button>
      </div>
    </div>

    {active && <div className="voice-wave" aria-hidden="true"><i /><i /><i /><i /><i /></div>}
    {interimTranscript && <div className="voice-interim" aria-live="polite"><span>Listening now</span><p>{interimTranscript}</p></div>}
    {reviewTranscript && <div className="voice-transcript-review" role="alert"><strong>This transcript may repeat information already present. Review before saving.</strong><p>{reviewWarnings.includes("DUPLICATE") ? "Similar technical wording is already in the description. " : ""}{reviewWarnings.includes("MISSING_PUNCTUATION") ? "The transcript has no closing punctuation. " : ""}{reviewWarnings.includes("INCOMPLETE") ? "The transcript may be an incomplete sentence." : ""}</p><textarea ref={reviewRef} value={reviewTranscript} onChange={(event) => setReviewTranscript(event.target.value)} rows={3} aria-label="Transcript awaiting review" /><div><button type="button" onClick={() => { onTranscript(reviewTranscript); setReviewTranscript(""); setReviewWarnings([]); }}>Keep transcript</button><button type="button" onClick={() => { onReplaceTranscript?.(reviewTranscript); setReviewTranscript(""); setReviewWarnings([]); }} disabled={!onReplaceTranscript}>Replace selected text</button><button type="button" onClick={() => { setReviewTranscript(""); setReviewWarnings([]); }}>Discard duplicate</button><button type="button" onClick={() => reviewRef.current?.focus()}>Edit transcript</button></div></div>}
    <p className={supported === false ? "voice-message voice-message-error" : "voice-message"} aria-live="polite">{supported === false ? "Voice input is not supported by this browser. You can continue by typing normally." : message}</p>
  </section>;
}
