import React, { useEffect, useState } from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Grid,
  Typography,
  Paper,
  TextField,
  Stack,
} from '@mui/material';

interface FieldMappingProps {
  availableColumns: string[];
  selectedColumns: { [key: string]: string };
  onMappingChange: (excelCol: string, value: string) => void;
  requiredFields: string[];
}

const knownFields = [
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'timeSpent', label: 'Time Spent' },
  { key: 'labels', label: 'Labels' },
  { key: 'roughEstimate', label: 'Rough Estimate' },
  { key: 'relatedCustomers', label: 'Related Customer(s)' },
  { key: 'prioritization', label: 'Prioritization' },
  { key: 'weight', label: 'Weight' },
];

const FieldMapping: React.FC<FieldMappingProps> = ({
  availableColumns,
  selectedColumns,
  onMappingChange,
  requiredFields,
}) => {
  const [dbColumns, setDbColumns] = useState<string[]>([]);

  useEffect(() => {
    // Fetch columns from backend
    fetch('https://requirement-prioritizer.onrender.com/api/requirements/columns', {
      method: 'POST',
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.columns)) {
          setDbColumns(data.columns.map((c: string) => c.trim()));
        }
      })
      .catch(() => {});
  }, []);

  // Merge known fields and db columns for dropdown
  const allFieldOptions = Array.from(
    new Set([
      ...knownFields.map(f => f.key),
      ...dbColumns.filter(c => !knownFields.some(f => f.key === c)),
    ])
  );

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 2, background: '#f8fafc' }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
        Map Excel Columns to Fields
      </Typography>
      <Grid container spacing={3}>
        {availableColumns.map((excelCol) => (
          <Grid item xs={12} md={6} key={excelCol}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Excel Column: {excelCol}
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel id={`${excelCol}-label`}>Map to Field</InputLabel>
                <Select
                  labelId={`${excelCol}-label`}
                  value={selectedColumns[excelCol.toLowerCase()] || ''}
                  label="Map to Field"
                  onChange={e => onMappingChange(excelCol.toLowerCase(), e.target.value)}
                  renderValue={val => val || 'Select or enter new field'}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {allFieldOptions.map((key) => (
                    <MenuItem key={key} value={key}>{knownFields.find(f => f.key === key)?.label || key}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {/* Allow entering a new field name if not in knownFields */}
              <TextField
                size="small"
                label="Or enter new field name"
                value={selectedColumns[excelCol.toLowerCase()] && !allFieldOptions.includes(selectedColumns[excelCol.toLowerCase()]) ? selectedColumns[excelCol.toLowerCase()] : ''}
                onChange={e => onMappingChange(excelCol.toLowerCase(), e.target.value)}
                placeholder="e.g. Product Manager"
                sx={{ mt: 1 }}
              />
            </Stack>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
};

export default FieldMapping; 