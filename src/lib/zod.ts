import {z} from "zod"

// A strict CSP has no 'unsafe-eval', so zod's JIT probe (`new Function`) would be reported as a
// violation even though zod catches it; jitless skips the probe. Import `z` from here, never from "zod".
z.config({jitless: true})

export {z}
