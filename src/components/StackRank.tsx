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

export const StackRank = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);

  useEffect(() => {
    fetchRequirements();
    fetchCriteria();
  }, []);

  const fetchCriteria = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/criteria');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch criteria');
      }
      
      setCriteria(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch criteria');
      console.error('Error fetching criteria:', err);
    }
  };

  const fetchRequirements = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/requirements');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch requirements');
      }
      
      // Sort requirements by score (descending) and rank
      const sortedRequirements = (result.data || []).sort((a: Requirement, b: Requirement) => {
        if (a.rank === b.rank) {
          return b.score - a.score;
        }
        return a.rank - b.rank;
      });

      setRequirements(sortedRequirements);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requirements');
      console.error('Error fetching requirements:', err);
    }
  };

  const handleRankChange = async (key: string, newRank: string) => {
    try {
      // Validate input
      const rankValue = parseInt(newRank);
      if (isNaN(rankValue) || rankValue < 0 || !Number.isInteger(rankValue)) {
        setError('Rank must be a non-negative whole number');
        return;
      }

      const response = await fetch(`http://localhost:3001/api/requirements/${key}/rank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rank: rankValue }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to update rank');
      }

      await fetchRequirements(); // Refresh the list to get the sorted order
      setError('');
      setSuccess('Rank updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rank');
      console.error('Error updating rank:', err);
    }
  };

  const handleFixRanks = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/requirements/fix-ranks', {
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
              <TableCell>Rank</TableCell>
              <TableCell>Requirement</TableCell>
              <TableCell align="right">Score</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requirements.map((requirement) => (
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