import { z } from "zod";

export const healthQuerySchema = z.object({
  test: z.string().min(3).optional(),
});
