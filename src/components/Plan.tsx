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
} from '@mui/material';
import { ChatBubbleOutline as CommentIcon, ChatBubble } from '@mui/icons-material';

interface Requirement {
  key: string;
  summary: string;
  rank: number;
  score: number;
  roughEstimate?: string;
  inPlan?: boolean;
  minorReleaseCandidate?: boolean;
  teams?: string;
  comments?: string[];
}

const Plan: React.FC = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [editing, setEditing] = useState<{ [key: string]: Partial<Requirement> }>({});
  const [commentPopover, setCommentPopover] = useState<{ anchorEl: HTMLElement | null, key: string | null }>({ anchorEl: null, key: null });
  const [editingComment, setEditingComment] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchRequirements();
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
        inPlan: r.inPlan || false,
        minorReleaseCandidate: r.minorReleaseCandidate || false,
        teams: r.teams || '',
        comments: Array.isArray(r.comments)
          ? r.comments.map((c: any) => typeof c === 'string' ? c : (c.text || JSON.stringify(c)))
          : r.comments
            ? [typeof r.comments === 'string' ? r.comments : JSON.stringify(r.comments)]
            : [],
      })));
    } catch (err) {
      // handle error
    }
  };

  const handleEdit = (key: string, field: keyof Requirement, value: any) => {
    setEditing(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleCommentChange = (key: string, value: string) => {
    setEditingComment(prev => ({ ...prev, [key]: value }));
  };

  const handleCommentSave = (key: string) => {
    const newComment = editingComment[key]?.trim();
    if (!newComment) return;
    setRequirements(prev => prev.map(r =>
      r.key === key ? { ...r, comments: [...(r.comments || []), newComment] } : r
    ));
    setEditingComment(prev => ({ ...prev, [key]: '' }));
    setCommentPopover({ anchorEl: null, key: null });
  };

  return (
    <Stack spacing={4} sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Plan Requirements
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: 500, overflow: 'auto' }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: 0, top: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Requirement</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Rank</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Score</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Rough Estimate</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>In Plan?</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Minor Rel Candidate?</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Team(s)</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Comments</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requirements.map((r, idx) => (
                <TableRow key={r.key} hover>
                  <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', fontWeight: 700 }}>{idx + 1}</TableCell>
                  <TableCell>{r.summary}</TableCell>
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
                    <TextField
                      value={editing[r.key]?.teams ?? r.teams ?? ''}
                      onChange={e => handleEdit(r.key, 'teams', e.target.value)}
                      size="small"
                      placeholder="Team(s)"
                    />
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
                              <Typography key={idx} sx={{ fontSize: 12, mb: 0.5 }}>{comment}</Typography>
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
    </Stack>
  );
};

export default Plan; 