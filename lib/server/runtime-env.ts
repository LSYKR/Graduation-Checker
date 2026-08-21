export interface RuntimeBindings { DB?: D1Database; BUCKET?: R2Bucket; }
const ENV_KEY = Symbol.for("gradcompass.runtime.bindings"); type RuntimeGlobal = typeof globalThis & { [ENV_KEY]?: RuntimeBindings };
export function installRuntimeBindings(bindings: RuntimeBindings) { (globalThis as RuntimeGlobal)[ENV_KEY] = bindings; }
export function getRuntimeBindings(): RuntimeBindings { return (globalThis as RuntimeGlobal)[ENV_KEY] ?? {}; }
