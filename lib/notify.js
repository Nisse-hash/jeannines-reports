import nodemailer from 'nodemailer';
import twilio from 'twilio';

export async function sendEmail(htmlContent, displayDate, attachments = []) {
  const user         = process.env.GMAIL_EMAIL_NISSE;
  const clientId     = process.env.GMAIL_CLIENT_ID_NISSE;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET_NISSE;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN_NISSE;

  if (!user || !clientId || !clientSecret || !refreshToken) {
    console.warn('  Email: Gmail OAuth credentials not set, skipping.');
    return;
  }

  const toRaw = process.env.REPORT_EMAIL_TO || '';
  const to = toRaw.split(',').map(e => e.trim()).filter(Boolean);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user,
      clientId,
      clientSecret,
      refreshToken,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Jeannine's Reports" <${user}>`,
      to: to.join(', '),
      subject: `Jeannine's Daily Report — ${displayDate}`,
      html: htmlContent,
      attachments,
    });
    console.log(`  Email sent from ${user} to: ${to.join(', ')}`);
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
