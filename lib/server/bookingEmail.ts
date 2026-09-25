type BookingEmailData = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  lessonName: string;
  date: string;
  timeLabels: string[];
  partySize: number;
  partyNames: string[];
  notes: string;
  locale: 'en' | 'es';
};

type EmailMessage = { to: string; subject: string; html: string; text: string };
export type DeliveryResult = { status: 'sent' | 'failed' | 'unconfigured'; id?: string };

const INBOX = 'sunsetsurfacademy@gmail.com';
const FROM = 'Sunset Surf Academy <bookings@sunsetsurfacademy.com>';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char] || char));
}

function displayDate(value: string, locale: 'en' | 'es'): string {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-PR' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(parsed);
}

function layout(eyebrow: string, title: string, intro: string, rows: [string, string][], footer: string, replyLabel = 'Replies go to'): string {
  const details = rows.map(([label, value]) => `
    <tr><td style="padding:10px 0;color:#5b6b73;font-size:13px;width:38%;vertical-align:top">${escapeHtml(label)}</td>
    <td style="padding:10px 0;color:#15343b;font-size:15px;font-weight:600;vertical-align:top">${escapeHtml(value)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:32px 12px;background:#f2f7f6;font-family:Arial,Helvetica,sans-serif;color:#15343b">
    <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse">
      <tr><td style="padding:25px 30px;background:#0b555a;color:#fff;border-radius:14px 14px 0 0">
        <div style="font-size:12px;letter-spacing:2.4px;font-weight:700">SUNSET SURF ACADEMY</div>
        <div style="font-size:13px;margin-top:8px;color:#cdece8">Rincón, Puerto Rico</div>
      </td></tr>
      <tr><td style="padding:32px 30px;background:#fff;border:1px solid #dce9e6;border-top:0">
        <div style="font-size:11px;letter-spacing:1.8px;text-transform:uppercase;font-weight:700;color:#167a7b">${escapeHtml(eyebrow)}</div>
        <h1 style="font-size:27px;line-height:1.2;margin:12px 0 14px;color:#15343b">${escapeHtml(title)}</h1>
        <p style="font-size:16px;line-height:1.6;margin:0 0 23px;color:#42565b">${escapeHtml(intro)}</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;border-top:1px solid #e3eeeb;border-bottom:1px solid #e3eeeb">${details}</table>
        <p style="font-size:14px;line-height:1.6;margin:24px 0 0;color:#42565b">${escapeHtml(footer)}</p>
      </td></tr>
      <tr><td style="padding:20px 30px;text-align:center;color:#60777a;font-size:12px;line-height:1.5">
        Sunset Surf Academy · Rincón, Puerto Rico<br>${escapeHtml(replyLabel)} ${INBOX}
      </td></tr>
    </table>
  </body></html>`;
}

function renderAdminEmail(booking: BookingEmailData): EmailMessage {
  const date = displayDate(booking.date, 'en');
  const rows: [string, string][] = [
    ['Guest', booking.customerName],
    ['Email', booking.customerEmail],
    ['Phone', booking.customerPhone],
    ['Lesson', booking.lessonName],
    ['Requested date', date],
    ['Preferred times', booking.timeLabels.join(', ')],
    ['Party size', String(booking.partySize)],
  ];
  if (booking.partyNames.length) rows.push(['Other surfers', booking.partyNames.join(', ')]);
  if (booking.notes) rows.push(['Notes', booking.notes]);
  const intro = 'A new lesson request was saved. Please review availability and contact the guest to confirm the booking.';
  const footer = `Request ID: ${booking.id}. This is a request, not a confirmed reservation.`;
  return {
    to: INBOX,
    subject: `New surf lesson request · ${booking.customerName.replace(/[\r\n]+/g, ' ')} · ${date}`,
    html: layout('New booking request', 'A surfer is ready to get started', intro, rows, footer),
    text: `${intro}\n\n${rows.map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n${footer}\n\nReply to ${INBOX}`,
  };
}

function renderCustomerEmail(booking: BookingEmailData): EmailMessage {
  const spanish = booking.locale === 'es';
  const date = displayDate(booking.date, booking.locale);
  const intro = spanish
    ? `Hola ${booking.customerName}, recibimos tu solicitud de clase de surf. Nuestro equipo revisará la disponibilidad y te escribirá para confirmarla.`
    : `Hi ${booking.customerName}, we received your surf lesson request. Our team will review availability and reach out to confirm it.`;
  const rows: [string, string][] = spanish
    ? [['Clase', booking.lessonName], ['Fecha solicitada', date], ['Horarios preferidos', booking.timeLabels.join(', ')], ['Personas', String(booking.partySize)]]
    : [['Lesson', booking.lessonName], ['Requested date', date], ['Preferred times', booking.timeLabels.join(', ')], ['Party size', String(booking.partySize)]];
  const footer = spanish
    ? `Esto todavía no es una reserva confirmada. Si necesitas cambiar algo, responde a este correo y te atenderemos en ${INBOX}.`
    : `This is not a confirmed reservation yet. To change anything, reply to this email and we will help you at ${INBOX}.`;
  return {
    to: booking.customerEmail,
    subject: spanish ? 'Recibimos tu solicitud · Sunset Surf Academy' : 'We received your request · Sunset Surf Academy',
    html: layout(spanish ? 'Solicitud recibida' : 'Request received', spanish ? '¡Gracias por escribirnos!' : 'Thanks for reaching out', intro, rows, footer, spanish ? 'Las respuestas llegan a' : 'Replies go to'),
    text: `${intro}\n\n${rows.map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n${footer}`,
  };
}

async function send(message: EmailMessage, idempotencyKey: string): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { status: 'unconfigured' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ from: FROM, to: [message.to], reply_to: INBOX, subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.id) {
      console.error('[booking-email] Provider rejected message', { status: response.status, code: result?.name || result?.error || 'unknown' });
      return { status: 'failed' };
    }
    return { status: 'sent', id: String(result.id) };
  } catch (error) {
    console.error('[booking-email] Provider request failed', error instanceof Error ? error.message : 'unknown error');
    return { status: 'failed' };
  }
}

export async function sendBookingEmails(booking: BookingEmailData): Promise<{ admin: DeliveryResult; customer: DeliveryResult }> {
  const [admin, customer] = await Promise.all([
    send(renderAdminEmail(booking), `booking/${booking.id}/admin`),
    send(renderCustomerEmail(booking), `booking/${booking.id}/customer`),
  ]);
  return { admin, customer };
}

export const bookingEmailTemplates = { renderAdminEmail, renderCustomerEmail };
