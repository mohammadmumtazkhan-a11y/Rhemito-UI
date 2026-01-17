import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Component', () => {
    it('renders the dashboard by default', () => {
        render(<App />);
        // Expect "Mito Admin" from sidebar or "Welcome back" from header
        expect(screen.getByText(/Mito Admin/i)).toBeInTheDocument();
        expect(screen.getByText(/Account Overview/i)).toBeInTheDocument();
    });
});
