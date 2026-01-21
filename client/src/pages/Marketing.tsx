import { motion } from "framer-motion";
import { ArrowRight, Gift, ShieldCheck, Zap, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
// @ts-ignore
import logo from "../assets/rhemito-logo-blue.png";

export default function Marketing() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden relative selection:bg-blue-100 flex flex-col">
            {/* Animated Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/10 rounded-full blur-[120px] opacity-60 animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal/10 rounded-full blur-[120px] opacity-60 animate-pulse delay-700" />
            </div>

            {/* Navigation */}
            <nav className="absolute top-0 w-full z-50 px-6 py-4 md:py-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/">
                        <div className="flex items-center gap-2 cursor-pointer bg-white/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/40 shadow-sm hover:bg-white/80 transition-all">
                            <img src={logo} alt="Rhemito" className="w-6 h-6 object-contain" />
                            <span className="text-lg font-bold font-display tracking-tight text-slate-900">Rhemito</span>
                        </div>
                    </Link>
                    <div className="flex items-center gap-3">
                        <a href="https://www.rhemito.com/login">
                            <Button variant="ghost" className="text-slate-600 hover:text-slate-900 hover:bg-white/50">Sign in</Button>
                        </a>
                        <a href="https://www.rhemito.com/login">
                            <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-5 shadow-lg shadow-slate-900/20 transition-all hover:scale-105">
                                Open Free Account
                            </Button>
                        </a>
                    </div>
                </div>
            </nav>

            {/* Main Content - Split Screen / Compact */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 grow flex flex-col justify-center pt-24 pb-12 md:pt-0 md:pb-0">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

                    {/* Left Col: Value Prop */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6 }}
                        className="max-w-xl mx-auto lg:mx-0 text-center lg:text-left"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-wider mb-6">
                            <Star className="w-3 h-3 fill-blue-600" />
                            <span>Trusted by 50k+ in Europe</span>
                        </div>

                        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold font-display tracking-tight mb-6 leading-[1.05]">
                            Your Money, <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal">Without Borders.</span>
                        </h1>

                        <p className="text-lg text-slate-500 mb-8 leading-relaxed">
                            The smart way to move money internationally. Real exchange rates, bank-level security, and zero hidden fees.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
                            <a href="https://www.rhemito.com/login" className="w-full sm:w-auto">
                                <Button size="lg" className="w-full sm:w-auto h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-xl shadow-blue-600/30 transition-all hover:-translate-y-0.5">
                                    Get Started
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            </a>
                            <div className="hidden sm:flex items-center ml-4">
                                <div className="flex -space-x-3 items-center">
                                    <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">JD</div>
                                    <div className="w-8 h-8 rounded-full border-2 border-white bg-teal/20 flex items-center justify-center text-[10px] font-bold text-teal">SM</div>
                                    <div className="w-8 h-8 rounded-full border-2 border-white bg-purple-100 flex items-center justify-center text-[10px] font-bold text-purple-700">AK</div>
                                </div>
                                <div className="pl-3 text-left">
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />)}
                                    </div>
                                    <span className="text-xs font-medium text-slate-500">4.8/5 from 10k+ reviews</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Right Col: Offers Cards (Stacked/Compact) */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="relative"
                    >
                        {/* Decorative blurring behind cards */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-teal/20 blur-3xl -z-10 rounded-full" />

                        <div className="grid gap-5">
                            {/* Offer 1: High Priority */}
                            <div className="group relative bg-white/70 backdrop-blur-xl border border-white/60 p-6 md:p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:bg-white/90">
                                <div className="absolute top-4 right-4 bg-teal/10 text-teal-700 font-bold text-xs px-2 py-1 rounded-full uppercase tracking-wider">
                                    New Users
                                </div>
                                <div className="flex items-start gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20 shrink-0">
                                        <Gift className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-1">First Transfer Free</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed mb-4">
                                            Send up to £500 with absolutely zero fees. Test our speed on the house.
                                        </p>
                                        <a href="https://www.rhemito.com/login" className="text-blue-600 font-bold text-sm hover:underline flex items-center gap-1 group-hover:gap-2 transition-all">
                                            Claim Offer <ArrowRight className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Offer 2 */}
                            <div className="group relative bg-white/40 backdrop-blur-lg border border-white/40 p-6 md:p-8 rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-white/80">
                                <div className="flex items-start gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-teal flex items-center justify-center text-white shadow-lg shadow-teal/20 shrink-0">
                                        <ShieldCheck className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-1">Best Rate Guarantee</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed mb-4">
                                            Find a better rate? We'll match it and credit you £5.
                                        </p>
                                        <a href="https://www.rhemito.com/login" className="text-teal-700 font-bold text-sm hover:underline flex items-center gap-1 group-hover:gap-2 transition-all">
                                            See Details <ArrowRight className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Trust Footer in Column */}
                        <div className="mt-8 flex items-center justify-center lg:justify-start gap-8 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
                            <div className="flex items-center gap-2 text-slate-600">
                                <ShieldCheck className="w-5 h-5" />
                                <span className="text-xs font-bold uppercase tracking-wider">FCA Regulated</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                                <Zap className="w-5 h-5" />
                                <span className="text-xs font-bold uppercase tracking-wider">Instant Transfers</span>
                            </div>
                        </div>

                    </motion.div>
                </div>
            </div>
        </div>
    );
}
