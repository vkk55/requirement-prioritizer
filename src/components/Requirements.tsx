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
  TextField,
} from '@mui/material';
import { Info, ChatBubbleOutline as CommentIcon, ChatBubble, Event as EventIcon } from '@mui/icons-material';
import Popover from '@mui/material/Popover';
import StatusBar from './StatusBar';

type CommentEntry = { text: string; date: string };
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
  comments?: string[];
  inPlan?: boolean;
  rank?: number;
}

interface Criterion {
  id: string;
  name: string;
  weight: number;
  scale_min: number;
  scale_max: number;
}

// Utility to format seconds as 'X hr Y min' or 'Y min'
function formatTimeSpent(seconds: number) {
  if (!seconds || isNaN(seconds)) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}`;
  }
  return `${mins} min${mins !== 1 ? 's' : ''}`;
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
  const [editingComment, setEditingComment] = useState<{ [key: string]: string }>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);
  const [commentPopover, setCommentPopover] = useState<{ anchorEl: HTMLElement | null, key: string | null }>({ anchorEl: null, key: null });
  const [squads, setSquads] = useState<{ id: string; name: string; capacity: number }[]>([]);
  const [capacityString, setCapacityString] = useState('');

  useEffect(() => {
    fetchRequirements();
    fetchCriteria();
    fetchSquads();
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
    comments: Array.isArray(req.comments)
      ? req.comments.map((c: any) => typeof c === 'string' ? c : (c.text || JSON.stringify(c)))
      : req.comments
        ? [typeof req.comments === 'string' ? req.comments : JSON.stringify(req.comments)]
        : [],
    inPlan: req["InPlan?"] ?? req.inPlan,
    rank: req["rank"] ?? req.rank,
  });

  const fetchRequirements = async () => {
    try {
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/requirements');
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch requirements');
      }

      // Normalize field names
      setRequirements((result.data || []).map((r: any) => ({
        ...normalizeRequirement(r),
        comments: Array.isArray(r.comments)
          ? r.comments.map((c: any) => typeof c === 'string' ? c : (c.text || JSON.stringify(c)))
          : r.comments
            ? [typeof r.comments === 'string' ? r.comments : JSON.stringify(r.comments)]
            : [],
      })));
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

  const handleCommentChange = (key: string, value: string) => {
    setEditingComment((prev) => ({ ...prev, [key]: value }));
  };

  const handleCommentSave = async (key: string) => {
    setSavingComment(key);
    try {
      const newComment = editingComment[key]?.trim();
      if (!newComment) return;
      const req = requirements.find(r => r.key === key);
      const prevComments = req?.comments || [];
      const updatedComments = [...prevComments, newComment];
      const response = await fetch(`https://requirement-prioritizer.onrender.com/api/requirements/${key}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: JSON.stringify(updatedComments) }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to save comment');
      setRequirements((prev) => prev.map(r => r.key === key ? { ...r, comments: updatedComments } : r));
      setEditingComment(prev => ({ ...prev, [key]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save comment');
    } finally {
      setSavingComment(null);
    }
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

  // Compute scored count
  const scoredCount = requirements.filter(r => typeof r.score === 'number' && !isNaN(r.score)).length;
  const totalCount = requirements.length;
  const roughEstimateCount = requirements.filter(r => r.roughEstimate && r.roughEstimate.trim() !== '').length;
  const rankedCount = requirements.filter(r => {
    const rankNum = typeof r.rank === 'string' ? parseFloat(r.rank) : r.rank;
    return typeof rankNum === 'number' && !isNaN(rankNum) && rankNum > 0;
  }).length;
  const inPlanCount = requirements.filter(r => r.inPlan).length;

  const fetchSquads = async () => {
    try {
      const response = await fetch('/api/squads');
      const result = await response.json();
      if (result.success) setSquads(result.data || []);
    } catch {}
  };

  useEffect(() => {
    const totalCapacity = squads.reduce((sum, s) => sum + (s.capacity || 0), 0);
    const totalRoughEstimate = requirements.filter(r => r.inPlan).reduce((sum, r) => sum + (parseFloat(r.roughEstimate || '0') || 0), 0);
    setCapacityString(`${totalRoughEstimate} / ${totalCapacity}`);
  }, [squads, requirements]);

  return (
    <Stack spacing={4} sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
        <StatusBar
          scoredCount={scoredCount}
          rankedCount={rankedCount}
          totalCount={totalCount}
          capacityString={capacityString}
          roughEstimateCount={roughEstimateCount}
          roughEstimateTotal={totalCount}
          inPlanCount={inPlanCount}
          inPlanTotal={totalCount}
          onDuplicateClick={() => {}}
        />
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
        <TableContainer sx={{ maxHeight: 500, overflow: 'auto' }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell rowSpan={2} sx={{ position: 'sticky', left: 0, top: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700 }}>#</TableCell>
                <TableCell rowSpan={2} sx={{ fontWeight: 700 }}>Requirement</TableCell>
                <TableCell rowSpan={2} sx={{ position: 'sticky', left: 40, top: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700, minWidth: 80, verticalAlign: 'bottom', cursor: 'pointer' }}
                  onClick={() => {
                    if (sortBy === 'weight') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('weight'); setSortOrder('desc'); }
                  }}
                  align="center"
                >
                  Weight {sortBy === 'weight' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                </TableCell>
                {criteria.map(criterion => (
                  <TableCell key={criterion.id} align="center" sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}>{criterion.name}</TableCell>
                ))}
                <TableCell rowSpan={2} sx={{ verticalAlign: 'bottom', display: 'flex', alignItems: 'center', gap: 1, position: 'sticky', right: 0, top: 0, zIndex: 2, bgcolor: 'background.paper', minWidth: 80 }}>
                  <span style={{ display: 'flex', alignItems: 'center' }}>
                    Score
                    <Tooltip title="Score = (Σ (criterion score × criterion weight)) / (Σ weights)">
                      <IconButton size="small" tabIndex={0} aria-label="Scoring formula" sx={{ ml: 0.5 }}>
                        <Info fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Add/View Comment">
                      <IconButton size="small" sx={{ ml: 1 }} onClick={e => setCommentPopover({ anchorEl: e.currentTarget, key: null })}>
                        <CommentIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </span>
                </TableCell>
              </TableRow>
              <TableRow>
                {criteria.map(criterion => (
                  <TableCell key={criterion.id} align="center" sx={{ position: 'sticky', top: 48, zIndex: 1, bgcolor: 'background.paper' }}>
                    <Typography variant="caption" color="text.secondary">
                      Weight: {criterion.weight}
                    </Typography>
                  </TableCell>
                ))}
                <TableCell sx={{ position: 'sticky', right: 0, top: 48, zIndex: 2, bgcolor: 'background.paper', minWidth: 80 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRequirements.map((requirement, index) => (
                <TableRow key={requirement.key} hover>
                  <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700 }}>{index + 1}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{requirement.key} - {requirement.summary}</span>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => { setSelectedRequirement(requirement); setDetailsOpen(true); }}>
                          <Info fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ position: 'sticky', left: 40, zIndex: 2, bgcolor: 'background.paper' }} align="center">{requirement.weight ?? ''}</TableCell>
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
                  <TableCell align="right" sx={{ position: 'sticky', right: 0, zIndex: 2, bgcolor: 'background.paper', minWidth: 80 }}>
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
                      <IconButton size="small" sx={{ ml: 1 }} onClick={e => setCommentPopover({ anchorEl: e.currentTarget, key: requirement.key })}>
                        {(requirement.comments && requirement.comments.length > 0)
                          ? <ChatBubble fontSize="small" sx={{ color: 'success.main' }} />
                          : <CommentIcon fontSize="small" />}
                      </IconButton>
                      <Popover
                        open={commentPopover.anchorEl !== null && commentPopover.key === requirement.key}
                        anchorEl={commentPopover.anchorEl}
                        onClose={() => setCommentPopover({ anchorEl: null, key: null })}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                        PaperProps={{ sx: { p: 2, minWidth: 400, maxWidth: 600 } }}
                      >
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Comments</Typography>
                        {requirement.comments && requirement.comments.length > 0 && (
                          <Box sx={{ mb: 2 }}>
                            <Typography align="center" variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>{new Date().toLocaleDateString()}</Typography>
                            {requirement.comments.map((comment, idx) => (
                              <Box key={idx} sx={{ fontSize: 11, mb: 0.5, px: 1, py: 0.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                {comment}
                              </Box>
                            ))}
                          </Box>
                        )}
                        <TextField
                          value={editingComment[requirement.key] || ''}
                          onChange={e => handleCommentChange(requirement.key, e.target.value)}
                          multiline
                          minRows={2}
                          maxRows={6}
                          fullWidth
                          placeholder="Add a comment..."
                          autoFocus
                          sx={{ fontSize: 11, mt: 1 }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && e.ctrlKey) {
                              e.preventDefault();
                              handleCommentSave(requirement.key);
                            }
                          }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={() => handleCommentSave(requirement.key)}
                            sx={{ fontWeight: 700, borderRadius: 2 }}
                            disabled={savingComment === requirement.key}
                          >
                            Save
                          </Button>
                        </Box>
                      </Popover>
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
                <ListItemText primary="Score" secondary={selectedRequirement.score?.toFixed(2) ?? 0} />
              </ListItem>
              <ListItem>
                <ListItemText primary="Rank" secondary={selectedRequirement.rank ?? 0} />
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
                <ListItemText primary="Time Spent" secondary={formatTimeSpent(Number(selectedRequirement.timeSpent))} />
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
              <ListItem>
                <ListItemText primary="Product Owner" secondary={selectedRequirement.productOwner || 'Not set'} />
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
