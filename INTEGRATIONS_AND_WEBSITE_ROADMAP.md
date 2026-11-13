# KWAN integrations and website enhancement roadmap

This guide describes the integrations and API work needed to take KWAN from its current demo setup to a production-ready education platform. It is based on the React + TypeScript frontend, Express + TypeScript backend, existing admin dashboard, and UGX pricing in this repository.

## What is already in place

- Public pages, student learning environments, tutor tools, and an admin dashboard.
- Admin content management for the website, blog, courses, resources, users, settings, and payment records.
- Express JSON APIs for authentication, learning activity, submissions, forums, content management, and settings.
- A checkout modal with MTN Mobile Money, Airtel Money, and card choices.
- Admin-managed learning resources can include PDF, Word, PowerPoint, spreadsheet, OpenDocument, text, CSV, and image attachments up to 20 MB; learner file downloads are authenticated and checked against purchase access.
- Local JSON-file persistence and seeded demo data.

## Production gaps to address first

The current checkout is only a UI simulation. `POST /api/purchase` grants access and records a paid transaction as completed without contacting a payment provider or verifying payment. Do not use this flow for real payments.

Other production blockers include:

- Passwords are now stored as scrypt hashes and are omitted from API responses. The initial administrator (Ayen Geoffrey Alexander) creates a password through the first-run setup flow guarded by `ADMIN_SETUP_KEY`. Session tokens are currently held in memory, and only tutor creation and user management enforce the admin role; authorization still needs to be applied consistently to every protected API before production.
- The frontend can request the complete platform state, including student and tutor records.
- The JSON file database is not suitable for reliable concurrent production writes, backups, or multi-instance deployment.
- Resource attachments currently live on the application filesystem; production needs managed object storage, backups, and malware scanning. CMS image uploads also need stricter validation.

Before launching real payments or inviting real users, persist sessions securely, apply authorization across all protected endpoints, migrate persistent data to a managed database, and configure HTTPS, backups, and monitoring.

## Recommended integrations

| Need | Recommended option | Notes |
|---|---|---|
| Database | PostgreSQL, hosted by a managed provider | Replace JSON-file storage; use migrations and backups. |
| Passwords and sessions | `bcrypt` or `argon2` with secure, HTTP-only sessions | Use a PostgreSQL-backed session store; protect admin and tutor routes by role. |
| Request validation | `zod` | Validate request bodies and environment configuration at API boundaries. |
| HTTP security | `helmet` and `express-rate-limit` | Add secure response headers and rate limits, especially on login and registration. Configure CORS narrowly if frontend and API are hosted separately. |
| Payments | Flutterwave hosted checkout, subject to Uganda merchant/channel activation | A strong first choice for UGX checkout with mobile money and card options. Confirm MTN/Airtel availability, settlement, fees, and account eligibility with the provider before committing. Keep provider credentials on the server. |
| Payment alternative | Pesapal hosted checkout, subject to account and channel confirmation | Consider if onboarding or local support is simpler for KWAN. Confirm Uganda mobile-money methods and settlement terms. Hosted checkout reduces card-data handling but still requires server verification and webhooks. |
| Transactional email | Resend or Brevo | Send verification, password-reset, enrollment, payment, and tutor/admin notification emails. |
| Newsletter distribution | Brevo campaigns, or another consent-based email marketing service | Keep marketing lists separate from transactional email; record consent and support unsubscribe/suppression. |
| Media storage | S3-compatible object storage or Cloudinary | Store uploads outside the application filesystem; use access controls and image transformations/CDN delivery. |
| Error monitoring | Sentry | Capture frontend and backend errors without logging passwords, tokens, or payment secrets. |
| Analytics | Privacy-conscious analytics such as Plausible, or Google Analytics if consent requirements are met | Track public-site and enrollment funnels; do not send student-sensitive data to analytics. |

These are recommendations, not installed packages. Check current provider pricing, regional availability, and terms before selecting a vendor.

## Payments: recommended implementation

Use a provider-hosted checkout or payment link so KWAN never handles raw card details. Flutterwave is the suggested first option; keep the gateway behind a small backend service so another provider can be substituted without rewriting the checkout UI.

### Payment lifecycle

1. The signed-in learner selects a course or resource. The browser sends only the item ID, item type, and selected method; it does not set the price or declare a payment successful.
2. The backend checks the user, item, class eligibility, current price, and whether access is already granted. It creates a unique pending order/payment record using the server-calculated UGX amount.
3. The backend asks the gateway to initialize checkout and returns only the hosted checkout URL and a non-secret local reference.
4. The learner pays on the gateway's hosted page or mobile-money prompt.
5. A gateway webhook is validated using the provider's documented signature/authentication rules. The backend then verifies the transaction with the provider API, including reference, amount, currency, and final status.
6. Only a verified successful payment changes the order to paid and grants course/resource access. Processing must be idempotent so retries cannot duplicate transactions, downloads, or enrollments.
7. The learner sees a pending, successful, or failed result page. A browser redirect alone is never proof of payment.
8. Refunds are initiated and confirmed through the provider API; the admin dashboard displays provider and local refund status.

### Payment API endpoints to add or replace

- `POST /api/payments/checkout` — authenticated; validates item access and creates a pending payment, then initializes provider checkout.
- `GET /api/payments/:reference` — authenticated; returns the current status for the signed-in user's payment.
- `POST /api/payments/webhooks/flutterwave` — public provider callback; verifies authenticity and provider status before updating records. Add a separate route if Pesapal is selected.
- `POST /api/admin/payments/:id/refund` — admin-only; requests a provider refund and records its result.

Replace the existing paid-purchase behavior in `POST /api/purchase`; retain a separate free-enrollment path if needed. Store a provider reference, local order reference, amount, currency, method, payment status, and timestamps. Do not store card numbers, CVVs, provider secret keys, or mobile-money PINs.

The checkout should request a real phone number for mobile money, validate it on the server, clearly identify the provider, and display a helpful pending state while waiting for mobile-money confirmation. Remove the sample phone number and “Processed by KWAN” wording unless KWAN itself processes the payment.

## Email distribution

Use provider APIs from the backend only. Keep API keys in deployment secrets and never expose them through Vite/client environment variables.

### Transactional messages

- Verify email after registration.
- Password reset with short-lived, single-use links.
- Payment receipt and payment failure/pending updates.
- Course enrollment and resource purchase confirmation.
- Tutor approval, new assignment, and submission notifications.
- Admin alerts for support requests or payment exceptions.

### Newsletter and announcements

- Add an explicit opt-in checkbox; do not subscribe users automatically as a condition of account creation.
- Store consent timestamp, source, and subscription status.
- Provide unsubscribe links and honor provider suppression lists.
- Segment campaigns by learner division/class only when users have consented and the message is appropriate.
- Use a verified sending domain with SPF, DKIM, and DMARC configured.
- Add admin controls for composing, previewing, scheduling, and reviewing campaign delivery metrics, or start with the email provider's campaign dashboard rather than building a full campaign editor.

Suggested backend API:

- `POST /api/newsletter/subscribe` — public, rate-limited, double-opt-in subscription.
- `POST /api/newsletter/unsubscribe` — signed unsubscribe token; no login required.
- `POST /api/admin/announcements` — admin-only notification/campaign request, with provider-backed delivery and audit history.

Do not send bulk campaigns directly from a web request. Queue or schedule deliveries, retry transient provider failures safely, and avoid logging message contents or personal data unnecessarily.

## Frontend, backend, and dashboard work

### Frontend

- Replace simulated checkout with a payment initialization request and hosted-gateway redirect.
- Show pending/success/failure states and allow safe status refresh after returning from checkout.
- Add email verification, password reset, and newsletter opt-in/unsubscribe flows.
- Improve mobile navigation and ensure key flows work on small screens and low-bandwidth connections.
- Add loading, empty, and recoverable error states for API-backed pages.
- Add accessible labels, keyboard navigation, visible focus, sufficient contrast, and meaningful image alternatives.

### Backend APIs

- Introduce validated request schemas and a consistent error response format.
- Add session authentication and authorization middleware for student, tutor, and admin roles.
- Never return password hashes or private account fields in general state responses.
- Use a managed relational database for users, courses, enrollments, submissions, orders, payments, consent, and audit records.
- Add pagination and filters for large admin lists; avoid returning the entire database to the browser.
- Add webhook verification, idempotency, audit logging for sensitive admin actions, and provider-independent payment records.
- Add email delivery and subscription endpoints with consent/suppression support.

### Admin dashboard

- Provide payment status, provider reference, reconciliation, and refund status.
- Add an email settings/notification area for sender status, templates, and delivery logs; do not expose provider secrets in the UI.
- Provide newsletter consent and subscriber management with export/access controls and unsubscribe handling.
- Add audit history for administrator changes and payment actions.
- Add searchable, paginated tables and clear empty/error states as data grows.

## Website enhancements

1. **Trust and conversion:** make the learning divisions, curriculum/class coverage, pricing, payment options, tutor credentials, support contacts, and enrollment steps easy to find. Add clear calls to action and FAQs.
2. **Mobile and performance:** optimize and responsively size images, lazy-load below-the-fold media, reduce unnecessary animation, and test on slower mobile connections.
3. **Search visibility:** add unique page titles/descriptions, canonical URLs, social-sharing metadata, sitemap, robots rules, and structured data where accurate. Ensure blog pages have stable shareable URLs.
4. **Accessibility:** target WCAG 2.2 AA practices, including keyboard support, semantic headings, form errors, contrast, and reduced-motion preferences.
5. **Content and discoverability:** improve blog/resource filtering and search, add clear previews and access requirements, and keep published content current.
6. **Measurement:** track privacy-appropriate page, signup, checkout-start, payment-success, and newsletter opt-in events. Never include credentials, payment details, student answers, or unnecessary identifiers in analytics.
7. **Reliability:** add production health checks, error monitoring, automated database/media backups, and a tested restore procedure.

## Suggested delivery order

1. Secure authentication, role authorization, validation, and private API responses.
2. Migrate from JSON persistence to PostgreSQL and establish backups.
3. Integrate one payment provider in test mode; validate webhooks and duplicate-event handling before a small live pilot.
4. Add transactional email, verified sender-domain records, consent, and unsubscribe handling.
5. Improve admin payment/reconciliation tools and add monitoring.
6. Complete accessibility, performance, SEO, and website content improvements.

## Go-live checklist

- [ ] Production secrets are configured server-side and excluded from source control.
- [ ] HTTPS and secure cookies are enabled.
- [ ] Authentication, role restrictions, password hashing, and password reset have been tested.
- [ ] Payment test cases cover success, failure, cancellation, delayed mobile-money approval, duplicate webhook, amount mismatch, and refund.
- [ ] A payment is never marked paid based only on browser redirect or client input.
- [ ] Email verification, unsubscribe, consent records, and suppression behavior have been tested.
- [ ] Database and media backups are configured and a restore has been tested.
- [ ] Admin and learner flows are tested on mobile and with keyboard navigation.
- [ ] Privacy notice, terms, refund policy, and provider/regulatory requirements have been reviewed for the operating region.
