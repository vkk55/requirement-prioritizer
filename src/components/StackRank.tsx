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
  Card,
  Stack,
  Divider,
} from '@mui/material';
import { Info, Refresh, FileDownload, Check, Delete as DeleteIcon, Save as SaveIcon, History as HistoryIcon, ChatBubbleOutline as CommentIcon, ChatBubble, Event as EventIcon, InfoOutlined } from '@mui/icons-material';
import * as XLSX from 'xlsx';
import Popover from '@mui/material/Popover';
import StatusBar from './StatusBar';

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
  productOwner?: string;
  inPlan?: boolean;
}

interface Criterion {
  id: string;
  name: string;
  weight: number;
  scale_min: number;
  scale_max: number;
}

// Update RequirementWithComments type
type RequirementWithComments = Requirement & { comments?: string[]; weight?: number; updatehistory?: string };

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

export const StackRank = () => {
  const [requirements, setRequirements] = useState<RequirementWithComments[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [selectedRequirement, setSelectedRequirement] = useState<RequirementWithComments | null>(null);
  const [sortBy, setSortBy] = useState<'rank' | 'score'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingComment, setEditingComment] = useState<{ [key: string]: string }>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editingRank, setEditingRank] = useState<{ [key: string]: string }>({});
  const [rankError, setRankError] = useState<{ [key: string]: string }>({});
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean, key: string, newRank: string } | null>(null);
  const [commentPopover, setCommentPopover] = useState<{ anchorEl: HTMLElement | null, key: string | null }>({ anchorEl: null, key: null });
  const [commentCursor, setCommentCursor] = useState<{ [key: string]: number }>({});
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean, log: string }>({ open: false, log: '' });
  const [duplicateDialog, setDuplicateDialog] = useState(false);
  const [squads, setSquads] = useState<{ id: string; name: string; capacity: number }[]>([]);
  const [capacityString, setCapacityString] = useState('');

  // Persist last active tab
  useEffect(() => {
    localStorage.setItem('lastTab', 'rank');
  }, []);

  useEffect(() => {
    fetchRequirements();
    fetchCriteria();
    setSortBy('rank');
    setSortOrder('asc');
  }, []);

  useEffect(() => {
    fetchSquads();
  }, []);

  useEffect(() => {
    const totalCapacity = squads.reduce((sum, s) => sum + (s.capacity || 0), 0);
    const totalRoughEstimate = requirements.filter(r => r.inPlan).reduce((sum, r) => sum + (parseFloat(r.roughEstimate || '0') || 0), 0);
    setCapacityString(`${totalRoughEstimate} / ${totalCapacity}`);
  }, [squads, requirements]);

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
      reqs = reqs.map((r: any) => ({
        ...r,
        roughEstimate: r.roughestimate,
        inPlan: r["InPlan?"] ?? false,
        comments: Array.isArray(r.comments)
          ? r.comments.map((c: any) => typeof c === 'string' ? c : (c.text || JSON.stringify(c)))
          : r.comments
            ? [typeof r.comments === 'string' ? r.comments : JSON.stringify(r.comments)]
            : [],
      }));
      setRequirements(reqs);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requirements');
      console.error('Error fetching requirements:', err);
    }
  };

  const fetchSquads = async () => {
    try {
      const response = await fetch('/api/squads');
      const result = await response.json();
      if (result.success) setSquads(result.data || []);
    } catch {}
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
  const getWeightedScore = (requirement: RequirementWithComments) => {
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
    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  };
  const sortedRequirements = [...filteredRequirements].sort((a, b) => {
    if (sortBy === 'rank') {
      return sortOrder === 'asc' ? a.rank - b.rank : b.rank - a.rank;
    } else if (sortBy === 'score') {
      const aScore = getWeightedScore(a);
      const bScore = getWeightedScore(b);
      return sortOrder === 'asc' ? aScore - bScore : bScore - aScore;
    }
    return 0;
  });

  const handleSort = (field: 'rank' | 'score') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleRankInputChange = (key: string, value: string) => {
    // Allow empty string for editing
    setEditingRank(prev => ({ ...prev, [key]: value }));
    setRankError(prev => ({ ...prev, [key]: '' }));
  };

  const handleRankSave = async (key: string) => {
    const value = editingRank[key];
    if (value === undefined || value === null || value === '') {
      setRankError(prev => ({ ...prev, [key]: 'Rank is required' }));
      return;
    }
    const rankValue = parseInt(value);
    if (isNaN(rankValue) || rankValue < 0 || !Number.isInteger(rankValue)) {
      setRankError(prev => ({ ...prev, [key]: 'Rank must be a non-negative whole number' }));
      return;
    }
    // If rank is 999, skip duplicate check and renumbering
    if (rankValue === 999) {
      await doRankSave(key, value, false);
      return;
    }
    // Check for duplicate rank (exclude 999s)
    // const duplicate = requirements.some(r => r.key !== key && r.rank === rankValue && r.rank !== 999);
    // if (duplicate) {
    //   setConfirmDialog({ open: true, key, newRank: value });
    //   return;
    // }
    await doRankSave(key, value, false);
  };

  const doRankSave = async (key: string, value: string, fixRanksAfter = false) => {
    try {
      const rankValue = parseInt(value);
      const oldRank = requirements.find(r => r.key === key)?.rank;
      const response = await fetch(`https://requirement-prioritizer.onrender.com/api/requirements/${key}/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rank: rankValue }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to update rank');
      console.log('Rank updated for', key, 'to', rankValue);
      if (fixRanksAfter && rankValue !== 999) {
        await fetch('https://requirement-prioritizer.onrender.com/api/requirements/fix-ranks', { method: 'POST' });
      }
      setRequirements(prev =>
        prev.map(r =>
          r.key === key ? { ...r, rank: rankValue } : r
        )
      );
      setEditingRank(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      setRankError(prev => ({ ...prev, [key]: '' }));
      setError('');
      setSuccess(`'${key}' rank was updated from ${oldRank} to ${rankValue}`);
      setTimeout(() => setSuccess(''), 2500);
      // Do not auto-sort by rank after saving
      setTimeout(fetchRequirements, 1500);
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
          'Rough Estimate': req.roughEstimate ? parseFloat(req.roughEstimate) : 0,
          'Related Customers': req.relatedCustomers || '',
          'Stack Rank': typeof req.rank === 'number' ? req.rank : (parseFloat(req.rank) || 0),
          'Overall Score': parseFloat(getWeightedScore(req).toFixed(2)),
          'Product Owner': req.productOwner || '',
        };
        // Add criteria scores as numbers
        criteria.forEach(criterion => {
          row[`${criterion.name} Score`] = req.criteria?.[criterion.id] !== undefined ? Number(req.criteria[criterion.id]) : 0;
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

  // Compute scored, ranked, and duplicate metrics
  const scoredCount = requirements.filter(r => typeof r.score === 'number' && !isNaN(r.score)).length;
  const rankedCount = requirements.filter(r => {
    const rankNum = typeof r.rank === 'string' ? parseFloat(r.rank) : r.rank;
    return typeof rankNum === 'number' && !isNaN(rankNum) && rankNum > 0;
  }).length;
  const totalCount = requirements.length;
  const rankMap: { [rank: number]: RequirementWithComments[] } = {};
  requirements.forEach(r => {
    if (r.rank > 0 && r.rank !== 999) {
      if (!rankMap[r.rank]) rankMap[r.rank] = [];
      rankMap[r.rank].push(r);
    }
  });
  const duplicateRanks = Object.values(rankMap).filter(arr => arr.length > 1).flat();
  const roughEstimateCount = requirements.filter(r => r.roughEstimate && r.roughEstimate.trim() !== '').length;
  const inPlanCount = requirements.filter(r => r.inPlan).length;

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
          onDuplicateClick={() => setDuplicateDialog(true)}
        />
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Stack Rank Requirements
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between" mb={2}>
          <TextField
            label="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <Tooltip title="Export requirements with scores and ranks to Excel">
            <Button
              variant="contained"
              color="success"
              startIcon={<FileDownload />}
              onClick={handleExportToExcel}
              sx={{ fontWeight: 700, borderRadius: 2 }}
            >
              Export to Excel
            </Button>
          </Tooltip>
        </Stack>
        <Divider sx={{ mb: 2 }} />
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>
        )}
        <TableContainer sx={{ maxHeight: 500, overflow: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: 0, top: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Requirement
                    <Tooltip title="Show Duplicate Ranks">
                      <IconButton size="small" onClick={() => setDuplicateDialog(true)}>
                        <InfoOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}>
                  <Button onClick={() => handleSort('rank')} sx={{ fontWeight: 700, textTransform: 'none' }}>
                    Rank
                  </Button>
                </TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Button onClick={() => handleSort('score')} sx={{ fontWeight: 700, textTransform: 'none' }}>
                      Score
                    </Button>
                    <Tooltip title="Weighted score based on criteria">
                      <Info sx={{ fontSize: 18, ml: 0.5, color: 'text.secondary' }} />
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}>Comments</TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRequirements.map((requirement, index) => (
                <TableRow key={requirement.key} hover>
                  <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700 }}>{index + 1}</TableCell>
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
                  <TableCell>
                    <TextField
                      type="number"
                      value={editingRank[requirement.key] !== undefined ? editingRank[requirement.key] : requirement.rank}
                      onChange={e => handleRankInputChange(requirement.key, e.target.value)}
                      onBlur={() => handleRankSave(requirement.key)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRankSave(requirement.key); }}
                      error={!!rankError[requirement.key]}
                      helperText={rankError[requirement.key]}
                      size="small"
                      inputProps={{ min: 0, step: 1, style: { width: '60px' } }}
                      sx={success && success.includes(requirement.key) ? { border: '2px solid #4caf50', borderRadius: 1 } : {}}
                      InputProps={{
                        endAdornment: (
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleRankSave(requirement.key)}
                          >
                            <SaveIcon fontSize="small" />
                          </IconButton>
                        )
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {/* Recalculate score using current criteria and weights */}
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
                      return totalWeight > 0 ? (totalWeightedScore / totalWeight).toFixed(2) : '0.00';
                    })()}
                  </TableCell>
                  <TableCell>
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
                      {/* Group comments by save date (use today as group header for new saves) */}
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
                  </TableCell>
                  <TableCell>
                    <IconButton
                      color="primary"
                      size="small"
                      onClick={() => setHistoryDialog({ open: true, log: requirement.updatehistory || 'No history.' })}
                      sx={{ mr: 1 }}
                    >
                      <HistoryIcon />
                    </IconButton>
                    <IconButton color="error" size="small" onClick={() => handleDelete(requirement.key)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      {selectedRequirement && (
        <Dialog open={!!selectedRequirement} onClose={() => setSelectedRequirement(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 2 } }}>
          <DialogTitle sx={{ fontWeight: 700, fontSize: 24 }}>
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
              {/* Criteria scores section */}
              {criteria.length > 0 && (
                <ListItem alignItems="flex-start">
                  <ListItemText
                    primary="Scores by Criteria"
                    secondary={
                      <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                        {criteria.map(c => (
                          <li key={c.id}>
                            <strong>{c.name}:</strong> {selectedRequirement.criteria?.[c.id] ?? 'N/A'}
                          </li>
                        ))}
                      </Box>
                    }
                  />
                </ListItem>
              )}
              {/* End criteria scores section */}
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
            <Button onClick={() => setSelectedRequirement(null)} sx={{ fontWeight: 700, borderRadius: 2 }}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
      <Dialog open={historyDialog.open} onClose={() => setHistoryDialog({ open: false, log: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>Rank Change Log</DialogTitle>
        <DialogContent>
          <Box sx={{ whiteSpace: 'pre-line', fontFamily: 'monospace', fontSize: 15 }}>
            {historyDialog.log}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog({ open: false, log: '' })}>Close</Button>
        </DialogActions>
      </Dialog>
      {/* Duplicate Ranks Dialog */}
      <Dialog open={duplicateDialog} onClose={() => setDuplicateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Duplicate Ranks</DialogTitle>
        <DialogContent>
          {duplicateRanks.length === 0 ? (
            <Typography>No duplicate ranks found.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Key</TableCell>
                  <TableCell>Summary</TableCell>
                  <TableCell>Rank</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.values(rankMap).filter(arr => arr.length > 1).flat().map(r => (
                  <TableRow key={r.key}>
                    <TableCell>{r.key}</TableCell>
                    <TableCell>{r.summary}</TableCell>
                    <TableCell>{r.rank}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}; 