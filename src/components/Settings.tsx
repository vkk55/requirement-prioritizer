import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from '@mui/material';

interface Criterion {
  id: string;
  name: string;
  weight: number;
  scale_min: number;
  scale_max: number;
}

export const Settings = () => {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [newCriteria, setNewCriteria] = useState({
    name: '',
    weight: 1,
    scale_min: 1,
    scale_max: 5,
  });

  useEffect(() => {
    initializeCriteria();
  }, []);

  const initializeCriteria = async () => {
    try {
      // First try to fetch existing criteria
      const response = await fetch('http://localhost:3001/api/criteria');
      const result = await response.json();
      
      // If no criteria exist, initialize with defaults
      if (!result.data || result.data.length === 0) {
        const initResponse = await fetch('http://localhost:3001/api/criteria/init', {
          method: 'POST'
        });
        const initResult = await initResponse.json();
        
        if (!initResult.success) {
          throw new Error(initResult.message || 'Failed to initialize criteria');
        }
        
        setCriteria(initResult.data || []);
      } else {
        setCriteria(result.data || []);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize criteria');
      console.error('Error initializing criteria:', err);
    }
  };

  const fetchCriteria = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/criteria');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch criteria');
      }
      
      setCriteria(result.data || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch criteria');
      console.error('Error fetching criteria:', err);
    }
  };

  const handleAddCriteria = async () => {
    try {
      if (!newCriteria.name) {
        setError('Criteria name is required');
        return;
      }

      const response = await fetch('http://localhost:3001/api/criteria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newCriteria),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to add criteria');
      }

      setCriteria([...criteria, result.data]);
      setNewCriteria({
        name: '',
        weight: 1,
        scale_min: 1,
        scale_max: 5,
      });
      setSuccess('Criteria added successfully');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add criteria');
      console.error('Error adding criteria:', err);
    }
  };

  const handleDeleteCriteria = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/criteria/${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to delete criteria');
      }

      setCriteria(criteria.filter(c => c.id !== id));
      setSuccess('Criteria deleted successfully');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete criteria');
      console.error('Error deleting criteria:', err);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Criteria Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Add New Criteria
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            label="Criteria Name"
            value={newCriteria.name}
            onChange={(e) => setNewCriteria({ ...newCriteria, name: e.target.value })}
          />
          <TextField
            label="Weight"
            type="number"
            value={newCriteria.weight}
            onChange={(e) => setNewCriteria({ ...newCriteria, weight: parseFloat(e.target.value) })}
            inputProps={{ min: 0, step: 0.1 }}
          />
          <TextField
            label="Scale Min"
            type="number"
            value={newCriteria.scale_min}
            onChange={(e) => setNewCriteria({ ...newCriteria, scale_min: parseInt(e.target.value) })}
          />
          <TextField
            label="Scale Max"
            type="number"
            value={newCriteria.scale_max}
            onChange={(e) => setNewCriteria({ ...newCriteria, scale_max: parseInt(e.target.value) })}
          />
          <Button variant="contained" onClick={handleAddCriteria}>
            Add Criteria
          </Button>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Weight</TableCell>
              <TableCell>Scale Range</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {criteria.map((criterion) => (
              <TableRow key={criterion.id}>
                <TableCell>{criterion.name}</TableCell>
                <TableCell>{criterion.weight}</TableCell>
                <TableCell>{criterion.scale_min} - {criterion.scale_max}</TableCell>
                <TableCell>
                  <Button
                    color="error"
                    onClick={() => handleDeleteCriteria(criterion.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
