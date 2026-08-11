import { BookOpen, UserRound } from "lucide-react";

export type Tab = "catalog" | "profile";

export function BottomNav({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      <button className={activeTab === "catalog" ? "active" : ""} onClick={() => onChange("catalog")} type="button">
        <BookOpen size={20} />
        <span>Книги</span>
      </button>
      <button className={activeTab === "profile" ? "active" : ""} onClick={() => onChange("profile")} type="button">
        <UserRound size={20} />
        <span>Профиль</span>
      </button>
    </nav>
  );
}
