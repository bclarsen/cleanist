import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { Resend } from "resend";

const resendApiKey = defineSecret("RESEND_API_KEY");

export const sendEmail = onCall(
    { secrets: [resendApiKey] },
    async (request) => {
        const { to, subject, html } = request.data;

        if (!to || !subject || !html) {
            throw new HttpsError(
                "invalid-argument",
                "Missing required fields: to, subject, html"
            );
        }

        const resend = new Resend(resendApiKey.value());

        try {
            const result = await resend.emails.send({
                from: "Your App <noreply@yourdomain.com>", // must be a verified domain in Resend
                to,
                subject,
                html,
            });

            return { success: true, id: result.data?.id };
        } catch (error) {
            console.error("Resend error:", error);
            throw new HttpsError("internal", "Failed to send email");
        }
    }
);