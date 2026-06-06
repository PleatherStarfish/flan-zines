// @fontsource packages are side-effect CSS imports with no JS exports or bundled types.
// Declaring them lets TypeScript resolve the lazy `import('@fontsource-variable/…')` calls
// in font-loader.ts.
declare module '@fontsource/*';
declare module '@fontsource-variable/*';
