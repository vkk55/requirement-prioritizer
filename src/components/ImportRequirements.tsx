import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Box,
  Button,
  Typography,
  Alert,
  Paper,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Card,
  Stack,
  Divider,
  LinearProgress,
  TextField
} from '@mui/material';
import { UploadFile, Add, Update } from '@mui/icons-material';
import FieldMapping from './FieldMapping';

interface PreviewData {
  totalRows: number;
  toBeInserted: any[];
  toBeUpdated: any[];
  errors: { row: number; message: string }[];
}

interface ErrorData {
  message: string;
  row: number;
}

interface ImportResponse {
  success: boolean;
  message?: string;
  toBeInserted: PreviewData[];
  toBeUpdated: PreviewData[];
  errors: ErrorData[];
}

interface SelectedColumns {
  title: string;
  description: string;
  priority: string;
  status: string;
  assignee: string;
}

const ImportRequirements: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importResponse, setImportResponse] = useState<ImportResponse | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<{ [key: string]: string }>({});
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('key');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState('');

  const requiredFields = ['key'];

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Check file type
    if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
      setErrorMessage('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setFile(selectedFile);
    setErrorMessage('');
    setIsLoading(true);

    try {
      // Read file contents
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Get headers
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const headers: string[] = [];
      
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })];
        if (cell && cell.v) {
          headers.push(cell.v.toString());
        }
      }

      setAvailableColumns(headers);
    } catch (err) {
      setErrorMessage('Error reading file: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMappingChange = (field: string, value: string) => {
    setSelectedColumns(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePreview = async () => {
    if (!file) return;

    // Check required fields
    const missingFields = requiredFields.filter(field => !selectedColumns[field]);
    if (missingFields.length > 0) {
      setErrorMessage(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(selectedColumns));

      const previewResponse = await fetch('https://requirement-prioritizer.onrender.com/api/requirements/preview', {
        method: 'POST',
        body: formData,
      });

      if (!previewResponse.ok) {
        throw new Error(`HTTP error! status: ${previewResponse.status}`);
      }

      const data = await previewResponse.json();
      if (data.error) {
        throw new Error(data.message || 'Preview failed');
      }

      setPreviewData(data.preview);
      setPreviewOpen(true);
    } catch (err) {
      console.error('Preview error:', err);
      setErrorMessage('Error previewing data: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mapping', JSON.stringify(selectedColumns));

      const response = await fetch('https://requirement-prioritizer.onrender.com/api/requirements/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.message || 'Import failed');
      }

      // Reset state after successful import
      setFile(null);
      setAvailableColumns([]);
      setSelectedColumns({});
      setPreviewData(null);
      setPreviewOpen(false);
    } catch (err) {
      console.error('Import error:', err);
      setErrorMessage('Error importing data: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, []);

  const normalizeRequirement = (r: any) => ({
    ...r,
    timeSpent: r.timeSpent || r.timespent || '',
    roughEstimate: r.roughEstimate || r.roughestimate || '',
    relatedCustomers: r.relatedCustomers || r.relatedcustomers || '',
  });

  const fetchRequirements = async () => {
    setReqLoading(true);
    try {
      const response = await fetch('https://requirement-prioritizer.onrender.com/api/requirements');
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to fetch requirements');
      setRequirements((result.data || []).map(normalizeRequirement));
      setReqError('');
    } catch (err) {
      setReqError(err instanceof Error ? err.message : 'Failed to fetch requirements');
    } finally {
      setReqLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const filteredRequirements = requirements.filter(r => {
    return (
      r.key?.toLowerCase().includes(search.toLowerCase()) ||
      r.summary?.toLowerCase().includes(search.toLowerCase()) ||
      r.priority?.toLowerCase().includes(search.toLowerCase()) ||
      r.status?.toLowerCase().includes(search.toLowerCase()) ||
      r.assignee?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const sortedRequirements = [...filteredRequirements].sort((a, b) => {
    if (a[sortBy] === undefined || b[sortBy] === undefined) return 0;
    if (typeof a[sortBy] === 'number' && typeof b[sortBy] === 'number') {
      return sortOrder === 'asc' ? a[sortBy] - b[sortBy] : b[sortBy] - a[sortBy];
    }
    return sortOrder === 'asc'
      ? String(a[sortBy]).localeCompare(String(b[sortBy]))
      : String(b[sortBy]).localeCompare(String(a[sortBy]));
  });

  useEffect(() => {
    if (previewData) {
      // eslint-disable-next-line no-console
      console.log('DEBUG previewData:', previewData);
    }
  }, [previewData]);

  console.log('selectedColumns:', selectedColumns);

  return (
    <Container maxWidth="md">
      <Card elevation={3} sx={{ p: { xs: 2, sm: 4 }, mt: 6, borderRadius: 4 }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              Import Requirements
            </Typography>
            <Divider sx={{ mb: 3 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Upload Excel File
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Please upload an Excel file (.xlsx or .xls) containing your requirements.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={3}>
              <Button
                variant="contained"
                component="label"
                startIcon={<UploadFile />}
                sx={{ fontWeight: 700, borderRadius: 2 }}
              >
                Choose File
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                />
              </Button>
              {file && (
                <Typography variant="body2" color="text.secondary">
                  Selected file: {file.name}
                </Typography>
              )}
            </Stack>
            {availableColumns.length > 0 && (
              <FieldMapping
                availableColumns={availableColumns}
                selectedColumns={selectedColumns}
                onMappingChange={handleMappingChange}
                requiredFields={requiredFields}
              />
            )}
            <Stack direction="row" spacing={2} mt={3}>
              <Button
                variant="contained"
                color="primary"
                onClick={handlePreview}
                disabled={!file || !selectedColumns.key || isLoading}
                sx={{ fontWeight: 700, borderRadius: 2, px: 3 }}
              >
                {isLoading ? 'Processing...' : 'Preview and Import Requirements'}
              </Button>
            </Stack>
            {isLoading && <LinearProgress sx={{ mt: 2 }} />}
            {errorMessage && (
              <Alert severity="error" sx={{ mt: 2 }}>{errorMessage}</Alert>
            )}
          </Box>
          {previewData && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Requirements Preview
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {Object.keys({
                        key: '', summary: '', priority: '', status: '', assignee: '', timeSpent: '', labels: '', roughEstimate: '', relatedCustomers: '', prioritization: '', weight: '', operation: ''
                      }).map(field => (
                        <TableCell key={field}>{field.charAt(0).toUpperCase() + field.slice(1)}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.toBeInserted.map((item, idx) => (
                      <TableRow key={item.key + '-insert'} sx={{ backgroundColor: '#e8f5e9' }} hover>
                        {Object.keys({
                          key: '', summary: '', priority: '', status: '', assignee: '', timeSpent: '', labels: '', roughEstimate: '', relatedCustomers: '', prioritization: '', weight: '', operation: ''
                        }).map(field => (
                          <TableCell key={field}>{item[field] ?? ''}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {previewData.toBeUpdated.map((item, idx) => (
                      <TableRow key={item.key + '-update'} sx={{ backgroundColor: '#fffde7' }} hover>
                        {Object.keys({
                          key: '', summary: '', priority: '', status: '', assignee: '', timeSpent: '', labels: '', roughEstimate: '', relatedCustomers: '', prioritization: '', weight: '', operation: ''
                        }).map(field => (
                          <TableCell key={field}>{item.newValues ? item.newValues[field] ?? '' : item[field] ?? ''}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          <Dialog
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { borderRadius: 3, p: 2 } }}
          >
            <DialogTitle sx={{ fontWeight: 700, fontSize: 24 }}>Preview Changes</DialogTitle>
            <DialogContent>
              {previewData && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    Summary
                  </Typography>
                  <Stack direction="row" spacing={2} mb={3}>
                    <Chip
                      icon={<Add />}
                      label={`${previewData.toBeInserted.length} to be inserted`}
                      color="success"
                      sx={{ fontWeight: 700 }}
                    />
                    <Chip
                      icon={<Update />}
                      label={`${previewData.toBeUpdated.length} to be updated`}
                      color="primary"
                      sx={{ fontWeight: 700 }}
                    />
                    {previewData.errors.length > 0 && (
                      <Chip
                        label={`${previewData.errors.length} errors`}
                        color="error"
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                  </Stack>
                  {previewData.errors.length > 0 && (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom color="error">
                        Errors
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Row</TableCell>
                              <TableCell>Error</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {previewData.errors.map((error, index) => (
                              <TableRow key={index} hover>
                                <TableCell>{error.row}</TableCell>
                                <TableCell>{error.message}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                  {(previewData.toBeInserted.length > 0 || previewData.toBeUpdated.length > 0) && (
                    <Box sx={{ mt: 4 }}>
                      <Typography variant="h6" fontWeight={700} gutterBottom>
                        Requirements Preview
                      </Typography>
                      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              {Object.keys({
                                key: '', summary: '', priority: '', status: '', assignee: '', timeSpent: '', labels: '', roughEstimate: '', relatedCustomers: '', prioritization: '', weight: '', operation: ''
                              }).map(field => (
                                <TableCell key={field}>{field.charAt(0).toUpperCase() + field.slice(1)}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {previewData.toBeInserted.map((item, idx) => (
                              <TableRow key={item.key + '-insert'} sx={{ backgroundColor: '#e8f5e9' }} hover>
                                {Object.keys({
                                  key: '', summary: '', priority: '', status: '', assignee: '', timeSpent: '', labels: '', roughEstimate: '', relatedCustomers: '', prioritization: '', weight: '', operation: ''
                                }).map(field => (
                                  <TableCell key={field}>{item[field] ?? ''}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                            {previewData.toBeUpdated.map((item, idx) => (
                              <TableRow key={item.key + '-update'} sx={{ backgroundColor: '#fffde7' }} hover>
                                {Object.keys({
                                  key: '', summary: '', priority: '', status: '', assignee: '', timeSpent: '', labels: '', roughEstimate: '', relatedCustomers: '', prioritization: '', weight: '', operation: ''
                                }).map(field => (
                                  <TableCell key={field}>{item.newValues ? item.newValues[field] ?? '' : item[field] ?? ''}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPreviewOpen(false)} sx={{ fontWeight: 700, borderRadius: 2 }}>Close</Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleImport}
                disabled={isLoading}
                sx={{ fontWeight: 700, borderRadius: 2 }}
              >
                {isLoading ? 'Processing...' : 'Import Requirements'}
              </Button>
            </DialogActions>
          </Dialog>
          {/* Requirements Table Section */}
          <Divider sx={{ my: 6 }} />
          <Box>
            <Typography variant="h5" fontWeight={800} gutterBottom>
              All Requirements
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={2}>
              <TextField
                label="Search requirements"
                value={search}
                onChange={e => setSearch(e.target.value)}
                size="small"
                sx={{ minWidth: 220 }}
              />
            </Stack>
            {reqError && <Alert severity="error" sx={{ mb: 2 }}>{reqError}</Alert>}
            <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['key','summary','priority','status','assignee','timeSpent','labels','roughEstimate','relatedCustomers','prioritization','weight','score','rank'].map(field => (
                      <TableCell key={field} sortDirection={sortBy === field ? sortOrder : false}>
                        <Button onClick={() => handleSort(field)} sx={{ fontWeight: 700, textTransform: 'none' }}>
                          {field.charAt(0).toUpperCase() + field.slice(1)}
                        </Button>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reqLoading ? (
                    <TableRow><TableCell colSpan={13}><LinearProgress /></TableCell></TableRow>
                  ) : (
                    sortedRequirements.map((r, idx) => (
                      <TableRow key={r.key || idx} hover>
                        <TableCell>{r.key}</TableCell>
                        <TableCell>{r.summary}</TableCell>
                        <TableCell>{r.priority}</TableCell>
                        <TableCell>{r.status}</TableCell>
                        <TableCell>{r.assignee}</TableCell>
                        <TableCell>{r.timeSpent}</TableCell>
                        <TableCell>{r.labels}</TableCell>
                        <TableCell>{r.roughEstimate}</TableCell>
                        <TableCell>{r.relatedCustomers}</TableCell>
                        <TableCell>{r.prioritization}</TableCell>
                        <TableCell>{r.weight}</TableCell>
                        <TableCell>{r.score}</TableCell>
                        <TableCell>{r.rank}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Stack>
      </Card>
    </Container>
  );
};

export default ImportRequirements;
