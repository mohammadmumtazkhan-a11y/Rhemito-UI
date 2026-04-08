import React, { useState } from "react";
import { useLocation } from "wouter";

export default function LandingPage() {
    const [, setLocation] = useLocation();
    const [sendAmount, setSendAmount] = useState("1,000.00");
    const [receiveAmount, setReceiveAmount] = useState("1,000.00");

    return (
        <div className="min-h-screen bg-white overflow-x-hidden font-sans">

            {/* Google Fonts import */}
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

            {/* ===== NAVBAR ===== */}
            <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300" style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', background: 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div className="flex items-center justify-between px-8 py-4 max-w-7xl mx-auto">
                    {/* Logo */}
                    <div className="flex items-center space-x-2.5 cursor-pointer group" onClick={() => setLocation("/home")}>
                        <div className="relative">
                            <svg width="28" height="35" viewBox="0 0 26 33" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-300 group-hover:scale-110">
                                <path d="M25.0764 30.3999C25.0471 30.0963 24.9593 29.8023 24.813 29.5351L16.8761 14.4493L24.8398 3.57589C25.5715 2.5726 25.352 1.17091 24.3471 0.439699C23.9495 0.165191 23.5007 0 22.9983 0H2.25129C1.63908 0 1.08296 0.238069 0.658557 0.655904C0.251228 1.06159 0 1.62275 0 2.24222V30.604C0 31.3109 0.348792 32.0008 0.924419 32.4162C1.83664 33.0988 3.22693 32.9434 3.95622 32.0688C3.99769 32.0227 4.03183 31.9741 4.07086 31.9279L10.3296 23.3818L21.3836 32.3312C21.5568 32.4769 21.7543 32.5911 21.9641 32.6786C23.5007 33.332 25.2447 32.0591 25.0739 30.4023L25.0764 30.3999ZM9.49542 16.915L4.5099 23.7218V4.4893H18.6006L11.5857 14.0606L15.7541 21.9825L9.49542 16.915Z" fill="url(#logo-gradient)" />
                                <defs>
                                    <linearGradient id="logo-gradient" x1="0" y1="0" x2="25" y2="33" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#4F46E5" />
                                        <stop offset="1" stopColor="#7C3AED" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <span className="text-2xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>Rhemito</span>
                    </div>

                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => setLocation("/login")}
                            className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 hover:scale-105"
                            style={{ color: '#4F46E5', background: 'rgba(79, 70, 229, 0.08)', border: '1px solid rgba(79, 70, 229, 0.15)' }}
                        >
                            Login
                        </button>
                        <button
                            onClick={() => setLocation("/login")}
                            className="px-5 py-2.5 text-white text-sm font-semibold rounded-xl shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
                            style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 4px 15px rgba(79, 70, 229, 0.35)' }}
                        >
                            Sign Up
                        </button>
                    </div>
                </div>
            </nav>

            {/* ===== HERO SECTION ===== */}
            <section className="relative h-screen flex items-center overflow-hidden pt-16" style={{ background: 'linear-gradient(135deg, #fafbff 0%, #f0f0ff 30%, #e8ecff 60%, #f5f3ff 100%)' }}>
                {/* Animated gradient orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full opacity-30"
                        style={{ background: 'radial-gradient(circle, rgba(79,70,229,0.3) 0%, transparent 70%)', animation: 'float 8s ease-in-out infinite' }} />
                    <div className="absolute top-40 right-0 w-[400px] h-[400px] rounded-full opacity-20"
                        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)', animation: 'float 10s ease-in-out infinite reverse' }} />
                    <div className="absolute bottom-10 left-1/4 w-[300px] h-[300px] rounded-full opacity-15"
                        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.3) 0%, transparent 70%)', animation: 'float 12s ease-in-out infinite' }} />
                    {/* Dot pattern */}
                    <div className="absolute inset-0 opacity-[0.03]"
                        style={{ backgroundImage: 'radial-gradient(circle, #4F46E5 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                </div>

                <div className="max-w-7xl mx-auto px-8 py-6 flex flex-col lg:flex-row items-center gap-10 relative z-10 w-full">
                    {/* Left Content */}
                    <div className="flex-1 max-w-xl">
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full mb-4 text-xs font-semibold tracking-wide uppercase"
                            style={{ background: 'rgba(79, 70, 229, 0.08)', color: '#4F46E5', border: '1px solid rgba(79, 70, 229, 0.12)' }}>
                            <span className="w-2 h-2 rounded-full mr-2" style={{ background: '#4F46E5', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                            Trusted by 50,000+ users worldwide
                        </div>
                        <h1 className="text-5xl font-extrabold leading-[1.1] mb-4 tracking-tight">
                            <span className="text-slate-900">Send it with</span>
                            <br />
                            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #4F46E5, #7C3AED, #06B6D4)' }}>Rhemito</span>
                        </h1>
                        <p className="text-base text-slate-500 leading-relaxed mb-5 max-w-md">
                            Built to make life easier for you to send money and value to your loved ones worldwide. We offer you the <strong className="text-slate-700">best rates</strong> in the market.
                        </p>
                        <div className="flex items-center space-x-4">
                            <a href="#" className="inline-block transition-transform duration-300 hover:scale-105">
                                <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on App Store" className="h-12" />
                            </a>
                            <a href="#" className="inline-block transition-transform duration-300 hover:scale-105">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" className="h-12" />
                            </a>
                        </div>
                    </div>

                    {/* Right - Calculator Card */}
                    <div className="flex-1 max-w-md w-full">
                        <div className="rounded-3xl p-5 transition-all duration-500 hover:shadow-2xl"
                            style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 25px 50px -12px rgba(79,70,229,0.15), 0 0 0 1px rgba(255,255,255,0.5)' }}>
                            {/* You Send */}
                            <div className="mb-3">
                                <label className="block text-xs text-slate-400 mb-1.5 font-semibold uppercase tracking-widest">You Send</label>
                                <div className="flex items-center rounded-2xl overflow-hidden transition-all duration-300" style={{ border: '2px solid #e2e8f0' }}>
                                    <input
                                        type="text"
                                        value={sendAmount}
                                        onChange={(e) => setSendAmount(e.target.value)}
                                        placeholder="Enter amount"
                                        className="flex-1 px-4 py-2.5 text-base font-semibold text-slate-800 focus:outline-none bg-transparent"
                                    />
                                    <div className="px-4 py-2.5 flex items-center space-x-2" style={{ background: 'rgba(79,70,229,0.04)' }}>
                                        <span className="text-lg">🇬🇧</span>
                                        <span className="text-sm font-bold text-slate-700">GBP</span>
                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Exchange icon */}
                            <div className="flex justify-center my-1">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-transform duration-300 hover:rotate-180" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
                                </div>
                            </div>

                            {/* Recipient Receives */}
                            <div className="mb-4">
                                <label className="block text-xs text-slate-400 mb-1.5 font-semibold uppercase tracking-widest">Recipient Receives</label>
                                <div className="flex items-center rounded-2xl overflow-hidden transition-all duration-300" style={{ border: '2px solid #e2e8f0' }}>
                                    <input
                                        type="text"
                                        value={receiveAmount}
                                        onChange={(e) => setReceiveAmount(e.target.value)}
                                        placeholder="Recipient gets"
                                        className="flex-1 px-4 py-2.5 text-base font-semibold text-slate-800 focus:outline-none bg-transparent"
                                    />
                                    <div className="px-4 py-2.5 flex items-center space-x-2" style={{ background: 'rgba(79,70,229,0.04)' }}>
                                        <span className="text-lg">🇬🇧</span>
                                        <span className="text-sm font-bold text-slate-700">GBP</span>
                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Transaction Details */}
                            <div className="space-y-2 mb-4 p-3 rounded-2xl" style={{ background: 'rgba(79,70,229,0.03)' }}>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Amount Sent</span>
                                    <span className="font-semibold text-slate-700">1,000.00 GBP</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Fee</span>
                                    <span className="font-semibold text-emerald-600">Free ✨</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Exchange Rate</span>
                                    <span className="font-semibold text-slate-700">1.0000</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between" style={{ borderColor: 'rgba(79,70,229,0.1)' }}>
                                    <span className="font-bold text-slate-800">Total to Pay</span>
                                    <span className="font-bold text-slate-900">1,000.00 GBP</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setLocation("/login")}
                                className="w-full text-white font-bold py-3 px-4 rounded-2xl transition-all duration-300 text-sm hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
                                style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 8px 25px rgba(79, 70, 229, 0.35)' }}
                            >
                                Continue →
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== WHY RHEMITO SECTION ===== */}
            <section className="py-24 px-8 relative" style={{ background: '#fafbff' }}>
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4" style={{ background: 'rgba(79, 70, 229, 0.08)', color: '#4F46E5' }}>
                            Why choose us
                        </span>
                        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                            Why <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>Rhemito</span>?
                        </h2>
                    </div>

                    <div className="flex flex-col lg:flex-row items-center gap-16">
                        {/* Left - User Portraits */}
                        <div className="flex-1 flex justify-center">
                            <div className="w-80 h-80 rounded-3xl overflow-hidden relative group transition-all duration-500 hover:scale-105"
                                style={{ boxShadow: '0 25px 50px -12px rgba(79,70,229,0.25)' }}>
                                <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }} />
                                <img
                                    src="https://www.rhemito.com/users.jpg"
                                    alt="Trusted users"
                                    className="w-full h-full object-cover mix-blend-luminosity opacity-70 group-hover:opacity-90 transition-opacity duration-500"
                                />
                                <div className="absolute bottom-4 left-4 right-4 p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
                                    <p className="text-white text-sm font-semibold">50,000+ happy users</p>
                                    <p className="text-blue-200 text-xs">and growing every day</p>
                                </div>
                            </div>
                        </div>

                        {/* Right - Features grid */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5">
                            {[
                                { icon: '🛡️', title: 'Used & Trusted', desc: 'Join thousands who love and use Rhemito.', color: '#4F46E5' },
                                { icon: '🌍', title: '156 Countries & More', desc: 'Use Rhemito daily to send money back home to your loved ones.', color: '#7C3AED' },
                                { icon: '✨', title: 'Simple To Use', desc: 'Sending money is just as simple as sending a chat message.', color: '#06B6D4' },
                                { icon: '🤝', title: 'Amazing Partners', desc: 'We work with the best partners in the industry.', color: '#10B981' },
                            ].map((feature, i) => (
                                <div key={i} className="p-6 rounded-2xl transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-default group"
                                    style={{ background: 'white', border: '1px solid rgba(0,0,0,0.05)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 transition-transform duration-300 group-hover:scale-110"
                                        style={{ background: `${feature.color}10` }}>
                                        {feature.icon}
                                    </div>
                                    <h3 className="font-bold text-slate-800 mb-1">{feature.title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== BUSINESS & INDIVIDUAL PAYMENTS ===== */}
            <section className="py-24 px-8 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #f0f0ff 0%, #e8ecff 50%, #f5f3ff 100%)' }}>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #4F46E5 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                <div className="max-w-7xl mx-auto text-center relative z-10">
                    <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4" style={{ background: 'rgba(79, 70, 229, 0.08)', color: '#4F46E5' }}>
                        Lightning fast
                    </span>
                    <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
                        Fast and reliable payments for
                        <br />
                        <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>businesses and individuals</span>
                    </h2>
                    <p className="text-slate-500 mb-14 max-w-lg mx-auto">Making life easier, one transaction at a time</p>

                    <div className="flex flex-col lg:flex-row items-center justify-center gap-16">
                        {/* Phone Mockup - Premium */}
                        <div className="relative group">
                            <div className="absolute -inset-4 rounded-[56px] opacity-50 group-hover:opacity-80 transition-opacity duration-500 blur-2xl" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }} />
                            <div className="relative w-[280px] bg-slate-900 rounded-[48px] p-3 shadow-2xl" style={{ border: '4px solid #2d2d3d' }}>
                                {/* Notch */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-900 rounded-b-2xl z-10" />
                                <div className="w-full aspect-[9/19] bg-white rounded-[40px] overflow-hidden flex flex-col">
                                    <div className="p-5 pt-8 text-center" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                                        <p className="text-blue-200 text-xs font-medium">Welcome back 👋</p>
                                        <p className="text-blue-200 text-[10px] mt-2 uppercase tracking-widest">Your balance</p>
                                        <p className="text-white text-3xl font-extrabold mt-1">£2,450<span className="text-lg opacity-70">.00</span></p>
                                    </div>
                                    <div className="p-4 flex-1">
                                        <div className="flex justify-around mb-5">
                                            {[
                                                { emoji: '📤', label: 'Send' },
                                                { emoji: '📥', label: 'Request' },
                                                { emoji: '📱', label: 'Top Up' },
                                            ].map((action, i) => (
                                                <div key={i} className="text-center">
                                                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center mx-auto mb-1.5 shadow-sm" style={{ background: '#f0f0ff' }}>
                                                        <span className="text-base">{action.emoji}</span>
                                                    </div>
                                                    <span className="text-[10px] font-semibold text-slate-500">{action.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 mb-3">Recent</p>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2.5">
                                                    <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center"><span className="text-xs">✅</span></div>
                                                    <div>
                                                        <p className="text-[11px] font-semibold text-slate-800">Sarah Johnson</p>
                                                        <p className="text-[9px] text-slate-400">Today, 2:30 PM</p>
                                                    </div>
                                                </div>
                                                <span className="text-[11px] font-bold text-emerald-600">+£250</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2.5">
                                                    <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center"><span className="text-xs">📤</span></div>
                                                    <div>
                                                        <p className="text-[11px] font-semibold text-slate-800">Mobile Top Up</p>
                                                        <p className="text-[9px] text-slate-400">Yesterday</p>
                                                    </div>
                                                </div>
                                                <span className="text-[11px] font-bold text-red-500">-£15</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right side CTA */}
                        <div className="flex flex-col items-center lg:items-start space-y-6 max-w-sm">
                            <div className="space-y-4">
                                {[
                                    { num: '50K+', label: 'Active Users' },
                                    { num: '156', label: 'Countries Supported' },
                                    { num: '99.9%', label: 'Uptime Guarantee' },
                                ].map((stat, i) => (
                                    <div key={i} className="flex items-center space-x-4 p-4 rounded-2xl transition-all duration-300 hover:scale-105" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)' }}>
                                        <span className="text-2xl font-extrabold bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>{stat.num}</span>
                                        <span className="text-sm text-slate-600 font-medium">{stat.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center space-x-3 pt-2">
                                <a href="#" className="inline-block transition-transform duration-300 hover:scale-105">
                                    <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on App Store" className="h-11" />
                                </a>
                                <a href="#" className="inline-block transition-transform duration-300 hover:scale-105">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" className="h-11" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== MULTIPLE WAYS TO SEND MONEY ===== */}
            <section className="py-24 px-8 bg-white">
                <div className="max-w-7xl mx-auto text-center">
                    <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4" style={{ background: 'rgba(79, 70, 229, 0.08)', color: '#4F46E5' }}>
                        Flexible options
                    </span>
                    <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-14">
                        Multiple ways to <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>send money</span>
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {[
                            {
                                icon: (
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#06B6D4' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
                                    </svg>
                                ),
                                title: 'Bank Deposit',
                                desc: 'Send money straight to bank accounts worldwide instantly.',
                                gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                                bgLight: '#ecfeff',
                            },
                            {
                                icon: (
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#4F46E5' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                ),
                                title: 'Mobile Topup',
                                desc: 'Top up all network providers directly from Rhemito.',
                                gradient: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                                bgLight: '#eef2ff',
                            },
                            {
                                icon: (
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#E11D48' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                ),
                                title: 'Mobile Money Wallet',
                                desc: 'Transfers made instantly to Mobile Money accounts.',
                                gradient: 'linear-gradient(135deg, #E11D48, #F43F5E)',
                                bgLight: '#fff1f2',
                            },
                        ].map((method, i) => (
                            <div key={i} className="p-8 rounded-3xl transition-all duration-500 hover:scale-105 hover:shadow-2xl group cursor-default" style={{ background: 'white', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)' }}>
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                                    style={{ background: method.bgLight }}>
                                    {method.icon}
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-3">{method.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{method.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== DOWNLOAD MOBILE APP ===== */}
            <section className="py-24 px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="rounded-[32px] p-12 flex flex-col lg:flex-row items-center gap-12 relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #6D28D9 100%)' }}>
                        {/* Background decoration */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(30%, -30%)' }} />
                            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(-30%, 30%)' }} />
                        </div>

                        {/* Phone Mockup Mini */}
                        <div className="relative flex-shrink-0 z-10">
                            <div className="w-52 bg-slate-800 rounded-[36px] p-2 shadow-2xl" style={{ border: '3px solid rgba(255,255,255,0.1)' }}>
                                <div className="w-full aspect-[9/19] bg-white rounded-[28px] overflow-hidden flex flex-col">
                                    <div className="p-3 pt-5 text-center" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
                                        <p className="text-white text-[10px] font-bold">Dashboard</p>
                                        <p className="text-blue-200 text-[8px] mt-1.5 uppercase tracking-widest">Total Balance</p>
                                        <p className="text-white text-xl font-extrabold">£5,230</p>
                                    </div>
                                    <div className="p-3 flex-1">
                                        <p className="text-[9px] font-bold text-slate-700 mb-2">Quick Actions</p>
                                        <div className="grid grid-cols-3 gap-1.5 mb-3">
                                            {[
                                                { emoji: '💸', label: 'Send' },
                                                { emoji: '📲', label: 'Top Up' },
                                                { emoji: '📊', label: 'History' },
                                            ].map((a, i) => (
                                                <div key={i} className="rounded-xl p-1.5 text-center" style={{ background: '#f5f3ff' }}>
                                                    <span className="text-sm">{a.emoji}</span>
                                                    <p className="text-[7px] text-slate-500 font-semibold mt-0.5">{a.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[9px] font-bold text-slate-700 mb-1">Billers</p>
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-1.5 p-1.5 bg-slate-50 rounded-lg">
                                                <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center"><span className="text-[8px]">⚡</span></div>
                                                <p className="text-[9px] text-slate-600 font-medium">Electricity</p>
                                            </div>
                                            <div className="flex items-center space-x-1.5 p-1.5 bg-slate-50 rounded-lg">
                                                <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-[8px]">💧</span></div>
                                                <p className="text-[9px] text-slate-600 font-medium">Water</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CTA */}
                        <div className="flex-1 text-white text-center lg:text-left relative z-10">
                            <h3 className="text-3xl font-extrabold mb-4 leading-tight">Get started in<br />minutes</h3>
                            <p className="text-blue-200 mb-8 leading-relaxed text-base">
                                Download the Rhemito app and experience the fastest way to send money worldwide. Available on iOS and Android.
                            </p>
                            <div className="flex items-center justify-center lg:justify-start space-x-3">
                                <a href="#" className="inline-block transition-all duration-300 hover:scale-105 hover:brightness-110">
                                    <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on App Store" className="h-12" />
                                </a>
                                <a href="#" className="inline-block transition-all duration-300 hover:scale-105 hover:brightness-110">
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" className="h-12" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ===== FOOTER ===== */}
            <footer className="pt-16 pb-8 px-8" style={{ background: '#fafbff' }}>
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between mb-10">
                        {/* Logo */}
                        <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setLocation("/home")}>
                            <svg width="24" height="30" viewBox="0 0 26 33" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M25.0764 30.3999C25.0471 30.0963 24.9593 29.8023 24.813 29.5351L16.8761 14.4493L24.8398 3.57589C25.5715 2.5726 25.352 1.17091 24.3471 0.439699C23.9495 0.165191 23.5007 0 22.9983 0H2.25129C1.63908 0 1.08296 0.238069 0.658557 0.655904C0.251228 1.06159 0 1.62275 0 2.24222V30.604C0 31.3109 0.348792 32.0008 0.924419 32.4162C1.83664 33.0988 3.22693 32.9434 3.95622 32.0688C3.99769 32.0227 4.03183 31.9741 4.07086 31.9279L10.3296 23.3818L21.3836 32.3312C21.5568 32.4769 21.7543 32.5911 21.9641 32.6786C23.5007 33.332 25.2447 32.0591 25.0739 30.4023L25.0764 30.3999ZM9.49542 16.915L4.5099 23.7218V4.4893H18.6006L11.5857 14.0606L15.7541 21.9825L9.49542 16.915Z" fill="#4F46E5" />
                            </svg>
                            <span className="text-xl font-bold text-slate-800">Rhemito</span>
                        </div>

                        <div className="flex items-center space-x-8 mt-6 md:mt-0">
                            {['About Us', 'FAQ', 'Terms', 'Privacy', 'Contact Us'].map((link) => (
                                <a key={link} href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors duration-300 font-medium">{link}</a>
                            ))}
                        </div>

                        <div className="flex items-center space-x-3 mt-6 md:mt-0">
                            {/* Social Icons */}
                            {[
                                <path key="fb" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />,
                                <path key="x" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
                                <path key="ig" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />,
                            ].map((icon, i) => (
                                <a key={i} href="#" className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110"
                                    style={{ background: 'rgba(79,70,229,0.06)' }}>
                                    <svg className="w-4 h-4" fill="#4F46E5" viewBox="0 0 24 24">{icon}</svg>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Legal */}
                    <div className="text-center border-t pt-8" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                        <p className="text-[11px] text-slate-400 leading-relaxed max-w-4xl mx-auto mb-4">
                            FunTech Global Communications Ltd is registered in England and Wales with company registration number 08542370.
                            Registered with HMRC as a Money Service Business (MSB) under the Money Laundering, Terrorist Financing and Transfer of Funds
                            (Information on the Payer) Regulation 2017 (as amended). HMRC Registration FRN: 815146. MLR NO: 12803115.
                            Registered office: Salisbury House, 29 Finsbury Circus, London EC2M 5QQ.
                        </p>
                        <p className="text-xs text-slate-400 font-medium">© 2026 Funtech Global. All rights reserved</p>
                    </div>
                </div>
            </footer>

            {/* ===== CSS Animations ===== */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) scale(1); }
                    50% { transform: translateY(-20px) scale(1.05); }
                }
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.3); }
                }
                html { scroll-behavior: smooth; }
            `}</style>
        </div>
    );
}
