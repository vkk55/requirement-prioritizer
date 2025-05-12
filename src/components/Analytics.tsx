import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Card,
  Stack,
  Divider,
} from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ScaleOptions,
  ChartData,
  PieController,
  ArcElement,
} from 'chart.js';
import { Bar, Scatter, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  PieController,
  ArcElement
);

interface Requirement {
  key: string;
  summary: string;
  score?: number;
  rank?: number;
  criteria: Record<string, number>;
  customers?: string[];
  relatedCustomers?: string;
  status?: string;
  labels?: string[];
  priority?: string;
}

interface ScoreRange {
  min: number;
  max: number;
  count: number;
}

interface ScatterDataPoint {
  x: number;
  y: number;
}

interface ChartContainerProps {
  children: React.ReactNode;
  height?: number;
}

const ChartContainer: React.FC<ChartContainerProps> = ({ children, height = 400 }) => (
  <Paper 
    elevation={1} 
    sx={{ 
      p: 3, 
      bgcolor: '#fff',
      borderRadius: 1,
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
    }}
  >
    <Box sx={{ height }}>
      {children}
    </Box>
  </Paper>
);

const Analytics: React.FC = () => {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/requirements');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      
      // Extract requirements array from the nested response
      const requirementsData = result.data || [];
      
      if (!Array.isArray(requirementsData)) {
        throw new Error('Invalid data format: expected an array of requirements');
      }
      setRequirements(requirementsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch requirements');
      setRequirements([]);
    } finally {
      setLoading(false);
    }
  };

  // Defensive normalization: ensure every requirement has a relatedCustomers string
  const normalizedRequirements = useMemo(() => {
    return requirements.map(req => ({
      ...req,
      relatedCustomers: req.relatedCustomers || (req as any)['relatedcustomers'] || '',
    }));
  }, [requirements]);

  const distributionData = useMemo(() => {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return {
        labels: [],
        datasets: [{
          label: 'Weighted Scores',
          data: [],
          backgroundColor: 'rgba(135, 206, 250, 0.8)',
          borderColor: 'rgba(135, 206, 250, 0.8)',
          borderWidth: 1,
          barThickness: 20,
        }]
      };
    }

    const ranges: ScoreRange[] = Array.from({ length: 10 }, (_, i) => ({
      min: i * 10,
      max: (i + 1) * 10,
      count: 0
    }));

    requirements.forEach(req => {
      const scorePercentage = ((req.score ?? 0) * 100);
      const rangeIndex = Math.min(Math.floor(scorePercentage / 10), 9);
      ranges[rangeIndex].count++;
    });

    return {
      labels: ranges.map(r => `${r.min}-${r.max}%`),
      datasets: [{
        label: 'Weighted Scores',
        data: ranges.map(r => r.count),
        backgroundColor: 'rgba(135, 206, 250, 0.8)',
        borderColor: 'rgba(135, 206, 250, 0.8)',
        borderWidth: 1,
        barThickness: 20,
      }]
    };
  }, [requirements]);

  const criteriaData = useMemo(() => {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderWidth: 1,
        }]
      };
    }

    const criteriaCount: Record<string, number> = {};
    let totalCriteria = 0;

    requirements.forEach(req => {
      if (req.criteria) {
        Object.entries(req.criteria).forEach(([criterion, value]) => {
          if (value > 0) {
            criteriaCount[criterion] = (criteriaCount[criterion] || 0) + 1;
            totalCriteria++;
          }
        });
      }
    });

    const labels = Object.keys(criteriaCount);
    const data = labels.map(label => (criteriaCount[label] / requirements.length) * 100);

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [requirements]);

  const customerData = useMemo(() => {
    if (!Array.isArray(normalizedRequirements) || normalizedRequirements.length === 0) {
      return {
        labels: [],
        datasets: [{
          data: [],
          backgroundColor: [],
          borderWidth: 1,
        }]
      };
    }
    const customerCount: Record<string, number> = {};
    normalizedRequirements.forEach(req => {
      // Try both customers (array) and relatedCustomers (string)
      let customers: string[] = [];
      if (Array.isArray(req.customers)) {
        customers = req.customers;
      } else if (typeof req.relatedCustomers === 'string' && req.relatedCustomers.trim()) {
        customers = req.relatedCustomers.split(',').map(c => c.trim()).filter(Boolean);
      }
      customers.forEach(customer => {
        if (customer) {
          customerCount[customer] = (customerCount[customer] || 0) + 1;
        }
      });
    });
    const labels = Object.keys(customerCount);
    const data = labels.map(label => customerCount[label]);
    if (labels.length === 0) {
      console.warn('No customer data found in requirements. Check field mapping and import.');
    }
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(255, 159, 64, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(153, 102, 255, 0.8)',
          'rgba(255, 99, 132, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [normalizedRequirements]);

  const statusData = useMemo(() => {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }]
      };
    }
    const statusCount: Record<string, number> = {};
    requirements.forEach(req => {
      const status = req.status || 'Unknown';
      statusCount[status] = (statusCount[status] || 0) + 1;
    });
    const labels = Object.keys(statusCount);
    const data = labels.map(label => statusCount[label]);
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(255, 205, 86, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [requirements]);

  const labelData = useMemo(() => {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }]
      };
    }
    const labelCount: Record<string, number> = {};
    requirements.forEach(req => {
      let labels: string[] = [];
      if (Array.isArray(req.labels)) {
        labels = req.labels as string[];
      } else if (typeof req.labels === 'string' && req.labels && String.prototype.trim.call(req.labels)) {
        labels = (req.labels as string).split(',').map((l: string) => l.trim()).filter(Boolean);
      }
      labels.forEach(label => {
        if (label) {
          labelCount[label] = (labelCount[label] || 0) + 1;
        }
      });
    });
    const labels = Object.keys(labelCount);
    const data = labels.map(label => labelCount[label]);
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [requirements]);

  const pieChartOptions = useMemo<ChartOptions<'pie'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 15,
          padding: 15,
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed;
            return `${context.label}: ${value.toFixed(1)}%`;
          }
        }
      }
    }
  }), []);

  const distributionOptions = useMemo<ChartOptions<'bar'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: {
          boxWidth: 15,
          usePointStyle: true,
          padding: 10,
        }
      },
      title: {
        display: true,
        text: 'Requirement Score Distribution',
        align: 'start',
        padding: { bottom: 30 },
        font: {
          size: 14,
          weight: 'normal'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => typeof value === 'number' ? value.toFixed(1) : value
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
          drawTicks: false
        },
        border: {
          dash: [4, 4]
        }
      },
      x: {
        grid: {
          display: false
        },
        border: {
          dash: [4, 4]
        }
      }
    }
  }), []);

  const correlationOptions = useMemo<ChartOptions<'scatter'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Score vs Rank Correlation',
        align: 'start',
        padding: { bottom: 30 },
        font: {
          size: 14,
          weight: 'normal'
        }
      }
    },
    scales: {
      y: {
        reverse: true,
        ticks: {
          callback: (value) => typeof value === 'number' ? value.toFixed(1) : value
        }
      },
      x: {
        ticks: {
          callback: (value) => typeof value === 'number' ? value.toFixed(2) : value
        }
      }
    }
  }), []);

  const scoreRangeData = useMemo(() => {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }]
      };
    }
    const ranges = [
      { label: '1-2', min: 1, max: 2 },
      { label: '2-3', min: 2, max: 3 },
      { label: '3-4', min: 3, max: 4 },
      { label: '4-5', min: 4, max: 5.0001 }, // include 5 in last bucket
    ];
    const rangeCounts = [0, 0, 0, 0];
    requirements.forEach(req => {
      const score = typeof req.score === 'number' ? req.score : null;
      if (score !== null) {
        for (let i = 0; i < ranges.length; i++) {
          if (score >= ranges[i].min && score < ranges[i].max) {
            rangeCounts[i]++;
            break;
          }
        }
      }
    });
    return {
      labels: ranges.map(r => r.label),
      datasets: [{
        data: rangeCounts,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [requirements]);

  // --- Requirements by Priority Bar Chart ---
  const priorityData = useMemo(() => {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }]
      };
    }
    const priorityCount: Record<string, number> = {};
    requirements.forEach(req => {
      const priority = req.priority || 'Unknown';
      priorityCount[priority] = (priorityCount[priority] || 0) + 1;
    });
    const labels = Object.keys(priorityCount);
    const data = labels.map(label => priorityCount[label]);
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [requirements]);

  // --- Bar chart options for horizontal bar ---
  const horizontalBarOptions = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      x: { beginAtZero: true },
      y: { beginAtZero: true },
    },
  };

  // --- Bar chart options for vertical bar ---
  const verticalBarOptions = {
    indexAxis: 'x' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      x: { beginAtZero: true },
      y: { beginAtZero: true },
    },
  };

  // --- Requirements by Product Owner Bar Chart ---
  const productOwnerData = useMemo(() => {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return {
        labels: [],
        datasets: [{ data: [], backgroundColor: [], borderWidth: 1 }]
      };
    }
    const ownerCount: Record<string, number> = {};
    requirements.forEach(req => {
      const owner = (req as any).assignee || 'Unassigned';
      ownerCount[owner] = (ownerCount[owner] || 0) + 1;
    });
    const labels = Object.keys(ownerCount);
    const data = labels.map(label => ownerCount[label]);
    return {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
        borderWidth: 1,
      }]
    };
  }, [requirements]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={4} sx={{ p: { xs: 1, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        Analytics
      </Typography>
      <Divider sx={{ mb: 2 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
        <Card elevation={2} sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom align="center">
            Requirements by Criteria
          </Typography>
          <Box sx={{ maxWidth: 320, mx: 'auto', width: '100%' }}>
            <Pie data={criteriaData} options={pieChartOptions} />
          </Box>
        </Card>
        <Card elevation={2} sx={{ p: 2, borderRadius: 3, minHeight: 320 }}>
          <Typography variant="h6" gutterBottom align="center">
            Requirements by Customer
          </Typography>
          <Box sx={{ height: 260 }}>
            <Bar data={customerData} options={horizontalBarOptions} />
          </Box>
        </Card>
        <Card elevation={2} sx={{ p: 2, borderRadius: 3, minHeight: 320 }}>
          <Typography variant="h6" gutterBottom align="center">
            Requirements by Status
          </Typography>
          <Box sx={{ height: 260 }}>
            {Object.keys(statusData.labels).length > 5 ? (
              <Bar data={statusData} options={verticalBarOptions} />
            ) : (
              <Pie data={statusData} options={pieChartOptions} />
            )}
          </Box>
        </Card>
        <Card elevation={2} sx={{ p: 2, borderRadius: 3, minHeight: 320 }}>
          <Typography variant="h6" gutterBottom align="center">
            Requirements by Label
          </Typography>
          <Box sx={{ height: 260 }}>
            <Bar data={labelData} options={horizontalBarOptions} />
          </Box>
        </Card>
        <Card elevation={2} sx={{ p: 2, borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom align="center">
            Requirements by Score Range
          </Typography>
          <Box sx={{ maxWidth: 320, mx: 'auto', width: '100%' }}>
            <Pie data={scoreRangeData} options={pieChartOptions} />
          </Box>
        </Card>
        <Card elevation={2} sx={{ p: 2, borderRadius: 3, minHeight: 320 }}>
          <Typography variant="h6" gutterBottom align="center">
            Requirements by Priority
          </Typography>
          <Box sx={{ height: 260 }}>
            <Bar data={priorityData} options={verticalBarOptions} />
          </Box>
        </Card>
        {/* Product Owner Report */}
        <Card elevation={2} sx={{ p: 2, borderRadius: 3, minHeight: 320 }}>
          <Typography variant="h6" gutterBottom align="center">
            Requirements by Product Owner
          </Typography>
          <Box sx={{ height: 260 }}>
            <Bar data={productOwnerData} options={horizontalBarOptions} />
          </Box>
        </Card>
      </Box>
    </Stack>
  );
};

export default Analytics; 