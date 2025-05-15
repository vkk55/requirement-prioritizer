import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { InfoOutlined } from '@mui/icons-material';

const StatusBar = ({
  scoredCount,
  rankedCount,
  totalCount,
  duplicateRanksCount,
  onDuplicateClick
}) => (
  <Box
    sx={{
      position: 'sticky',
      top: 64, // below app bar
      zIndex: 1200,
      bgcolor: 'background.paper',
      boxShadow: 1,
      borderRadius: 2,
      px: 3,
      py: 1.5,
      mb: 2,
      display: 'flex',
      gap: 4,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 56,
    }}
  >
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
      Scored: {scoredCount} / {totalCount}
    </Typography>
    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
      Ranked: {rankedCount} / {totalCount}
    </Typography>
    <Typography
      variant="subtitle1"
      sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
      onClick={onDuplicateClick}
    >
      Duplicate Ranks: {duplicateRanksCount}
      <IconButton size="small" sx={{ ml: 0.5 }}>
        <InfoOutlined fontSize="small" />
      </IconButton>
    </Typography>
  </Box>
);

export default StatusBar; 