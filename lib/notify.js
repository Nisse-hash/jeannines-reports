import nodemailer from 'nodemailer';
import twilio from 'twilio';

export async function sendEmail(htmlContent, displayDate) {
  const user = process.env.GMAIL_EMAIL_NISSE;
  const pass = process.env.GMAIL_APP_PASSWORD_NISSE;

  if (!user || !pass) {
    console.warn('  Email: GMAIL_EMAIL_NISSE or GMAIL_APP_PASSWORD_NISSE not set, skipping.');
    return;
  }

  const toRaw = process.env.REPORT_EMAIL_TO || 'alison@jeannines.com';
  const to = toRaw.split(',').map(e => e.trim()).filter(Boolean);

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from: `"Jeannine's Reports" <${user}>`,
      to: to.join(', '),
      subject: `Jeannine's Daily Report — ${displayDate}`,
      html: htmlContent,
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
