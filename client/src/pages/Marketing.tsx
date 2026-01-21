import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Globe2, ShieldCheck, Zap, CreditCard, Clock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
// @ts-ignore
import logo from "../assets/rhemito-logo-blue.png";

const fadeIn = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
};

const stagger = {
    animate: {
        transition: {
            staggerChildren: 0.1
        }
    }
};

export default function Marketing() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 flex items-center justify-center">
                                <img src={logo} alt="Rhemito Logo" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-xl font-bold font-display tracking-tight text-slate-900">Rhemito</span>
                        </div>
                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Features</a>
                            <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">How it Works</a>
                            <a href="#testimonials" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Testimonials</a>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href="/">
                                <Button variant="ghost" className="hidden sm:inline-flex">Log in</Button>
                            </Link>
                            <Link href="/">
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">
                                    Get Started
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 lg:pt-48 lg:pb-32 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                    <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-teal/10 rounded-full blur-3xl" />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-3xl mx-auto text-slate-900">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold uppercase tracking-wider mb-6">
                                <Zap className="w-3.5 h-3.5 fill-blue-600" />
                                <span>Next Gen Payments</span>
                            </div>
                            <h1 className="text-5xl lg:text-7xl font-bold font-display tracking-tight mb-6 leading-[1.1]">
                                Global payments,<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal">simplified.</span>
                            </h1>
                            <p className="text-xl text-slate-500 mb-10 leading-relaxed">
                                Send money internationally with zero hidden fees and real-time exchange rates.
                                Experience the future of financial transactions today.
                            </p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                <Link href="/">
                                    <Button size="lg" className="h-14 px-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-lg shadow-xl shadow-slate-900/20">
                                        Start Sending Now
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </Button>
                                </Link>
                                <Button variant="outline" size="lg" className="h-14 px-8 rounded-full border-slate-200 hover:bg-white hover:text-blue-600 text-lg">
                                    View Live Rates
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-12 bg-white border-y border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {[
                            { label: "Active Users", value: "50k+" },
                            { label: "Countries Supported", value: "30+" },
                            { label: "Transaction Volume", value: "$500M+" },
                            { label: "Customer Rating", value: "4.9/5" },
                        ].map((stat, i) => (
                            <div key={i} className="text-center">
                                <div className="text-3xl lg:text-4xl font-bold text-slate-900 mb-1">{stat.value}</div>
                                <div className="text-sm font-medium text-slate-500 uppercase tracking-wide">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-slate-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold font-display text-slate-900 mb-4">Why choose Rhemito?</h2>
                        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                            We've built a platform that puts you first. Unmatched speed, bank-grade security, and the best rates in the market.
                        </p>
                    </div>

                    <motion.div
                        variants={stagger}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true }}
                        className="grid md:grid-cols-3 gap-8"
                    >
                        {[
                            {
                                icon: Zap,
                                title: "Instant Transfers",
                                desc: "Money reaches your loved ones in seconds, not days. We utilize local payment networks for maximum speed."
                            },
                            {
                                icon: ShieldCheck,
                                title: "Bank-Grade Security",
                                desc: "Your money and data are protected by 256-bit encryption and industry-leading fraud detection systems."
                            },
                            {
                                icon: Globe2,
                                title: "Global Reach",
                                desc: "Send to over 30 countries directly to bank accounts, mobile wallets, or for cash pickup."
                            },
                            {
                                icon: CreditCard,
                                title: "Low Fees",
                                desc: "We believe in transparency. See exactly what you pay and what they receive upfront. No hidden surprises."
                            },
                            {
                                icon: Clock,
                                title: "24/7 Support",
                                desc: "Our dedicated support team is available around the clock to assist you with any questions."
                            },
                            {
                                icon: Smartphone,
                                title: "All-in-One App",
                                desc: "Track transfers, manage beneficiaries, and get real-time notifications all from our mobile-friendly app."
                            }
                        ].map((feature, i) => (
                            <motion.div
                                key={i}
                                variants={fadeIn}
                                className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow group"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors duration-300">
                                    <feature.icon className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors duration-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                                <p className="text-slate-500 leading-relaxed">
                                    {feature.desc}
                                </p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 bg-slate-900">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-teal/20" />
                </div>
                <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
                    <h2 className="text-4xl md:text-5xl font-bold font-display text-white mb-6">Ready to get started?</h2>
                    <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
                        Join thousands of users who trust Rhemito for their international money transfers. Quick, safe, and reliable.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/">
                            <Button size="lg" className="h-14 px-8 rounded-full bg-white text-slate-900 hover:bg-blue-50 font-semibold text-lg">
                                Create Free Account
                            </Button>
                        </Link>
                        <Link href="/">
                            <Button variant="outline" size="lg" className="h-14 px-8 rounded-full border-blue-400/30 text-white hover:bg-white/10 text-lg backdrop-blur-sm">
                                Contact Sales
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
                        <div className="col-span-2">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 flex items-center justify-center">
                                    <img src={logo} alt="Rhemito Logo" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-xl font-bold font-display text-slate-900">Rhemito</span>
                            </div>
                            <p className="text-slate-500 max-w-xs mb-6">
                                Making global money transfers simple, secure, and affordable for everyone.
                            </p>
                            <div className="flex gap-4">
                                {/* Social placeholders */}
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="w-8 h-8 bg-slate-100 rounded-full hover:bg-blue-100 transition-colors cursor-pointer" />
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 mb-4">Company</h4>
                            <ul className="space-y-2 text-slate-500">
                                <li><a href="#" className="hover:text-blue-600">About Us</a></li>
                                <li><a href="#" className="hover:text-blue-600">Careers</a></li>
                                <li><a href="#" className="hover:text-blue-600">Press</a></li>
                                <li><a href="#" className="hover:text-blue-600">Partners</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 mb-4">Support</h4>
                            <ul className="space-y-2 text-slate-500">
                                <li><a href="#" className="hover:text-blue-600">Help Center</a></li>
                                <li><a href="#" className="hover:text-blue-600">Safety & Security</a></li>
                                <li><a href="#" className="hover:text-blue-600">Contact Us</a></li>
                                <li><a href="#" className="hover:text-blue-600">Status</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 mb-4">Legal</h4>
                            <ul className="space-y-2 text-slate-500">
                                <li><a href="#" className="hover:text-blue-600">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-blue-600">Terms of Service</a></li>
                                <li><a href="#" className="hover:text-blue-600">Cookie Policy</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-slate-100 text-center text-slate-400 text-sm">
                        &copy; {new Date().getFullYear()} Rhemito Ltd. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}
