import { z } from "zod";

export const roleIdParamsSchema = z.object({ id: z.uuid() });

export type RoleIdParams = z.output<typeof roleIdParamsSchema>;
