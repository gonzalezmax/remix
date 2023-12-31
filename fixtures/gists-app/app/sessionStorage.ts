import { createCookieSessionStorage } from "remix";

let { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: "__session",
    secrets: ["r3m1xr0ck5"],
  },
});

export { getSession, commitSession, destroySession };
