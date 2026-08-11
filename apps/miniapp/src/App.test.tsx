import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders catalog navigation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/api/books")) {
          return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      })
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText("Книги")).toBeTruthy());
    expect(screen.getByText("Профиль")).toBeTruthy();
  });
});
