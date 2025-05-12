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
  productOwner?: string;
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
  const [sortBy, setSortBy] = useState<'weight'|'key'|'summary'>("weight");
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>("desc");
  const [search, setSearch] = useState('');

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

  const normalizeRequirement = (req: any): Requirement => ({
    ...req,
    timeSpent: req.timespent,
    roughEstimate: req.roughestimate,
    relatedCustomers: req.relatedcustomers,
    // fallback to camelCase if already present
    priority: req.priority,
    status: req.status,
    assignee: req.assignee,
    labels: req.labels,
    weight: req.weight,
    score: req.score,
    criteria: req.criteria,
    summary: req.summary,
    key: req.key,
    productOwner: req.productOwner,
  });

  const fetchRequirements = async () => {
    try {
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/requirements');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch requirements');
      }

      // Normalize field names
      setRequirements((result.data || []).map(normalizeRequirement));
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

  // Sorting and filtering logic
  const filteredRequirements = requirements.filter(r =>
    r.key.toLowerCase().includes(search.toLowerCase()) ||
    (r.summary || '').toLowerCase().includes(search.toLowerCase())
  );
  const sortedRequirements = [...filteredRequirements].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'weight') {
      cmp = (b.weight || 0) - (a.weight || 0);
    } else if (sortBy === 'key') {
      cmp = a.key.localeCompare(b.key);
    } else if (sortBy === 'summary') {
      cmp = (a.summary || '').localeCompare(b.summary || '');
    }
    return sortOrder === 'asc' ? -cmp : cmp;
  });

  return (
    <Stack spacing={4} sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Score Requirements
      </Typography>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <input
          type="text"
          placeholder="Search by Key or Requirement..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', minWidth: 260 }}
        />
      </Box>
      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}
      <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
        <TableContainer>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell rowSpan={2} sx={{ verticalAlign: 'bottom' }}>Requirement</TableCell>
                <TableCell
                  rowSpan={2}
                  sx={{ verticalAlign: 'bottom', cursor: 'pointer', fontWeight: 700 }}
                  onClick={() => {
                    if (sortBy === 'weight') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('weight'); setSortOrder('desc'); }
                  }}
                  align="center"
                >
                  Weight {sortBy === 'weight' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </TableCell>
                {criteria.map(criterion => (
                  <TableCell key={criterion.id} align="center">{criterion.name}</TableCell>
                ))}
                <TableCell rowSpan={2} sx={{ verticalAlign: 'bottom', display: 'flex', alignItems: 'center', gap: 1 }}>
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
              <TableRow>
                <TableCell align="center" sx={{ fontWeight: 400, color: 'text.secondary' }}>
                  {/* Empty cell for Weight row 2 */}
                </TableCell>
                {criteria.map(criterion => (
                  <TableCell key={criterion.id} align="center">
                    <Typography variant="caption" color="text.secondary">
                      Weight: {criterion.weight}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRequirements.map(requirement => (
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
                  <TableCell align="center">{requirement.weight ?? ''}</TableCell>
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
                <ListItemText primary="Product Owner" secondary={selectedRequirement.productOwner || 'Not set'} />
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
