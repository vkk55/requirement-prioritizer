import React, { useState, ReactNode } from 'react';
import { Box, Typography, Paper, TextField, Button, Stack } from '@mui/material';

const PASSWORD = 'ReqPrioritize#Nov2025'; // <-- Set your password here

interface PasswordGateProps {
  children: ReactNode;
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const [entered, setEntered] = useState(
    localStorage.getItem('pw_ok') === '1'
  );
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === PASSWORD) {
      localStorage.setItem('pw_ok', '1');
      setEntered(true);
    } else {
      alert('Incorrect password');
    }
  };

  if (entered) return <>{children}</>;

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
      </Stack>
      <Paper elevation={4} sx={{ p: 5, borderRadius: 4, minWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 700 }}>
          Enter Password
        </Typography>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <Stack direction="column" spacing={2} alignItems="center">
            <TextField
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Enter password"
              variant="outlined"
              size="medium"
              sx={{ fontSize: 20, width: 250 }}
              InputProps={{ style: { fontSize: 20, textAlign: 'center' } }}
              autoFocus
            />
            <Button type="submit" variant="contained" color="primary" size="large" sx={{ fontWeight: 700, fontSize: 18, px: 5 }}>
              Enter
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
} 