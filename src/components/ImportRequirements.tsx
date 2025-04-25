import React, { useState } from 'react';
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
  CircularProgress
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

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Import Requirements
        </Typography>

        <Box sx={{ my: 3 }}>
          <Typography variant="h6" gutterBottom>
            Upload Excel File
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Please upload an Excel file (.xlsx or .xls) containing your requirements.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
          <Button
            variant="contained"
            component="label"
            startIcon={<UploadFile />}
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
        </Box>

        {availableColumns.length > 0 && (
          <FieldMapping
            availableColumns={availableColumns}
            selectedColumns={selectedColumns}
            onMappingChange={handleMappingChange}
            requiredFields={requiredFields}
          />
        )}

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="outlined"
            onClick={handlePreview}
            disabled={!file || !selectedColumns.key || isLoading}
          >
            Preview Changes
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleImport}
            disabled={!file || !fieldMapping.key || isLoading}
          >
            {isLoading ? 'Processing...' : 'Import Requirements'}
          </Button>
        </Box>

        {errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage}
          </Alert>
        )}

        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>Preview Changes</DialogTitle>
          <DialogContent>
            {previewData && (
              <Box>
                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Summary
                </Typography>
                <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
                  <Chip
                    icon={<Add />}
                    label={`${previewData.toBeInserted.length} to be inserted`}
                    color="success"
                  />
                  <Chip
                    icon={<Update />}
                    label={`${previewData.toBeUpdated.length} to be updated`}
                    color="primary"
                  />
                  {previewData.errors.length > 0 && (
                    <Chip
                      label={`${previewData.errors.length} errors`}
                      color="error"
                    />
                  )}
                </Box>

                {previewData.errors.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom color="error">
                      Errors
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Row</TableCell>
                            <TableCell>Error</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {previewData.errors.map((error, index) => (
                            <TableRow key={index}>
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
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Key</TableCell>
                          <TableCell>Summary</TableCell>
                          <TableCell>Operation</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[...previewData.toBeInserted, ...previewData.toBeUpdated]
                          .map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.key}</TableCell>
                              <TableCell>{item.summary}</TableCell>
                              <TableCell>{item.operation}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleImport}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Import Requirements'}
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Container>
  );
};

export default ImportRequirements;
