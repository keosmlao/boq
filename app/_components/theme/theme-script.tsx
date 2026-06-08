/**
 * Inline script that sets [data-theme] on <html> before React hydrates,
 * preventing a flash of incorrect theme (FOUC). Mirrors ThemeProvider's
 * storage key + system-preference fallback.
 */
const SCRIPT = `(function(){try{var k='odg-theme';var p=localStorage.getItem(k);if(p!=='light'&&p!=='dark'&&p!=='system')p='system';var t=p==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
