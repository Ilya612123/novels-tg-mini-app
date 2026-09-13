import { Check, Pencil, Trash2, UsersRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { AccessStatusDto, BookSummary } from "@novell-reader/shared";

const PROFILE_NICKNAME_STORAGE_KEY = "novell-reader.profile.nickname";
const PROFILE_AVATAR_STORAGE_KEY = "novell-reader.profile.avatar";
const AVATAR_MAX_BYTES = 1_500_000;
const CHAPTERS_PER_LEVEL = 5;

type ReaderLevel = {
  level: number;
  chaptersRead: number;
  currentLevelProgress: number;
  chaptersToNextLevel: number;
};

function readLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string | null) {
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Local profile data is optional; quota or privacy-mode failures should not break the app.
  }
}

function getDefaultDisplayName(userName: string | null): string {
  return userName?.trim() || "Читатель";
}

export function calculateReaderLevel(books: BookSummary[]): ReaderLevel {
  const chaptersRead = books.reduce((sum, book) => {
    if (!book.progress) return sum;
    const progressInBook = Math.max(0, book.progress.chapterNumber - 1) + (book.progress.percent ?? 0) / 100;
    return sum + Math.min(book.chapterCount, progressInBook);
  }, 0);
  const level = Math.floor(chaptersRead / CHAPTERS_PER_LEVEL) + 1;
  const currentLevelChapters = chaptersRead % CHAPTERS_PER_LEVEL;
  return {
    level,
    chaptersRead,
    currentLevelProgress: Math.round((currentLevelChapters / CHAPTERS_PER_LEVEL) * 100),
    chaptersToNextLevel: Math.max(0, CHAPTERS_PER_LEVEL - currentLevelChapters)
  };
}

export function ProfileScreen({
  accessStatus,
  books,
  defaultUserName,
  paymentStatusMessage,
  onOpenPaywall,
  onOpenSupport,
  onOpenCommunity
}: {
  accessStatus: AccessStatusDto | null;
  books: BookSummary[];
  defaultUserName: string | null;
  paymentStatusMessage?: string | null;
  onOpenPaywall: () => void;
  onOpenSupport: () => void;
  onOpenCommunity: () => void;
}) {
  const [nickname, setNickname] = useState(() => readLocalStorage(PROFILE_NICKNAME_STORAGE_KEY) ?? getDefaultDisplayName(defaultUserName));
  const [draftNickname, setDraftNickname] = useState(nickname);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState(() => readLocalStorage(PROFILE_AVATAR_STORAGE_KEY));
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const subscriptionDate = accessStatus?.subscriptionUntil
    ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(accessStatus.subscriptionUntil))
    : null;
  const readerLevel = useMemo(() => calculateReaderLevel(books), [books]);
  const initials = nickname.trim().slice(0, 2).toLocaleUpperCase("ru");

  useEffect(() => {
    const storedNickname = readLocalStorage(PROFILE_NICKNAME_STORAGE_KEY);
    if (storedNickname) return;
    const defaultName = getDefaultDisplayName(defaultUserName);
    setNickname(defaultName);
    setDraftNickname(defaultName);
  }, [defaultUserName]);

  const saveNickname = (event: FormEvent) => {
    event.preventDefault();
    const normalizedNickname = draftNickname.trim() || getDefaultDisplayName(defaultUserName);
    setNickname(normalizedNickname);
    setDraftNickname(normalizedNickname);
    writeLocalStorage(PROFILE_NICKNAME_STORAGE_KEY, normalizedNickname);
    setIsEditingNickname(false);
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Выберите изображение.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError("Фото слишком большое.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setAvatarDataUrl(reader.result);
      writeLocalStorage(PROFILE_AVATAR_STORAGE_KEY, reader.result);
      setAvatarError(null);
    };
    reader.onerror = () => setAvatarError("Не удалось открыть фото.");
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatarDataUrl(null);
    setAvatarError(null);
    writeLocalStorage(PROFILE_AVATAR_STORAGE_KEY, null);
  };

  return (
    <main className="screen">
      <header className="screen-header">
        <h1>Профиль</h1>
      </header>
      <section className="profile-section profile-user-section" aria-label="Пользователь">
        <div className="profile-avatar-wrap">
          <button className="profile-avatar-button" onClick={() => avatarInputRef.current?.click()} type="button" aria-label="Изменить фото">
            {avatarDataUrl ? <img src={avatarDataUrl} alt="" /> : <span>{initials}</span>}
          </button>
          <input ref={avatarInputRef} className="profile-avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} />
          {avatarDataUrl && (
            <button className="icon-button profile-avatar-remove" onClick={removeAvatar} type="button" aria-label="Удалить фото">
              <Trash2 size={18} />
            </button>
          )}
        </div>
        <div className="profile-user-info">
          {isEditingNickname ? (
            <form className="profile-nickname-form" onSubmit={saveNickname}>
              <input
                className="profile-nickname-input"
                maxLength={24}
                onChange={(event) => setDraftNickname(event.target.value)}
                value={draftNickname}
                aria-label="Ник"
              />
              <button className="icon-button profile-nickname-save" type="submit" aria-label="Сохранить ник">
                <Check size={18} />
              </button>
            </form>
          ) : (
            <div className="profile-nickname-row">
              <h2>{nickname}</h2>
              <button className="icon-button profile-nickname-edit" onClick={() => setIsEditingNickname(true)} type="button" aria-label="Изменить ник">
                <Pencil size={18} />
              </button>
            </div>
          )}
          <div className="profile-level">
            <div className="profile-level-header">
              <span>Уровень {readerLevel.level}</span>
              <span>{Math.floor(readerLevel.chaptersRead)} гл.</span>
            </div>
            <div className="profile-level-bar" aria-label={`Прогресс уровня ${readerLevel.currentLevelProgress}%`}>
              <span style={{ width: `${readerLevel.currentLevelProgress}%` }} />
            </div>
            <p>До следующего уровня {Math.ceil(readerLevel.chaptersToNextLevel)} гл.</p>
          </div>
          {avatarError && <p className="profile-avatar-error">{avatarError}</p>}
        </div>
      </section>
      <section className="profile-section profile-community-section" aria-label="Сообщество">
        <button className="text-button profile-community-button" onClick={onOpenCommunity} type="button">
          <UsersRound size={18} />
          <span>Сообщество</span>
        </button>
      </section>
      <section className="profile-section">
        <h2>Откройте все главы любимых тайтлов</h2>
        {paymentStatusMessage && <p className="profile-payment-status">{paymentStatusMessage}</p>}
        {accessStatus?.active && subscriptionDate ? (
          <p className="profile-access-status">Подписка активна до {subscriptionDate}</p>
        ) : (
          <div className="profile-subscription-benefits">
            <p>Подписка открывает продолжение без ограничений.</p>
            <ul>
              <li>Все платные главы во всех новеллах</li>
              <li>Доступ на 30 дней сразу после оплаты</li>
              <li>Чтение без ожидания новых бесплатных глав</li>
            </ul>
          </div>
        )}
        {!accessStatus?.active && (
          <button className="primary-button profile-subscription-button" onClick={onOpenPaywall} type="button">
            Купить подписку
          </button>
        )}
        <button className="text-button profile-support-button" onClick={onOpenSupport} type="button">
          Поддержка
        </button>
      </section>
    </main>
  );
}
