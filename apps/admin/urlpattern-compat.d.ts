import type {
  URLPatternInit as NodeURLPatternInit,
  URLPatternOptions as NodeURLPatternOptions
} from "node:url";

// Next.js references these URLPattern types globally; Node 24 exposes them from node:url.
declare global {
  type URLPatternInput = string | NodeURLPatternInit;
  type URLPatternOptions = NodeURLPatternOptions;
}

export {};
