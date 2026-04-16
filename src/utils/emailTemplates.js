import { env } from '../config/env.js';

const emailLogoUrl =
  env.EMAIL_LOGO_URL ||
  'https://res.cloudinary.com/dlyhmtquc/image/upload/v1776295472/logo_u0f2pk.png';

function renderTemplate({
  title,
  heading,
  intro,
  ctaText,
  ctaLink,
  fallbackNote,
  footerText,
}) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>

<body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, Helvetica, sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8; padding:20px 0;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">

<!-- LOGO -->
<tr>
<td align="center" style="padding:40px 20px 15px; background:#ffffff;">
  <img src="${emailLogoUrl}" width="170" style="display:block; margin:auto;" />
</td>
</tr>

<!-- HEADING -->
<tr>
<td align="center" style="padding:10px 30px;">
  <h2 style="margin:0; color:#E53935; font-size:24px;">
    ${heading}
  </h2>
</td>
</tr>

<!-- ARABIC CONTENT -->
<tr>
<td style="padding:20px 30px; text-align:right; direction:rtl; color:#333;">
  <p style="margin:0; font-size:16px; line-height:1.8;">
    ${intro}
  </p>
</td>
</tr>

<!-- DIVIDER -->
<tr>
<td style="padding:10px 30px;">
  <hr style="border:none; border-top:1px solid #eee;">
</td>
</tr>

<!-- ENGLISH CONTENT -->
<tr>
<td style="padding:10px 30px; text-align:left; direction:ltr; color:#444;">
  <p style="margin:0; font-size:15px; line-height:1.7;">
    Welcome to LifeLink ❤️<br><br>
    Please verify your email address to activate your account and start using the platform.
  </p>
</td>
</tr>

<!-- BUTTON -->
<tr>
<td align="center" style="padding:25px;">
  <a href="${ctaLink}"
     style="background:#E53935; color:#fff; padding:14px 30px; text-decoration:none; border-radius:30px; font-weight:bold; display:inline-block;">
     ${ctaText} / Verify Email
  </a>
</td>
</tr>

<!-- FALLBACK -->
<tr>
<td align="center" style="padding:10px 30px;">
  <p style="font-size:13px; color:#777;">
    ${fallbackNote}<br>
    If the button doesn’t work, copy this link:
  </p>
  <a href="${ctaLink}" style="color:#E53935; font-size:13px;">
    ${ctaLink}
  </a>
</td>
</tr>

<!-- FOOTER -->
<tr>
<td align="center" style="padding:20px; font-size:12px; color:#999; background:#fafafa;">
  ${footerText}
  <br><br>
  LifeLink Team ❤️
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>`;
}

export const confirmEmailTemplate = (link, name = 'مستخدم LifeLink') =>
  renderTemplate({
    title: 'تأكيد حسابك',
    heading: 'تأكيد البريد الإلكتروني',
    intro: `مرحباً <strong>${name}</strong>،<br><br>يرجى تأكيد بريدك الإلكتروني لتفعيل حسابك في LifeLink.`,
    ctaText: 'تأكيد الحساب',
    ctaLink: link,
    fallbackNote: 'إذا واجهت مشكلة في الضغط على الزر:',
    footerText: 'إذا لم تقم بإنشاء هذا الحساب، تجاهل هذا البريد.',
  });

export const resetPasswordTemplate = (link, name = 'مستخدم LifeLink') =>
  renderTemplate({
    title: 'إعادة تعيين كلمة المرور',
    heading: 'إعادة تعيين كلمة المرور',
    intro: `مرحباً <strong>${name}</strong>،<br><br>يمكنك إعادة تعيين كلمة المرور الخاصة بك من خلال الزر التالي.`,
    ctaText: 'تغيير كلمة المرور',
    ctaLink: link,
    fallbackNote: 'إذا لم يعمل الزر:',
    footerText: 'إذا لم تطلب تغيير كلمة المرور، تجاهل هذا البريد.',
  });

export default {
  confirmEmailTemplate,
  resetPasswordTemplate,
};