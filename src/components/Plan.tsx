import React, { useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Checkbox,
  IconButton,
  Tooltip,
  Button,
  Paper,
  Snackbar,
  Alert,
  Box,
  Select,
  MenuItem,
} from '@mui/material';
import { ChatBubbleOutline as CommentIcon, ChatBubble, Visibility as VisibilityIcon, Info as InfoIcon } from '@mui/icons-material';
import StatusBar from './StatusBar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';

interface Requirement {
  key: string;
  summary: string;
  rank: number;
  score: number;
  roughEstimate?: string;
  inPlan?: boolean;
  minorReleaseCandidate?: boolean;
  squads?: string;
  comments?: string[];
}

interface Squad {
  id: string;
  name: string;
  capacity: number;
}

function cleanComment(comment: any) {
  try {
    let cleaned = comment;
    if (typeof cleaned === 'string') {
      cleaned = cleaned.replace(/^"+|"+$/g, ''); // Remove leading/trailing quotes
      cleaned = cleaned.replace(/\\/g, '\\'); // Unescape slashes
    }
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed)) return parsed.join(', ');
    return cleaned;
  } catch {
    return comment;
  }
}

const Plan: React.FC = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [editing, setEditing] = useState<{ [key: string]: Partial<Requirement> }>({});
  const [commentPopover, setCommentPopover] = useState<{ anchorEl: HTMLElement | null, key: string | null }>({ anchorEl: null, key: null });
  const [editingComment, setEditingComment] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'rank'|'score'|'roughEstimate'|'squads'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('asc');
  const [teamPopover, setTeamPopover] = useState<{ anchorEl: HTMLElement | null, key: string | null }>({ anchorEl: null, key: null });
  const [squads, setSquads] = useState<Squad[]>([]);
  const [teamReportOpen, setTeamReportOpen] = useState(false);
  const [capacityString, setCapacityString] = useState('');

  useEffect(() => {
    fetchRequirements();
    fetchSquads();
  }, []);

  const fetchRequirements = async () => {
    try {
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/requirements');
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to fetch requirements');
      setRequirements((result.data || []).map((r: any) => ({
        key: r.key,
        summary: r.summary,
        rank: r.rank,
        score: r.score,
        roughEstimate: r.roughestimate,
        inPlan: r["InPlan?"] ?? false,
        minorReleaseCandidate: r["MinorRelCandidate?"] ?? false,
        squads: r["Team(s)"] ?? '',
        comments: Array.isArray(r.comments)
          ? r.comments.map((c: any) => typeof c === 'string' ? c : (c.text || JSON.stringify(c)))
          : r.comments
            ? [typeof r.comments === 'string' ? r.comments : JSON.stringify(r.comments)]
            : [],
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requirements');
    }
  };

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

  const handleEdit = (key: string, field: keyof Requirement, value: any) => {
    setEditing(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleCommentChange = (key: string, value: string) => {
    setEditingComment(prev => ({ ...prev, [key]: value }));
  };

  const handleCommentSave = async (key: string) => {
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
      setRequirements(prev => prev.map(r => r.key === key ? { ...r, comments: updatedComments } : r));
      setEditingComment(prev => ({ ...prev, [key]: '' }));
      setCommentPopover({ anchorEl: null, key: null });
      setSuccess('Comment saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save comment');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Get all requirements that have been edited
      const editedRequirements = Object.entries(editing).map(([key, changes]) => {
        const original = requirements.find(r => r.key === key);
        // Map frontend fields to DB columns
        const mapped: any = {
          ...original,
          ...changes,
          key,
        };
        if ('inPlan' in mapped) {
          mapped['InPlan?'] = mapped.inPlan;
          delete mapped.inPlan;
        }
        if ('minorReleaseCandidate' in mapped) {
          mapped['MinorRelCandidate?'] = mapped.minorReleaseCandidate;
          delete mapped.minorReleaseCandidate;
        }
        if ('squads' in mapped) {
          mapped['Team(s)'] = mapped.squads;
          delete mapped.squads;
        }
        return mapped;
      });

      // Save each edited requirement
      for (const req of editedRequirements) {
        const response = await fetch('https://requirement-prioritizer.onrender.com/api/requirements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Failed to save requirement');
      }

      // Update local state
      setRequirements(prev => prev.map(r => {
        const changes = editing[r.key];
        return changes ? { ...r, ...changes } : r;
      }));
      setEditing({});
      setSuccess('Changes saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Compute counts for status bar
  const scoredCount = requirements.filter(r => typeof r.score === 'number' ? !isNaN(r.score) : !isNaN(parseFloat(r.score as any))).length;
  const roughEstimateCount = requirements.filter(r => r.roughEstimate && r.roughEstimate.trim() !== '').length;
  const inPlanCount = requirements.filter(r => r.inPlan).length;
  const rankedCount = requirements.filter(r => {
    const rankNum = typeof r.rank === 'string' ? parseFloat(r.rank) : r.rank;
    return typeof rankNum === 'number' && !isNaN(rankNum) && rankNum > 0;
  }).length;

  // Filter and sort requirements
  const filteredRequirements = requirements.filter(r =>
    r.key.toLowerCase().includes(search.toLowerCase()) ||
    (r.summary || '').toLowerCase().includes(search.toLowerCase())
  );
  const sortedRequirements = [...filteredRequirements].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'rank') cmp = (a.rank || 0) - (b.rank || 0);
    else if (sortBy === 'score') cmp = (a.score || 0) - (b.score || 0);
    else if (sortBy === 'roughEstimate') cmp = (a.roughEstimate || '').localeCompare(b.roughEstimate || '');
    else if (sortBy === 'squads') cmp = (a.squads || '').localeCompare(b.squads || '');
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  return (
    <Stack spacing={4} sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
        <StatusBar
          scoredCount={scoredCount}
          rankedCount={rankedCount}
          totalCount={requirements.length}
          capacityString={capacityString}
          roughEstimateCount={roughEstimateCount}
          roughEstimateTotal={requirements.length}
          inPlanCount={inPlanCount}
          inPlanTotal={requirements.length}
          onDuplicateClick={() => {}}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight={800}>
            Plan Requirements
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={saving || Object.keys(editing).length === 0}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Stack>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <TextField
            label="Search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
        </Box>
        <TableContainer component={Paper} sx={{ maxHeight: 500, overflow: 'auto' }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: 0, top: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', fontWeight: 700 }}>
                  Requirement
                  <br />
                  <span style={{ fontWeight: 400, fontSize: 12 }}>(Key + Summary)</span>
                </TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', fontWeight: 700 }}>
                  <Button onClick={() => {
                    setSortBy('rank');
                    setSortOrder(sortBy === 'rank' && sortOrder === 'asc' ? 'desc' : 'asc');
                  }} sx={{ fontWeight: 700, textTransform: 'none' }}>
                    Rank {sortBy === 'rank' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </Button>
                </TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', fontWeight: 700 }}>
                  <Button onClick={() => {
                    setSortBy('score');
                    setSortOrder(sortBy === 'score' && sortOrder === 'asc' ? 'desc' : 'asc');
                  }} sx={{ fontWeight: 700, textTransform: 'none' }}>
                    Score {sortBy === 'score' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </Button>
                </TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', fontWeight: 700 }}>
                  <Button onClick={() => {
                    setSortBy('roughEstimate');
                    setSortOrder(sortBy === 'roughEstimate' && sortOrder === 'asc' ? 'desc' : 'asc');
                  }} sx={{ fontWeight: 700, textTransform: 'none' }}>
                    Rough Estimate {sortBy === 'roughEstimate' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </Button>
                </TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', fontWeight: 700 }}>In Plan?</TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', fontWeight: 700 }}>Minor Rel Candidate?</TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', fontWeight: 700 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button onClick={() => {
                      setSortBy('squads');
                      setSortOrder(sortBy === 'squads' && sortOrder === 'asc' ? 'desc' : 'asc');
                    }} sx={{ fontWeight: 700, textTransform: 'none' }}>
                      Team(s) {sortBy === 'squads' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </Button>
                    <Tooltip title="Show Team Capacity Report">
                      <IconButton size="small" onClick={() => setTeamReportOpen(true)}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
                <TableCell sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', fontWeight: 700 }}>Comments</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRequirements.map((r, idx) => (
                <TableRow key={r.key} hover>
                  <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700 }}>{idx + 1}</TableCell>
                  <TableCell>{r.key} - {r.summary}</TableCell>
                  <TableCell>{r.rank}</TableCell>
                  <TableCell>{r.score?.toFixed(2) ?? ''}</TableCell>
                  <TableCell>{r.roughEstimate ?? ''}</TableCell>
                  <TableCell>
                    <Checkbox
                      checked={editing[r.key]?.inPlan ?? r.inPlan ?? false}
                      onChange={e => handleEdit(r.key, 'inPlan', e.target.checked)}
                      color="primary"
                    />
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={editing[r.key]?.minorReleaseCandidate ?? r.minorReleaseCandidate ?? false}
                      onChange={e => handleEdit(r.key, 'minorReleaseCandidate', e.target.checked)}
                      color="primary"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Select
                        value={editing[r.key]?.squads ?? r.squads ?? ''}
                        onChange={e => handleEdit(r.key, 'squads', e.target.value)}
                        size="small"
                        displayEmpty
                        sx={{ flex: 1, minWidth: 120 }}
                        renderValue={selected => selected || 'Select Team'}
                      >
                        <MenuItem value=""><em>None</em></MenuItem>
                        {squads.map(squad => (
                          <MenuItem key={squad.id} value={squad.name}>{squad.name}</MenuItem>
                        ))}
                      </Select>
                      <Tooltip title="View full team(s)">
                        <IconButton size="small" onClick={e => setTeamPopover({ anchorEl: e.currentTarget, key: r.key })}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    {teamPopover.anchorEl && teamPopover.key === r.key && (
                      <Paper sx={{ position: 'absolute', zIndex: 10, p: 2, minWidth: 200 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Team(s)</Typography>
                        <Typography sx={{ fontSize: 13 }}>{editing[r.key]?.squads ?? r.squads ?? ''}</Typography>
                        <Button onClick={() => setTeamPopover({ anchorEl: null, key: null })} sx={{ mt: 1 }}>Close</Button>
                      </Paper>
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={e => setCommentPopover({ anchorEl: e.currentTarget, key: r.key })}>
                      {(r.comments && r.comments.length > 0)
                        ? <ChatBubble fontSize="small" sx={{ color: 'success.main' }} />
                        : <CommentIcon fontSize="small" />}
                    </IconButton>
                    {/* Popover for comments */}
                    {commentPopover.anchorEl && commentPopover.key === r.key && (
                      <Paper sx={{ position: 'absolute', zIndex: 10, p: 2, minWidth: 300 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Comments</Typography>
                        {r.comments && r.comments.length > 0 && (
                          <>
                            {r.comments.map((comment, idx) => (
                              <Typography key={idx} sx={{ fontSize: 12, mb: 0.5 }}>{cleanComment(comment)}</Typography>
                            ))}
                          </>
                        )}
                        <TextField
                          value={editingComment[r.key] || ''}
                          onChange={e => handleCommentChange(r.key, e.target.value)}
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
                              handleCommentSave(r.key);
                            }
                          }}
                        />
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => handleCommentSave(r.key)}
                          sx={{ fontWeight: 700, borderRadius: 2, mt: 1 }}
                        >
                          Save
                        </Button>
                        <Button onClick={() => setCommentPopover({ anchorEl: null, key: null })} sx={{ ml: 1, mt: 1 }}>Close</Button>
                      </Paper>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert onClose={() => setError('')} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={3000} onClose={() => setSuccess('')}>
        <Alert onClose={() => setSuccess('')} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
      <Dialog open={teamReportOpen} onClose={() => setTeamReportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Team Capacity Report</DialogTitle>
        <DialogContent>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Team Name</TableCell>
                <TableCell>Total Capacity (Hrs)</TableCell>
                <TableCell>Allotted Capacity (Hrs)</TableCell>
                <TableCell>Remaining Capacity (Hrs)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {squads.map(squad => {
                const allotted = requirements.filter(r => (editing[r.key]?.inPlan ?? r.inPlan) && (editing[r.key]?.squads ?? r.squads) === squad.name)
                  .reduce((sum, r) => sum + parseFloat((editing[r.key]?.roughEstimate ?? r.roughEstimate ?? '0').toString()), 0);
                const remaining = (squad.capacity || 0) - allotted;
                return (
                  <TableRow key={squad.id}>
                    <TableCell>{squad.name}</TableCell>
                    <TableCell>{squad.capacity}</TableCell>
                    <TableCell>{allotted}</TableCell>
                    <TableCell>{remaining}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default Plan; 