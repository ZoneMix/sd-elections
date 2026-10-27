"use client";

/** Light/dark switch. The pre-paint script in layout.tsx applies the saved
 * choice; this flips it and saves it (storage may be unavailable). */
export function ThemeToggle() {
  const toggle = () => {
    const dark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
  };

  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label="Switch light or dark theme">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
        <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 3.75a8.25 8.25 0 0 1 0 16.5z" fill="currentColor" />
      </svg>
    </button>
  );
}
