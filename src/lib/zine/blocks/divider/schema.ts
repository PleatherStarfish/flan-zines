import { z } from 'zod';

// A thematic break. No props today; the object schema leaves room to add a style
// variant later without a schema-version bump (extra keys are ignored).
export const DividerPropsSchema = z.object({});

export type DividerProps = z.infer<typeof DividerPropsSchema>;
