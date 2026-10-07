import { baseUrl, getAuthToken } from "./config.js";

export type LanguagePairing = {
  id: number;
  baseLanguageName: string;
  currentStreakDays: number;
  currentWeekLeaderboardRank?: number;
  level: number;
  numPointsToday: number;
  score: number;
  targetLanguageName: string;
};

export type Collection = {
  id: number;
  collectionClozeSentencesAnswerUrl: string;
  collectionClozeSentencesUpsertUrl: string;
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
  collectionClozeSentencesUpsertUrl?: string;
  hint?: string | null;
  level: number | null;
  multipleChoiceOptions: string[] | null;
  nextReview: string | null;
  pronunciation?: string | null;
  text: string;
  translation: string;
  ttsAudioUrl?: string | null;
  ttsUrl?: string;
};

export type Round = {
  collection?: { isEditable?: boolean };
  collectionClozeSentences: Sentence[];
  wordBank: string[];
};

export type PlayMode = "flashcard" | "listening" | "multiple_choice" | "text_input";

// Listening is the web's listening skill played with text input: hear the sentence, then type the word.
export function isTypedMode(mode: PlayMode): boolean {
  return mode === "text_input" || mode === "listening";
}

function apiModeAndSkill(mode: PlayMode) {
  if (mode === "listening") return { mode: "text_input", skill: "listening" };
  // Flashcards score like multiple choice, and the apps send them that way.
  if (mode === "flashcard") return { mode: "multiple_choice", skill: "vocabulary" };
  return { mode, skill: "vocabulary" };
}

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
  sentence?: string | null;
  sentenceTranslation?: string | null;
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

export class ProRequiredError extends Error {
  readonly upgradeUrl: string;

  constructor(message: string, placement: string) {
    super(message);
    this.upgradeUrl = `${baseUrl}/pro?placement=cli_${placement}`;
  }
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type RequestOptions = {
  body?: object;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
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

export async function getLanguagePairing(languagePairing: LanguagePairing): Promise<LanguagePairing> {
  const response = await request<{ languagePairing: LanguagePairing }>(`/lp/${languagePairing.id}`);
  return response.languagePairing;
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

export async function updateQuickCaptureEntry(
  entry: QuickCaptureEntry,
  { sentence, sentenceTranslation }: { sentence: string; sentenceTranslation: string },
): Promise<QuickCaptureEntry> {
  const { quickCaptureEntry } = await request<{ quickCaptureEntry: QuickCaptureEntry }>(entry.url, {
    body: { quick_capture_entry: { sentence, sentence_translation: sentenceTranslation } },
    method: "PATCH",
  });
  return quickCaptureEntry;
}

export async function deleteQuickCaptureEntry(entry: QuickCaptureEntry): Promise<void> {
  await request<void>(entry.url, { method: "DELETE" });
}

export type OwnCollection = { id: number; name: string };

// The user's own collections, most recently updated first, like the mobile app's import picker.
export async function getOwnCollections(languagePairing: LanguagePairing): Promise<OwnCollection[]> {
  const { collections } = await request<{ collections: OwnCollection[] }>(`/lp/${languagePairing.id}/c`, {
    query: { filter: "mine", order: "updatedAt" },
  });
  return collections;
}

export async function createCollection(languagePairing: LanguagePairing, name: string): Promise<OwnCollection> {
  const { collection } = await request<{ collection: OwnCollection }>(`/lp/${languagePairing.id}/c`, {
    body: { collection: { name } },
    method: "POST",
  });
  return collection;
}

export async function isProSubscriber(): Promise<boolean> {
  const { user } = await request<{ user: { isPro: boolean | null } }>("/users/pro_subscriber");
  return Boolean(user.isPro);
}

// Starts a background import on the server; the entries leave the Quick Capture list once it starts.
export async function importQuickCaptureEntries(
  languagePairing: LanguagePairing,
  { collection, entries }: { collection: OwnCollection; entries: QuickCaptureEntry[] },
): Promise<void> {
  await request(`/lp/${languagePairing.id}/quick_capture_imports`, {
    body: { collection_id: collection.id, pin_to_dashboard: true, quick_capture_entry_ids: entries.map((entry) => entry.id) },
    method: "POST",
  });
}

// The web saves the mode and skill asked for as the user's play options, so only send ones it knows.
export async function getRound({ mode, playDataUrl, scope }: { mode: PlayMode; playDataUrl: string; scope?: string }) {
  try {
    return await request<Round>(playDataUrl, {
      query: { count: "10", ...apiModeAndSkill(mode), ...(scope ? { scope } : {}) },
    });
  } catch (error) {
    if (mode === "listening" && error instanceof ApiError && error.status === 400) {
      throw new ProRequiredError("Your free listening trial is used up. Listening needs Clozemaster Pro.", "listening");
    }
    throw error;
  }
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
      ...apiModeAndSkill(mode),
      time: secondsSpent,
      used_hint: usedHint,
    },
    method: "PUT",
  });
}

// The apps' "Known": fully mastered and never reviewed again.
// The server only changes the text in the user's own collections; elsewhere just their translation is kept.
export async function updateSentence({ sentence, upsertUrl }: { sentence: Sentence; upsertUrl: string }): Promise<void> {
  await request(upsertUrl, { body: { updates: [{ id: sentence.id, text: sentence.text, translation: sentence.translation }] }, method: "POST" });
}

export async function markSentenceKnown({ sentence, upsertUrl }: { sentence: Sentence; upsertUrl: string }): Promise<void> {
  await request(upsertUrl, { body: { updates: [{ id: sentence.id, level: 4, next_review: "2100-01-01" }] }, method: "POST" });
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
const explanationsInFlight = new Map<number, Promise<Explanation>>();

// Shared per sentence so closing and reopening the panel picks up the same request instead of asking for another.
export async function getExplanation(sentence: Sentence): Promise<Explanation> {
  if (sentence.structuredExplanation || sentence.explanation) {
    return { structured: sentence.structuredExplanation || undefined, text: sentence.explanation || undefined };
  }
  if (!explanationsInFlight.has(sentence.id)) {
    const explanation = fetchExplanation(sentence);
    explanationsInFlight.set(sentence.id, explanation);
    explanation.catch(() => explanationsInFlight.delete(sentence.id));
  }
  return explanationsInFlight.get(sentence.id)!;
}

// Same flow as the mobile app: use what's there, otherwise ask for one and poll until it's written.
async function fetchExplanation(sentence: Sentence): Promise<Explanation> {
  if (!sentence.explanationJobUrl) throw new Error("No explanation available.");

  // Like the mobile app, a past failure just means asking again.
  const { tracker } = await request<ExplanationJob>(sentence.explanationJobUrl);
  const existing = tracker.status === "failed" ? undefined : explanationFrom({ tracker });
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

// Same as the mobile app: use the recorded audio, otherwise ask the server to generate it.
export async function getSentenceAudioUrl(sentence: Sentence): Promise<string | undefined> {
  if (sentence.ttsAudioUrl) return sentence.ttsAudioUrl;
  if (!sentence.ttsUrl) return undefined;
  const { ttsAudioUrl } = await request<{ ttsAudioUrl: string | null }>(sentence.ttsUrl);
  return ttsAudioUrl || undefined;
}
