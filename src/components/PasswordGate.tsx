import React, { useState, ReactNode } from 'react';
import { Box, Typography, Paper, TextField, Button, Stack, CircularProgress, Alert } from '@mui/material';

interface PasswordGateProps {
  children: ReactNode;
}

// Use window.location.hostname to determine API base
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';

export default function PasswordGate({ children }: PasswordGateProps) {
  const [step, setStep] = useState<'email' | 'otp' | 'done'>(
    localStorage.getItem('jwt_token') ? 'done' : 'email'
  );
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    setStep('email');
    setEmail('');
    setOtp('');
    setError(null);
    setInfo(null);
  };

  // Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.endsWith('@viseven.com')) {
      setError('Only viseven.com email addresses are allowed.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || data.message || 'Failed to send OTP.');
      } else {
        setInfo('OTP sent to your email.');
        setStep('otp');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.token) {
        setError(data.error || data.message || 'Invalid OTP.');
      } else {
        localStorage.setItem('jwt_token', data.token);
        setStep('done');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return <>{children}</>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', alignItems: 'center', justifyContent: 'center', bgcolor: '#f4f6fa' }}>
      {/* App Header */}
      <Stack direction="row" alignItems="center" spacing={2} mb={4}>
        <Box
          component="img"
          src="/ewizard-logo.png"
          alt="eWizard Logo"
          sx={{ height: 56, borderRadius: 2, boxShadow: 1, bgcolor: 'white' }}
        />
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: 1, color: 'primary.main' }}>
          eWizard Requirement Prioritizer
        </Typography>
        <Button onClick={handleLogout} sx={{ ml: 4, fontWeight: 700 }} color="secondary" variant="outlined">Logout</Button>
      </Stack>
      <Paper elevation={4} sx={{ p: 5, borderRadius: 4, minWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
          {step === 'email' ? 'Login with OTP' : 'Enter OTP'}
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {info && <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert>}
        {step === 'email' && (
          <form onSubmit={handleRequestOtp} style={{ width: '100%' }}>
            <Stack direction="column" spacing={2} alignItems="center">
              <TextField
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your viseven.com email"
                variant="outlined"
                size="medium"
                sx={{ fontSize: 20, width: 250 }}
                InputProps={{ style: { fontSize: 20, textAlign: 'center' } }}
                autoFocus
                required
              />
              <Button type="submit" variant="contained" color="primary" size="large" sx={{ fontWeight: 700, fontSize: 18, px: 5 }} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : 'Send OTP'}
              </Button>
            </Stack>
          </form>
        )}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} style={{ width: '100%' }}>
            <Stack direction="column" spacing={2} alignItems="center">
              <TextField
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="Enter OTP"
                variant="outlined"
                size="medium"
                sx={{ fontSize: 20, width: 250, letterSpacing: 6 }}
                InputProps={{ style: { fontSize: 20, textAlign: 'center', letterSpacing: 6 } }}
                autoFocus
                required
              />
              <Button type="submit" variant="contained" color="primary" size="large" sx={{ fontWeight: 700, fontSize: 18, px: 5 }} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : 'Verify OTP'}
              </Button>
              <Button onClick={() => { setStep('email'); setOtp(''); setError(null); setInfo(null); }} sx={{ mt: 1 }} color="secondary">
                Back to Email
              </Button>
            </Stack>
          </form>
        )}
      </Paper>
    </Box>
  );
} 