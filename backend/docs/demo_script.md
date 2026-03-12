# FOODAS Demo Script (Owner Evidence + Crypto)

1. **Setup**
   - Start backend: `python manage.py runserver`.
   - Start frontend from the `frontend` folder: `npm start` or equivalent.

2. **Owner Evidence Upload**
   - Log in as an OWNER user.
   - Go to Owner Dashboard → Evidence Upload.
   - Select a category and enter a descriptive explanation.
   - Upload 1–2 images and submit.
   - Show that the upload succeeds and evidence appears in the owner evidence list.

3. **Admin/Auditor Pending Work**
   - Log out and log in as an ADMIN or AUDITOR.
   - Navigate to “My pending work”.
   - Show that the restaurant with new PENDING evidence appears in the list.
   - Click to accept work if necessary and open the restaurant review screen.

4. **Admin Review with Crypto Verification**
   - Select a PENDING evidence item.
   - Approve it and note that the system implicitly runs the crypto checks via `IntegratedAdminVerification`.
   - (Optional) Trigger a crypto verification endpoint (e.g. `/api/crypto/verify-chain/<restaurant_id>/`) using a REST client to show hash-chain status.

5. **Closing**
   - Summarize how uploads, cryptographic verification, and admin review all connect.

