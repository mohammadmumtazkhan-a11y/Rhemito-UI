import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const OnboardingWizard = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        type: 'Business',
        name: '',
        regNumber: '',
        country: 'Nigeria',
        email: '',
        website: '',
        contactName: '',
        bankName: '',
        accountNumber: '',
        baseCurrency: 'NGN',
        payoutCurrency: 'USD'
    });

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = (e) => {
        e.preventDefault();
        // In real app: POST to API
        alert("Merchant Onboarded Successfully!");
        navigate('/merchants');
    };

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <h2 style={{ marginBottom: 32 }}>Onboard New Merchant</h2>

            <div className="glass-panel" style={{ padding: 32 }}>
                {/* Steps Indicator */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 32, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
                    <div style={{ color: step === 1 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }} onClick={() => setStep(1)}>1. Profile Details</div>
                    <div style={{ color: step === 2 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }} onClick={() => setStep(2)}>2. Bank Details</div>
                </div>

                <form onSubmit={handleSubmit}>
                    {step === 1 && (
                        <div style={{ display: 'grid', gap: 24 }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem' }}>Merchant Type</label>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="radio" name="type" value="Business" checked={formData.type === 'Business'} onChange={handleChange} /> Business
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="radio" name="type" value="Individual" checked={formData.type === 'Individual'} onChange={handleChange} /> Individual
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem' }}>Merchant Name</label>
                                    <input className="glass-panel" type="text" name="name" value={formData.name} onChange={handleChange} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', color: 'white', outline: 'none' }} placeholder="e.g. Global Tech" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem' }}>Registration Number / ID</label>
                                    <input className="glass-panel" type="text" name="regNumber" value={formData.regNumber} onChange={handleChange} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', color: 'white', outline: 'none' }} placeholder="RC-12345" />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem' }}>Email Address</label>
                                    <input className="glass-panel" type="email" name="email" value={formData.email} onChange={handleChange} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', color: 'white', outline: 'none' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem' }}>Website</label>
                                    <input className="glass-panel" type="text" name="website" value={formData.website} onChange={handleChange} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', color: 'white', outline: 'none' }} />
                                </div>
                            </div>

                            <button type="button" className="btn-primary" onClick={() => setStep(2)} style={{ width: 'fit-content' }}>Next Step &rarr;</button>
                        </div>
                    )}

                    {step === 2 && (
                        <div style={{ display: 'grid', gap: 24 }}>
                            <div style={{ padding: 16, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <h4 style={{ margin: '0 0 8px 0', color: '#60a5fa' }}>Payout Configuration</h4>
                                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Configure where this merchant receives their settlement.</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem' }}>Payout Currency</label>
                                    <select className="glass-panel" name="payoutCurrency" value={formData.payoutCurrency} onChange={handleChange} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', color: 'white', outline: 'none' }}>
                                        <option value="USD">USD ($)</option>
                                        <option value="GBP">GBP (£)</option>
                                        <option value="EUR">EUR (€)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem' }}>Bank Name</label>
                                    <input className="glass-panel" type="text" name="bankName" value={formData.bankName} onChange={handleChange} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', color: 'white', outline: 'none' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem' }}>Account Number / IBAN</label>
                                <input className="glass-panel" type="text" name="accountNumber" value={formData.accountNumber} onChange={handleChange} style={{ width: '100%', padding: '12px', boxSizing: 'border-box', color: 'white', outline: 'none' }} />
                            </div>

                            <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                                <button type="button" onClick={() => setStep(1)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'white', borderRadius: 8, cursor: 'pointer' }}>&larr; Back</button>
                                <button type="submit" className="btn-primary">Complete Onboarding</button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default OnboardingWizard;
