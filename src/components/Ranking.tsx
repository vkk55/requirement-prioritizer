import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, List, ListItem, ListItemText, Dialog, DialogTitle, DialogContent, DialogActions, Button, Card, Stack, Divider } from '@mui/material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { supabase } from '../lib/supabaseClient';
import { Requirement } from '../types/types';
import type { DroppableProvided, DraggableProvided } from 'react-beautiful-dnd';

export const Ranking = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tieDialog, setTieDialog] = useState(false);
  const [tiedRequirement, setTiedRequirement] = useState<{current: Requirement; tied: Requirement} | null>(null);

  useEffect(() => {
    fetchRequirements();
  }, []);

  const fetchRequirements = async () => {
    const { data, error } = await supabase.from('requirements').select('*').order('weighted_score', { ascending: false });
    if (error) {
      console.error('Error fetching requirements:', error);
      return;
    }
    const sortedReqs = sortByWeightedScoreAndRank(data || []);
    setRequirements(sortedReqs);
  };

  const sortByWeightedScoreAndRank = (reqs: Requirement[]): Requirement[] => {
    return reqs.sort((a, b) => {
      if (a.weighted_score === b.weighted_score) {
        return (a.rank || 0) - (b.rank || 0);
      }
      return (b.weighted_score || 0) - (a.weighted_score || 0);
    });
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;
    const reorderedReqs = Array.from(requirements);
    const [movedReq] = reorderedReqs.splice(result.source.index, 1);
    reorderedReqs.splice(result.destination.index, 0, movedReq);
    const tiedReq = reorderedReqs.find((req, index) => index !== result.destination.index && req.weighted_score === movedReq.weighted_score);
    if (tiedReq) {
      setTiedRequirement({ current: movedReq, tied: tiedReq });
      setTieDialog(true);
      return;
    }
    await updateRanks(reorderedReqs);
  };

  const updateRanks = async (reorderedReqs: Requirement[]) => {
    const updates = reorderedReqs.map((req, index) => ({ id: req.id, rank: index + 1 }));
    for (const update of updates) {
      await supabase.from('requirements').update({ rank: update.rank }).eq('id', update.id);
    }
    setRequirements(reorderedReqs);
  };

  const handleTieResolution = async (putBefore: boolean) => {
    if (!tiedRequirement) return;
    const reorderedReqs = Array.from(requirements);
    const currentIndex = reorderedReqs.findIndex(req => req.id === tiedRequirement.current.id);
    const tiedIndex = reorderedReqs.findIndex(req => req.id === tiedRequirement.tied.id);
    const finalIndex = putBefore ? tiedIndex : tiedIndex + 1;
    reorderedReqs.splice(currentIndex, 1);
    reorderedReqs.splice(finalIndex, 0, tiedRequirement.current);
    await updateRanks(reorderedReqs);
    setTieDialog(false);
    setTiedRequirement(null);
  };

  return (
    <Stack spacing={4} sx={{ p: { xs: 1, sm: 3 }, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Stack Ranking
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Card elevation={2} sx={{ p: 3, borderRadius: 3 }}>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="requirements">
            {(provided: DroppableProvided) => (
              <List {...provided.droppableProps} ref={provided.innerRef}>
                {requirements.map((req, index) => (
                  <Draggable key={req.id} draggableId={req.id} index={index}>
                    {(provided: DraggableProvided) => (
                      <ListItem ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} sx={{ bgcolor: 'background.paper', mb: 1, borderRadius: 1 }}>
                        <ListItemText primary={req.title} secondary={`Weighted Score: ${req.weighted_score || 0}`} />
                      </ListItem>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </List>
            )}
          </Droppable>
        </DragDropContext>
      </Card>
      <Dialog open={tieDialog} onClose={() => setTieDialog(false)} PaperProps={{ sx: { borderRadius: 3, p: 2 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 20 }}>Resolve Tie</DialogTitle>
        <DialogContent>
          These requirements have the same weighted score. Where would you like to place the requirement?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => handleTieResolution(true)} sx={{ fontWeight: 700, borderRadius: 2 }}>Before Tied Requirement</Button>
          <Button onClick={() => handleTieResolution(false)} sx={{ fontWeight: 700, borderRadius: 2 }}>After Tied Requirement</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
