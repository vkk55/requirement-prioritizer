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
  Card,
  Stack,
  Divider,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import { Delete as DeleteIcon, Save as SaveIcon } from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';

interface Criterion {
  id: string;
  name: string;
  weight: number;
  scale_min: number;
  scale_max: number;
}

interface Squad {
  id: string;
  name: string;
  capacity: number;
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
  const [editingWeights, setEditingWeights] = useState<{ [id: string]: number }>({});
  const [tab, setTab] = useState<'criteria' | 'squads'>('criteria');
  const [squads, setSquads] = useState<Squad[]>([]);
  const [newSquad, setNewSquad] = useState({ name: '', capacity: 0 });
  const [editingSquad, setEditingSquad] = useState<{ [id: string]: { name: string; capacity: number } }>({});

  useEffect(() => {
    initializeCriteria();
    fetchSquads();
  }, []);

  const initializeCriteria = async () => {
    try {
      // First try to fetch existing criteria
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/criteria');
      const result = await response.json();
      
      // If no criteria exist, initialize with defaults
      if (!result.data || result.data.length === 0) {
        const initResponse = await fetch('https://requirement-prioritizer.onrender.com/api/criteria/init', {
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
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/criteria');
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

      const response = await fetch('https://requirement-prioritizer.onrender.com/api/criteria', {
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
      const response = await fetch(`https://requirement-prioritizer.onrender.com/api/criteria/${id}`, {
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

  // Helper to get sum of weights
  const weightSum = criteria.reduce((sum, c) => sum + (editingWeights[c.id] !== undefined ? editingWeights[c.id] : c.weight), 0);

  // Handle weight change
  const handleWeightChange = (id: string, value: number) => {
    setEditingWeights(prev => ({ ...prev, [id]: value }));
    setError('');
  };

  // Save weight to backend
  const handleWeightBlur = async (id: string) => {
    const newWeight = editingWeights[id];
    if (isNaN(newWeight) || newWeight < 0) {
      setError('Weight must be a non-negative number');
      return;
    }
    const newSum = criteria.reduce((sum, c) => sum + (c.id === id ? newWeight : (editingWeights[c.id] !== undefined ? editingWeights[c.id] : c.weight)), 0);
    if (newSum > 100) {
      setError('Sum of all weights cannot exceed 100');
      return;
    }
    try {
      const criterion = criteria.find(c => c.id === id);
      if (!criterion) return;
      const updated = { ...criterion, weight: newWeight };
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to update weight');
      setCriteria(prev => prev.map(c => c.id === id ? { ...c, weight: newWeight } : c));
      setSuccess('Weight updated successfully');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update weight');
    }
  };

  // Save all weights in one batch
  const handleSaveAllWeights = async () => {
    if (weightSum > 100) {
      setError('Sum of all weights cannot exceed 100');
      return;
    }
    const updates = Object.entries(editingWeights)
      .filter(([id, value]) => {
        const crit = criteria.find(c => c.id === id);
        return crit && crit.weight !== value;
      });
    if (updates.length === 0) {
      setSuccess('No changes to save');
      return;
    }
    try {
      for (const [id, value] of updates) {
        const criterion = criteria.find(c => c.id === id);
        if (!criterion) continue;
        const updated = { ...criterion, weight: value };
        const response = await fetch('https://requirement-prioritizer.onrender.com/api/criteria', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Failed to update weight');
      }
      setCriteria(prev => prev.map(c => editingWeights[c.id] !== undefined ? { ...c, weight: editingWeights[c.id] } : c));
      setEditingWeights({});
      setSuccess('All weights saved successfully');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save weights');
    }
  };

  // Fetch squads from backend
  const fetchSquads = async () => {
    try {
      console.log('Fetching squads from /api/squads...');
      const response = await fetch('/api/squads');
      console.log('Squads fetch response:', response);
      const result = await response.json();
      console.log('Squads fetch result:', result);
      if (result.success) setSquads(result.data || []);
      else {
        setError(result.message || 'Failed to fetch squads');
        console.error('Squads fetch error:', result.message || 'Failed to fetch squads');
      }
    } catch (err) {
      setError('Failed to fetch squads');
      console.error('Squads fetch exception:', err);
    }
  };

  // Add or update squad in backend
  const saveSquadToBackend = async (squad: Squad) => {
    try {
      const response = await fetch('/api/squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(squad),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to save squad');
    } catch (err) {
      setError('Failed to save squad');
      throw err;
    }
  };

  // Delete squad in backend
  const deleteSquadInBackend = async (id: string) => {
    try {
      const response = await fetch(`/api/squads/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to delete squad');
    } catch (err) {
      setError('Failed to delete squad');
      throw err;
    }
  };

  // Squad handlers
  const handleAddSquad = async () => {
    if (!newSquad.name || newSquad.capacity <= 0) {
      setError('Squad name and capacity are required');
      return;
    }
    const id = uuidv4();
    const squad = { id, name: newSquad.name, capacity: newSquad.capacity };
    try {
      await saveSquadToBackend(squad);
      setSquads([...squads, squad]);
      setNewSquad({ name: '', capacity: 0 });
      setSuccess('Squad added successfully');
      setError('');
    } catch {}
  };
  const handleEditSquad = (id: string, field: string, value: any) => {
    setEditingSquad(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };
  const handleSaveSquad = async (id: string) => {
    const edit = editingSquad[id];
    if (!edit || !edit.name || edit.capacity <= 0) {
      setError('Squad name and capacity are required');
      return;
    }
    const squad = { id, name: edit.name, capacity: edit.capacity };
    try {
      await saveSquadToBackend(squad);
      setSquads(prev => prev.map(t => t.id === id ? { ...t, ...edit } : t));
      setEditingSquad(prev => { const p = { ...prev }; delete p[id]; return p; });
      setSuccess('Squad updated successfully');
      setError('');
    } catch {}
  };
  const handleDeleteSquad = async (id: string) => {
    try {
      await deleteSquadInBackend(id);
      setSquads(prev => prev.filter(t => t.id !== id));
      setSuccess('Squad deleted successfully');
      setError('');
    } catch {}
  };

  return (
    <Stack spacing={4} sx={{ p: { xs: 1, sm: 3 }, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Settings
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Criteria" value="criteria" />
        <Tab label="Teams" value="squads" />
      </Tabs>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      {tab === 'criteria' && (
        <>
          <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Add New Criteria
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={2}>
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
              <Button variant="contained" color="primary" sx={{ fontWeight: 700, borderRadius: 2, px: 3 }} onClick={handleAddCriteria}>
                Add Criteria
              </Button>
            </Stack>
          </Card>
          <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Existing Criteria
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSaveAllWeights}
                sx={{ fontWeight: 700, borderRadius: 2 }}
                disabled={Object.keys(editingWeights).length === 0}
              >
                Save
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <TableContainer>
              <Table size="medium">
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
                    <TableRow key={criterion.id} hover>
                      <TableCell>{criterion.name}</TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          size="small"
                          value={editingWeights[criterion.id] !== undefined ? editingWeights[criterion.id] : criterion.weight}
                          onChange={e => handleWeightChange(criterion.id, parseInt(e.target.value) || 0)}
                          onBlur={() => handleWeightBlur(criterion.id)}
                          inputProps={{ min: 0, max: 100, style: { width: 60 } }}
                          error={weightSum > 100}
                        />
                      </TableCell>
                      <TableCell>{criterion.scale_min} - {criterion.scale_max}</TableCell>
                      <TableCell>
                        <IconButton color="error" onClick={() => handleDeleteCriteria(criterion.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Sum row */}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: weightSum > 100 ? 'error.main' : 'inherit' }}>{weightSum}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
      {tab === 'squads' && (
        <>
          <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Add New Squad
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={2}>
              <TextField
                label="Squad Name"
                value={newSquad.name}
                onChange={e => setNewSquad({ ...newSquad, name: e.target.value })}
              />
              <TextField
                label="Total Capacity (Hrs)"
                type="number"
                value={newSquad.capacity}
                onChange={e => setNewSquad({ ...newSquad, capacity: parseInt(e.target.value) || 0 })}
                inputProps={{ min: 0, step: 1 }}
              />
              <Button variant="contained" color="primary" sx={{ fontWeight: 700, borderRadius: 2, px: 3 }} onClick={handleAddSquad}>
                Add Squad
              </Button>
            </Stack>
          </Card>
          <Card elevation={2} sx={{ p: 3, borderRadius: 3, mt: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Existing Squads
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer>
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    <TableCell>Squad</TableCell>
                    <TableCell>Total Capacity (Hrs)</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {squads.map(squad => (
                    <TableRow key={squad.id} hover>
                      <TableCell>
                        <TextField
                          value={editingSquad[squad.id]?.name ?? squad.name}
                          onChange={e => handleEditSquad(squad.id, 'name', e.target.value)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={editingSquad[squad.id]?.capacity ?? squad.capacity}
                          onChange={e => handleEditSquad(squad.id, 'capacity', parseInt(e.target.value) || 0)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          sx={{ mr: 1, fontWeight: 700, borderRadius: 2 }}
                          onClick={() => handleSaveSquad(squad.id)}
                          disabled={!editingSquad[squad.id]}
                        >
                          Save
                        </Button>
                        <IconButton color="error" onClick={() => handleDeleteSquad(squad.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
    </Stack>
  );
};
