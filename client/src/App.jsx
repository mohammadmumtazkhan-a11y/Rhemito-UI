import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './index.css';

import logo from './assets/logo.png';

// Components
import ReferralSettings from './pages/Growth/ReferralSettings';
import UserCreditLedger from './pages/Growth/UserCreditLedger';
import BonusSchemeManager from './pages/Growth/BonusSchemeManager';
import CampaignManager from './pages/Campaigns/CampaignManager';
import { LayoutGrid, BarChart3, Users, FileText, HelpCircle, Settings, LogOut, ChevronLeft } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname.includes(path);

  const menuItems = [
    { name: 'Overview', icon: <LayoutGrid size={20} />, path: '/' },
    { name: 'Transactions', icon: <BarChart3 size={20} />, path: '/test-checkout' },
    { name: 'Recipients', icon: <Users size={20} />, path: '/recipients' },
    { name: 'Compliance', icon: <FileText size={20} />, path: '/compliance' },
    { name: 'Support', icon: <HelpCircle size={20} />, path: '/support' },
    { name: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  return (
    <aside
      className={`sidebar-mobile ${isOpen ? 'open' : ''}`}
      style={{
        width: 250, flexShrink: 0, height: '100vh',
        background: '#ffffff',
        // borderRight: '1px solid #f3f4f6', // Clean look often avoids border if shadow or bg varies, keeping for structure
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Inter', sans-serif",
        padding: '20px 0'
      }}>

      {/* Brand Logo & Back */}
      <div style={{ padding: '0 32px', marginBottom: 40, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Logo Placeholder */}
        <div style={{ width: 32, height: 32, background: 'none' }}>
          {/* Simple R Logo representation */}
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 5H27" stroke="none" />
            <text x="0" y="24" fontFamily="Arial" fontWeight="bold" fontSize="32" fill="#2563eb">R</text>
          </svg>
        </div>

        <div style={{ alignSelf: 'flex-end', cursor: 'pointer', color: '#2563eb' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <ChevronLeft size={16} />
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 32px' }}>
        {menuItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link key={item.name} to={item.path} onClick={onClose} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '12px 0',
              color: active ? '#2563eb' : '#9ca3af', // Blue active, Gray inactive
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: active ? 600 : 400,
              marginBottom: 8
            }}>
              <span style={{ color: active ? '#2563eb' : '#9ca3af' }}>{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* Logout - Push to bottom of nav section visually or just regular list item? 
            Design shows it with a gap. */}
        <div style={{ marginTop: 20 }}>
          <Link to="/logout" onClick={onClose} style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '12px 0',
            color: '#9ca3af',
            textDecoration: 'none',
            fontSize: '0.95rem',
            fontWeight: 400
          }}>
            <LogOut size={20} />
            <span>Logout</span>
          </Link>
        </div>
      </nav>

    </aside>
  );
};

import { Bell, ChevronDown } from 'lucide-react';

const Header = () => {
  return (
    <header style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 32, padding: '0 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>

        {/* Notification Bell */}
        <div style={{ position: 'relative', cursor: 'pointer' }}>
          <Bell size={20} color="#6b7280" />
          <div style={{ position: 'absolute', top: -4, right: -4, background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 700, borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            4
          </div>
        </div>

        {/* Profile Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2563eb', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
              FA
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1f2937' }}>Individual Profile</span>
          </div>
          <ChevronDown size={16} color="#6b7280" />
        </div>

      </div>
    </header>
  );
};

// Placeholder Pages
const Dashboard = () => {
  return (
    <div style={{ fontFamily: 'sans-serif', color: '#4b5563' }}>
      {/* Top Banner */}
      <div style={{ background: '#dcfce7', color: '#166534', padding: '12px 24px', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderRadius: 4 }}>
        <span style={{ flex: 1 }}>Mito.Money uses cookies. By using our site you agree to our privacy policy.</span>
        <button style={{ background: 'transparent', border: 'none', color: '#166534', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
      </div>

      {/* Header Area */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 300, color: '#4ade80', margin: '0 0 4px 0' }}>
          Account Overview
        </h1>
        <p style={{ fontSize: '0.95rem', color: '#9ca3af', fontWeight: 400, margin: '0 0 16px 0' }}>
          A quick dashboard view of account status
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: '#6b7280', background: '#f3f4f6', padding: '8px 16px', borderRadius: 4 }}>
          <span>🏠 Home</span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>

        {/* Left Column: Chart */}
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ background: '#e5e7eb', padding: '12px 20px', borderRadius: 4, fontWeight: 600, color: '#374151', marginBottom: 20, fontSize: '0.95rem' }}>
            Successful transactions in the last 30 days
          </div>
          <div style={{ height: 300, position: 'relative', padding: '8px 0' }}>
            {/* Mock Chart SVG */}
            <svg viewBox="-50 -10 560 320" style={{ width: '100%', height: '100%' }}>
              {/* Grid Lines */}
              {[0, 1, 2, 3, 4, 5].map(i => (
                <line key={i} x1="0" y1={i * 60} x2="500" y2={i * 60} stroke="#e5e7eb" strokeWidth="1" />
              ))}
              {[0, 1, 2, 3, 4, 5].map(i => (
                <line key={i} x1={i * 100} y1="0" x2={i * 100} y2="300" stroke="#e5e7eb" strokeWidth="1" />
              ))}

              {/* Y Axis Labels */}
              <text x="-10" y="304" fontSize="11" fill="#6b7280" textAnchor="end">0</text>
              <text x="-10" y="244" fontSize="11" fill="#6b7280" textAnchor="end">1000</text>
              <text x="-10" y="184" fontSize="11" fill="#6b7280" textAnchor="end">2000</text>
              <text x="-10" y="124" fontSize="11" fill="#6b7280" textAnchor="end">3000</text>
              <text x="-10" y="64" fontSize="11" fill="#6b7280" textAnchor="end">4000</text>
              <text x="-10" y="14" fontSize="11" fill="#6b7280" textAnchor="end">5000</text>

              {/* Data Path (Mock) */}
              <path d="M0,280 L50,220 L75,240 L100,200 L125,260 L150,160 L175,160 L200,60 L225,220 L250,160 L275,200 L300,180 L325,220 L350,220 L375,200 L400,220 L425,180 L450,230 L475,180 L500,290"
                fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {/* Points */}
              <circle cx="200" cy="60" r="4" fill="#2563eb" />
              <circle cx="500" cy="290" r="4" fill="#2563eb" />
            </svg>
          </div>
        </div>

        {/* Right Column: Overview */}
        <div style={{ background: 'white', padding: 24, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ background: '#e5e7eb', padding: '12px 20px', borderRadius: 4, fontWeight: 600, color: '#374151', marginBottom: 20, fontSize: '0.95rem' }}>
            ℹ Overview
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <OverviewCard title="Pending Transaction" value="972" />
            <OverviewCard title="MTO Pending" value="106" />
            <OverviewCard title="Forex Pending" value="3" />

            <OverviewCard title="KYC Pending" value="0" />
            <OverviewCard title="Tickets Pending" value="15" />
            <OverviewCard title="Pin Pending" value="2408" />

            <OverviewCard title="Users Joined" value="8" />
          </div>
        </div>
      </div>
    </div>
  );
};

const OverviewCard = ({ title, value }) => (
  <div style={{
    background: '#fef3c7',
    borderRadius: 6,
    padding: '14px 10px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90
  }}>
    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#78350f', lineHeight: 1.3, marginBottom: 6 }}>
      {title.split(' ').map((word, i) => <div key={i}>{word}</div>)}
    </div>
    <div style={{ fontSize: '1.4rem', fontWeight: 600, color: '#92400e' }}>{value}</div>
  </div>
);

// Pages
import TestCheckout from './pages/TestCheckout';
import DebitLogs from './pages/Financials/DebitLogs';
import Payouts from './pages/Financials/Payouts';
import Commissions from './pages/Financials/Commissions';
import PromoCodes from './pages/Financials/PromoCodes';
import MerchantList from './pages/Merchants/MerchantList';
import OnboardingWizard from './pages/Merchants/OnboardingWizard';
import ApiKeys from './pages/Settings/ApiKeys';

// App Layout
function App() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Router>
      <div className="app-layout">
        <Sidebar isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        {mobileOpen && (
          <div className="sidebar-overlay" onClick={() => setMobileOpen(false)}></div>
        )}
        <main className="main-content">
          <button className="mobile-header-btn" onClick={() => setMobileOpen(true)}>☰</button>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/financials/debits" element={<DebitLogs />} />
            <Route path="/financials/payouts" element={<Payouts />} />
            <Route path="/financials/commissions" element={<Commissions />} />
            <Route path="/financials/promocodes" element={<PromoCodes />} />
            <Route path="/merchants" element={<MerchantList />} />
            <Route path="/merchants/onboard" element={<OnboardingWizard />} />
            <Route path="/api-keys" element={<ApiKeys />} />
            {/* Dev Route */}
            <Route path="/test-checkout" element={<TestCheckout />} />
            {/* Growth Engine */}
            <Route path="/growth/referral-settings" element={<ReferralSettings />} />
            <Route path="/growth/credit-ledger" element={<UserCreditLedger />} />
            <Route path="/growth/bonus-schemes" element={<BonusSchemeManager />} />
            <Route path="/crm/campaigns" element={<CampaignManager />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
