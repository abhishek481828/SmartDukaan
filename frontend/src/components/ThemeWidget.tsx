"use client";

import { useTheme, Accent } from "./ThemeContext";

export function ThemeWidget() {
  const { theme, setTheme, accent, setAccent, mounted } = useTheme();

  if (!mounted) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-[var(--bg-color)] p-2 rounded-full shadow-[inset_4px_4px_8px_var(--clay-inset-shadow),inset_-4px_-4px_8px_var(--clay-inset-high)] border border-[var(--clay-highlight-soft)] transition-colors duration-400">
      
      {/* Theme Toggle */}
      <button 
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--accent)] hover:scale-105 active:scale-95 transition-transform bg-[var(--bg-color)] shadow-[4px_4px_8px_var(--clay-shadow),-4px_-4px_8px_var(--clay-highlight)]"
        aria-label="Toggle Theme"
      >
        {theme === 'light' ? (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        ) : (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        )}
      </button>

      {/* Accent Toggles */}
      <div className="flex gap-1 ml-1 pl-2 border-l border-[var(--clay-inset-shadow)]">
        {(['orange', 'teal', 'blue'] as Accent[]).map((a) => (
          <button
            key={a}
            onClick={() => setAccent(a)}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${accent === a ? 'scale-110 border-[var(--accent)]' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-110'}`}
            style={{ 
              backgroundColor: 
                a === 'orange' ? '#f97316' : 
                a === 'teal' ? '#14b8a6' : 
                a === 'blue' ? '#3b82f6' : 'transparent',
              boxShadow: accent === a ? '0 0 10px var(--accent-shadow-high)' : 'none'
            }}
            aria-label={`Set Accent to ${a}`}
          />
        ))}
      </div>
    </div>
  );
}

