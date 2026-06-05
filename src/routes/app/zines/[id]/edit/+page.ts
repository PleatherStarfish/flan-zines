// The editor is a stateful client app; render it client-side only. The server load
// (+page.server.ts) still runs to fetch the RLS-scoped draft.
export const ssr = false;
