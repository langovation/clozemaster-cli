import { baseUrl, getAuthToken } from "./config.js";

export type LanguagePairing = {
  id: number;
  baseLanguageName: string;
  collectionsUrl: string;
  currentStreakDays: number;
  level: number;
  numPointsToday: number;
  playDataUrl: string;
  score: number;
  targetLanguageName: string;
};

export type Collection = {
  id: number;
  collectionClozeSentencesAnswerUrl: string;
  name: string;
  numMastered: number;
  numPlaying: number;
  numReadyForReview: number;
  numSentences: number;
  playDataUrl: string;
  playing: boolean;
  proOnly: boolean;
};

export type Sentence = {
  id: number;
  alternativeAnswers: string[];
  collectionClozeSentencesAnswerUrl?: string;
  level: number | null;
  multipleChoiceOptions: string[] | null;
  nextReview: string | null;
  text: string;
  translation: string;
};

export type Round = {
  collectionClozeSentences: Sentence[];
  wordBank: string[];
};

export type PlayMode = "multiple_choice" | "text_input";

export type AnswerResult = {
  languagePairing: { numPointsToday: number; score: number };
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
  method?: "GET" | "POST" | "PUT";
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

export async function getLanguagePairings(): Promise<LanguagePairing[]> {
  const { languagePairings } = await request<{ languagePairings: LanguagePairing[] }>("/lp", {
    query: { only_mine: "true" },
  });
  return languagePairings;
}

export async function getCollections(languagePairing: LanguagePairing): Promise<Collection[]> {
  const { collections } = await request<{ collections: Collection[] }>(languagePairing.collectionsUrl);
  return collections;
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
}: {
  answerUrl: string;
  correct: boolean;
  mode: PlayMode;
  secondsSpent: number;
  sentence: Sentence;
}): Promise<AnswerResult> {
  return request<AnswerResult>(answerUrl, {
    body: {
      correct,
      date: localDate(),
      id: sentence.id,
      mode,
      skill: "vocabulary",
      time: secondsSpent,
      used_hint: false,
    },
    method: "PUT",
  });
}

function localDate(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
