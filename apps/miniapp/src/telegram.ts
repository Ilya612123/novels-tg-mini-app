type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  openInvoice?: (url: string, callback?: (status: string) => void) => void;
  openTelegramLink?: (url: string) => void;
};

export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function initTelegramApp() {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready?.();
  webApp?.expand?.();
  return webApp;
}

export function getTelegramInitData(): string {
  return window.Telegram?.WebApp?.initData ?? "";
}

export function getTelegramUser(): TelegramUser | null {
  const userRaw = new URLSearchParams(getTelegramInitData()).get("user");
  if (!userRaw) return null;

  try {
    const user = JSON.parse(userRaw) as unknown;
    if (!user || typeof user !== "object" || !("id" in user) || typeof user.id !== "number") return null;
    return user as TelegramUser;
  } catch {
    return null;
  }
}

export function openInvoice(url: string, callback?: (status: string) => void) {
  const webApp = window.Telegram?.WebApp;
  if (webApp?.openInvoice) {
    webApp.openInvoice(url, callback);
    return;
  }
  window.location.href = url;
}

export function openTelegramLink(url: string) {
  const webApp = window.Telegram?.WebApp;
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
    return;
  }
  window.location.href = url;
}
