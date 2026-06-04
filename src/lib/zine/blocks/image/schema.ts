import { z } from 'zod';
import { SafeUrlSchema } from '../../schema/url';

// `alt` is a plain string (it MAY be empty in a draft). Emptiness is caught by the
// publish gate (requiredForPublish), not the schema — so a student can drop an image
// in and keep working, but cannot PUBLISH without describing it. (assetId → URL
// resolution via Supabase Storage arrives with the media pipeline in Step 5; for now
// `src` is a direct, scheme-checked URL.)
export const ImagePropsSchema = z.object({
	src: SafeUrlSchema,
	alt: z.string(),
	caption: z.string().optional(),
	width: z.number().int().positive().optional(),
	height: z.number().int().positive().optional()
});

export type ImageProps = z.infer<typeof ImagePropsSchema>;
