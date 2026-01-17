import React, { useState, useEffect } from 'react';
import Table from '../../components/Table';

const DebitLogs = () => {
    // Mock Data for now, eventually fetch from API
    const [data, setData] = useState([
        {
            merchantName: "Global Tech Ltd",
            date: "2024-10-24 10:30 AM",
            amount: "₦ 500,000",
            ref: "TXN-8821",
            status: "Successful"
        },
        {
            merchantName: "John Doe Logistics",
            date: "2024-10-24 11:15 AM",
            amount: "₦ 150,000",
            ref: "TXN-8822",
            status: "Pending"
        },
        {
            merchantName: "ShopRite Nigeria",
            date: "2024-10-23 09:45 PM",
            amount: "₦ 1,200,000",
            ref: "TXN-8819",
            status: "Successful"
        }
    ]);

    const columns = [
        { header: "Transaction Ref", accessor: "ref", render: (row) => <span style={{ fontFamily: 'monospace' }}>{row.ref}</span> },
        { header: "Merchant Name", accessor: "merchantName" },
        { header: "Date & Time", accessor: "date" },
        { header: "Amount Debited (NGN)", accessor: "amount", render: (row) => <span style={{ fontWeight: 600 }}>{row.amount}</span> },
        {
            header: "Status", accessor: "status", render: (row) => (
                <span className={`badge ${row.status === 'Successful' ? 'success' : 'warning'}`}>{row.status}</span>
            )
        }
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Debit Logs</h2>
                    <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Raw debit logs from merchant wallets.</p>
                </div>
                <div className="glass-panel" style={{ padding: '8px', display: 'flex', gap: 8 }}>
                    <input type="text" placeholder="Search Ref or Merchant..." style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', padding: '0 8px' }} />
                    <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.875rem' }}>Filter</button>
                </div>
            </div>

            <Table columns={columns} data={data} />
        </div>
    );
};

export default DebitLogs;
