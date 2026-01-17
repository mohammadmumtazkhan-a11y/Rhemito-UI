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
   
   - **Apply a promo code:**
     - Try: `SAVE20` (20% off fees, min £100)
     - Try: `WELCOME` (£5 off, min £50)
     - Try: `BOOSTRATE` (FX boost, min £500)
   
   - Click "Apply"
   - **Result**: You'll see a new green line appear:
     ```
     Discount Applied: -5.00 GBP  (in green)
     ```

## 📋 Test Codes

| Code | Type | Discount | Min Amount |
|------|------|----------|------------|
| **SAVE20** | Percentage | 20% off fees | £100 |
| **WELCOME** | Fixed | £5 off | £50 |
| **BOOSTRATE** | FX Boost | Rate improvement | £500 |

## 📁 What Was Changed

- ✅ Backend: `server/promocode.ts` - Validation logic
- ✅ Backend: `server/routes.ts` - API endpoints
- ✅ Frontend: `client/src/pages/SendMoney.tsx` - Payment page UI
- ✅ Config: `package.json` - Windows-compatible scripts

See `walkthrough.md` for full details!
