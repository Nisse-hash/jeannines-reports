import { Octokit } from '@octokit/rest';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

async function pushFile(octokit, owner, repo, repoPath, localPath, message) {
  if (!existsSync(localPath)) return;
  const content = Buffer.from(readFileSync(localPath)).toString('base64');
  let sha;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: repoPath });
    sha = Array.isArray(data) ? undefined : data.sha;
  } catch { /* new file */ }
  await octokit.repos.createOrUpdateFileContents({
    owner, repo, path: repoPath, message, content,
    ...(sha ? { sha } : {}),
  });
}

async function getOwner(octokit) {
  const owner = process.env.JEANNINES_GITHUB_REPO_OWNER;
  if (owner) return owner;
  const { data: me } = await octokit.users.getAuthenticated();
  return me.login;
}

export async function publishReport(htmlContent, displayDate) {
  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.JEANNINES_GITHUB_REPORT_REPO || 'jeannines-reports';
  const octokit = new Octokit({ auth: token });
  const owner = await getOwner(octokit);

  // Create repo if it doesn't exist
  try {
    await octokit.repos.get({ owner, repo });
  } catch {
    console.log(`  Creating GitHub repo ${owner}/${repo}...`);
    await octokit.repos.createForAuthenticatedUser({
      name: repo,
      description: "Jeannine's daily Toast POS reports",
      private: false,
      auto_init: true,
    });
    await new Promise(r => setTimeout(r, 2000));
  }

  // Push the daily HTML report
  const filePath = `reports/${displayDate}.html`;
  const content  = Buffer.from(htmlContent).toString('base64');
  let sha;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
    sha = Array.isArray(data) ? undefined : data.sha;
  } catch { /* new file */ }
  await octokit.repos.createOrUpdateFileContents({
    owner, repo, path: filePath,
    message: `Report ${displayDate}`,
    content,
    ...(sha ? { sha } : {}),
  });

  // Keep lib/report.js in sync so the /api/report serverless function can import it
  await pushFile(octokit, owner, repo,
    'lib/report.js', join(__dir, 'report.js'),
    'Sync report renderer');

  const vercelBase = process.env.JEANNINES_REPORT_URL_BASE || `https://${repo}.vercel.app`;
  return `${vercelBase}/reports/${displayDate}.html`;
}

export async function publishChartImage(buffer, displayDate, suffix = '', ext = 'gif') {
  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.JEANNINES_GITHUB_REPORT_REPO || 'jeannines-reports';
  const octokit = new Octokit({ auth: token });
  const owner = await getOwner(octokit);

  const filePath = `reports/chart-${displayDate}${suffix}.${ext}`;
  const content  = buffer.toString('base64');
  let sha;
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
    sha = Array.isArray(data) ? undefined : data.sha;
  } catch { /* new file */ }
  await octokit.repos.createOrUpdateFileContents({
    owner, repo, path: filePath,
    message: `Chart ${displayDate}${suffix}`,
    content,
    ...(sha ? { sha } : {}),
  });

  const vercelBase = process.env.JEANNINES_REPORT_URL_BASE || `https://${repo}.vercel.app`;
  return `${vercelBase}/reports/chart-${displayDate}${suffix}.${ext}`;
}

export async function publishDashboard() {
  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.JEANNINES_GITHUB_REPORT_REPO || 'jeannines-reports';
  const octokit = new Octokit({ auth: token });
  const owner = await getOwner(octokit);
  const root  = join(__dir, '..');

  await pushFile(octokit, owner, repo, 'dashboard.html',  join(root, 'dashboard.html'),        'Update analytics dashboard');
  await pushFile(octokit, owner, repo, 'analytics.html',  join(root, 'analytics.html'),        'Update analytics hub');
  await pushFile(octokit, owner, repo, 'api/report.js',   join(root, 'api', 'report.js'),      'Update dynamic report API');
  await pushFile(octokit, owner, repo, 'api/config.js',   join(root, 'api', 'config.js'),      'Update Vercel config endpoint');
  await pushFile(octokit, owner, repo, 'lib/report.js',   join(root, 'lib', 'report.js'),      'Sync report renderer');

  const vercelBase = process.env.JEANNINES_REPORT_URL_BASE || `https://${repo}.vercel.app`;
  return `${vercelBase}/dashboard.html`;
}
