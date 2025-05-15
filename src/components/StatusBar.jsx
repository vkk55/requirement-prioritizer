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
      position: 'fixed',
      top: 64, // below app bar
      left: 0,
      width: '100vw',
      zIndex: 1300,
      bgcolor: 'rgba(230, 242, 255, 0.95)', // subtle blue, slightly transparent
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      borderRadius: 0,
      px: { xs: 1, sm: 3 },
      py: 1.5,
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