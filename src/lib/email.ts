import "server-only";

/**
 * Emails from MyKartos itself (not Supabase's sign-in mails), sent through Resend.
 * Without RESEND_API_KEY nothing is sent and nothing breaks.
 */
async function send(to: string, subject: string, html: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const from = process.env.EMAIL_FROM || "MyKartos <noreply@mykartos.com>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    if (!res.ok) console.error("email", res.status, await res.text());
  } catch (e) {
    console.error("email", e);
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A plain, warm letter: the brand, a few lines, one big button. Works in every mail app. */
function letter({ heading, lines, button, href, foot }: { heading: string; lines: string[]; button: string; href: string; foot: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1d1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:36px 32px">
<tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:.3px;padding-bottom:24px">MyKartos</td></tr>
<tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;padding-bottom:16px">${esc(heading)}</td></tr>
${lines.map((l) => `<tr><td style="font-size:17px;line-height:1.55;padding-bottom:12px">${l}</td></tr>`).join("")}
<tr><td style="padding:16px 0 8px"><a href="${esc(href)}" style="display:inline-block;background:#1c1d1a;color:#ffffff;text-decoration:none;font-weight:600;font-size:17px;padding:15px 28px;border-radius:999px">${esc(button)}</a></td></tr>
<tr><td style="font-size:14px;line-height:1.5;color:#6b6a63;padding-top:20px;border-top:1px solid #ebe7de">${esc(foot)}</td></tr>
</table></td></tr></table></body></html>`;
}

/** After an account is made with email and password: it's there, and how to get back in. */
export async function sendWelcome(input: { to: string; locale: "lt" | "en"; family?: string | null; origin: string }) {
  const lt = input.locale === "lt";
  const href = `${input.origin}/${input.locale}/app`;
  const login = `${input.origin}/${input.locale}/login`;
  const fam = input.family ? esc(input.family) : null;
  const heading = lt ? "Sveiki atvykę į MyKartos!" : "Welcome to MyKartos!";
  const lines = lt
    ? [
        fam ? `Jūsų paskyra sukurta, ir jūs prisijungėte prie šeimos <strong>„${fam}“</strong>.` : "Jūsų paskyra sukurta.",
        `Prisijungimo el. paštas: <strong>${esc(input.to)}</strong>. Slaptažodį susigalvojote patys.`,
        `Kitą kartą tiesiog atidarykite <a href="${esc(login)}" style="color:#1c1d1a">mykartos.com</a> ir prisijunkite.`,
      ]
    : [
        fam ? `Your account is ready, and you have joined the <strong>${fam}</strong> family.` : "Your account is ready.",
        `Your sign-in email: <strong>${esc(input.to)}</strong>. You chose the password yourself.`,
        `Next time, just open <a href="${esc(login)}" style="color:#1c1d1a">mykartos.com</a> and sign in.`,
      ];
  const button = lt ? "Atidaryti šeimos medį" : "Open the family tree";
  const foot = lt ? "Jei šios paskyros nekūrėte, šį laišką galite ištrinti." : "If you didn't create this account, you can delete this email.";
  const subject = lt ? (input.family ? `Sveiki prisijungę prie šeimos „${input.family}“` : "Jūsų MyKartos paskyra sukurta") : input.family ? `Welcome to the ${input.family} family` : "Your MyKartos account is ready";
  const text = `${heading}\n\n${lines.map((l) => l.replace(/<[^>]+>/g, "")).join("\n")}\n\n${button}: ${href}\n\n${foot}`;
  await send(input.to, subject, letter({ heading, lines, button, href, foot }), text);
}
