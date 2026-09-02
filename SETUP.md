# LinQafé — existing menu + ordering update

This project keeps the existing LinQafé menu/design and adds only the requested ordering functionality.

## Added
- Add to Cart button on every existing menu card
- Real existing item image in cart and checkout
- Quantity controls and remove-by-decrement
- Cart persistence in browser localStorage
- Pickup / dine-in checkout
- Table number and notes
- MyFatoorah hosted payment page (Apple Pay / card / Google Pay when enabled on the merchant account)
- Server-side payment verification
- MyFatoorah Webhook V2 endpoint
- Admin dashboard at `/admin`
- Admin login, live order refresh, status changes, payment status and printable receipts

## 1. Supabase
Create a Supabase project and run `db-schema.sql` in the SQL editor.

Then add these Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key must stay server-side and must NOT be prefixed with `NEXT_PUBLIC_`.

## 2. MyFatoorah
Add:

- `MYFATOORAH_API_KEY`
- `MYFATOORAH_API_URL=https://apitest.myfatoorah.com` for testing
- `NEXT_PUBLIC_SITE_URL=https://linqafe-menu.vercel.app`

For live Qatar, use the Qatar API base URL from your MyFatoorah account: `https://api-qa.myfatoorah.com`.

Enable Apple Pay and the other desired payment methods in the MyFatoorah merchant account and complete the required Apple Pay domain verification.

Configure the MyFatoorah Webhook V2 endpoint as:

`https://linqafe-menu.vercel.app/api/payments/webhook`

Then add `MYFATOORAH_WEBHOOK_SECRET` in Vercel using the secret shown in the MyFatoorah portal.

## 3. Admin
Add:

- `ADMIN_PASSWORD` — strong staff password
- `ADMIN_SECRET` — long random secret used to sign the admin cookie

Open:

`https://linqafe-menu.vercel.app/admin`

## 4. Important
Do not put API keys, Supabase service-role keys, webhook secrets, or admin secrets in client-side code.
