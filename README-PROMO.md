# Quick Start Guide - Rhemito-UI with Promo Codes

## ✅ Installation Complete!

The promo code feature has been successfully integrated into your Rhemito-UI application.

## 🚀 Start the Server

Open your terminal and run:

```bash
cd "c:\Users\Khan1\OneDrive\Desktop\drive d data\Rhemito-UI\Rhemito-UI"
npm run dev
```

The server will start at **http://localhost:5000**

## 🧪 Test the Promo Code Feature

1. **Navigate to Send Money**
   - Click "Send Money" in the navigation

2. **Complete Steps 1-4**
   - **Step 1**: Enter amount (e.g., £500)
   - **Step 2**: Select a recipient
   - **Step 3**: Fill in recipient details
   - **Step 4**: Review summary

3. **Step 5 - Payment Page** ✨
   - You'll see an **Amount** summary box showing:
     - You Send
     - Amount Sent
     - They Receive
     - Transaction Fee
     - Exchange Rate
     - Collection Method
   
   - **Apply a promo code:** use a code created in Mito Admin (Financials > Promo Codes).
     Rhemito has no codes of its own; it asks Mito Admin (`MITO_API_URL`) to validate the code
     and, when the transfer is paid, to record its use.
   
   - Click "Apply"
   - **Result**: You'll see a new green line appear:
     ```
     Discount Applied: -5.00 GBP  (in green)
     ```

## 📋 Test Codes

Create your own in Mito Admin. The demo codes SAVE20, WELCOME and BOOSTRATE were removed from Rhemito.
If Mito Admin cannot be reached, a promo code cannot be applied (the checkout still works without one).

## 📁 What Was Changed

- ✅ Backend: `server/promoService.ts` - Forwards promo checks and redemptions to Mito Admin
- ✅ Backend: `server/routes.ts` and `server/sendMoneyRoutes.ts` - API endpoints; the code is redeemed when the transfer is paid
- ✅ Frontend: `client/src/pages/SendMoney.tsx` - Payment page UI
- ✅ Config: `package.json` - Windows-compatible scripts

See `walkthrough.md` for full details!
