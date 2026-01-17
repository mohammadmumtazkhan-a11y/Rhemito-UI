import React, { useState } from 'react';
import Table from '../../components/Table';

const Payouts = () => {
    const [data] = useState([
        {
            ref: "TXN-8821",
            merchant: "Global Tech Ltd",
            fxDate: "Oct 24, 2024",
            converted: "₦ 500,000",
            rate: "1 / 1545.79",
            payout: "$ 320.00",
            bank: "Chase Bank (**** 4432)",
            status: "Successful"
        },
        {
            ref: "TXN-8823",
            merchant: "Alpha Traders",
            fxDate: "Oct 25, 2024",
            converted: "₦ 750,000",
            rate: "1 / 1550.00",
            payout: "$ 480.12",
            bank: "Wells Fargo (**** 1122)",
            status: "Processing"
        }
    ]);

    const columns = [
        { header: "Ref #", accessor: "ref", render: (row) => <span style={{ fontFamily: 'monospace' }}>{row.ref}</span> },
        { header: "Merchant", accessor: "merchant" },
        { header: "FX Date", accessor: "fxDate" },
        { header: "Converted (NGN)", accessor: "converted" },
        { header: "Rate (USD/NGN)", accessor: "rate" },
        { header: "Payout Amt", accessor: "payout", render: (row) => <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{row.payout}</span> },
        { header: "Bank", accessor: "bank", render: (row) => <span style={{ color: 'var(--text-muted)' }}>{row.bank}</span> },
        {
            header: "Status", accessor: "status", render: (row) => (
                <span className={`badge ${row.status === 'Successful' ? 'success' : row.status === 'Processing' ? 'warning' : 'danger'}`}>{row.status}</span>
            )
        }
    ];

    const handleRowClick = (row) => {
        alert(`Drill-down details for ${row.merchant} (Ref: ${row.ref})`);
        // In real app, navigate to /financials/payouts/:id
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Merchant FX & Payouts</h2>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Track conversion and settlements.</p>
                </div>
                <button className="btn-primary">Download Report</button>
            </div>

            <Table
                columns={columns}
                data={data}
                actions={{
                    onRowClick: handleRowClick
                }}
            />
        </div>

    );
};

export default Payouts;
