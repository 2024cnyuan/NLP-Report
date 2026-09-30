// PostCSS sees CSS @imports too; a Vite JS transform does not see imported
// vendor styles. Keep original WOFF2 bytes, drop redundant WOFF/TTF fallbacks.
// This runs in development and production without editing vendor files.
export const localFontPostCSS = {
  postcssPlugin: 'tensorscope-local-woff2',
  Declaration: {
    src(declaration) {
      if (declaration.parent.type !== 'atrule' || declaration.parent.name !== 'font-face') return;
      const preferred = declaration.value.match(/url\([^)]*\)\s*format\(["']woff2["']\)/);
      if (preferred) declaration.value = preferred[0];
    },
  },
};
