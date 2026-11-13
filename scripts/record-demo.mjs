import { chromium, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve('../../recordings');
await mkdir(output, { recursive: true });
const commands = [
  ['Docker image sizes', ['image', 'ls', 'node-auth-app']],
  ['Three Compose services', ['compose', 'ps']],
  ['PostgreSQL named volume', ['inspect', 'node-auth-app-db-1', '--format', '{{json .Mounts}}']],
  ['Backend database health', ['compose', 'exec', '-T', 'backend', 'wget', '-qO-', 'http://localhost:3000/api/health']],
];
const evidence = commands.map(([title, args]) => ({ title, command: `docker ${args.join(' ')}`, output: execFileSync('docker', args, { encoding: 'utf8', timeout: 30000 }).trim() }));
const testOutput = execFileSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.compose.config.js'], { encoding: 'utf8', timeout: 120000 });
evidence.push({ title: 'Chromium E2E verification', command: 'npx.cmd playwright test --config playwright.compose.config.js', output: testOutput.replace(/\u001b\[[0-9;]*m/g, '') });
await writeFile(path.join(output, 'command-evidence.json'), JSON.stringify({ capturedAt: new Date().toISOString(), evidence }, null, 2));
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: output, size: { width: 1600, height: 900 } } });
const page = await context.newPage();
const video = page.video();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
async function slide(title, body, ms = 6500) {
  await page.setContent(`<html><body style="margin:0;background:#101b30;color:#eef5ff;font:24px Segoe UI;padding:55px;box-sizing:border-box"><div style="color:#76c9ff;font-size:18px">DEVOPS ASSIGNMENT • ACTUAL LOCAL VERIFICATION • SILENT WALKTHROUGH</div><h1 style="font-size:42px">${escape(title)}</h1>${body}<div style="position:fixed;bottom:25px;color:#a8b8d0;font-size:18px">Docker + nginx + Express + PostgreSQL | localhost:5173</div></body></html>`);
  await pause(ms);
}
async function banner(title) {
  await page.evaluate(title => {
    document.querySelector('#recording-caption')?.remove();
    const caption = document.createElement('div'); caption.id = 'recording-caption'; caption.textContent = title;
    Object.assign(caption.style, {position:'fixed',top:'0',left:'0',right:'0',padding:'22px',background:'#101b30',color:'white',font:'24px Segoe UI',textAlign:'center',zIndex:'99999'});
    document.body.append(caption);
  }, title);
  await pause(1800);
}
async function submit(username, password, button) {
  await expect(page.getByRole('button', {name:button, exact:true})).toBeVisible();
  await page.getByLabel('Username').pressSequentially(username, {delay:65});
  await page.getByLabel('Password').fill(password);
  await pause(900);
  await page.getByRole('button', {name:button, exact:true}).click();
}
try {
  await slide('Docker and Compose: verified working application', '<p>Frontend: nginx serves the production Vite build.</p><p>Backend: Express validates credentials and hashes passwords.</p><p>Database: PostgreSQL 18 stores accounts in a named volume.</p><p>Only the frontend is published: http://localhost:5173.</p><p style="color:#a8b8d0">The following evidence screens show real command output collected for this recording, followed by live browser interaction. They are not a terminal or Docker Desktop screen capture.</p>', 8500);
  for (const item of evidence.slice(0,4)) {
    const formatted = item.title.includes('volume') ? JSON.stringify(JSON.parse(item.output), null, 2) : item.output;
    await slide(item.title, `<div style="color:#76c9ff;font-size:21px">${escape(item.command)}</div><pre style="font:19px Consolas;white-space:pre-wrap;overflow-wrap:anywhere;background:#192941;padding:24px;border-radius:12px">${escape(formatted)}</pre>`);
  }
  const username = `demo_${Date.now().toString(36)}`;
  await page.goto('http://localhost:5173/#/register');
  await banner('LIVE APP — Register a new account');
  await submit(username, 'secret123', 'Register');
  await expect(page.getByRole('alert')).toHaveText(`Account created for ${username}. Please log in.`);
  await pause(3000);
  await banner('LIVE APP — Incorrect password is rejected');
  await submit(username, 'incorrect123', 'Log in');
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password');
  await pause(3000);
  await banner('LIVE APP — Correct credentials allow login');
  await submit(username, 'secret123', 'Log in');
  await expect(page.getByRole('heading', {name:`Welcome, ${username}!`})).toBeVisible();
  await pause(3500);
  await banner('LIVE APP — Log out, then refresh');
  await page.getByRole('button', {name:'Log out'}).click();
  await expect(page).toHaveURL(/#\/login$/);
  await page.reload();
  await banner('LIVE APP — The same database account still works after refresh');
  await submit(username, 'secret123', 'Log in');
  await expect(page.getByRole('heading', {name:`Welcome, ${username}!`})).toBeVisible();
  await pause(4000);
  const tests = evidence.at(-1);
  await slide(tests.title, `<div style="color:#76c9ff;font-size:21px">${escape(tests.command)}</div><pre style="font:18px Consolas;white-space:pre-wrap;background:#192941;padding:20px">${escape(tests.output)}</pre>`, 10000);
  await slide('Verification complete', '<p>10 Chromium E2E tests passed; 0 failed.</p><p>Three Compose containers are running.</p><p>PostgreSQL uses node-auth-app_db-data at /var/lib/postgresql.</p><p>Live registration, invalid password, login, logout and refresh persistence were demonstrated.</p><p>Services remain running. No persistent volume was deleted.</p>', 6500);
  await page.screenshot({path:path.join(output, 'recording-summary.png')});
} finally {
  await context.close();
  await browser.close();
}
const source = await video.path();
const destination = path.join(output, 'devops-demo.webm');
await rename(source, destination);
console.log(`Saved ${destination}`);
