import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useEffect, useRef, useState } from 'react';

export type VoiceStatus = 'off' | 'starting' | 'listening' | 'denied' | 'unavailable';

const COMMAND_WORDS = ['complete', 'completed', 'done', 'bump', 'finished', 'ready', 'pager', 'order'];

/**
 * Keeps the microphone listening while `enabled` and calls `onFinal` with each finished phrase.
 * Android's recogniser ends after a pause or on any hiccup, so it is restarted whenever it stops.
 * Never throws: a missing permission or recogniser just shows up in the returned status.
 */
export function useVoice({ enabled, onFinal }: { enabled: boolean; onFinal: (transcript: string) => void }): VoiceStatus {
  const [status, setStatus] = useState<VoiceStatus>('off');
  const enabledRef = useRef(enabled);
  const onFinalRef = useRef(onFinal);
  const restart = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const failures = useRef(0);
  enabledRef.current = enabled;
  onFinalRef.current = onFinal;

  const begin = () => {
    if (!enabledRef.current) return;
    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        continuous: true,
        interimResults: true,
        contextualStrings: COMMAND_WORDS,
      });
    } catch {
      setStatus('unavailable');
    }
  };

  useSpeechRecognitionEvent('start', () => {
    failures.current = 0;
    setStatus('listening');
  });

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results?.[0]?.transcript;
    if (enabledRef.current && e.isFinal && text) onFinalRef.current(text);
  });

  useSpeechRecognitionEvent('error', (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      enabledRef.current = false;
      setStatus('denied');
    } else if (e.error === 'language-not-supported') {
      enabledRef.current = false;
      setStatus('unavailable');
    } else if (e.error !== 'no-speech' && e.error !== 'speech-timeout' && e.error !== 'aborted') {
      failures.current++;
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (!enabledRef.current) return;
    setStatus('starting');
    clearTimeout(restart.current);
    // Back off if it keeps failing, so a broken recogniser doesn't spin.
    restart.current = setTimeout(begin, Math.min(10000, 300 + failures.current * 1500));
  });

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      clearTimeout(restart.current);
      setStatus('off');
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {}
      return;
    }
    setStatus('starting');
    ExpoSpeechRecognitionModule.requestPermissionsAsync()
      .then((p) => {
        if (cancelled) return;
        if (!p.granted) setStatus('denied');
        else if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) setStatus('unavailable');
        else begin();
      })
      .catch(() => !cancelled && setStatus('unavailable'));
    return () => {
      cancelled = true;
      clearTimeout(restart.current);
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return status;
}
