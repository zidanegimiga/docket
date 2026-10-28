import { z } from "zod";

export const userIdParamsSchema = z.object({ id: z.uuid() });

export type UserIdParams = z.output<typeof userIdParamsSchema>;
