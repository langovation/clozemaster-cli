import { baseUrl, getAuthToken } from "./config.js";

export type LanguagePairing = {
  id: number;
  baseLanguageName: string;
  currentStreakDays: number;
  level: number;
  numPointsToday: number;
  score: number;
  targetLanguageName: string;
};

export type Collection = {
  id: number;
  collectionClozeSentencesAnswerUrl: string;
  dashboardCollection: boolean;
  name: string;
  numMastered: number;
  numPlaying: number;
  numReadyForReview: number;
  numSentences: number;
  playDataUrl: string;
  playing: boolean;
  proOnly: boolean;
};

export type ExplanationWord = {
  features: string[];
  gloss: string;
  lemma: string;
  note: string | null;
  pos: string;
  reading: string | null;
  surface: string;
};

export type StructuredExplanation = {
  alternative: string | null;
  breakdown: ExplanationWord[];
  literalTranslation: string | null;
  sections: { body: string; examples: { text: string; translation: string }[]; type: "grammar" | "pitfall" | "register" }[];
  sentenceReading: string | null;
  translation: string;
};

export type Explanation = { structured?: StructuredExplanation; text?: string };

export type Sentence = {
  id: number;
  explanation?: string | null;
  explanationJobUrl?: string;
  structuredExplanation?: StructuredExplanation | null;
  alternativeAnswers: string[];
  collectionClozeSentencesAnswerUrl?: string;
  hint?: string | null;
  level: number | null;
  multipleChoiceOptions: string[] | null;
  nextReview: string | null;
  pronunciation?: string | null;
  text: string;
  translation: string;
};

export type Round = {
  collectionClozeSentences: Sentence[];
  wordBank: string[];
};

export type PlayMode = "flashcard" | "multiple_choice" | "text_input";

export type AnswerResult = {
  languagePairing: {
    currentStreakDays: number;
    dailyGoalPointsPerDay: number | null;
    level: number;
    numPointsToday: number;
    score: number;
  };
};

export type QuickCaptureEntry = {
  id: string;
  status: "queued" | "working" | "processed" | "failed";
  text: string;
  translation: string | null;
  url: string;
};

export type CliLoginStart = {
  deviceCode: string;
  expiresIn: number;
  pollInterval: number;
  userCode: string;
  verificationUrl: string;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type RequestOptions = {
  body?: object;
  method?: "DELETE" | "GET" | "POST" | "PUT";
  query?: Record<string, string>;
};

function headers(): Record<string, string> {
  const authToken = getAuthToken();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Time-Zone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    "Time-Zone-Offset-Hours": String(-new Date().getTimezoneOffset() / 60),
    ...(authToken ? { "Auth-Token": authToken } : {}),
    ...(process.env.CLOZEMASTER_COOKIE ? { Cookie: process.env.CLOZEMASTER_COOKIE } : {}),
  };
}

// The API hands back absolute URLs (playDataUrl etc.), so accept those as well as paths.
function toUrl(pathOrUrl: string, query?: Record<string, string>): string {
  const url = new URL(pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl}/api/v1${pathOrUrl}`);
  Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function request<T>(pathOrUrl: string, { body, method = "GET", query }: RequestOptions = {}): Promise<T> {
  const response = await fetch(toUrl(pathOrUrl, query), {
    body: body && JSON.stringify(body),
    headers: headers(),
    method,
  }).catch(() => {
    throw new ApiError(`Couldn't reach ${baseUrl}. Check your connection.`, 0);
  });
  if (response.status === 401) {
    throw new ApiError("You're not logged in. Run `clozemaster login`.", 401);
  }
  if (!response.ok) {
    throw new ApiError(`Clozemaster responded ${response.status}`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function startCliLogin(): Promise<CliLoginStart> {
  return request<CliLoginStart>("/cli_logins", { method: "POST" });
}

// Resolves to null while the browser hasn't approved yet.
export async function pollCliLogin(deviceCode: string): Promise<{ authToken: string; username: string } | null> {
  const login = await request<{ authToken?: string; username: string }>(`/cli_logins/${encodeURIComponent(deviceCode)}`);
  return login.authToken ? { authToken: login.authToken, username: login.username } : null;
}

// The pairings list has no URLs in it, unlike collections, so build the paths from the id.
export function languagePairingPlayPath(languagePairing: LanguagePairing): string {
  return `/lp/${languagePairing.id}/play`;
}

export async function getLanguagePairings(): Promise<LanguagePairing[]> {
  const { languagePairings } = await request<{ languagePairings: LanguagePairing[] }>("/lp", {
    query: { only_mine: "true" },
  });
  return languagePairings;
}

export async function getCollections(languagePairing: LanguagePairing): Promise<Collection[]> {
  const { collections } = await request<{ collections: Collection[] }>(`/lp/${languagePairing.id}/c`);
  return collections;
}

export async function getQuickCaptureEntries(languagePairing: LanguagePairing): Promise<QuickCaptureEntry[]> {
  const { quickCaptureEntries } = await request<{ quickCaptureEntries: QuickCaptureEntry[] }>(
    `/lp/${languagePairing.id}/quick_capture_entries`,
  );
  return quickCaptureEntries;
}

export async function addQuickCaptureEntry(languagePairing: LanguagePairing, text: string): Promise<QuickCaptureEntry> {
  const { quickCaptureEntry } = await request<{ quickCaptureEntry: QuickCaptureEntry }>(
    `/lp/${languagePairing.id}/quick_capture_entries`,
    { body: { quick_capture_entry: { text } }, method: "POST" },
  );
  return quickCaptureEntry;
}

export async function deleteQuickCaptureEntry(entry: QuickCaptureEntry): Promise<void> {
  await request<void>(entry.url, { method: "DELETE" });
}

export async function getRound({ mode, playDataUrl, scope }: { mode: PlayMode; playDataUrl: string; scope?: string }) {
  return request<Round>(playDataUrl, {
    query: { count: "10", mode, skill: "vocabulary", ...(scope ? { scope } : {}) },
  });
}

export async function saveAnswer({
  answerUrl,
  correct,
  mode,
  secondsSpent,
  sentence,
  usedHint,
}: {
  answerUrl: string;
  correct: boolean;
  mode: PlayMode;
  secondsSpent: number;
  sentence: Sentence;
  usedHint: boolean;
}): Promise<AnswerResult> {
  return request<AnswerResult>(answerUrl, {
    body: {
      correct,
      date: localDate(),
      id: sentence.id,
      // Flashcards score like multiple choice, and the apps send them that way.
      mode: mode === "flashcard" ? "multiple_choice" : mode,
      skill: "vocabulary",
      time: secondsSpent,
      used_hint: usedHint,
    },
    method: "PUT",
  });
}

type ExplanationJob = {
  tracker: { explanation: string | null; status: string | null; structuredExplanation: StructuredExplanation | null };
};

export class ExplanationLimitError extends Error {}

function explanationFrom(job: ExplanationJob): Explanation | undefined {
  const { explanation, status, structuredExplanation } = job.tracker;
  if (status === "failed") throw new Error("Couldn't explain this sentence. Try again later.");
  if (status !== "complete") return undefined;
  if (!structuredExplanation && !explanation) throw new Error("No explanation available.");
  return { structured: structuredExplanation || undefined, text: explanation || undefined };
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 75;

// Same flow as the mobile app: use what's there, otherwise ask for one and poll until it's written.
export async function getExplanation(sentence: Sentence): Promise<Explanation> {
  if (sentence.structuredExplanation || sentence.explanation) {
    return { structured: sentence.structuredExplanation || undefined, text: sentence.explanation || undefined };
  }
  if (!sentence.explanationJobUrl) throw new Error("No explanation available.");

  const existing = explanationFrom(await request<ExplanationJob>(sentence.explanationJobUrl));
  if (existing) return existing;

  try {
    await request<ExplanationJob>(sentence.explanationJobUrl, { method: "POST" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      throw new ExplanationLimitError("You've used all your explanations this month.");
    }
    throw error;
  }

  for (let poll = 0; poll < MAX_POLLS; poll++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const explanation = explanationFrom(await request<ExplanationJob>(sentence.explanationJobUrl));
    if (explanation) return explanation;
  }
  throw new Error("The explanation is taking too long. Try again later.");
}

function localDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
