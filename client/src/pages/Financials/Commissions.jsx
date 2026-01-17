import React from 'react';
import Table from '../../components/Table';

const Commissions = () => {
    const kpis = [
        { label: "Total Pending Commission", value: "₦ 125,000" },
        { label: "Available to Withdraw", value: "₦ 450,000", highlight: true },
        { label: "Total Paid Out", value: "₦ 1,200,000" },
    ];

    const data = [
        {
            merchant: "Global Tech Ltd",
            ref: "TXN-8821",
            debited: "₦ 500,000",
            baseComm: "₦ 5,000",
            fxSpread: "₦ 2,500",
            totalComm: "₦ 7,500",
            status: "Due"
        },
        {
            merchant: "John Doe Logistics",
            ref: "TXN-8815",
            debited: "₦ 200,000",
            baseComm: "₦ 2,000",
            fxSpread: "₦ 1,000",
            totalComm: "₦ 3,000",
            status: "Paid"
        }
    ];

    const columns = [
        { header: "Merchant", accessor: "merchant" },
        { header: "Ref #", accessor: "ref", render: (row) => <span style={{ fontFamily: 'monospace' }}>{row.ref}</span> },
        { header: "Amt Debited", accessor: "debited" },
        { header: "Base Comm.", accessor: "baseComm" },
        { header: "FX Spread", accessor: "fxSpread" },
        { header: "Total Earnings", accessor: "totalComm", render: (row) => <span style={{ color: '#4ade80', fontWeight: 700 }}>{row.totalComm}</span> },
        {
            header: "Payout Status", accessor: "status", render: (row) => (
                <span className={`badge ${row.status === 'Paid' ? 'success' : 'warning'}`}>{row.status}</span>
            )
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Commission Statement</h2>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Earnings report for Wholesale Biller.</p>
                </div>
                <button className="btn-primary">Manage Payout A/c</button>
            </div>

            {/* Mini KPI Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                {kpis.map((k, i) => (
                    <div key={i} className="glass-panel" style={{ padding: 16, border: k.highlight ? '1px solid var(--primary)' : '' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{k.label}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{k.value}</div>
                    </div>
                ))}
            </div>

            <Table columns={columns} data={data} />
        </div>
    );
};

export default Commissions;
