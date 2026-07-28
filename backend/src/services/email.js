import nodemailer from 'nodemailer';

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });
}

const FROM = process.env.SMTP_FROM || 'noreply@boo-king.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

export async function sendConfirmationEmail(appointment, business) {
  const { guestName, guestEmail, startsAt, guestPhone } = appointment;
  try {
    const transporter = getTransporter();
    const date = new Date(startsAt).toLocaleString('es-SV', {
      dateStyle: 'full', timeStyle: 'short', timeZone: business.timezone,
    });
    const bookingUrl = `${FRONTEND_URL}/b/${business.slug}`;
    await transporter.sendMail({
      from: FROM,
      to: guestEmail,
      subject: `Cita confirmada en ${business.name}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#14b8a6">¡Cita confirmada!</h2>
        <p>Hola <strong>${guestName}</strong>,</p>
        <p>Tu cita en <strong>${business.name}</strong> ha sido confirmada.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Fecha</td>
              <td style="padding:8px;border:1px solid #ddd">${date}</td></tr>
          ${guestPhone ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Teléfono</td>
              <td style="padding:8px;border:1px solid #ddd">${guestPhone}</td></tr>` : ''}
          ${business.address ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">Dirección</td>
              <td style="padding:8px;border:1px solid #ddd">${business.address}</td></tr>` : ''}
        </table>
        <p style="color:#666">Si necesitas reprogramar, visita el enlace:
          <br><a href="${bookingUrl}" style="color:#14b8a6">${bookingUrl}</a></p>
      </div>`,
    });
  } catch (err) {
    console.error('Email send error:', err);
  }
}

export async function sendRescheduleEmail(appointment, business) {
  const { guestName, guestEmail, startsAt } = appointment;
  try {
    const transporter = getTransporter();
    const date = new Date(startsAt).toLocaleString('es-SV', {
      dateStyle: 'full', timeStyle: 'short', timeZone: business.timezone,
    });
    await transporter.sendMail({
      from: FROM,
      to: guestEmail,
      subject: `Cita reprogramada en ${business.name}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#14b8a6">Cita reprogramada</h2>
        <p>Hola <strong>${guestName}</strong>,</p>
        <p>Tu cita en <strong>${business.name}</strong> ha sido reprogramada.</p>
        <p><strong>Nueva fecha:</strong> ${date}</p>
        <p style="color:#666">Si tienes dudas, contacta al negocio directamente.</p>
      </div>`,
    });
  } catch (err) {
    console.error('Reschedule email error:', err);
  }
}
