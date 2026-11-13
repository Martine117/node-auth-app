// nginx forwards these same-origin requests to the private Express service.
export class ApiError extends Error {}

async function post(path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Server unavailable, please try again");
  }
  if (res.status >= 500) throw new ApiError("Server unavailable, please try again");
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function register(username, password) {
  const res = await post("/register", { username, password });
  if (!res.ok) throw new ApiError(res.data.error ?? "Registration failed");
  return res.data.username;
}

export async function login(username, password) {
  const res = await post("/login", { username, password });
  if (res.ok) return res.data.username;
  if (res.status === 401) return null;
  throw new ApiError(res.data.error ?? "Login failed");
}
