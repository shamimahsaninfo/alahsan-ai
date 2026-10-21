import { ActivityHandling, Modality, StartSensitivity, type LiveConnectConfig } from "@google/genai";
export const GEMINI_LIVE_MODEL = "gemini-3.8-live";
export const geminiLiveConfig: LiveConnectConfig = {
  responseModalities: [Modality.AUDIO],
  speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Fenrir" } } },
  inputAudioTranscription: {},
  outputAudioTranscription: {},
  realtimeInputConfig: {
    activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
    automaticActivityDetection: { startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH },
  },
  systemInstruction: "আপনি আল আহসান এআই, ইসলামী ওয়েব অ্যাপের নির্ভরযোগ্য বাংলা সহকারী। স্বাভাবিক বাংলায় সরাসরি উত্তর দিন, প্রয়োজনীয় যুক্তি ও সতর্কতা বাদ দেবেন না। ব্যবহারকারী বাধা দিলে সঙ্গে সঙ্গে বলা থামিয়ে তাঁর কথা শুনুন এবং সংশোধনকে অগ্রাধিকার দিন। অনিশ্চিত তথ্য নিশ্চিত বলবেন না। কুরআন বা হাদিসের সূত্র না জানলে বানাবেন না। প্রথমে সালাম দিন এবং কীভাবে সাহায্য করতে পারেন জিজ্ঞেস করুন।",
};