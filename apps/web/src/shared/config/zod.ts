import { z } from "zod";

// Zod probes `new Function` to decide whether it can compile fast parsers. Under a CSP without
// 'unsafe-eval' that probe is reported as a violation even though Zod catches the error.
z.config({ jitless: true });
