export const AUTHENTICATED_ENTRY_PATH = "/app";

export function isSafeAppPath(path: string | undefined): path is string {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

export function getAuthRedirectDestination(next: string | undefined): string {
  if (isSafeAppPath(next) && next.startsWith("/checkout/return")) return next;
  return AUTHENTICATED_ENTRY_PATH;
}