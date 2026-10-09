import { httpError } from "../crud.js";
import { masterData } from "./masterData.js";
import { auth } from "./auth.js";
import { permission } from "./permission.js";
import { people } from "./people.js";
import { projects } from "./projects.js";
import { records } from "./records.js";
import { documents } from "./documents.js";
import { finance } from "./finance.js";
import { notifications } from "./notifications.js";

/* Entity registry. Entity names are case-sensitive and must match the
   strings the frontend sends (same rule the old flow's Switch had).
   Later steps add their entities here. */
export const registry = {
  ...masterData,
  ...people,
  ...projects,
  ...records,
  ...documents,
  ...finance,
  ...notifications,
  Auth: auth,
  Permission: permission,
};

const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export async function dispatch(body) {
  const entity = body?.entity;
  let action = String(body?.action || "").toUpperCase();

  // own-property checks only: a request must never reach inherited JS members
  // such as "constructor" or "__proto__".
  if (typeof entity !== "string" || !own(registry, entity)) {
    throw httpError(501, `Entity '${entity}' is not implemented in the API yet.`);
  }
  const handler = registry[entity];
  // Some calls carry no action at all (fetching one document's file): use the entity's DEFAULT.
  if (!action && own(handler, "DEFAULT")) action = "DEFAULT";
  if (!own(handler, action) || typeof handler[action] !== "function") {
    throw httpError(400, `Action '${action}' is not supported for ${entity}.`);
  }
  return handler[action]({ ...body, action });
}
