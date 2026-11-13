import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { pool } from "./db.js";

const pbkdf2Async = promisify(pbkdf2);
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export class AuthError extends Error {}
const normalize = (username) => String(username).trim().toLowerCase();

async function hashPassword(password, salt = randomBytes(16)) {
  const hash = await pbkdf2Async(password, salt, 100_000, 32, "sha256");
  return `${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [saltHex] = stored.split("$");
  const candidate = await hashPassword(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(stored));
}

export async function register(rawUsername, password) {
  const username = normalize(rawUsername);
  password = String(password);
  if (!USERNAME_RE.test(username)) throw new AuthError("Username must be 3-20 characters: letters, digits or underscore");
  if (password.length < 8) throw new AuthError("Password must be at least 8 characters");
  if (!/\d/.test(password)) throw new AuthError("Password must contain at least one digit");
  try {
    await pool.query("INSERT INTO users (username, password_hash) VALUES ($1, $2)", [username, await hashPassword(password)]);
  } catch (err) {
    if (err.code === "23505") throw new AuthError("Username already taken");
    throw err;
  }
  return username;
}

export async function login(rawUsername, password) {
  const username = normalize(rawUsername);
  const { rows } = await pool.query("SELECT password_hash FROM users WHERE username = $1", [username]);
  if (!rows.length) return null;
  return (await verifyPassword(String(password), rows[0].password_hash)) ? username : null;
}
