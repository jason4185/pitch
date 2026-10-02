export const MAX_EVIDENCE_ITEMS = 5;
export const MAX_EVIDENCE_URL_LENGTH = 500;
export const MAX_FETCHED_EVIDENCE_BYTES = 4096;

export type PreparedEvidence = {
  url: string;
  sha256: string;
  size: number;
};

function invalidEvidence(message: string): Error {
  return new Error(message);
}

function validateUrl(value: string) {
  if (!value || value.length > MAX_EVIDENCE_URL_LENGTH || value !== value.trim()) {
    throw invalidEvidence("Enter a valid HTTPS evidence URL.");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw invalidEvidence("Enter a valid HTTPS evidence URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    throw invalidEvidence(
      "Evidence URLs must use HTTPS and cannot contain credentials or fragments.",
    );
  }
  if (/\s/.test(value)) throw invalidEvidence("Evidence URLs cannot contain whitespace.");
  return parsed.toString();
}

async function readBoundedBytes(response: Response) {
  if (!response.body) throw invalidEvidence("The evidence response had no readable body.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_FETCHED_EVIDENCE_BYTES) {
        await reader.cancel();
        throw invalidEvidence("Evidence responses must be 4,096 bytes or smaller.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) throw invalidEvidence("Evidence responses must not be empty.");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function prepareEvidence(urls: string[]): Promise<PreparedEvidence[]> {
  const cleaned = urls.map(validateUrl).filter(Boolean);
  if (cleaned.length > MAX_EVIDENCE_ITEMS) {
    throw invalidEvidence("A submission can include at most five evidence URLs.");
  }
  const prepared: PreparedEvidence[] = [];
  for (const url of cleaned) {
    let response: Response;
    try {
      response = await fetch(url, { cache: "no-store", credentials: "omit" });
    } catch {
      throw invalidEvidence(
        "This evidence URL could not be content-locked from the browser. Check CORS, network access, and the URL, then try again.",
      );
    }
    if (!response.ok || response.status < 200 || response.status >= 300) {
      throw invalidEvidence(`The evidence URL returned HTTP ${response.status}.`);
    }
    const bytes = await readBoundedBytes(response);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw invalidEvidence("Evidence responses must contain valid UTF-8 text.");
    }
    prepared.push({ url, sha256, size: bytes.byteLength });
  }
  return prepared;
}

export function buildEvidenceBlob(items: PreparedEvidence[]) {
  return items.map((item) => `${item.sha256} ${item.url}`).join("\n");
}
