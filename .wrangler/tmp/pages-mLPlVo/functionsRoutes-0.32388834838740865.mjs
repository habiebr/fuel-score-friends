import { onRequestGet as __fitness_ts_onRequestGet } from "/Users/habiebraharjo/fuel-score-friends/functions/fitness.ts"
import { onRequestOptions as __fitness_ts_onRequestOptions } from "/Users/habiebraharjo/fuel-score-friends/functions/fitness.ts"
import { onRequestPost as __fitness_ts_onRequestPost } from "/Users/habiebraharjo/fuel-score-friends/functions/fitness.ts"
import { onRequestGet as __timezone_ts_onRequestGet } from "/Users/habiebraharjo/fuel-score-friends/functions/timezone.ts"
import { onRequestOptions as __timezone_ts_onRequestOptions } from "/Users/habiebraharjo/fuel-score-friends/functions/timezone.ts"

export const routes = [
    {
      routePath: "/fitness",
      mountPath: "/",
      method: "GET",
      middlewares: [],
      modules: [__fitness_ts_onRequestGet],
    },
  {
      routePath: "/fitness",
      mountPath: "/",
      method: "OPTIONS",
      middlewares: [],
      modules: [__fitness_ts_onRequestOptions],
    },
  {
      routePath: "/fitness",
      mountPath: "/",
      method: "POST",
      middlewares: [],
      modules: [__fitness_ts_onRequestPost],
    },
  {
      routePath: "/timezone",
      mountPath: "/",
      method: "GET",
      middlewares: [],
      modules: [__timezone_ts_onRequestGet],
    },
  {
      routePath: "/timezone",
      mountPath: "/",
      method: "OPTIONS",
      middlewares: [],
      modules: [__timezone_ts_onRequestOptions],
    },
  ]