import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CrowdBadge from "../components/CrowdBadge";
import { fmtDistance, fmtEta, parseUtc } from "../lib/format";
import { routeColor } from "../lib/colors";
import Login from "../pages/Login";
import { AuthProvider } from "../lib/auth";

describe("format helpers", () => {
  it("formats ETAs and distances", () => {
    expect(fmtEta(0.4)).toBe("Due");
    expect(fmtEta(4.6)).toBe("5 min");
    expect(fmtDistance(420)).toBe("420 m");
    expect(fmtDistance(1530)).toBe("1.5 km");
  });

  it("treats naive API timestamps as UTC", () => {
    expect(parseUtc("2026-10-25T12:00:00").toISOString()).toBe("2026-10-25T12:00:00.000Z");
    expect(parseUtc("2026-10-25T12:00:00Z").toISOString()).toBe("2026-10-25T12:00:00.000Z");
  });
});

describe("route colours", () => {
  it("keeps a fixed colour per route and never cycles before 8", () => {
    expect(routeColor(1)).toBe(routeColor(1));
    expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map((r) => routeColor(r))).size).toBe(8);
  });
});

describe("CrowdBadge", () => {
  it("shows the level as text, not only colour", () => {
    render(<CrowdBadge level="HIGH" />);
    expect(screen.getByText("Crowd: High")).toBeInTheDocument();
  });
  it("renders nothing without a level", () => {
    const { container } = render(<CrowdBadge level={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Login page", () => {
  it("has labelled email and password fields", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("Login shortcuts", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows Skip sign-in and demo accounts when the server enables them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ enabled: true, guest: true }), { status: 200, headers: { "Content-Type": "application/json" } })));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AuthProvider>
            <Login />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("button", { name: /Skip sign-in/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Demo admin/ })).toBeInTheDocument();
  });
});
