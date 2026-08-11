type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  openInvoice?: (url: string, callback?: (status: string) => void) => void;
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

export function openInvoice(url: string) {
  const webApp = window.Telegram?.WebApp;
  if (webApp?.openInvoice) {
    webApp.openInvoice(url);
    return;
  }
  window.location.href = url;
}
