import { env } from '../config/env.js';

const shell = ({ title, status, iconEntity, message, detail, statusCode = 200 }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --bg: #f5f7fb;
      --card: #ffffff;
      --text: #172033;
      --muted: #667085;
      --border: #e5e7eb;
      --accent: ${status === 'success' ? '#166534' : '#b42318'};
      --accent-soft: ${status === 'success' ? '#ecfdf3' : '#fef3f2'};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(198, 40, 40, 0.10), transparent 35%),
        linear-gradient(180deg, #f8fafc 0%, var(--bg) 100%);
      font-family: Arial, Helvetica, sans-serif;
      color: var(--text);
    }
    .card {
      width: 100%;
      max-width: 560px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
      padding: 40px 32px;
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 80px;
      height: 80px;
      margin-bottom: 20px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 36px;
      font-weight: 700;
    }
    h1 {
      margin: 0 0 14px;
      font-size: 32px;
      line-height: 1.15;
    }
    p {
      margin: 0;
      line-height: 1.7;
      font-size: 16px;
      color: var(--muted);
    }
    .detail {
      margin-top: 18px;
      padding: 16px 18px;
      border-radius: 16px;
      background: #f8fafc;
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 14px;
    }
    .actions {
      margin-top: 26px;
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .button {
      display: inline-block;
      padding: 14px 20px;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      text-decoration: none;
      font-weight: 700;
    }
    .button.secondary {
      background: #fff;
      color: var(--accent);
      border: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="badge">${iconEntity}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="detail">${detail}</div>
    <div class="actions">
      <a class="button" href="${env.FRONTEND_URL || '/'}">Return To The App</a>
      ${statusCode >= 400 ? '<span class="button secondary">Request a new verification email from the app</span>' : ''}
    </div>
  </main>
</body>
</html>`;

export const renderVerificationSuccessPage = () =>
  shell({
    title: 'Email Verified Successfully',
    status: 'success',
    iconEntity: '&#10003;',
    message: 'Your LifeLink email address has been verified successfully.',
    detail: 'You can now return to the app and continue with sign in or onboarding.',
  });

export const renderVerificationFailurePage = () =>
  shell({
    title: 'Verification Link Invalid or Expired',
    status: 'failure',
    iconEntity: '&#9888;',
    message: 'This verification link is no longer valid. It may have expired or already been used.',
    detail: 'Request a new verification email from the app and try again with the latest message.',
    statusCode: 400,
  });
