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
  Rating,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Card,
  Stack,
  Divider,
} from '@mui/material';
import { Info } from '@mui/icons-material';

interface Requirement {
  key: string;
  summary: string;
  score: number;
  criteria: Record<string, number>;
  priority?: string;
  status?: string;
  assignee?: string;
  timeSpent?: string;
  labels?: string;
  roughEstimate?: string;
  relatedCustomers?: string;
  weight?: number;
}

interface Criterion {
  id: string;
  name: string;
  weight: number;
  scale_min: number;
  scale_max: number;
}

export const Requirements = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [error, setError] = useState<string>('');
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchRequirements();
    fetchCriteria();
  }, []);

  const fetchCriteria = async () => {
    try {
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/criteria');
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
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/requirements');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch requirements');
      }
      
      setRequirements(result.data || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requirements');
      console.error('Error fetching requirements:', err);
    }
  };

  const handleScoreChange = async (key: string, criteriaId: string, newScore: number) => {
    try {
      const requirement = requirements.find(r => r.key === key);
      if (!requirement) return;

      const updatedCriteria = {
        ...requirement.criteria,
        [criteriaId]: newScore
      };

      // Calculate weighted score (fix: ensure weights are numbers)
      let totalWeightedScore = 0;
      let totalWeight = 0;

      criteria.forEach(criterion => {
        const score = updatedCriteria[criterion.id];
        const weight = typeof criterion.weight === 'string' ? parseFloat(criterion.weight) : criterion.weight;
        if (score !== undefined && weight) {
          totalWeightedScore += score * weight;
          totalWeight += weight;
        }
      });

      const weightedScore = totalWeight > 0 ? +(totalWeightedScore / totalWeight).toFixed(2) : 0;

      const response = await fetch(`https://requirement-prioritizer.onrender.com/api/requirements/${key}/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          score: weightedScore,
          criteria: updatedCriteria,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to update score');
      }

      setRequirements(prev =>
        prev.map(req =>
          req.key === key
            ? { ...req, score: weightedScore, criteria: updatedCriteria }
            : req
        )
      );
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update score');
      console.error('Error updating score:', err);
    }
  };

  const handleOpenDetails = (requirement: Requirement) => {
    setSelectedRequirement(requirement);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedRequirement(null);
  };

  return (
    <Stack spacing={4} sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Score Requirements
      </Typography>
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}
      <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
        <TableContainer>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell>Requirement</TableCell>
                {criteria.map(criterion => (
                  <TableCell key={criterion.id}>
                    <Stack spacing={0.5} alignItems="center">
                      <span>{criterion.name}</span>
                      <Typography variant="caption" color="text.secondary">
                        Weight: {criterion.weight}
                      </Typography>
                    </Stack>
                  </TableCell>
                ))}
                <TableCell>Time Spent</TableCell>
                <TableCell>Rough Estimate</TableCell>
                <TableCell>Related Customers</TableCell>
                <TableCell style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    Score
                    <Tooltip title="Score = (Σ (criterion score × criterion weight)) / (Σ weights)">
                      <IconButton size="small" tabIndex={0} aria-label="Scoring formula" sx={{ ml: 0.5 }}>
                        <Info fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </span>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requirements.map(requirement => (
                <TableRow key={requirement.key} hover>
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
                          onClick={() => handleOpenDetails(requirement)}
                          sx={{ ml: 1 }}
                        >
                          <Info fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  {criteria.map(criterion => (
                    <TableCell key={criterion.id}>
                      <Rating
                        value={requirement.criteria?.[criterion.id] || 0}
                        max={criterion.scale_max}
                        onChange={(_, newValue) =>
                          handleScoreChange(requirement.key, criterion.id, newValue || 0)
                        }
                      />
                    </TableCell>
                  ))}
                  <TableCell>{requirement.timeSpent || ''}</TableCell>
                  <TableCell>{requirement.roughEstimate || ''}</TableCell>
                  <TableCell>{requirement.relatedCustomers || ''}</TableCell>
                  <TableCell align="right">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {(() => {
                        let totalWeightedScore = 0;
                        let totalWeight = 0;
                        criteria.forEach(criterion => {
                          const score = requirement.criteria?.[criterion.id] ?? 0;
                          const weight = typeof criterion.weight === 'string' ? parseFloat(criterion.weight) : criterion.weight;
                          if (weight) {
                            totalWeightedScore += score * weight;
                            totalWeight += weight;
                          }
                        });
                        return totalWeight > 0 ? +(totalWeightedScore / totalWeight).toFixed(2) : 0;
                      })()}
                      <Tooltip
                        title={(() => {
                          const mathParts = criteria.map(criterion => {
                            const score = requirement.criteria?.[criterion.id] ?? 0;
                            return `${score}×${criterion.weight}`;
                          });
                          const numerator = mathParts.join(' + ');
                          const denominator = criteria.map(c => c.weight).join('+');
                          let totalWeightedScore = 0;
                          let totalWeight = 0;
                          criteria.forEach(criterion => {
                            const score = requirement.criteria?.[criterion.id] ?? 0;
                            const weight = typeof criterion.weight === 'string' ? parseFloat(criterion.weight) : criterion.weight;
                            if (weight) {
                              totalWeightedScore += score * weight;
                              totalWeight += weight;
                            }
                          });
                          const weightedScore = totalWeight > 0 ? +(totalWeightedScore / totalWeight).toFixed(2) : 0;
                          return `(${numerator}) / (${denominator}) = ${weightedScore}`;
                        })()}
                        placement="top"
                        arrow
                      >
                        <span>
                          <IconButton size="small" tabIndex={0} aria-label="Show scoring math">
                            <Info fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      <Dialog
        open={detailsOpen}
        onClose={handleCloseDetails}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 24 }}>Requirement Details</DialogTitle>
        <DialogContent>
          {selectedRequirement && (
            <List>
              <ListItem>
                <ListItemText primary="Key" secondary={selectedRequirement.key} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Summary" secondary={selectedRequirement.summary} />
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
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDetails} sx={{ fontWeight: 700, borderRadius: 2 }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
