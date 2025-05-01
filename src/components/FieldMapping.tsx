import React, { useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Grid,
  Typography,
  Paper,
  Stack,
} from '@mui/material';

interface FieldMappingProps {
  availableColumns: string[];
  selectedColumns: { [key: string]: string };
  onMappingChange: (field: string, value: string) => void;
  requiredFields: string[];
}

const FieldMapping: React.FC<FieldMappingProps> = ({
  availableColumns,
  selectedColumns,
  onMappingChange,
  requiredFields,
}) => {
  const fields = [
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

  // Auto-map fields when availableColumns change
  useEffect(() => {
    const autoMap = () => {
      const newMapping: { [key: string]: string } = {};
      
      fields.forEach(({ key, label }) => {
        // Skip if already mapped
        if (selectedColumns[key]) return;

        // Try different variations of the field name
        const variations = [
          key,
          label,
          key.toLowerCase(),
          label.toLowerCase(),
          key.toUpperCase(),
          label.toUpperCase(),
          // Handle special cases
          key === 'timeSpent' ? 'Time Spent' : '',
          key === 'roughEstimate' ? 'Rough Estimate' : '',
          key === 'relatedCustomers' ? 'Related Customer(s)' : '',
        ].filter(Boolean);

        // Find first matching column
        const matchedColumn = availableColumns.find(column =>
          variations.some(v => column.toLowerCase() === v.toLowerCase())
        );

        if (matchedColumn) {
          newMapping[key] = matchedColumn;
        }
      });

      // Update only if we found any matches
      if (Object.keys(newMapping).length > 0) {
        Object.entries(newMapping).forEach(([key, value]) => {
          onMappingChange(key, value);
        });
      }
    };

    autoMap();
  }, [availableColumns, fields, onMappingChange, selectedColumns]);

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 2, background: '#f8fafc' }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
        Map Excel Columns to Fields
      </Typography>
      <Grid container spacing={3}>
        {/* Group 1: Core Fields */}
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}>
            Core Fields
          </Typography>
          <Stack spacing={2}>
            {["key", "summary", "priority", "status", "assignee"].map((key) => {
              const field = fields.find(f => f.key === key)!;
              return (
                <FormControl
                  key={key}
                  fullWidth
                  required={requiredFields.includes(key)}
                  error={requiredFields.includes(key) && !selectedColumns[key]}
                  size="small"
                >
                  <InputLabel id={`${key}-label`}>{field.label}</InputLabel>
                  <Select
                    labelId={`${key}-label`}
                    value={selectedColumns[key] || ''}
                    label={field.label}
                    onChange={(e) => onMappingChange(key, e.target.value)}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {availableColumns.map((column) => (
                      <MenuItem key={column} value={column}>
                        {column}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            })}
          </Stack>
        </Grid>
        {/* Group 2: Additional Fields */}
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary', fontWeight: 600 }}>
            Additional Fields
          </Typography>
          <Stack spacing={2}>
            {["timeSpent", "labels", "roughEstimate", "relatedCustomers", "prioritization", "weight"].map((key) => {
              const field = fields.find(f => f.key === key)!;
              return (
                <FormControl
                  key={key}
                  fullWidth
                  required={requiredFields.includes(key)}
                  error={requiredFields.includes(key) && !selectedColumns[key]}
                  size="small"
                >
                  <InputLabel id={`${key}-label`}>{field.label}</InputLabel>
                  <Select
                    labelId={`${key}-label`}
                    value={selectedColumns[key] || ''}
                    label={field.label}
                    onChange={(e) => onMappingChange(key, e.target.value)}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {availableColumns.map((column) => (
                      <MenuItem key={column} value={column}>
                        {column}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            })}
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default FieldMapping; 