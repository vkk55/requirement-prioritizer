import React, { useState, ReactNode } from 'react';

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
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Enter password"
        />
        <button type="submit">Enter</button>
      </form>
    </div>
  );
} 