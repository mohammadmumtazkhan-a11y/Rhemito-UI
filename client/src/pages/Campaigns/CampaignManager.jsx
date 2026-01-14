import React, { useState, useEffect } from 'react';
import { Mail, Users, Tag, CheckCircle, Clock } from 'lucide-react';

const CampaignManager = () => {
    const [activeTab, setActiveTab] = useState('create');
    const [history, setHistory] = useState([]);

    // Wizard State
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        template_id: 'welcome_v1',
        promo_code_id: '',
        segment: 'new_users'
    });

    const [promos, setPromos] = useState([]);
    const [audienceCount, setAudienceCount] = useState(null);
    const [calculating, setCalculating] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        fetchHistory();
        fetchPromos();
    }, []);

    useEffect(() => {
        if (activeTab === 'create' && step === 3) {
            calculateAudience();
        }
    }, [formData.segment, step]);

    const fetchHistory = async () => {
        const res = await fetch('/api/campaigns');
        const data = await res.json();
        setHistory(data.data);
    };

    const fetchPromos = async () => {
        const res = await fetch('/api/promocodes');
        const data = await res.json();
        setPromos(data.data.filter(p => p.status === 'Active')); // Only active promos
    };

    const calculateAudience = async () => {
        setCalculating(true);
        try {
            const res = await fetch('/api/segments/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ segment: formData.segment })
            });
            const data = await res.json();
            setAudienceCount(data.count);
        } catch (e) {
            console.error(e);
        } finally {
            setCalculating(false);
        }
    };

    const handleSend = async () => {
        setSending(true);
        try {
            await fetch('/api/campaigns/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            alert('Campaign Queued Successfully!');
            setActiveTab('history');
            fetchHistory();
            setStep(1); // Reset
            setFormData({ ...formData, name: '' });
        } catch (err) {
            alert('Failed to send campaign');
        } finally {
            setSending(false);
        }
    };

    const renderWizard = () => {
        return (
            <div className="glass-panel" style={{ padding: 32 }}>
                {/* Steps Indicator */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16 }}>
                    {['Details', 'Select Offer', 'Audience', 'Review'].map((label, i) => (
                        <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            opacity: step === i + 1 ? 1 : step > i + 1 ? 0.6 : 0.4,
                            fontWeight: step === i + 1 ? 600 : 400,
                            color: step === i + 1 ? '#ea580c' : 'var(--text-main)'
                        }}>
                            <div style={{
                                width: 24, height: 24, borderRadius: '50%',
                                background: step > i + 1 ? '#16a34a' : step === i + 1 ? '#ea580c' : '#e5e7eb',
                                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem'
                            }}>
                                {step > i + 1 ? '✓' : i + 1}
                            </div>
                            {label}
                        </div>
                    ))}
                </div>

                {/* Step Content */}
                <div className="fade-in" style={{ minHeight: 300 }}>
                    {step === 1 && (
                        <div>
                            <h3 className="text-xl font-semibold mb-4">Campaign Details</h3>
                            <div className="mb-4">
                                <label className="block text-sm text-gray-500 mb-2">Campaign Name</label>
                                <input
                                    className="w-full p-3 border rounded-lg outline-none focus:border-orange-500"
                                    placeholder="e.g. Summer Sale Blast"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm text-gray-500 mb-2">Email Template</label>
                                <div className="grid grid-cols-3 gap-4">
                                    {['welcome_v1', 'reengagement_v2', 'holiday_special'].map(tpl => (
                                        <div
                                            key={tpl}
                                            onClick={() => setFormData({ ...formData, template_id: tpl })}
                                            className={`p-4 border rounded-lg cursor-pointer transition-all ${formData.template_id === tpl ? 'border-orange-500 bg-orange-50' : 'hover:bg-gray-50'}`}
                                        >
                                            <div className="font-semibold mb-1">{tpl.replace('_', ' ').toUpperCase()}</div>
                                            <div className="text-xs text-gray-400">Standard Layout</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <h3 className="text-xl font-semibold mb-4">Select an Offer</h3>
                            <p className="text-gray-500 mb-4">Choose an active promo code to include in this campaign.</p>
                            <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
                                {promos.map(promo => (
                                    <div
                                        key={promo.code}
                                        onClick={() => setFormData({ ...formData, promo_code_id: promo.code })}
                                        className={`p-4 border rounded-lg cursor-pointer flex justify-between items-center ${formData.promo_code_id === promo.code ? 'border-orange-500 bg-orange-50' : 'hover:bg-gray-50'}`}
                                    >
                                        <div>
                                            <span className="font-mono font-bold text-lg">{promo.code}</span>
                                            <span className="ml-3 text-sm text-gray-500">{promo.type}</span>
                                        </div>
                                        <div className="text-sm font-semibold">
                                            {promo.type === 'Percentage' ? `${promo.value}%` : `${promo.currency} ${promo.value}`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div>
                            <h3 className="text-xl font-semibold mb-4">Target Audience</h3>
                            <div className="mb-6">
                                <label className="block text-sm text-gray-500 mb-2">User Segment</label>
                                <select
                                    className="w-full p-3 border rounded-lg bg-white"
                                    value={formData.segment}
                                    onChange={e => setFormData({ ...formData, segment: e.target.value })}
                                >
                                    <option value="new_users">New Users (Active &lt; 30 days)</option>
                                    <option value="churned_users">Churned Users (Inactive &gt; 90 days)</option>
                                    <option value="all">All Users (Global Blast)</option>
                                </select>
                            </div>

                            <div className="bg-blue-50 p-6 rounded-lg flex items-center justify-between">
                                <div>
                                    <div className="text-sm text-blue-800 font-semibold mb-1">Estimated Audience Reach</div>
                                    <div className="text-xs text-blue-600">Calculated based on current user base</div>
                                </div>
                                <div className="text-3xl font-bold text-blue-900">
                                    {calculating ? '...' : audienceCount?.toLocaleString() || '0'}
                                    <span className="text-sm font-normal text-blue-600 ml-2">users</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div>
                            <h3 className="text-xl font-semibold mb-6">Review & Send</h3>
                            <div className="bg-gray-50 p-6 rounded-lg space-y-4">
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Campaign Name</span>
                                    <span className="font-semibold">{formData.name}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Template</span>
                                    <span className="font-mono text-sm">{formData.template_id}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-gray-500">Promo Offer</span>
                                    <span className="font-bold text-green-600">{formData.promo_code_id}</span>
                                </div>
                                <div className="flex justify-between pt-2">
                                    <span className="text-gray-500">Target Segment</span>
                                    <span className="font-semibold">{formData.segment.replace('_', ' ')}</span>
                                </div>
                                <div className="flex justify-between pt-2">
                                    <span className="text-gray-500">Recipients</span>
                                    <span className="font-bold">{audienceCount?.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
                    <button
                        className="btn-secondary"
                        disabled={step === 1}
                        onClick={() => setStep(s => s - 1)}
                    >
                        Back
                    </button>

                    {step < 4 ? (
                        <button
                            className="btn-primary"
                            disabled={!formData.name && step === 1 || !formData.promo_code_id && step === 2}
                            onClick={() => setStep(s => s + 1)}
                        >
                            Next Step
                        </button>
                    ) : (
                        <button
                            className="btn-primary"
                            style={{ background: '#ea580c' }}
                            onClick={handleSend}
                            disabled={sending}
                        >
                            {sending ? 'Sending...' : '🚀 Launch Campaign'}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 600 }}>Campaign Blasting</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Create and manage email marketing campaigns.</p>
                </div>
                <div style={{ background: '#f3f4f6', padding: 4, borderRadius: 8, display: 'flex', gap: 4 }}>
                    <button
                        onClick={() => setActiveTab('create')}
                        style={{ padding: '8px 16px', borderRadius: 6, background: activeTab === 'create' ? 'white' : 'transparent', fontWeight: 500, boxShadow: activeTab === 'create' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
                    >
                        Create New
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        style={{ padding: '8px 16px', borderRadius: 6, background: activeTab === 'history' ? 'white' : 'transparent', fontWeight: 500, boxShadow: activeTab === 'history' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
                    >
                        History
                    </button>
                </div>
            </div>

            {activeTab === 'create' ? renderWizard() : (
                <div className="table-wrapper">
                    <table className="data-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Sent Date</th>
                                <th>Campaign Name</th>
                                <th>Segment</th>
                                <th>Code Used</th>
                                <th>Recipients</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map(camp => (
                                <tr key={camp.id}>
                                    <td>{new Date(camp.sent_at).toLocaleString()}</td>
                                    <td style={{ fontWeight: 600 }}>{camp.name}</td>
                                    <td><span className="bg-gray-100 px-2 py-1 rounded text-xs">{camp.segment}</span></td>
                                    <td className="font-mono">{camp.promo_code}</td>
                                    <td>{camp.sent_count ? camp.sent_count.toLocaleString() : '-'}</td>
                                    <td><span className="status-badge success">{camp.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default CampaignManager;
