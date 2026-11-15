import { md5 } from "@/lib/md5";

// The web reader shares reading positions through the same KOReader Sync
// endpoints Readest uses, so a book continues where the other app left it.

const ACCOUNT_KEY = "minerva.sync.account";

export type SyncAccount = { username: string; key: string; deviceId: string };
export type RemoteProgress = {
  progress?: string;
  percentage?: number;
  timestamp?: number;
  device_id?: string;
};

const headers = (account: SyncAccount) => ({
  "x-auth-user": account.username,
  "x-auth-key": account.key,
  accept: "application/vnd.koreader.v1+json",
});

export function loadAccount(): SyncAccount | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(ACCOUNT_KEY) ?? "null") as SyncAccount | null;
    return stored?.username && stored.key && stored.deviceId ? stored : null;
  } catch {
    return null;
  }
}

export function forgetAccount() {
  try {
    window.localStorage.removeItem(ACCOUNT_KEY);
  } catch {}
}

/** Checks the credentials with the server and remembers them in this browser. */
export async function signIn(username: string, password: string): Promise<SyncAccount> {
  // As in every KOSync client, the key is the MD5 of the password.
  const account = { username, key: md5(password), deviceId: crypto.randomUUID().replaceAll("-", "") };
  const response = await fetch("/users/auth", { headers: headers(account) }).catch(() => null);
  if (!response) throw new Error("Could not reach the server.");
  if (response.status === 401) throw new Error("Wrong username or password.");
  if (!response.ok) throw new Error("Sync is unavailable right now.");
  try {
    window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  } catch {}
  return account;
}

export async function pullProgress(account: SyncAccount, document: string, signal: AbortSignal) {
  const response = await fetch(`/syncs/progress/${document}`, { headers: headers(account), signal });
  if (!response.ok) return null;
  const remote = (await response.json()) as RemoteProgress;
  return remote.timestamp ? remote : null;
}

export function pushProgress(account: SyncAccount, document: string, cfi: string, percentage: number) {
  return fetch("/syncs/progress", {
    method: "PUT",
    // Lets the last position still go out while the tab is closing.
    keepalive: true,
    headers: { ...headers(account), "content-type": "application/json" },
    body: JSON.stringify({
      document,
      // Readest opens an EPUB CFI as-is, so no conversion to its XPointers is needed.
      progress: cfi,
      percentage,
      device: "Minerva web reader",
      device_id: account.deviceId,
    }),
  });
}

/** Readest reports positions as `/body/DocFragment[chapter]/body/div/p[3]/text().0`. */
export function xpointerSpineIndex(pointer: string) {
  const match = /^\/body\/DocFragment(?:\[(\d+)\])?\//.exec(pointer);
  return match ? Number(match[1] ?? 1) - 1 : null;
}

/**
 * The element such a pointer names inside its chapter. Each step is a tag,
 * counted among siblings with the same tag. Stops at the deepest step that
 * still exists, so a small markup difference costs precision, not the jump.
 */
export function resolveXPointer(document: Document, pointer: string): Element {
  const steps = pointer
    .replace(/^\/body\/DocFragment(?:\[\d+\])?\/body/, "")
    .replace(/\/text\(\).*$/, "")
    .replace(/\.\d+$/, "")
    .split("/")
    .filter(Boolean);
  let element: Element = document.body;
  for (const step of steps) {
    const match = /^([\w-]+)(?:\[(\d+)\])?$/.exec(step);
    if (!match) break;
    const sameTag = Array.from(element.children).filter(
      (child) => child.localName.toLowerCase() === match[1].toLowerCase(),
    );
    const next = sameTag[Number(match[2] ?? 1) - 1];
    if (!next) break;
    element = next;
  }
  return element;
}
