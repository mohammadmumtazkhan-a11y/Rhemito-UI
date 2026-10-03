## ✅ Server Issue Fixed!

The socket binding error has been resolved by changing the host from `0.0.0.0` to `127.0.0.1`.

## 🚀 Run the Server Now

```bash
npm run dev
```

The server should start successfully now at **http://localhost:5000**

## Next Steps

1. **Start the server** with the command above
2. **Open browser** to http://localhost:5000
3. **Navigate** to "Send Money"
4. **Complete** Steps 1-4
5. **On Step 5** - Enter promo code and see the discount!

### Test Promo Codes
- `SAVE20` - 20% off fees (min £100)
- `WELCOME` - £5 off (min £50)
- `BOOSTRATE` - FX boost (min £500)

The "Discount Applied" line will appear in green in the Amount summary box! ✨

## Refer & Earn and bonus credit (Mito Admin referral engine)

Referral offers, referrals and bonus credit come from the **Mito Admin** app (PromoCode repo). Run both apps side by side — Mito Admin on port **5050** so it does not clash with Rhemito on 5000:

```bash
# Terminal 1 — Mito Admin API (PromoCode repo)
cd PromoCode/server
set PORT=5050 && node server.js        # Windows CMD
# PORT=5050 node server.js             # macOS / Linux

# Terminal 2 — Rhemito (this repo)
npm run dev                            # uses MITO_API_URL=http://localhost:5050 by default
```

- Point Rhemito at another Mito Admin address with `MITO_API_URL` (for example on Render).
- **On Render:** the Rhemito-UI service needs `MITO_API_URL=https://promocode-jcd8.onrender.com` (the live Mito Admin / PromoCode service). It is set in Render under Rhemito-UI > Environment and is also listed in `render.yaml`. If it is missing, the dashboard's Refer & Earn card shows "We couldn't load your referral details." Changing the value redeploys the service. Both services are on Render's free plan, so the first request after a quiet spell can take up to a minute while the engine wakes up.
- Create an active GBP rule in Mito Admin → Growth Engine → Referral Settings, then open the Rhemito dashboard to see Refer & Earn.
- If Mito Admin is not running, Rhemito keeps working: the Refer & Earn card shows a retry message and no bonus can be used.
