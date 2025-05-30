import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';

const StatusBar = ({
  scoredCount,
  rankedCount,
  totalCount,
  capacityString,
  roughEstimateCount = 0,
  roughEstimateTotal = 0,
  inPlanCount = 0,
  inPlanTotal = 0,
  onDuplicateClick
}) => (
  <Box
    sx={{
      position: 'sticky',
      top: 0,
      zIndex: 2,
      bgcolor: 'rgba(230, 242, 255, 0.95)', // subtle blue, slightly transparent
      boxShadow: 1,
      borderRadius: 3,
      px: { xs: 1, sm: 3 },
      py: 1.5,
      mb: 2,
      display: 'flex',
      gap: 4,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 56,
      borderBottom: '1px solid #e3eaf2',
      transition: 'background 0.2s',
    }}
  >
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
      Scored: {scoredCount} / {totalCount}
    </Typography>
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
      Ranked: {rankedCount} / {totalCount}
    </Typography>
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
      Rough Estimate: {roughEstimateCount} / {roughEstimateTotal || totalCount}
    </Typography>
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
      In Plan: {inPlanCount} / {inPlanTotal || totalCount}
    </Typography>
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
      Capacity: {capacityString}
    </Typography>
  </Box>
);

export default StatusBar; 