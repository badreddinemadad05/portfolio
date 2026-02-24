const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const fs = require('fs/promises');
const path = require('path');

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 3001);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const CONTACT_TO = String(process.env.CONTACT_TO || '').trim();
const CONTACT_FROM = String(process.env.CONTACT_FROM || process.env.SMTP_USER || '').trim();
const SMTP_REQUIRED = String(process.env.SMTP_REQUIRED || 'false').toLowerCase() === 'true';
const MESSAGES_FILE = path.join(__dirname, 'data', 'messages.json');

app.use(helmet());
app.use(
  cors({
    origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN,
  })
);
app.use(express.json({ limit: '100kb' }));

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function normalizeBody(body) {
  return {
    name: String(body.name || '').trim(),
    email: String(body.email || '').trim(),
    subject: String(body.subject || '').trim(),
    message: String(body.message || '').trim(),
  };
}

async function readMessages() {
  try {
    const raw = await fs.readFile(MESSAGES_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function appendMessage(entry) {
  const data = await readMessages();
  data.push(entry);
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function normalizeSmtpConfig() {
  const service = String(process.env.SMTP_SERVICE || '').trim();
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = String(process.env.SMTP_USER || '').trim();
  const rawPass = String(process.env.SMTP_PASS || '').trim();

  const gmailLike = host.includes('gmail.com') || user.endsWith('@gmail.com') || service.toLowerCase() === 'gmail';
  const pass = gmailLike ? rawPass.replace(/\s+/gu, '') : rawPass;

  return { service, host, port, secure, user, pass };
}

function createTransporterIfConfigured() {
  const cfg = normalizeSmtpConfig();

  if ((!cfg.service && !cfg.host) || !cfg.user || !cfg.pass || !CONTACT_TO) {
    return null;
  }

  const transportConfig = {
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  };

  if (cfg.service) {
    transportConfig.service = cfg.service;
  } else {
    transportConfig.host = cfg.host;
  }

  return nodemailer.createTransport(transportConfig);
}

function mapSmtpError(error) {
  if (error && (error.code === 'EAUTH' || error.responseCode === 535)) {
    return 'SMTP auth failed (535). Verify Gmail App Password and 2FA.';
  }
  return 'SMTP delivery failed.';
}

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/api/messages', async (_req, res) => {
  try {
    const data = await readMessages();
    res.status(200).json({ ok: true, count: data.length, messages: data });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Cannot read messages.' });
  }
});

app.get('/api/smtp-test', async (_req, res) => {
  try {
    const transporter = createTransporterIfConfigured();

    if (!transporter) {
      return res.status(200).json({
        ok: true,
        message: 'SMTP not configured. Form can still store messages locally.',
      });
    }

    await transporter.verify();
    return res.status(200).json({ ok: true, message: 'SMTP connection/auth is valid.' });
  } catch (error) {
    return res.status(401).json({ ok: false, message: mapSmtpError(error) });
  }
});

app.post('/api/contact', async (req, res) => {
  const payload = normalizeBody(req.body || {});

  if (!payload.name || !payload.email || !payload.subject || !payload.message) {
    return res.status(400).json({ ok: false, message: 'All fields are required.' });
  }

  if (!isValidEmail(payload.email)) {
    return res.status(400).json({ ok: false, message: 'Invalid email address.' });
  }

  const savedMessage = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    delivery: 'stored',
    ...payload,
  };

  try {
    await appendMessage(savedMessage);

    const transporter = createTransporterIfConfigured();

    if (!transporter) {
      return res.status(200).json({
        ok: true,
        message: 'Message received and stored successfully.',
      });
    }

    try {
      await transporter.sendMail({
        from: CONTACT_FROM || process.env.SMTP_USER,
        to: CONTACT_TO,
        replyTo: payload.email,
        subject: `[Portfolio] ${payload.subject}`,
        text: [
          `Name: ${payload.name}`,
          `Email: ${payload.email}`,
          '',
          'Message:',
          payload.message,
        ].join('\n'),
        html: `
          <h2>New message from portfolio</h2>
          <p><strong>Name:</strong> ${payload.name}</p>
          <p><strong>Email:</strong> ${payload.email}</p>
          <p><strong>Subject:</strong> ${payload.subject}</p>
          <p><strong>Message:</strong></p>
          <p>${payload.message.replace(/\n/g, '<br>')}</p>
        `,
      });

      return res.status(200).json({ ok: true, message: 'Message sent successfully.' });
    } catch (smtpError) {
      const smtpMessage = mapSmtpError(smtpError);
      console.error('Contact endpoint SMTP warning:', smtpError && smtpError.message ? smtpError.message : smtpError);

      if (SMTP_REQUIRED) {
        return res.status(401).json({ ok: false, message: smtpMessage });
      }

      return res.status(200).json({
        ok: true,
        message: 'Message received and stored successfully (email delivery skipped).',
        warning: smtpMessage,
      });
    }
  } catch (error) {
    console.error('Contact endpoint error:', error && error.message ? error.message : error);
    return res.status(500).json({ ok: false, message: 'Server error while storing message.' });
  }
});

app.listen(PORT, () => {
  console.log(`Contact backend listening on http://localhost:${PORT}`);
});
