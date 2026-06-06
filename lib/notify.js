import nodemailer from 'nodemailer';
import twilio from 'twilio';

async function sendViaResend(htmlContent, displayDate, to) {
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.REPORT_FROM_EMAIL || 'reports@theautomatedguy.com';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `Jeannine's Reports <${from}>`,
      to,
      subject: `Jeannine's Daily Report — ${displayDate}`,
      html: htmlContent,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Resend ${res.status}: ${txt.slice(0, 200)}`);
  }
  console.log(`  Email sent via Resend from ${from} to: ${to.join(', ')}`);
}

async function sendViaGmail(htmlContent, displayDate, to) {
  const user         = process.env.GMAIL_EMAIL_NISSE;
  const clientId     = process.env.GMAIL_CLIENT_ID_NISSE;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET_NISSE;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN_NISSE;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { type: 'OAuth2', user, clientId, clientSecret, refreshToken },
    connectionTimeout: 30_000,
    socketTimeout: 30_000,
  });

  await transporter.sendMail({
    from: `"Jeannine's Reports" <${user}>`,
    to: to.join(', '),
    subject: `Jeannine's Daily Report — ${displayDate}`,
    html: htmlContent,
  });
  console.log(`  Email sent via Gmail from ${user} to: ${to.join(', ')}`);
}

export async function sendEmail(htmlContent, displayDate) {
  const toRaw = process.env.REPORT_EMAIL_TO || '';
  const to = toRaw.split(',').map(e => e.trim()).filter(Boolean);
  if (!to.length) { console.warn('  Email: REPORT_EMAIL_TO not set, skipping.'); return; }

  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend(htmlContent, displayDate, to);
    } else {
      const user         = process.env.GMAIL_EMAIL_NISSE;
      const clientId     = process.env.GMAIL_CLIENT_ID_NISSE;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET_NISSE;
      const refreshToken = process.env.GMAIL_REFRESH_TOKEN_NISSE;
      if (!user || !clientId || !clientSecret || !refreshToken) {
        console.warn('  Email: no delivery credentials set (RESEND_API_KEY or Gmail OAuth), skipping.');
        return;
      }
      await sendViaGmail(htmlContent, displayDate, to);
    }
  } catch (err) {
    console.warn('  Email send failed:', err.message);
  }
}

export async function sendSms(displayDate, reportUrl) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !auth || !from) { console.warn('  SMS: Twilio credentials not set, skipping.'); return; }

  const numbersRaw = process.env.TWILIO_TO_NUMBERS || '';
  const numbers = numbersRaw.split(',').map(n => n.trim()).filter(Boolean);
  if (!numbers.length) { console.warn('  SMS: TWILIO_TO_NUMBERS not set, skipping.'); return; }

  const client = twilio(sid, auth);
  const body = `Jeannine's report for ${displayDate}: ${reportUrl}`;

  const results = await Promise.allSettled(
    numbers.map(to => client.messages.create({ body, from, to }))
  );

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') console.log(`  SMS sent to ${numbers[i]}`);
    else console.warn(`  SMS failed for ${numbers[i]}:`, r.reason?.message);
  });
}
