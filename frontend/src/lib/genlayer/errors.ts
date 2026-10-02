export function normalizePitchError(reason: unknown, fallback?: string) {
  const detail = reason instanceof Error ? reason.message : String(reason);
  const normalized = detail.toLowerCase();

  if (!normalized || normalized === "undefined" || normalized === "null") {
    return fallback ?? "PITCH could not complete that request. Check the current contract state.";
  }
  if (/user rejected|user denied|user cancel|rejected by (?:the )?user|\b4001\b/.test(normalized)) {
    return "You cancelled the wallet request.";
  }
  if (
    /wrong network|wrong chain|chain mismatch|unsupported chain|unknown chain|\b4902\b|chain id/.test(
      normalized,
    )
  ) {
    return "Switch your wallet to Studio Next to continue.";
  }
  if (/entry bond.*(?:equal|exact).*1\s*gen|bond.*must.*1\s*gen/.test(normalized)) {
    return "The entry bond must be exactly 1 GEN.";
  }
  if (/commit phase.*closed|no longer accepting entries|competition.*closed/.test(normalized)) {
    return "This competition is no longer accepting entries.";
  }
  if (/submission.*already.*revealed|already revealed/.test(normalized)) {
    return "This submission has already been revealed.";
  }
  if (/commitment mismatch|does not match.*original submission|hash mismatch/.test(normalized)) {
    return "The reveal data does not match the original submission. Use the correct reveal backup.";
  }
  if (
    /evaluation starts after reveal deadline|evaluation.*before.*reveal|reveal deadline.*evaluation/.test(
      normalized,
    )
  ) {
    return "Evaluation is not available until the reveal window has ended.";
  }
  if (/nothing claimable|nothing.*available.*claim/.test(normalized)) {
    return "There is nothing available to claim yet.";
  }
  if (
    /agent owner or operator|owner or registered operator|only.*owner.*operator|not authorized.*agent/.test(
      normalized,
    )
  ) {
    return "Only this agent's owner or registered operator can perform this action.";
  }
  if (/creator only|only creator|pitch creator/.test(normalized)) {
    return "Only the pitch creator can perform this action.";
  }
  if (
    /pitch.*already.*(?:terminal|finalized|settled|cancelled|refunded)|already terminal/.test(
      normalized,
    )
  ) {
    return "This pitch has already been finalized.";
  }
  if (/already entered|already submitted|duplicate.*entry/.test(normalized)) {
    return "This agent has already entered this competition.";
  }
  if (/inactive agent|agent.*not active/.test(normalized)) {
    return "This agent is inactive and cannot enter competitions.";
  }
  if (/evidence.*(?:cors|browser|content.lock|fetch|unavailable)|cors/.test(normalized)) {
    return "We couldn't fetch this evidence URL from your browser. Check that the URL is public, HTTPS, and allows browser access.";
  }
  if (
    /evidence.*(?:http\s*\d+|status)|evidence.*(?:https|whitespace|credentials|fragments)/.test(
      normalized,
    )
  ) {
    return "Evidence URLs must be public HTTPS URLs that return a successful response.";
  }
  if (/(?:evidence|response|body).*(?:4096|4,096|too large|larger than)/.test(normalized)) {
    return "This evidence response is too large. PITCH supports up to 4,096 bytes per evidence item.";
  }
  if (/evidence.*(?:empty|no readable body|valid utf.8)/.test(normalized)) {
    return "This evidence URL did not return usable text content.";
  }
  if (
    /finished_with_error|execution.*(?:error|failed)|failed to execute|execution reverted/.test(
      normalized,
    )
  ) {
    return "Transaction failed during execution.";
  }
  if (
    /insufficient funds|insufficient balance|not enough (?:gen|funds)|fee.*(?:balance|funds)/.test(
      normalized,
    )
  ) {
    return "Your wallet does not have enough GEN to cover this transaction.";
  }
  if (
    /fee estimate|failed to estimate|gas estimate|estimate.*fee|external.message fee/.test(
      normalized,
    )
  ) {
    return "PITCH could not prepare the network fee estimate. Try again shortly.";
  }
  if (
    /failed to fetch|fetch failed|network error|connection error|transport|rpc|unavailable/.test(
      normalized,
    )
  ) {
    return "PITCH could not reach Studio Next. Check your connection and try again.";
  }
  if (/backup.*(?:different|incomplete|invalid|json)|invalid json/.test(normalized)) {
    return "We couldn't import this reveal backup. Choose the original PITCH backup JSON.";
  }

  return fallback ?? "PITCH could not complete that request. Check the current contract state.";
}
