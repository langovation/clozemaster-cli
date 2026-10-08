import { baseUrl, getAuthToken } from "./config.js";
import { currentVersion } from "./updateCheck.js";

export type LanguagePairing = {
  id: number;
  baseLanguageName: string;
  currentLevelPoints: number;
  currentStreakDays: number;
  currentWeekLeaderboardRank?: number;
  level: number;
  nextLevelPoints: number;
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
  url?: string;
};

export type Round = {
  collection?: { isEditable?: boolean };
  collectionClozeSentences: Sentence[];
  wordBank: string[];
};

export type PlayMode = "flashcard" | "listening" | "multiple_choice" | "text_input";

// Listening is the web's listening skill answered by typing. Flashcards go up as their own mode so the server counts them separately.
function apiModeAndSkill(mode: PlayMode) {
  if (mode === "listening") return { mode: "text_input", skill: "listening" };
  return { mode, skill: "vocabulary" };
}

export type LanguagePairingProgress = {
  currentStreakDays: number;
  dailyGoalPointsPerDay: number | null;
  level: number;
  numPointsToday: number;
  score: number;
};

export type AnswerResult = { languagePairing: LanguagePairingProgress };

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

export function isApiError(error: unknown, status: number): error is ApiError {
  return error instanceof ApiError && error.status === status;
}

const REQUEST_TIMEOUT_MS = 30_000;
const ROUND_SIZE = "10";
const KNOWN_LEVEL = 4;
const NEVER_DUE_DATE = "2100-01-01";

type RequestOptions = {
  body?: object;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  query?: Record<string, string>;
};

export type ClientName = "cli" | "mcp";

let clientName: ClientName = "cli";

export function identifyClientAs(name: ClientName) {
  clientName = name;
}

function requestHeaders(): Record<string, string> {
  const authToken = getAuthToken();
  const cookie = process.env.CLOZEMASTER_COOKIE;
  return {
    Accept: "application/json",
    "Clozemaster-Client": `${clientName}/${currentVersion}`,
    "Content-Type": "application/json",
    "Time-Zone": Intl.DateTimeFormat().resolvedOptions().timeZone,
    "Time-Zone-Offset-Hours": String(-new Date().getTimezoneOffset() / 60),
    ...(authToken ? { "Auth-Token": authToken } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

// The API hands back absolute URLs (playDataUrl etc.), so accept those as well as paths.
function toUrl(pathOrUrl: string, query?: Record<string, string>): string {
  const url = new URL(pathOrUrl.startsWith("http") ? pathOrUrl : `${baseUrl}/api/v1${pathOrUrl}`);
  Object.entries(query || {}).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function request<T>(pathOrUrl: string, { body, method = "GET", query }: RequestOptions = {}): Promise<T> {
  const response = await send(toUrl(pathOrUrl, query), { body: body && JSON.stringify(body), headers: requestHeaders(), method });
  if (response.status === 401) throw new ApiError("You're not logged in. Run `clozemaster login`.", 401);
  if (!response.ok) throw new ApiError(`Clozemaster responded ${response.status}`, response.status);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    if (isTimeout(error)) throw new ApiError(`${baseUrl} took too long to answer. Try again.`, 0);
    throw new ApiError(`Couldn't reach ${baseUrl}. Check your connection.`, 0);
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
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

export type CollectionSentence = {
  id: number;
  alternativeAnswers: string[];
  hint: string | null;
  notes: string | null;
  pronunciation: string | null;
  text: string;
  translation: string;
};

export type NewCollectionSentence = {
  alternativeAnswers?: string[];
  hint?: string;
  notes?: string;
  pronunciation?: string;
  text: string;
  translation: string;
};

export type CollectionSentencesPage = {
  collectionClozeSentences: CollectionSentence[];
  page: number;
  perPage: number;
  total: number;
};

function collectionSentencesPath(languagePairing: LanguagePairing, collection: OwnCollection): string {
  return `/lp/${languagePairing.id}/c/${collection.id}/ccs`;
}

export async function getCollectionSentences(
  languagePairing: LanguagePairing,
  { collection, page, perPage }: { collection: OwnCollection; page: number; perPage: number },
): Promise<CollectionSentencesPage> {
  return request<CollectionSentencesPage>(collectionSentencesPath(languagePairing, collection), {
    query: { page: String(page), per_page: String(perPage) },
  });
}

export async function getCollectionSentence(
  languagePairing: LanguagePairing,
  { collection, id }: { collection: OwnCollection; id: number },
): Promise<CollectionSentence> {
  const { collectionClozeSentence } = await request<{ collectionClozeSentence: CollectionSentence }>(
    `${collectionSentencesPath(languagePairing, collection)}/${id}`,
  );
  return collectionClozeSentence;
}

// The server answers 200 with { errors } when a sentence doesn't save, e.g. a duplicate.
export async function createCollectionSentence(
  languagePairing: LanguagePairing,
  { collection, sentence }: { collection: OwnCollection; sentence: NewCollectionSentence },
): Promise<CollectionSentence> {
  const { alternativeAnswers, ...fields } = sentence;
  const response = await request<{ collectionClozeSentence?: CollectionSentence; errors?: string }>(
    collectionSentencesPath(languagePairing, collection),
    {
      body: { collection_cloze_sentence: { ...fields, alternative_answers: alternativeAnswers?.join(",") } },
      method: "POST",
    },
  );
  if (!response.collectionClozeSentence) throw new Error(response.errors || "The sentence wasn't saved.");
  return response.collectionClozeSentence;
}

// Callers check the sentence exists first, so an update never saves a different sentence by mistake.
export async function updateCollectionSentence(
  languagePairing: LanguagePairing,
  { collection, id, text, translation }: { collection: OwnCollection; id: number; text: string; translation: string },
): Promise<void> {
  const response = await request<{ errors?: string }>(collectionSentencesPath(languagePairing, collection), {
    body: { updates: [{ id, text, translation }] },
    method: "POST",
  });
  if (response.errors) throw new Error(response.errors);
}

export async function deleteCollectionSentence(
  languagePairing: LanguagePairing,
  { collection, id }: { collection: OwnCollection; id: number },
): Promise<void> {
  await request(`${collectionSentencesPath(languagePairing, collection)}/${id}`, { method: "DELETE" });
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
export async function getRound({ mode, playDataUrl, scope }: { mode: PlayMode; playDataUrl: string; scope?: string }): Promise<Round> {
  try {
    return await request<Round>(playDataUrl, {
      query: { count: ROUND_SIZE, ...apiModeAndSkill(mode), ...(scope ? { scope } : {}) },
    });
  } catch (error) {
    if (mode === "listening" && isApiError(error, 400)) {
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
      date: localDateString(),
      id: sentence.id,
      ...apiModeAndSkill(mode),
      time: secondsSpent,
      used_hint: usedHint,
    },
    method: "PUT",
  });
}

// The server only changes the text in the user's own collections; elsewhere just their translation is kept.
export async function updateSentence({ sentence, upsertUrl }: { sentence: Sentence; upsertUrl: string }): Promise<void> {
  await request(upsertUrl, { body: { updates: [{ id: sentence.id, text: sentence.text, translation: sentence.translation }] }, method: "POST" });
}

export async function deleteSentence(sentence: Sentence): Promise<void> {
  if (!sentence.url) throw new Error("this sentence can't be deleted.");
  await request(sentence.url, { method: "DELETE" });
}

export async function markSentenceKnown({ sentence, upsertUrl }: { sentence: Sentence; upsertUrl: string }): Promise<void> {
  await request(upsertUrl, { body: { updates: [{ id: sentence.id, level: KNOWN_LEVEL, next_review: NEVER_DUE_DATE }] }, method: "POST" });
}

type ExplanationJob = {
  tracker: { explanation: string | null; status: string | null; structuredExplanation: StructuredExplanation | null };
};

export class ExplanationLimitError extends Error {}

const EXPLANATION_POLL_INTERVAL_MS = 2000;
const MAX_EXPLANATION_POLLS = 75;
const NO_EXPLANATION = "No explanation available.";
const explanationsInFlight = new Map<number, Promise<Explanation>>();

// Shared per sentence so closing and reopening the panel picks up the same request instead of asking for another.
export async function getExplanation(sentence: Sentence): Promise<Explanation> {
  if (sentence.structuredExplanation || sentence.explanation) return toExplanation(sentence.structuredExplanation, sentence.explanation);
  if (!explanationsInFlight.has(sentence.id)) {
    const explanation = fetchExplanation(sentence);
    explanationsInFlight.set(sentence.id, explanation);
    explanation.catch(() => explanationsInFlight.delete(sentence.id));
  }
  return explanationsInFlight.get(sentence.id)!;
}

async function fetchExplanation(sentence: Sentence): Promise<Explanation> {
  const jobUrl = sentence.explanationJobUrl;
  if (!jobUrl) throw new Error(NO_EXPLANATION);
  const written = await findWrittenExplanation(jobUrl);
  if (written) return written;
  await startExplanationJob(jobUrl);
  return pollForExplanation(jobUrl);
}

// Like the mobile app, a past failure just means asking again.
async function findWrittenExplanation(jobUrl: string): Promise<Explanation | undefined> {
  const job = await request<ExplanationJob>(jobUrl);
  return job.tracker.status === "failed" ? undefined : completedExplanation(job);
}

async function startExplanationJob(jobUrl: string): Promise<void> {
  try {
    await request<ExplanationJob>(jobUrl, { method: "POST" });
  } catch (error) {
    if (isApiError(error, 400)) throw new ExplanationLimitError("You've used all your explanations this month.");
    throw error;
  }
}

async function pollForExplanation(jobUrl: string): Promise<Explanation> {
  for (let poll = 0; poll < MAX_EXPLANATION_POLLS; poll++) {
    await new Promise((resolve) => setTimeout(resolve, EXPLANATION_POLL_INTERVAL_MS));
    const explanation = completedExplanation(await request<ExplanationJob>(jobUrl));
    if (explanation) return explanation;
  }
  throw new Error("The explanation is taking too long. Try again later.");
}

function completedExplanation({ tracker }: ExplanationJob): Explanation | undefined {
  if (tracker.status === "failed") throw new Error("Couldn't explain this sentence. Try again later.");
  if (tracker.status !== "complete") return undefined;
  if (!tracker.structuredExplanation && !tracker.explanation) throw new Error(NO_EXPLANATION);
  return toExplanation(tracker.structuredExplanation, tracker.explanation);
}

function toExplanation(structured: StructuredExplanation | null | undefined, text: string | null | undefined): Explanation {
  return { structured: structured || undefined, text: text || undefined };
}

function localDateString(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export async function getSentenceAudioUrl(sentence: Sentence): Promise<string | undefined> {
  if (sentence.ttsAudioUrl) return sentence.ttsAudioUrl;
  if (!sentence.ttsUrl) return undefined;
  const { ttsAudioUrl } = await request<{ ttsAudioUrl: string | null }>(sentence.ttsUrl);
  return ttsAudioUrl || undefined;
}
