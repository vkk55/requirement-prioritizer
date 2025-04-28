import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Alert,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { Info, Refresh, FileDownload } from '@mui/icons-material';
import * as XLSX from 'xlsx';

interface Requirement {
  key: string;
  summary: string;
  score: number;
  rank: number;
  criteria: Record<string, number>;
  priority?: string;
  status?: string;
  assignee?: string;
  timeSpent?: string;
  labels?: string;
  roughEstimate?: string;
  relatedCustomers?: string;
}

interface Criterion {
  id: string;
  name: string;
  weight: number;
  scale_min: number;
  scale_max: number;
}

// Add comments to Requirement interface
type RequirementWithComments = Requirement & { comments?: string; weight?: number };

export const StackRank = () => {
  const [requirements, setRequirements] = useState<RequirementWithComments[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedRequirement, setSelectedRequirement] = useState<RequirementWithComments | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'rank'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingComment, setEditingComment] = useState<{ [key: string]: string }>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Persist last active tab
  useEffect(() => {
    localStorage.setItem('lastTab', 'rank');
  }, []);

  useEffect(() => {
    fetchRequirements();
    fetchCriteria();
  }, []);

  const fetchCriteria = async () => {
    try {
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/criteria');
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to fetch criteria');
      setCriteria(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch criteria');
      console.error('Error fetching criteria:', err);
    }
  };

  const fetchRequirements = async () => {
    try {
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/requirements');
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to fetch requirements');
      let reqs = result.data || [];
      reqs = reqs.map((r: any) => ({ ...r, comments: r.comments || '' }));
      setRequirements(reqs);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requirements');
      console.error('Error fetching requirements:', err);
    }
  };

  // Search and filter logic
  const filteredRequirements = requirements.filter(r => {
    const matchesSearch =
      r.key.toLowerCase().includes(search.toLowerCase()) ||
      (r.summary && r.summary.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = filterStatus ? r.status === filterStatus : true;
    return matchesSearch && matchesStatus;
  });

  // Sorting logic (do not auto-sort after rank/score update)
  const sortedRequirements = [...filteredRequirements].sort((a, b) => {
    if (sortBy === 'score') {
      return sortOrder === 'desc' ? b.score - a.score : a.score - b.score;
    } else {
      return sortOrder === 'desc' ? b.rank - a.rank : a.rank - b.rank;
    }
  });

  const handleSort = (field: 'score' | 'rank') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'score' ? 'desc' : 'asc');
    }
  };

  const handleRankChange = async (key: string, newRank: string) => {
    try {
      const rankValue = parseInt(newRank);
      if (isNaN(rankValue) || rankValue < 0 || !Number.isInteger(rankValue)) {
        setError('Rank must be a non-negative whole number');
        return;
      }
      const response = await fetch(`https://requirement-prioritizer.onrender.com/api/requirements/${key}/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rank: rankValue }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to update rank');
      // Update UI immediately
      setRequirements(prev => prev.map(r => r.key === key ? { ...r, rank: rankValue } : r));
      setError('');
      setSuccess('Rank updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rank');
      console.error('Error updating rank:', err);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      const response = await fetch(`https://requirement-prioritizer.onrender.com/api/requirements/${key}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to delete requirement');
      setRequirements(prev => prev.filter(r => r.key !== key));
      setSuccess('Requirement deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete requirement');
    }
  };

  const handleCommentChange = (key: string, value: string) => {
    setEditingComment((prev) => ({ ...prev, [key]: value }));
  };

  const handleCommentSave = async (key: string) => {
    setSavingComment(key);
    try {
      const response = await fetch(`https://requirement-prioritizer.onrender.com/api/requirements/${key}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: editingComment[key] || '' }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to save comment');
      setRequirements((prev) => prev.map(r => r.key === key ? { ...r, comments: editingComment[key] } : r));
      // Keep comment visible after save
      // Do not clear editingComment
      setSuccess('Comment saved!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save comment');
    } finally {
      setSavingComment(null);
    }
  };

  const handleFixRanks = async () => {
    try {
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/requirements/fix-ranks', {
        method: 'POST',
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fix ranks');
      }

      await fetchRequirements();
      setError('');
      setSuccess('Ranks have been fixed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fix ranks');
      console.error('Error fixing ranks:', err);
    }
  };

  const handleExportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = requirements.map(req => {
        const row: Record<string, any> = {
          'Key': req.key,
          'Summary': req.summary,
          'Priority': req.priority || '',
          'Status': req.status || '',
          'Assignee': req.assignee || '',
          'Time Spent': req.timeSpent || '',
          'Labels': req.labels || '',
          'Rough Estimate': req.roughEstimate || '',
          'Related Customers': req.relatedCustomers || '',
          'Stack Rank': req.rank,
          'Overall Score': req.score?.toFixed(2) || '0'
        };

        // Add criteria scores
        criteria.forEach(criterion => {
          row[`${criterion.name} Score`] = req.criteria?.[criterion.id]?.toFixed(2) || '0';
        });

        return row;
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Requirements');

      // Save file
      XLSX.writeFile(wb, 'requirements_with_scores.xlsx');

      setSuccess('Requirements exported successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export requirements');
      console.error('Error exporting requirements:', err);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          Stack Rank Requirements
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <TextField
            label="Status"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            size="small"
            select
            SelectProps={{ native: true }}
            sx={{ minWidth: 120 }}
          >
            <option value="">All</option>
            {[...new Set(requirements.map(r => r.status).filter(Boolean))].map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </TextField>
          <Tooltip title="Fix duplicate ranks by renumbering them sequentially">
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={handleFixRanks}
            >
              Fix Numbering
            </Button>
          </Tooltip>
          <Tooltip title="Export requirements with scores and ranks to Excel">
            <Button
              variant="contained"
              color="success"
              startIcon={<FileDownload />}
              onClick={handleExportToExcel}
            >
              Export to Excel
            </Button>
          </Tooltip>
        </Box>
      </Box>

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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell onClick={() => handleSort('rank')} style={{ cursor: 'pointer' }}>Rank {sortBy === 'rank' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</TableCell>
              <TableCell>Requirement</TableCell>
              <TableCell align="right" onClick={() => handleSort('score')} style={{ cursor: 'pointer' }}>Score {sortBy === 'score' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}</TableCell>
              <TableCell>Comments</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRequirements.map((requirement) => (
              <TableRow key={requirement.key}>
                <TableCell>
                  <TextField
                    type="number"
                    value={requirement.rank}
                    onChange={(e) => handleRankChange(requirement.key, e.target.value)}
                    inputProps={{
                      min: 0,
                      step: 1,
                      style: { width: '60px' }
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {requirement.key}
                      </Typography>
                      {requirement.summary}
                    </Box>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => setSelectedRequirement(requirement)}
                      >
                        <Info fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  {requirement.score?.toFixed(2) || 0}
                </TableCell>
                <TableCell>
                  <TextField
                    value={editingComment[requirement.key] !== undefined ? editingComment[requirement.key] : (requirement.comments || '')}
                    onChange={(e) => handleCommentChange(requirement.key, e.target.value)}
                    size="small"
                    multiline
                    minRows={1}
                    maxRows={4}
                    sx={{ width: 180 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ ml: 1, mt: 1 }}
                    disabled={savingComment === requirement.key}
                    onClick={() => handleCommentSave(requirement.key)}
                  >
                    Save
                  </Button>
                </TableCell>
                <TableCell>
                  <Button color="error" size="small" onClick={() => handleDelete(requirement.key)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedRequirement && (
        <Dialog open={!!selectedRequirement} onClose={() => setSelectedRequirement(null)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Requirement Details
          </DialogTitle>
          <DialogContent>
            <List>
              <ListItem>
                <ListItemText primary="Key" secondary={selectedRequirement.key} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Summary" secondary={selectedRequirement.summary} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Score" secondary={selectedRequirement.score?.toFixed(2) || 0} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Rank" secondary={selectedRequirement.rank} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Priority" secondary={selectedRequirement.priority || 'Not set'} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Status" secondary={selectedRequirement.status || 'Not set'} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Assignee" secondary={selectedRequirement.assignee || 'Not assigned'} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Time Spent" secondary={selectedRequirement.timeSpent || 'Not set'} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Labels" secondary={selectedRequirement.labels || 'No labels'} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Rough Estimate" secondary={selectedRequirement.roughEstimate || 'Not estimated'} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Related Customers" secondary={selectedRequirement.relatedCustomers || 'None'} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Weight" secondary={selectedRequirement.weight ?? 'Not set'} />
              </ListItem>
              {criteria.length > 0 && (
                <ListItem>
                  <ListItemText
                    primary="Criteria Weights"
                    secondary={criteria.map(c => `${c.name}: ${c.weight}`).join(', ')}
                  />
                </ListItem>
              )}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedRequirement(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}; 